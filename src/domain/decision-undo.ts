import { remainingBulkAdded, removeBulkAdded, type AddedCopies } from './bulk-add.ts'
import type { Card, DeckCard } from './card-model.ts'
import { updatePreferenceScores, type RecommendationDecision } from './recommendation-queue.ts'
import type { IgnoreReason } from './recommendation-tuning.ts'
import type { DeferredCard } from './recommendation-types.ts'

/** Builder fields one batch decision reads or changes. */
type DecisionState = {
  deck: DeckCard[]
  sideboard: DeckCard[]
  queue: Card[]
  deferredCards: DeferredCard<Card>[]
  batchNumber: number
  decisions: Record<string, RecommendationDecision>
  ignoreReasons: Record<string, IgnoreReason>
  ignoredCards: string[]
  ignoredDetails: Card[]
  liked: string[]
  preferenceScores: Record<string, number>
  theme: string
  activeSubThemes: string[]
}

/** The batch as it stood just before Next recommendations (or applied settings) committed it. */
type BatchSnapshot = Pick<
  DecisionState,
  | 'queue'
  | 'deferredCards'
  | 'batchNumber'
  | 'decisions'
  | 'ignoreReasons'
  | 'liked'
  | 'preferenceScores'
>

/**
 * The player's most recent Add, Later or Ignore, undoable in one step. Session-only, like the bulk
 * add record it shares copy accounting with: `added` and `baseline` count an Add's copies the same
 * way, so undo removes only the copy this decision placed.
 */
export type DecisionUndoRecord = AddedCopies & {
  card: Card
  decision: RecommendationDecision
  /** The card's decision before this click, when the player switched from another one. */
  previous?: RecommendationDecision
  /** The card's More like this and ignore reason before the click. */
  liked: boolean
  reason?: IgnoreReason
  /** Set when the batch is committed: what to restore, and the affinity the commit learned. */
  committed?: {
    before: BatchSnapshot
    after: { queue: string[]; deferredCards: string[]; batchNumber: number }
    preference: Record<string, number>
  }
}

const names = (cards: { name: string }[]) => cards.map(({ name }) => name)
const sameNames = (left: string[], right: string[]) =>
  left.length === right.length && left.every((name, index) => name === right[index])

/** Whether the record still describes the board, so undo can reverse it exactly. */
export function decisionUndoAvailable(record: DecisionUndoRecord | null, state: DecisionState) {
  if (!record) return false
  const { name } = record.card
  if (!record.committed) return state.decisions[name] === record.decision
  if (record.decision === 'ignore') return state.ignoredCards.includes(name)
  if (record.decision === 'later')
    return state.deferredCards.some(({ card, later }) => later && card.name === name)
  return remainingBulkAdded(record, state).size > 0
}

/** The status line for the last decision; null once it can no longer be undone. */
export function decisionUndoStatus(record: DecisionUndoRecord | null, state: DecisionState) {
  if (!record || !decisionUndoAvailable(record, state)) return null
  const board =
    record.decision === 'add' &&
    state.sideboard.some(({ name }) => name === record.card.name) &&
    !state.deck.some(({ name }) => name === record.card.name)
      ? ('sideboard' as const)
      : ('deck' as const)
  return { kind: 'decision' as const, card: record.card, decision: record.decision, board }
}

/**
 * Stamp the record when an action commits its batch, so undo can restore that batch or, once the
 * player has moved on, take back the affinity the commit learned from this card.
 */
export function commitDecisionRecord<S extends DecisionState>(
  record: DecisionUndoRecord | null,
  before: S,
  after: S,
  themes: string[],
): DecisionUndoRecord | null {
  if (!record || record.committed) return record
  const { name } = record.card
  if (before.decisions[name] !== record.decision || after.decisions[name] !== undefined)
    return record
  const card = before.queue.find((item) => item.name === name) ?? record.card
  return {
    ...record,
    committed: {
      before: {
        queue: before.queue,
        deferredCards: before.deferredCards,
        batchNumber: before.batchNumber,
        decisions: before.decisions,
        ignoreReasons: before.ignoreReasons,
        liked: before.liked,
        preferenceScores: before.preferenceScores,
      },
      after: {
        queue: names(after.queue),
        deferredCards: names(after.deferredCards.map(({ card }) => card)),
        batchNumber: after.batchNumber,
      },
      // Each card's feedback is additive, so this card's share is its update from zero.
      preference: updatePreferenceScores(
        [card],
        { [name]: record.decision },
        before.liked,
        {},
        before.ignoreReasons,
        themes,
      ),
    },
  }
}

/**
 * Put the committed batch back when nothing has happened since: same queue, waiting cards and
 * batch, and no new decisions. Current card objects win, so hydrated data and printings survive;
 * cards fetched for the new batch stay queued after the restored ones.
 */
export function restoreCommittedBatch<S extends DecisionState>(
  record: DecisionUndoRecord,
  state: S,
): S | null {
  const committed = record.committed
  if (
    !committed ||
    Object.keys(state.decisions).length ||
    state.batchNumber !== committed.after.batchNumber ||
    !sameNames(names(state.queue), committed.after.queue) ||
    !sameNames(names(state.deferredCards.map(({ card }) => card)), committed.after.deferredCards)
  )
    return null
  const { before } = committed
  const current = new Map(
    [...state.queue, ...state.deferredCards.map(({ card }) => card)].map((card) => [
      card.name,
      card,
    ]),
  )
  const latest = (card: Card) => current.get(card.name) ?? card
  const known = new Set(names([...before.queue, ...before.deferredCards.map(({ card }) => card)]))
  return {
    ...state,
    queue: [...before.queue.map(latest), ...state.queue.filter(({ name }) => !known.has(name))],
    deferredCards: before.deferredCards.map((entry) => ({ ...entry, card: latest(entry.card) })),
    batchNumber: before.batchNumber,
    decisions: before.decisions,
    ignoreReasons: before.ignoreReasons,
    liked: before.liked,
    preferenceScores: before.preferenceScores,
  }
}

/**
 * Undo a committed decision after the player has moved on: take back the affinity it taught, lift
 * the ignore, Later wait or added copy, and queue the card again. The current batch keeps its order;
 * the card is ranked with the rest at the next batch.
 */
export function reverseCommittedDecision<S extends DecisionState>(
  record: DecisionUndoRecord,
  state: S,
  commanderCount: number,
): S {
  const { name } = record.card
  const preferenceScores = { ...state.preferenceScores }
  for (const [tag, change] of Object.entries(record.committed?.preference ?? {})) {
    const next = (preferenceScores[tag] ?? 0) - change
    if (next) preferenceScores[tag] = next
    else delete preferenceScores[tag]
  }
  const boards =
    record.decision === 'add'
      ? removeBulkAdded(record, state, commanderCount)
      : { deck: state.deck, sideboard: state.sideboard }
  const deferredCards = state.deferredCards.filter(({ card }) => card.name !== name)
  const listed = [...state.queue, ...deferredCards.map(({ card }) => card)]
  return {
    ...state,
    ...boards,
    preferenceScores,
    ignoredCards: state.ignoredCards.filter((item) => item !== name),
    ignoredDetails: state.ignoredDetails.filter((card) => card.name !== name),
    deferredCards,
    queue: listed.some((card) => card.name === name) ? state.queue : [...state.queue, record.card],
  }
}

/**
 * Cards set aside in earlier batches, for Later & ignored. Later lists the player's Later choices,
 * soonest return first; saves from before the Later mark count waits without an undecided skip.
 * Ignored lists the newest first and leaves out this batch's cards, which keep their own buttons.
 */
export function setAsideCards(
  state: Pick<
    DecisionState,
    'deferredCards' | 'ignoredCards' | 'ignoredDetails' | 'decisions' | 'batchNumber'
  >,
) {
  const later = state.deferredCards
    .filter(({ card, later }) => later ?? !card.undecidedSkips)
    .toSorted((left, right) => left.eligibleBatch - right.eligibleBatch)
    .map(({ card, eligibleBatch }) => ({
      card,
      returnsIn: Math.max(1, eligibleBatch - state.batchNumber),
    }))
  const ignored = state.ignoredCards
    .filter((name) => !state.decisions[name])
    .toReversed()
    .map((name) => ({ name, card: state.ignoredDetails.find((card) => card.name === name) }))
  return { later, ignored, count: later.length + ignored.length }
}
