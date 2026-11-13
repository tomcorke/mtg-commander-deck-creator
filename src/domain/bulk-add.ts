import { allowedByOwnership, type OwnedQuantities, type OwnershipMode } from './owned-cards.ts'
import {
  analyseDeck,
  basicLandPlan,
  isBasicLandName,
  rolesForCard,
  targetKeys,
  type DeckTargets,
  type TargetKey,
} from '../deck-analysis.ts'
import { rankLandSuggestions } from '../land-suggestions.ts'
import { toDeckCardFromRecommendation, type Card, type DeckCard } from './card-model.ts'
import { recommendationDataError } from './deck-data-status.ts'
import { cardPrice, exceedsDeckBudget, remainingDeckBudget } from './deck-price.ts'
import { gameChangersAtLimit } from './play-style.ts'
import { preconFastMana } from './recommendation-scoring.ts'
import { withinPriceCap } from './recommendation-tuning.ts'
import type { CollectionMode, DeferredCard, PowerTarget } from './recommendation-types.ts'

/**
 * One bulk add the player can undo in a single step: "Add all" on a recommendation batch, or a
 * generated starting deck. Session-only, like Deck Doctor history.
 */
export type BulkAddRecord = {
  kind: 'batch' | 'draft'
  /** Copies added of each card name. */
  added: Record<string, number>
  /**
   * Copies of each added name across deck and sideboard before the add. Copies above this are the
   * add's, wherever the player has since moved them; basics are interchangeable, so a count is exact.
   */
  baseline: Record<string, number>
  /** Basic lands added past the land target because candidates ran out. */
  extraBasics: number
  before: { queue: Card[]; deferredCards: DeferredCard<Card>[] }
  after: { queue: Card[]; deferredCards: DeferredCard<Card>[] }
}

/** Builder fields a starting deck reads. */
export type StartingDeckInput = {
  deck: DeckCard[]
  sideboard: DeckCard[]
  queue: Card[]
  deferredCards: DeferredCard<Card>[]
  decisions: Record<string, 'add' | 'later' | 'ignore'>
  ignoredCards: string[]
  commanderDetails: { colours: string[] } | null
  deckTargets: DeckTargets
  maxPrice: number | null
  deckBudget: number | null
  powerTarget: PowerTarget
  excludeGameChangers: boolean
  limitGameChangers: boolean
  collectionMode: CollectionMode
  collectionSets: string[]
  ownedCards?: OwnedQuantities
  ownershipMode?: OwnershipMode
}

export type StartingDeckPlan = {
  /** Cards to append to the main deck, in order. */
  additions: DeckCard[]
  /** Queue and Later-list cards the plan uses. */
  taken: Set<string>
  extraBasics: number
}

const isLandCard = (card: Card | DeckCard) => rolesForCard(card).includes('lands')
const nonlandRoles = targetKeys.filter((key) => key !== 'lands')

/** Queue then Later-list cards the player hasn't declined, within the current filters. */
function draftCandidates(input: StartingDeckInput) {
  const blocked = new Set([
    ...input.deck.map(({ name }) => name),
    ...input.sideboard.map(({ name }) => name),
    ...input.ignoredCards,
    ...Object.entries(input.decisions)
      .filter(([, decision]) => decision !== 'add')
      .map(([name]) => name),
  ])
  const inSets = (card: Card) =>
    input.collectionMode !== 'only' ||
    !input.collectionSets.length ||
    card.collectionMatch ||
    (card.set !== undefined && input.collectionSets.includes(card.set))
  return [...input.queue, ...input.deferredCards.map(({ card }) => card)].filter(
    (card, index, cards) =>
      !blocked.has(card.name) &&
      cards.findIndex(({ name }) => name === card.name) === index &&
      withinPriceCap(card, input.maxPrice) &&
      !(input.powerTarget === 'precon' && preconFastMana.has(card.name)) &&
      inSets(card) &&
      allowedByOwnership(card, input.ownedCards, input.ownershipMode),
  )
}

/** Basics for every remaining slot, split by colour demand against the deck's land sources. */
function basicFill(identity: string[], deck: DeckCard[], basics: DeckCard[]) {
  const analysis = analyseDeck(deck)
  const fill = 100 - deck.length
  const plan = basicLandPlan(
    identity,
    analysis.required,
    analysis.counts.lands,
    analysis.counts.lands + fill,
    deck.length,
    // Only lands count as existing sources here: a draft must not skip a colour's basics because
    // its spells happen to include mana creatures or rocks of that colour.
    analyseDeck(deck.filter(isLandCard)).produced,
  )
  return plan.flatMap(({ name, count }) => {
    const basic = basics.find((card) => card.name === name)
    if (!basic) throw new Error(`${name} is unavailable. Try again shortly.`)
    return Array.from({ length: count }, () => ({ ...basic }))
  })
}

/**
 * App heuristic, not a tuned list: fill unmet nonland role targets from the ranked queue, then the
 * remaining nonland slots in queue order (which already reflects theme and priority), then
 * nonbasic lands that beat a basic, then basics split by colour demand. Every card passes the same
 * construction and filter checks as a manual Add. Basics fill any slots left when candidates run
 * out, so the result is always 100 cards.
 */
export function planStartingDeck(input: StartingDeckInput, basics: DeckCard[]): StartingDeckPlan {
  const identity = input.commanderDetails?.colours ?? []
  const deck = [...input.deck]
  const additions: DeckCard[] = []
  const taken = new Set<string>()
  const pool = draftCandidates(input)
  const landTarget = input.deckTargets.lands
  const startingLands = analyseDeck(deck).counts.lands
  const landSlots = Math.max(0, Math.min(100 - deck.length, landTarget - startingLands))
  // Every open slot may end up a basic, so a card fits only if basics can still fill the rest.
  const basicPrice = Math.max(0, ...basics.map((card) => cardPrice(card) ?? 0))
  let remaining = remainingDeckBudget(input.deckBudget, deck)

  const fits = (card: Card) =>
    !taken.has(card.name) &&
    !exceedsDeckBudget(
      card,
      remaining === null ? null : remaining - basicPrice * (99 - deck.length),
    ) &&
    !recommendationDataError(
      toDeckCardFromRecommendation(card),
      deck,
      identity,
      input.excludeGameChangers || (input.limitGameChangers && gameChangersAtLimit(deck)),
    )
  const take = (card: Card) => {
    const added = toDeckCardFromRecommendation(card)
    deck.push(added)
    additions.push(added)
    taken.add(card.name)
    const price = cardPrice(card)
    if (remaining !== null && price !== null) remaining -= price
  }

  // Spells never add lands, so the land slots stay reserved through both spell passes.
  const nonlandSlots = () => 100 - deck.length - landSlots
  const spells = pool.filter((card) => !isLandCard(card))
  const counts = analyseDeck(deck).counts
  const unmet = (role: TargetKey) => counts[role] < input.deckTargets[role]
  for (const card of spells) {
    if (nonlandSlots() <= 0 || !nonlandRoles.some(unmet)) break
    const roles = rolesForCard(card)
    if (!roles.some((role) => role !== 'lands' && unmet(role)) || !fits(card)) continue
    take(card)
    for (const role of roles) counts[role] += 1
  }
  for (const card of spells) {
    if (nonlandSlots() <= 0) break
    if (fits(card)) take(card)
  }

  const nonbasicLands = rankLandSuggestions(
    pool.filter((card) => isLandCard(card)),
    deck,
    { excluded: [...taken], identity, landTarget, limit: landSlots },
  )
  for (const { card } of nonbasicLands) if (fits(card)) take(card)

  const fill = 100 - deck.length
  const landsShort = Math.max(0, Math.min(fill, landTarget - analyseDeck(deck).counts.lands))
  additions.push(...basicFill(identity, deck, basics))
  return { additions, taken, extraBasics: fill - landsShort }
}

type Boards = { deck: DeckCard[]; sideboard: DeckCard[] }
/** The copy accounting an undo needs; a single Add's undo record reuses it. */
export type AddedCopies = Pick<BulkAddRecord, 'added' | 'baseline'>

const copiesOf = (name: string, boards: Boards) =>
  boards.deck.filter((card) => card.name === name).length +
  boards.sideboard.filter((card) => card.name === name).length

/** Count each name's copies across both boards, for a record's baseline. */
export function boardCounts(names: Iterable<string>, boards: Boards) {
  return Object.fromEntries([...new Set(names)].map((name) => [name, copiesOf(name, boards)]))
}

/** Copies of each added name still on either board, never counting the player's own copies. */
export function remainingBulkAdded(record: AddedCopies | null, boards: Boards) {
  const remaining = new Map<string, number>()
  if (!record) return remaining
  for (const [name, added] of Object.entries(record.added)) {
    const count = Math.min(
      added,
      Math.max(0, copiesOf(name, boards) - (record.baseline[name] ?? 0)),
    )
    if (count) remaining.set(name, count)
  }
  return remaining
}

/** Names of a bulk add's cards still in the main deck. */
export function bulkAddedNames(record: BulkAddRecord | null, boards: Boards) {
  const present = new Set(boards.deck.map(({ name }) => name))
  return new Set([...remainingBulkAdded(record, boards).keys()].filter((name) => present.has(name)))
}

/** Remove the add's surviving copies, newest first: main deck (never commanders), then sideboard. */
export function removeBulkAdded(record: AddedCopies, boards: Boards, commanderCount: number) {
  const next = { deck: [...boards.deck], sideboard: [...boards.sideboard] }
  for (const [name, count] of remainingBulkAdded(record, boards))
    for (let copy = 0; copy < count; copy += 1) {
      const index = next.deck.findLastIndex((card) => card.name === name)
      const spare = next.sideboard.findLastIndex((card) => card.name === name)
      if (index >= commanderCount) next.deck.splice(index, 1)
      else if (spare >= 0) next.sideboard.splice(spare, 1)
    }
  return next
}

/** A starting deck's cards still in the main deck: spells and nonbasic lands, then basics by name. */
export function startingDeckSummary(record: BulkAddRecord | null, boards: Boards) {
  if (record?.kind !== 'draft') return null
  const remaining = remainingBulkAdded(record, boards)
  const cards: DeckCard[] = []
  const basics: { card: DeckCard; count: number }[] = []
  for (const card of boards.deck) {
    const count = remaining.get(card.name)
    if (
      !count ||
      [...cards, ...basics.map((basic) => basic.card)].some(({ name }) => name === card.name)
    )
      continue
    if (isBasicLandName(card.name))
      basics.push({
        card,
        count: Math.min(count, boards.deck.filter(({ name }) => name === card.name).length),
      })
    else cards.push(card)
  }
  if (!cards.length && !basics.length) return null
  return {
    cards,
    basics,
    total: cards.length + basics.reduce((sum, { count }) => sum + count, 0),
    extraBasics: record.extraBasics,
  }
}

/** The last bulk add and how many of its cards are still on either board; null once none are. */
export function bulkAddStatus(record: BulkAddRecord | null, boards: Boards) {
  const count = [...remainingBulkAdded(record, boards).values()].reduce(
    (sum, value) => sum + value,
    0,
  )
  return record && count ? { kind: record.kind, count } : null
}
