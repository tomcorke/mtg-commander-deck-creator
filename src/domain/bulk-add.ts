import { hasTag } from './creature-types.ts'
import {
  allowedByOwnership,
  ownedCardReason,
  type OwnedQuantities,
  type OwnershipMode,
} from './owned-cards.ts'
import {
  analyseDeck,
  isBasicLandName,
  rolesForCard,
  targetKeys,
  type DeckTargets,
  type TargetKey,
} from '../deck-analysis.ts'
import { commanderNames } from './commander-catalog.ts'
import { planBasics, planLandFill } from './land-plan.ts'
import { toDeckCardFromRecommendation, type Card, type DeckCard } from './card-model.ts'
import { recommendationDataError } from './deck-data-status.ts'
import { cardPrice, exceedsDeckBudget, remainingDeckBudget } from './deck-price.ts'
import { gameChangersAtLimit } from './play-style.ts'
import { preconFastMana, isTopThemeFavourite } from './recommendation-scoring.ts'
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
  /** The commander key; its names mark the deck's leading commander cards. */
  commander: string
  theme: string
  activeSubThemes: string[]
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

/** Builder fields the land plan's candidates and deck evidence read. */
export type LandFillCandidateInput = Pick<
  StartingDeckInput,
  | 'deck'
  | 'sideboard'
  | 'queue'
  | 'deferredCards'
  | 'decisions'
  | 'ignoredCards'
  | 'maxPrice'
  | 'powerTarget'
  | 'collectionMode'
  | 'collectionSets'
  | 'ownedCards'
  | 'ownershipMode'
>

/** Queue then Later-list cards the player hasn't declined, within the current filters. */
function draftCandidates(input: LandFillCandidateInput) {
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

/**
 * Lands Choose lands and a starting deck may plan from: the same queue and Later-list candidates
 * as a draft, kept to lands a manual Add would accept now. #590 can add more sources here.
 */
export function landFillCandidates(
  input: LandFillCandidateInput,
  identity: string[],
  excludeGameChangers: boolean,
) {
  return draftCandidates(input).filter(
    (card) =>
      isLandCard(card) &&
      !recommendationDataError(
        toDeckCardFromRecommendation(card),
        input.deck,
        identity,
        excludeGameChangers,
      ),
  )
}

/**
 * The manual Add check for a planned land, run against the deck plus the lands planned before it,
 * so two Game Changer lands never both take the last Game Changer slot.
 */
export function landPlanAllowed(
  deck: DeckCard[],
  identity: string[],
  excludeGameChangers: boolean,
  limitGameChangers: boolean,
) {
  const base = [...deck]
  return (card: Card, picked: Card[]) => {
    const planned = [...base, ...picked.map(toDeckCardFromRecommendation)]
    return !recommendationDataError(
      toDeckCardFromRecommendation(card),
      planned,
      identity,
      excludeGameChangers || (limitGameChangers && gameChangersAtLimit(planned)),
    )
  }
}

/** The selected theme and extra themes, as land-role evidence reads them. */
export const selectedThemes = (input: { theme: string; activeSubThemes: string[] }) =>
  [input.theme, ...input.activeSubThemes].filter(Boolean)

/** The deck's commanders as land-role evidence reads them: their rules text counts. */
export const deckCommanders = (input: { commander: string; deck: DeckCard[] }) =>
  input.deck
    .slice(0, commanderNames(input.commander).length)
    .map(({ name, detail }) => ({ name, detail }))

/** Basics for every remaining slot, split by colour demand against the deck's land sources. */
function basicFill(identity: string[], deck: DeckCard[], basics: DeckCard[]) {
  return planBasics(deck, identity, analyseDeck(deck).counts.lands + 100 - deck.length).flatMap(
    ({ name, count }) => {
      const basic = basics.find((card) => card.name === name)
      if (!basic) throw new Error(`${name} is unavailable. Try again shortly.`)
      return Array.from({ length: count }, () => ({ ...basic }))
    },
  )
}

/**
 * App heuristic, not a tuned list: fill unmet nonland role targets from the ranked queue, then the
 * remaining nonland slots, preferring cards without completed roles in both stages, then the
 * land plan Choose lands shows (`planLandFill`), then basics split by colour demand. Every card passes the same
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

  // App heuristic: keep speculative local theme filler to three new spells per draft.
  // Provider-backed cards are enriched beyond the local snapshot before reaching this pool.
  const speculativeTheme = (card: Card) =>
    !isLandCard(card) &&
    (card.localIndexSnapshot ||
      card.reason === 'Local card match' ||
      card.reason === ownedCardReason) &&
    selectedThemes(input).some((theme) => hasTag(card, theme))
  let speculativePicks = 0
  const fits = (card: Card) =>
    !(speculativeTheme(card) && speculativePicks >= 3) &&
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
    if (speculativeTheme(card)) speculativePicks += 1
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
  // Reserve the commander's strongest theme evidence before role quotas consume spell slots.
  spells
    .filter((card) => isTopThemeFavourite(card, selectedThemes(input)))
    .sort((a, b) => (b.inclusion ?? 0) - (a.inclusion ?? 0))
    .forEach((card) => {
      if (nonlandSlots() > 0 && fits(card)) take(card)
    })
  const counts = analyseDeck(deck).counts
  const unmet = (role: TargetKey) => counts[role] < input.deckTargets[role]
  const fillRoles = (allowCompletedRoles: boolean) => {
    for (const card of spells) {
      if (nonlandSlots() <= 0 || !nonlandRoles.some(unmet)) break
      const roles = rolesForCard(card)
      if (!allowCompletedRoles && roles.some((role) => !unmet(role))) continue
      if (!roles.some((role) => role !== 'lands' && unmet(role)) || !fits(card)) continue
      take(card)
      for (const role of roles) counts[role] += 1
    }
  }
  fillRoles(false)
  fillRoles(true)
  // The queue was ranked against the original deck. Prefer remaining theme/filler cards
  // without a completed role before reusing its now-stale role preferences. Keep queue
  // order within each pass; overlapping roles and favourites can still exceed targets.
  const fillSpells = (allowCompletedRoles: boolean) => {
    for (const card of spells) {
      if (nonlandSlots() <= 0) break
      const roles = rolesForCard(card)
      if (!allowCompletedRoles && roles.some((role) => !unmet(role))) continue
      if (!fits(card)) continue
      take(card)
      for (const role of roles) counts[role] += 1
    }
  }

  fillSpells(false)
  fillSpells(true)

  // The same planner as Choose lands; `fits` re-checks each pick against the growing deck.
  const lands = planLandFill({
    deck,
    commanders: deckCommanders(input),
    themes: selectedThemes(input),
    identity,
    landTarget,
    power: input.powerTarget,
    candidates: pool.filter((card) => isLandCard(card) && !taken.has(card.name)),
    remainingBudget: remaining,
    basicPrice,
    allowed: landPlanAllowed(deck, identity, input.excludeGameChangers, input.limitGameChangers),
  })
  for (const { card } of lands.picks) if (fits(card)) take(card)

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
