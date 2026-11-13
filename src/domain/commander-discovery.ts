import {
  fetchScryfallCardsByIdentifiers,
  searchScryfallCached,
  searchScryfallPageCached,
  type CardListResponse,
} from '../adapters/scryfall.ts'
import { themeCommanders, themeSearchTerm } from './commander-catalog.ts'
import { creatureTypeForTheme, creatureTypeTags } from './creature-types.ts'
import { commanderConstructionError } from './commander-construction.ts'
import { partnerSearchScope } from './commander-pairing.ts'
import { cardNameKey, toDeckCard, type ScryfallCard } from './card-model.ts'
import { identityTerm, matchesIdentity, type ColourMatch } from './colour-identity.ts'

export type DiscoveryFilters = {
  theme: string
  colours: string[]
  /** How `colours` match a commander's identity; absent means exactly. */
  colourMatch?: ColourMatch
  search: string
  /** More creature types after a creature-type theme; commanders matching any of them are found. */
  creatureTypes?: string[]
  /** Rules text, keyword or named ability (such as Eminence) the commander must mention. */
  rulesText?: string
  /** Highest commander mana value; null or absent means any. */
  maxManaValue?: number | null
  /** Set codes; commanders with a printing in any of them match. */
  sets?: string[]
  /** Result order; absent keeps search or curated order. */
  sort?: CommanderSort
}
export type CommanderSort = 'popularity' | 'name' | 'manaValue' | 'newest'
/** Scryfall's order for each sort; each sorts in that key's natural direction. */
const scryfallOrders: Record<CommanderSort, string> = {
  popularity: 'edhrec',
  name: 'name',
  manaValue: 'cmc',
  newest: 'released',
}
const last = Number.MAX_SAFE_INTEGER
const compareBy: Record<CommanderSort, (left: ScryfallCard, right: ScryfallCard) => number> = {
  // Scryfall's EDHREC rank: lower is more popular; unranked cards go last.
  popularity: (left, right) => (left.edhrec_rank ?? last) - (right.edhrec_rank ?? last),
  name: (left, right) => left.name.localeCompare(right.name),
  manaValue: (left, right) => (left.cmc ?? last) - (right.cmc ?? last),
  // The shown printing's release date, which Scryfall also sorts by.
  newest: (left, right) => (right.released_at ?? '').localeCompare(left.released_at ?? ''),
}
/** `coverage`: how many of several chosen creature types the commander is or mentions. */
export type CommanderSuggestion = { card: ScryfallCard; reason: string; coverage?: number }
/**
 * `more`: Scryfall has matches past the fetched pages. `total`: Scryfall's match count for a search,
 * before local legality checks. `batches`: commanders from each fetched page, in order; each is
 * ordered on its own, so fetching another never moves earlier tiles. `next` fetches the next page
 * and returns the matches with its commanders appended (#485).
 */
export type CommanderMatches = {
  commanders: CommanderSuggestion[]
  more: boolean
  total?: number
  batches?: number[]
  next?: (signal?: AbortSignal) => Promise<CommanderMatches>
}
/**
 * `broader`: for a curated theme, commanders the rules-text search finds beyond the curated picks,
 * with the heading that names their weaker claim (#481).
 */
export type CommanderDiscovery = CommanderMatches & {
  broader?: CommanderMatches & { heading: string }
}

/** Cards in one Scryfall search page; discovery fetches further pages on demand. */
export const scryfallPageSize = 175

const coveredTypes = (card: ScryfallCard, types: string[]) => {
  const tags = creatureTypeTags(
    [card.type_line, card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)]
      .filter(Boolean)
      .join('\n'),
  )
  return types.filter((type) => tags.includes(type))
}

// Heuristic curation from live Oracle/type review, 2026-10-04; see docs/a2-a9-first-use-investigation.md.
// These expand the old lists only where the bounded thematic-query trial failed relevance/coverage.
export const discoveryAdditions: Record<string, string[]> = {
  Tokens: [
    'Mondrak, Glory Dominus',
    'Adeline, Resplendent Cathar',
    "Trostani, Selesnya's Voice",
    'Maja, Bretagard Protector',
  ],
  '+1/+1 counters': ['Rishkar, Peema Renegade', 'Bristly Bill, Spine Sower'],
  Enchantments: ['Pearl-Ear, Imperial Advisor', 'Sram, Senior Edificer'],
  Graveyard: ['Six', 'Emry, Lurker of the Loch'],
  Dragons: ['Ganax, Astral Hunter', 'Old Gnawbone'],
  Spellslinger: ['Talrand, Sky Summoner', 'Ashling, Flame Dancer'],
  Artifacts: ['Emry, Lurker of the Loch', 'Sai, Master Thopterist'],
  Lifegain: ['Vito, Thorn of the Dusk Rose', 'Dina, Soul Steeper'],
  Sacrifice: ['Yawgmoth, Thran Physician', 'Yahenni, Undying Partisan'],
  'Group hug': ['Kami of the Crescent Moon', 'Selvala, Explorer Returned'],
  Voltron: ['Halvar, God of Battle // Sword of the Realms', 'Sram, Senior Edificer'],
  'Big mana': ['Neheb, the Eternal', 'Urza, Lord High Artificer'],
  Blink: ['Thassa, Deep-Dwelling', 'Emiel the Blessed'],
  ETB: ['Thassa, Deep-Dwelling', 'Emiel the Blessed'],
  'Death triggers': ['Syr Konrad, the Grim', 'Elenda, the Dusk Rose'],
  Wither: ['The Reaper, King No More', 'Auntie Ool, Cursewretch'],
  Political: ['Gluntch, the Bestower', 'Selvala, Explorer Returned'],
  Vampires: ['Vito, Thorn of the Dusk Rose', 'Yahenni, Undying Partisan'],
  Angels: ['Lyra Dawnbringer', 'Avacyn, Angel of Hope'],
  Demons: ['Kardur, Doomscourge', 'Valgavoth, Harrower of Souls'],
  Faeries: ['Oona, Queen of the Fae', 'Maralen, Fae Ascendant'],
  Vehicles: ['Sram, Senior Edificer', 'Cid, Freeflier Pilot'],
  Indestructible: ['Heliod, Sun-Crowned', 'Xenagos, God of Revels'],
  Mill: ['The Mindskinner', 'Syr Konrad, the Grim'],
  Zombies: ['Zul Ashur, Lich Lord', 'Ratadrabik of Urborg'],
  Elves: ['Rishkar, Peema Renegade', 'Arwen, Weaver of Hope'],
  Goblins: ['General Kreat, the Boltbringer', 'Pashalik Mons'],
  Dinosaurs: ['Etali, Primal Storm', 'Ghalta, Primal Hunger'],
  Merfolk: ['Thrasios, Triton Hero', 'Vorel of the Hull Clade'],
  Knights: [
    'Adeline, Resplendent Cathar',
    "Dion, Bahamut's Dominant // Bahamut, Warden of Light",
    'Danitha Capashen, Paragon',
  ],
  Spirits: ['Kodama of the East Tree', 'Brago, King Eternal'],
  Slivers: ['Sliver Queen'],
}

// Heuristic query relevance passed the live top-12 review for these three themes.
// Other broad queries matched removal, prevention, back faces, or unrelated recursion.
export const discoveryQueries: Record<string, string> = {
  Equipment: 'o:equipment',
  Landfall: 'o:landfall',
  Goad: 'o:goad',
}

// Heuristic rules-text terms for curated themes without a theme search term (#481). They only feed
// the separately labelled broader section, never the curated picks or theme detection.
export const broaderQueries: Record<string, string> = {
  Wither: 'o:wither',
  Vehicles: 'o:vehicle',
  Indestructible: 'o:indestructible',
  Mill: 'o:mill',
}

/** The rules-text or creature-type search behind a curated theme's broader section, if any. */
export const broaderTerm = (theme: string) => themeSearchTerm(theme) ?? broaderQueries[theme]

/** The broader section's heading; it never claims the commanders were picked for the theme. */
export const broaderHeading = (theme: string) =>
  creatureTypeForTheme(theme)
    ? `More ${theme} commanders, or ones that mention them`
    : `More commanders that mention ${theme}`

export function discoveryNames(theme: string) {
  return [...new Set([...(themeCommanders[theme] ?? []), ...(discoveryAdditions[theme] ?? [])])]
}

const cardRulesText = (card: ScryfallCard) =>
  [card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Scryfall terms for the identity, name, rules text, mana value and set criteria. */
export function commanderCriteriaTerms(filters: DiscoveryFilters) {
  const text = (filters.rulesText ?? '').trim()
  const name = filters.search.trim()
  const sets = filters.sets ?? []
  return [
    identityTerm(filters.colours, filters.colourMatch),
    name.length >= 2 ? `name:${JSON.stringify(name)}` : '',
    // Named abilities such as Eminence are not always in Scryfall's keyword field, so match Oracle text too.
    text.length >= 2 ? `(o:${JSON.stringify(text)} or kw:${JSON.stringify(text)})` : '',
    filters.maxManaValue != null ? `mv<=${filters.maxManaValue}` : '',
    sets.length ? `(${sets.map((code) => `e:${code}`).join(' or ')})` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function filterCommanders(cards: ScryfallCard[], filters: DiscoveryFilters) {
  const search = filters.search.trim().toLowerCase()
  const rulesText = (filters.rulesText ?? '').trim().toLowerCase()
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = card.oracle_id ?? card.name
    if (seen.has(key) || commanderConstructionError([toDeckCard(card)])) return false
    // An unknown identity fails closed whenever colours are chosen.
    if (
      filters.colours.length &&
      !(
        card.color_identity &&
        matchesIdentity(card.color_identity, filters.colours, filters.colourMatch)
      )
    )
      return false
    if (search.length >= 2 && !card.name.toLowerCase().includes(search)) return false
    if (rulesText.length >= 2 && !cardRulesText(card).includes(rulesText)) return false
    if (filters.maxManaValue != null && !((card.cmc ?? Infinity) <= filters.maxManaValue))
      return false
    seen.add(key)
    return true
  })
}

/**
 * The Scryfall search for a theme, or undefined to use its curated list. Creature types without a
 * curated list search for commanders of, or referring to, that type; several types search for any.
 */
function discoveryTerm(theme: string, types: string[]) {
  if (types.length > 1) return types.map((type) => `(${themeSearchTerm(type)})`).join(' or ')
  if (discoveryQueries[theme]) return discoveryQueries[theme]
  return discoveryNames(theme).length || !creatureTypeForTheme(theme)
    ? undefined
    : themeSearchTerm(theme)
}

function discoveryReason(theme: string, term: string | undefined, curated: boolean) {
  return curated
    ? `Picked for ${theme} decks`
    : term && creatureTypeForTheme(theme)
      ? `${theme}, or commanders whose rules text mentions them`
      : term
        ? `Commanders whose rules text mentions ${theme}`
        : ''
}

/** One Scryfall search page, 1-based, in `order`. */
type PageSearch = (
  query: string,
  fetcher: typeof fetch,
  signal: AbortSignal | undefined,
  order: string,
  page: number,
) => Promise<CardListResponse>

export async function discoverCommanders(
  filters: DiscoveryFilters,
  signal?: AbortSignal,
  providers: {
    search: PageSearch
    hydrate: typeof fetchScryfallCardsByIdentifiers
  } = { search: searchScryfallPageCached, hydrate: fetchScryfallCardsByIdentifiers },
): Promise<CommanderDiscovery> {
  const types = creatureTypeForTheme(filters.theme)
    ? [filters.theme, ...(filters.creatureTypes ?? [])]
    : []
  const term = discoveryTerm(filters.theme, types)
  const criteria = commanderCriteriaTerms(filters)
  const curatedNames = filters.theme && !term ? discoveryNames(filters.theme) : []
  // Set filters need Scryfall's printings, so a curated list becomes an exact-name search.
  const curated = curatedNames.length > 0 && !filters.sets?.length
  const scope = curatedNames.map((name) => `!${JSON.stringify(name)}`).join(' or ') || term
  const order = scryfallOrders[filters.sort ?? 'popularity']
  const wider = curatedNames.length ? broaderTerm(filters.theme) : undefined
  const query = searchQuery(criteria, scope)
  const widerQuery = wider && searchQuery(criteria, wider)
  const [found, widerFound] = await Promise.all([
    curated
      ? providers
          .hydrate(
            curatedNames.map((name) => ({ name })),
            fetch,
            signal,
          )
          .then((data): CardListResponse => ({ data }))
      : providers.search(query, fetch, signal, order, 1),
    widerQuery ? providers.search(widerQuery, fetch, signal, order, 1) : undefined,
  ])
  signal?.throwIfAborted()
  const reason = discoveryReason(filters.theme, term, curatedNames.length > 0)
  const suggest = (card: ScryfallCard) =>
    types.length < 2 ? { card, reason } : coverageSuggestion(card, types, reason)
  const matches: CommanderMatches = curated
    ? {
        commanders: orderCommanders(
          filterCommanders(found.data, filters).map(suggest),
          filters.sort,
        ),
        more: false,
      }
    : pagedMatches(
        found,
        (page, pageSignal) => providers.search(query, fetch, pageSignal, order, page),
        // Scryfall already matched rules text, including keyword-only matches; curated lists check it locally.
        (cards) => filterCommanders(cards, { ...filters, rulesText: '' }).map(suggest),
        filters.sort,
      )
  return {
    ...matches,
    ...(widerQuery &&
      widerFound && {
        broader: {
          ...pagedMatches(
            widerFound,
            (page, pageSignal) => providers.search(widerQuery, fetch, pageSignal, order, page),
            broaderSuggestions(found.data, curatedNames, filters),
            filters.sort,
          ),
          heading: broaderHeading(filters.theme),
        },
      }),
  }
}

const searchQuery = (criteria: string, scope: string | undefined) =>
  `is:commander legal:commander date<=today ${criteria} ${scope ? `(${scope})` : ''}`
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A search's commanders from its first page. While Scryfall has more, `next` fetches one more page
 * per call and appends its new commanders, ordered among themselves (#485).
 */
function pagedMatches(
  first: CardListResponse,
  fetchPage: (page: number, signal?: AbortSignal) => Promise<CardListResponse>,
  suggest: (cards: ScryfallCard[]) => CommanderSuggestion[],
  sort: CommanderSort | undefined,
) {
  const append = (
    result: CardListResponse,
    page: number,
    earlier?: CommanderMatches,
  ): CommanderMatches => {
    const known = new Set(earlier?.commanders.map(({ card }) => card.oracle_id ?? card.name))
    const added = orderCommanders(
      suggest(result.data).filter(({ card }) => !known.has(card.oracle_id ?? card.name)),
      sort,
    )
    const matches = {
      commanders: [...(earlier?.commanders ?? []), ...added],
      more: Boolean(result.has_more),
      total: result.total_cards,
      batches: [...(earlier?.batches ?? []), added.length],
    }
    if (!result.has_more) return matches
    return {
      ...matches,
      next: async (signal?: AbortSignal) => {
        const following = await fetchPage(page + 1, signal)
        signal?.throwIfAborted()
        return append(following, page + 1, matches)
      },
    }
  }
  return append(first, 1)
}

/** Broader matches minus every curated pick, whether or not that pick passed the filters. */
function broaderSuggestions(picks: ScryfallCard[], pickNames: string[], filters: DiscoveryFilters) {
  const picked = new Set([
    ...picks.flatMap((card) => card.oracle_id ?? []),
    ...[...picks.map(({ name }) => name), ...pickNames].map(cardNameKey),
  ])
  const reason = broaderHeading(filters.theme)
  return (found: ScryfallCard[]) =>
    filterCommanders(found, { ...filters, rulesText: '' })
      .filter((card) => !picked.has(card.oracle_id ?? '') && !picked.has(cardNameKey(card.name)))
      .map((card) => ({ card, reason }))
}

function coverageSuggestion(card: ScryfallCard, types: string[], reason: string) {
  const covered = coveredTypes(card, types)
  return {
    card,
    reason: covered.length ? `Covers ${covered.join(' and ')}` : reason,
    coverage: covered.length,
  }
}

/**
 * Commanders covering more of the chosen creature types first, then by `sort`; without a sort,
 * search or curated order is kept.
 */
export const orderCommanders = (cards: CommanderSuggestion[], sort?: CommanderSort) =>
  cards.toSorted(
    (left, right) =>
      (right.coverage ?? 0) - (left.coverage ?? 0) ||
      (sort ? compareBy[sort](left.card, right.card) : 0),
  )

/**
 * Popularity by EDHREC deck count (#514): commanders with a known count first, most decks first;
 * those without one follow in their existing order, Scryfall's EDHREC rank. Creature-type coverage
 * still leads, and equal counts keep rank order.
 */
export const orderByDeckCount = (
  cards: CommanderSuggestion[],
  deckCount: (card: ScryfallCard) => number | undefined,
) =>
  cards.toSorted(
    (left, right) =>
      (right.coverage ?? 0) - (left.coverage ?? 0) ||
      (deckCount(right.card) ?? -1) - (deckCount(left.card) ?? -1),
  )

/**
 * Every legal second commander for `first`, most popular first: Scryfall finds cards with a
 * matching partner ability, then the shared construction check keeps only legal pairs (#487).
 */
export async function discoverPartners(
  first: ScryfallCard,
  signal?: AbortSignal,
  search = searchScryfallCached,
): Promise<CommanderMatches> {
  const leader = toDeckCard(first)
  const scope = partnerSearchScope(leader)
  if (!scope) return { commanders: [], more: false }
  const cards = await search(`legal:commander date<=today (${scope})`, fetch, signal, 'edhrec')
  signal?.throwIfAborted()
  const commanders = cards
    .filter((card) => {
      const partner = toDeckCard(card)
      return !commanderConstructionError([leader, partner])
    })
    .map((card) => ({ card, reason: `Partners with ${first.name}` }))
  return { commanders, more: cards.length >= scryfallPageSize }
}

/** Every fetched commander in `found`, curated picks then broader matches, once per Oracle card. */
export function discoveredCards(found: CommanderDiscovery) {
  const seen = new Set<string>()
  return [...found.commanders, ...(found.broader?.commanders ?? [])]
    .map(({ card }) => card)
    .filter((card) => {
      const key = card.oracle_id ?? card.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/**
 * A uniform random pick from `cards`, avoiding `previous` (an Oracle ID) while another card is
 * available, so a re-roll changes the commander (#486). Undefined when `cards` is empty.
 */
export function pickRandomCommander(
  cards: readonly ScryfallCard[],
  previous?: string,
  random = Math.random,
) {
  const fresh = cards.filter((card) => (card.oracle_id ?? card.name) !== previous)
  const pool = fresh.length ? fresh : cards
  return pool[Math.floor(random() * pool.length)]
}
