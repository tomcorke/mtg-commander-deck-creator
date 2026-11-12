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
  /** Each card added, in order. Basic lands repeat. */
  added: { name: string; board: 'deck' | 'sideboard' }[]
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
      inSets(card),
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

/** Names of a bulk add's cards still on their boards, with basics counted once. */
export function bulkAddedNames(record: BulkAddRecord | null, deck: DeckCard[]) {
  if (!record) return new Set<string>()
  const present = new Set(deck.map(({ name }) => name))
  return new Set(
    record.added
      .filter(({ name, board }) => board === 'deck' && present.has(name))
      .map(({ name }) => name),
  )
}

/** Remove each recorded card once from its board, newest copy first. */
export function removeBulkAdded(
  record: BulkAddRecord,
  boards: { deck: DeckCard[]; sideboard: DeckCard[] },
  commanderCount: number,
) {
  const next = { deck: [...boards.deck], sideboard: [...boards.sideboard] }
  for (const { name, board } of [...record.added].reverse()) {
    const cards = next[board]
    const index = cards.findLastIndex((card) => card.name === name)
    if (index >= (board === 'deck' ? commanderCount : 0)) cards.splice(index, 1)
  }
  return next
}

/** A starting deck's cards still in the main deck: spells and nonbasic lands, then basics by name. */
export function startingDeckSummary(record: BulkAddRecord | null, deck: DeckCard[]) {
  if (record?.kind !== 'draft') return null
  const drafted = bulkAddedNames(record, deck)
  const cards: DeckCard[] = []
  const basics = new Map<string, { card: DeckCard; count: number }>()
  const recordedCopies = new Map<string, number>()
  for (const { name } of record.added) recordedCopies.set(name, (recordedCopies.get(name) ?? 0) + 1)
  for (const card of deck) {
    if (!drafted.has(card.name)) continue
    if (!isBasicLandName(card.name)) {
      if (!cards.some(({ name }) => name === card.name)) cards.push(card)
      continue
    }
    const entry = basics.get(card.name) ?? { card, count: 0 }
    // Count only the copies the draft added, not basics the player had already.
    if (entry.count < (recordedCopies.get(card.name) ?? 0)) entry.count += 1
    basics.set(card.name, entry)
  }
  const basicList = [...basics.values()]
  if (!cards.length && !basicList.length) return null
  return {
    cards,
    basics: basicList,
    total: cards.length + basicList.reduce((sum, { count }) => sum + count, 0),
    extraBasics: record.extraBasics,
  }
}

/** The last bulk add and how many of its cards are still on their boards; null once none are. */
export function bulkAddStatus(
  record: BulkAddRecord | null,
  boards: { deck: DeckCard[]; sideboard: DeckCard[] },
) {
  if (!record) return null
  let count = 0
  for (const board of ['deck', 'sideboard'] as const) {
    const added = new Map<string, number>()
    for (const entry of record.added)
      if (entry.board === board) added.set(entry.name, (added.get(entry.name) ?? 0) + 1)
    for (const [name, copies] of added)
      count += Math.min(copies, boards[board].filter((card) => card.name === name).length)
  }
  return count ? { kind: record.kind, count } : null
}
