import type { DeckCard, ScryfallCard } from './card-model.ts'
import { toDeckCard } from './card-model.ts'
import { defaultFinish, foilTypeFor } from './printing.ts'
import { cardConstructionError } from './commander-construction.ts'
import { releasedBy } from './recommendation-sources.ts'
import { themeSearchTerm } from './commander-catalog.ts'
import { roleLabels } from './glossary.ts'

export type SearchMatch = 'any' | 'need' | 'exclude'
export type CardSearchFilters = {
  /** The simple search box: a card name or rules-text phrase. */
  text: string
  /** Limit results to cards matching the deck's theme or active sub-themes. */
  fitsTheme: boolean
  name: string
  nameMatch: SearchMatch
  typeLine: string
  typeLineMatch: SearchMatch
  minimumManaValue: string
  maximumManaValue: string
  manaValueMatch: SearchMatch
  matches: Record<string, SearchMatch>
  rulesNeed: string
  rulesExclude: string
  filterIdentity: boolean
}

export const defaultCardSearchFilters: CardSearchFilters = {
  text: '',
  fitsTheme: false,
  name: '',
  nameMatch: 'need',
  typeLine: '',
  typeLineMatch: 'need',
  minimumManaValue: '',
  maximumManaValue: '',
  manaValueMatch: 'need',
  matches: {},
  rulesNeed: '',
  rulesExclude: '',
  filterIdentity: true,
}

/** Commander popularity: Scryfall's EDHREC rank order. */
export const defaultCardSearchOrder = 'edhrec'

export const cardSearchKeywords = [
  { label: 'Lifelink', query: 'kw:lifelink' },
  { label: 'Trample', query: 'kw:trample' },
  { label: 'Flying', query: 'kw:flying' },
  { label: 'Haste', query: 'kw:haste' },
  { label: 'Vigilance', query: 'kw:vigilance' },
  { label: 'Deathtouch', query: 'kw:deathtouch' },
  { label: 'Reach', query: 'kw:reach' },
  { label: 'First strike', query: 'kw:"first strike"' },
  { label: 'Double strike', query: 'kw:"double strike"' },
  { label: 'Hexproof', query: 'kw:hexproof' },
  { label: 'Indestructible', query: 'kw:indestructible' },
  { label: 'Ward', query: 'kw:ward' },
  { label: 'Menace', query: 'kw:menace' },
  { label: 'Flash', query: 'kw:flash' },
  { label: '+1/+1 counters', query: 'o:"+1/+1 counter"' },
  { label: '-1/-1 counters', query: 'o:"-1/-1 counter"' },
  { label: 'Counter spells', query: 'otag:counterspell' },
  { label: 'Sacrifice', query: 'o:sacrifice' },
  { label: 'ETB triggers', query: 'o:/(when|whenever)[^.]* enters/' },
  { label: 'Create tokens', query: 'o:/creat(e|es)[^.]* tokens?/' },
  { label: 'Gain life', query: 'otag:lifegain' },
] as const

// Scryfall Tagger tags for each deck-need role; recommendations re-check results with rolesForCard.
export type SearchRole = 'ramp' | 'draw' | 'removal' | 'wipes'
export const roleSearchTags: Record<string, string> & Record<SearchRole, string> = {
  ramp: 'otag:ramp',
  draw: 'otag:draw',
  removal: 'otag:removal',
  wipes: 'otag:sweeper',
}

export function cardSearchManaOptions(colours: string[]) {
  return [
    ...['W', 'U', 'B', 'R', 'G']
      .filter((colour) => colours.includes(colour))
      .map((colour) => ({
        label: colour,
        symbol: `{${colour}}`,
        query: `mana:/\\{[^}]*${colour}[^}]*\\}/`,
      })),
    { label: 'Colourless cards', symbol: '{C}', query: 'c:c' },
    { label: 'X costs', symbol: '{X}', query: 'mana:{X}' },
    { label: 'Colourless payment', symbol: '{C}', query: 'mana:{C}' },
    { label: 'Hybrid costs', symbol: '', query: 'mana:/\\{[2WUBRGC]\\/[WUBRGC](\\/P)?\\}/' },
    { label: 'Phyrexian costs', symbol: '{H}', query: 'mana:/\\{[^}]*\\/P\\}/' },
  ]
}

/** Deck themes that have a Scryfall search term, so "Fits my theme" can filter by them. */
export function searchableThemes(themes: string[]) {
  return [...new Set(themes.filter((theme) => theme && themeSearchTerm(theme)))]
}

function themeTerm(themes: string[]) {
  const terms = [...new Set(searchableThemes(themes).map((theme) => themeSearchTerm(theme)!))]
  return terms.length ? `(${terms.map((term) => `(${term})`).join(' or ')})` : ''
}

const quoted = (value: string) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
const matchTerm = (query: string, match: SearchMatch) =>
  match === 'any' ? '' : match === 'exclude' ? `-(${query})` : query

function manaValueTerms(filters: CardSearchFilters) {
  const bounds = [filters.minimumManaValue, filters.maximumManaValue]
  for (const value of bounds) {
    if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))
      throw new Error('Mana values must be non-negative numbers.')
  }
  const [minimum, maximum] = bounds.map((value) => (value.trim() ? Number(value) : null))
  if (minimum !== null && maximum !== null && minimum > maximum)
    throw new Error('Minimum mana value must not exceed maximum mana value.')
  return [minimum !== null ? `mv>=${minimum}` : '', maximum !== null ? `mv<=${maximum}` : '']
    .filter(Boolean)
    .join(' ')
}

export function buildCardSearchQuery(
  filters: CardSearchFilters,
  commanderColours: string[],
  excludeUnreleased: boolean,
  today?: string,
  themes: string[] = [],
) {
  const range = manaValueTerms(filters)
  const manaOptions = cardSearchManaOptions(
    filters.filterIdentity ? commanderColours : ['W', 'U', 'B', 'R', 'G'],
  )
  const phrases = (field: 't' | 'o', value: string, match: SearchMatch) =>
    value
      .split(',')
      .map((phrase) => phrase.trim())
      .filter(Boolean)
      .map((phrase) => matchTerm(`${field}:${quoted(phrase)}`, match))
  const query = [
    'legal:commander',
    filters.filterIdentity ? `id<=${commanderColours.join('').toLowerCase() || 'c'}` : '',
    excludeUnreleased ? releasedBy(today) : '',
    filters.text.trim()
      ? `(name:${quoted(filters.text.trim())} or o:${quoted(filters.text.trim())})`
      : '',
    filters.fitsTheme ? themeTerm(themes) : '',
    filters.name.trim() ? matchTerm(`name:${quoted(filters.name.trim())}`, filters.nameMatch) : '',
    ...phrases('t', filters.typeLine, filters.typeLineMatch),
    range ? matchTerm(range, filters.manaValueMatch) : '',
    ...[...manaOptions, ...cardSearchKeywords].map(({ query, label }) =>
      matchTerm(query, filters.matches[label] ?? 'any'),
    ),
    // Role keys are lowercase, so they never collide with capitalised keyword labels.
    ...Object.entries(roleSearchTags).map(([role, query]) =>
      matchTerm(query, filters.matches[role] ?? 'any'),
    ),
    ...phrases('o', filters.rulesNeed, 'need'),
    ...phrases('o', filters.rulesExclude, 'exclude'),
  ]
    .filter(Boolean)
    .join(' ')
  if (query.length > 1000)
    throw new Error('Too many search terms. Shorten the name, types, or rules text.')
  return query
}

/**
 * Filters set under "Advanced filters". A required deck role belongs to the deck-needs list, so
 * only an excluded role counts here.
 */
export function advancedFilterCount(filters: CardSearchFilters) {
  const text = (value: string, match: SearchMatch) => Boolean(value.trim()) && match !== 'any'
  return [
    text(filters.name, filters.nameMatch),
    text(filters.typeLine, filters.typeLineMatch),
    Boolean(filters.rulesNeed.trim()),
    Boolean(filters.rulesExclude.trim()),
    text(filters.minimumManaValue + filters.maximumManaValue, filters.manaValueMatch),
    !filters.filterIdentity,
    ...Object.entries(filters.matches).map(
      ([label, match]) => match === 'exclude' || (match === 'need' && !(label in roleSearchTags)),
    ),
  ].filter(Boolean).length
}

/**
 * The search shown when the page opens: the deck need furthest below its target, else the deck's
 * theme, else every card in the commander's colours. Results sort by commander popularity.
 */
export function startingCardSearch(
  counts: Record<SearchRole, number>,
  targets: Record<SearchRole, number>,
  themes: string[],
) {
  const [role] = (Object.keys(roleSearchTags) as SearchRole[])
    .map((key) => ({ key, gap: targets[key] - counts[key] }))
    .filter(({ gap }) => gap > 0)
    .sort((a, b) => b.gap - a.gap)
  if (role)
    return {
      filters: { ...defaultCardSearchFilters, matches: { [role.key]: 'need' as const } },
      label: `Showing your deck's biggest need, ${roleLabels[role.key]} (${counts[role.key]}/${targets[role.key]}), most popular first.`,
    }
  const fitting = searchableThemes(themes)
  if (fitting.length)
    return {
      filters: { ...defaultCardSearchFilters, fitsTheme: true },
      label: `Showing cards that fit your theme (${fitting.join(', ')}), most popular first.`,
    }
  return {
    filters: defaultCardSearchFilters,
    label: "Showing cards in your commander's colour identity, most popular first.",
  }
}

export function cardSearchError(card: ScryfallCard, deck: DeckCard[], commanderColours: string[]) {
  return cardConstructionError(toDeckCard(card), deck, commanderColours)
}

export function addCardSearchCards(
  cards: ScryfallCard[],
  deck: DeckCard[],
  sideboard: DeckCard[],
  commanderColours: string[],
  mainLimit = 100,
) {
  const additions: DeckCard[] = []
  for (const card of cards) {
    const target = deck.length + additions.length < mainLimit ? deck : sideboard
    const pending = additions.slice(target === deck ? 0 : Math.max(0, mainLimit - deck.length))
    const error = cardSearchError(card, [...target, ...pending], commanderColours)
    if (error) throw new Error(`${card.name}: ${error}`)
    additions.push({
      ...toDeckCard(card),
      finish: defaultFinish(card.finishes),
      foilType: foilTypeFor(card, defaultFinish(card.finishes)),
    })
  }
  const mainCount = Math.min(additions.length, Math.max(0, mainLimit - deck.length))
  return {
    deck: [...deck, ...additions.slice(0, mainCount)],
    sideboard: [...sideboard, ...additions.slice(mainCount)],
    mainCount,
    sideboardCount: additions.length - mainCount,
  }
}
