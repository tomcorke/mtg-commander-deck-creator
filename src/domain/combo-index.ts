import { cardNameKey } from './card-model.ts'

// Commander Spellbook combos, compacted at build time (scripts/build-combo-index.ts). This is
// provider data from a community database: absence means none was found, not that none exists,
// and a listed combo is not a bracket verdict. See docs/domain/combo-data.md.

export const comboIndexVersion = 1
export const comboSourceName = 'Commander Spellbook'
export const comboSourceUrl = 'https://commanderspellbook.com/'
export const comboPageUrl = (id: string) =>
  `https://commanderspellbook.com/combo/${encodeURIComponent(id)}/`

export type ComboIndexMetadata = {
  /** When Commander Spellbook built the export the index was generated from. */
  exportedAt: string
  exportVersion: string
  generatedAt: string
}
/** `[name, Oracle ID or null, Scryfall image key or null]`. */
export type ComboCardRow = [string, string | null, string | null]
/**
 * `[Spellbook variant ID, card refs, result refs, colour identity, popularity]`. A card ref is an
 * index into `cards`; `~index` (a negative number) marks a card that must be a commander.
 */
export type ComboRow = [string, number[], number[], string, number]
export type ComboIndex = {
  version: typeof comboIndexVersion
  metadata: ComboIndexMetadata
  cards: ComboCardRow[]
  results: string[]
  combos: ComboRow[]
}

export type ComboCard = { name: string; oracleId?: string; image?: string }
export type Combo = {
  id: string
  cards: ComboCard[]
  /** Cards Spellbook says must be the deck's commander. */
  commanders: ComboCard[]
  results: string[]
  identity: string[]
  /** Spellbook's count of decks it has seen with the combo; a popularity signal only. */
  popularity: number
}
/** Cards missing from the deck, each with the combos it alone would complete. */
export type ComboNearMiss = { card: ComboCard; combos: Combo[] }
export type DeckCombos = { included: Combo[]; nearMisses: ComboNearMiss[] }
export type ComboDeckCard = { name: string; oracleId?: string }

const imageKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\?\d+)?$/

/** Scryfall's `normal` image for a stored `id?timestamp` key. */
export function comboCardImage(key: string | null | undefined) {
  if (!key || !imageKeyPattern.test(key)) return undefined
  const [id, version] = key.split('?')
  return `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg${version ? `?${version}` : ''}`
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isIndexList = (value: unknown, limit: number, allowCommander = false) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      Number.isInteger(item) && (item >= 0 ? item < limit : allowCommander && ~item < limit),
  )

/** Validates the generated artifact; throws on anything the matcher could misread. */
export function parseComboIndex(value: unknown): ComboIndex {
  const index = value as Partial<ComboIndex> | null
  if (!index || index.version !== comboIndexVersion) throw new Error('Unknown combo index version')
  const { metadata, cards, results, combos } = index
  if (
    !metadata ||
    !isString(metadata.exportedAt) ||
    Number.isNaN(Date.parse(metadata.exportedAt)) ||
    !isString(metadata.exportVersion) ||
    !isString(metadata.generatedAt)
  )
    throw new Error('Invalid combo index metadata')
  if (
    !Array.isArray(cards) ||
    !cards.every(
      (row) =>
        Array.isArray(row) &&
        isString(row[0]) &&
        row[0] &&
        (row[1] === null || isString(row[1])) &&
        (row[2] === null || isString(row[2])),
    )
  )
    throw new Error('Invalid combo index cards')
  if (!Array.isArray(results) || !results.every(isString))
    throw new Error('Invalid combo index results')
  if (
    !Array.isArray(combos) ||
    !combos.every(
      (row) =>
        Array.isArray(row) &&
        isString(row[0]) &&
        isIndexList(row[1], cards.length, true) &&
        Array.isArray(row[2]) &&
        (row[2].length === 0 || isIndexList(row[2], results.length)) &&
        isString(row[3]) &&
        Number.isFinite(row[4]),
    )
  )
    throw new Error('Invalid combo index combos')
  return index as ComboIndex
}

type Lookup = { oracle: Map<string, number>; name: Map<string, number> }
const lookups = new WeakMap<ComboIndex, Lookup>()
function lookupFor(index: ComboIndex) {
  let lookup = lookups.get(index)
  if (!lookup) {
    lookup = { oracle: new Map(), name: new Map() }
    index.cards.forEach(([name, oracleId], position) => {
      if (oracleId) lookup!.oracle.set(oracleId, position)
      lookup!.name.set(cardNameKey(name), position)
    })
    lookups.set(index, lookup)
  }
  return lookup
}
// Oracle identity first; names cover legacy saved cards without one.
function cardPosition(lookup: Lookup, card: ComboDeckCard) {
  return (
    (card.oracleId ? lookup.oracle.get(card.oracleId) : undefined) ??
    lookup.name.get(cardNameKey(card.name))
  )
}

function comboCard(index: ComboIndex, position: number): ComboCard {
  const [name, oracleId, image] = index.cards[position]
  return {
    name,
    ...(oracleId && { oracleId }),
    ...(comboCardImage(image) && { image: comboCardImage(image) }),
  }
}
function decodeCombo(index: ComboIndex, [id, refs, results, identity, popularity]: ComboRow) {
  return {
    id,
    cards: refs.map((ref) => comboCard(index, ref < 0 ? ~ref : ref)),
    commanders: refs.filter((ref) => ref < 0).map((ref) => comboCard(index, ~ref)),
    results: results.map((result) => index.results[result]),
    identity: [...identity].filter((colour) => colour !== 'C'),
    popularity,
  }
}

const byPopularity = (left: Combo, right: Combo) =>
  left.cards.length - right.cards.length ||
  right.popularity - left.popularity ||
  left.id.localeCompare(right.id)

const blocked = -2
const complete = -1
/**
 * The card a combo still needs: `complete` when none, `blocked` when it needs a different
 * commander or more than one card, else that card's position.
 */
function missingCard(refs: number[], present: Set<number>, commanders: Set<number>) {
  let missing = complete
  for (const ref of refs) {
    if (ref < 0) {
      if (!commanders.has(~ref)) return blocked
    } else if (!present.has(ref)) {
      if (missing !== complete) return blocked
      missing = ref
    }
  }
  return missing
}
const nearMissOrder = (left: ComboNearMiss, right: ComboNearMiss) =>
  right.combos.length - left.combos.length ||
  right.combos[0].popularity - left.combos[0].popularity ||
  left.card.name.localeCompare(right.card.name)

/**
 * Spellbook's find-my-combos rules for the cases a client can check: every card present (and any
 * must-be-commander card is a commander) means included; exactly one non-commander card missing,
 * within the deck's colour identity, means one card away. Combos that need a different commander
 * are skipped. The build drops combos that need a card template rather than named cards.
 */
export function findDeckCombos(
  index: ComboIndex,
  deck: { commanders: ComboDeckCard[]; cards: ComboDeckCard[]; identity: string[] },
): DeckCombos {
  const lookup = lookupFor(index)
  const positions = (cards: ComboDeckCard[]) =>
    new Set(
      cards.map((card) => cardPosition(lookup, card)).filter((position) => position !== undefined),
    )
  const commanders = positions(deck.commanders)
  const present = positions([...deck.commanders, ...deck.cards])
  const identity = new Set([...deck.identity, 'C'])
  const included: Combo[] = []
  const nearMisses = new Map<number, Combo[]>()
  for (const row of index.combos) {
    const missing = missingCard(row[1], present, commanders)
    if (missing === complete) included.push(decodeCombo(index, row))
    else if (missing >= 0 && [...row[3]].every((colour) => identity.has(colour))) {
      const combos = nearMisses.get(missing) ?? []
      combos.push(decodeCombo(index, row))
      nearMisses.set(missing, combos)
    }
  }
  return {
    included: included.sort(byPopularity),
    nearMisses: [...nearMisses]
      .map(([position, combos]) => ({
        card: comboCard(index, position),
        combos: combos.sort(byPopularity),
      }))
      .sort(nearMissOrder),
  }
}
