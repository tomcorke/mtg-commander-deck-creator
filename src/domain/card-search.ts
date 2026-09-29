import type { DeckCard, ScryfallCard } from './card-model.ts'
import { toDeckCard } from './card-model.ts'
import { defaultFinish } from './printing.ts'
import { manualCardError } from './recommendation-scoring.ts'

export type SearchMatch = 'any' | 'need' | 'exclude'
export type CardSearchFilters = {
  name: string
  nameMatch: SearchMatch
  minimumManaValue: string
  maximumManaValue: string
  manaValueMatch: SearchMatch
  matches: Record<string, SearchMatch>
  rulesNeed: string
  rulesExclude: string
  filterIdentity: boolean
}

export const defaultCardSearchFilters: CardSearchFilters = {
  name: '',
  nameMatch: 'need',
  minimumManaValue: '',
  maximumManaValue: '',
  manaValueMatch: 'need',
  matches: {},
  rulesNeed: '',
  rulesExclude: '',
  filterIdentity: true,
}

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
  { label: 'Draw cards', query: 'otag:draw' },
  { label: 'Create tokens', query: 'o:/creat(e|es)[^.]* tokens?/' },
  { label: 'Gain life', query: 'otag:lifegain' },
] as const

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
    { label: 'Hybrid costs', symbol: '', query: 'mana:/\\{[2WUBRG]\\/[WUBRG](\\/P)?\\}/' },
    { label: 'Phyrexian costs', symbol: '{P}', query: 'mana:/\\{[^}]*\\/P\\}/' },
  ]
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
) {
  const range = manaValueTerms(filters)
  const manaOptions = cardSearchManaOptions(
    filters.filterIdentity ? commanderColours : ['W', 'U', 'B', 'R', 'G'],
  )
  const phrases = (value: string, match: SearchMatch) =>
    value
      .split(',')
      .map((phrase) => phrase.trim())
      .filter(Boolean)
      .map((phrase) => matchTerm(`o:${quoted(phrase)}`, match))
  const query = [
    'legal:commander',
    filters.filterIdentity ? `id<=${commanderColours.join('').toLowerCase() || 'c'}` : '',
    excludeUnreleased ? 'date<=today' : '',
    filters.name.trim() ? matchTerm(`name:${quoted(filters.name.trim())}`, filters.nameMatch) : '',
    range ? matchTerm(range, filters.manaValueMatch) : '',
    ...[...manaOptions, ...cardSearchKeywords].map(({ query, label }) =>
      matchTerm(query, filters.matches[label] ?? 'any'),
    ),
    ...phrases(filters.rulesNeed, 'need'),
    ...phrases(filters.rulesExclude, 'exclude'),
  ]
    .filter(Boolean)
    .join(' ')
  if (query.length > 1000) throw new Error('Too many search terms. Shorten the name or rules text.')
  return query
}

export function cardSearchError(
  card: ScryfallCard,
  usedNames: string[],
  commanderColours: string[],
) {
  if (card.legalities?.commander && card.legalities.commander !== 'legal')
    return 'Card is not legal in Commander.'
  return manualCardError(card, usedNames, commanderColours)
}

export function addCardSearchCards(
  cards: ScryfallCard[],
  deck: DeckCard[],
  sideboard: DeckCard[],
  commanderColours: string[],
) {
  const names = [...deck, ...sideboard].map(({ name }) => name)
  const additions = cards.map((card) => {
    const error = cardSearchError(card, names, commanderColours)
    if (error) throw new Error(`${card.name}: ${error}`)
    names.push(card.name)
    return { ...toDeckCard(card), finish: defaultFinish(card.finishes) }
  })
  const mainCount = Math.min(additions.length, Math.max(0, 100 - deck.length))
  return {
    deck: [...deck, ...additions.slice(0, mainCount)],
    sideboard: [...sideboard, ...additions.slice(mainCount)],
    mainCount,
    sideboardCount: additions.length - mainCount,
  }
}
