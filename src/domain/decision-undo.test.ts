import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBuilderAction,
  createBuilderState,
  type BuilderAction,
  type BuilderState,
} from './builder-state.ts'
import { builderPoolKey } from './builder-settings.ts'
import { toCard, toDeckCard, type Card, type ScryfallCard } from './card-model.ts'
import { decisionUndoStatus } from './decision-undo.ts'
import { deckStateForStorage, persistedDeckStateSchema } from '../deck-state.ts'
import { restoreBuilderState } from '../app/builder-restore.ts'

const scryfall = (name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  oracle_id: `oracle-${name}`,
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
  mana_cost: '{2}',
  set: 'tst',
  collector_number: '1',
  oracle_text: '',
  game_changer: false,
  legalities: { commander: 'legal' },
  prices: { usd: '1.00' },
  prints_search_uri: `https://api.scryfall.com/cards/search?q=${name}`,
  ...overrides,
})
const card = (name: string, tags: string[] = []): Card => ({
  ...toCard(scryfall(name), 'Commander synergy'),
  tags,
})
const commander = toDeckCard(
  scryfall('Leader', { type_line: 'Legendary Creature — Elf', color_identity: ['G'] }),
)

function builder(overrides: Partial<BuilderState> = {}): BuilderState {
  const state: BuilderState = {
    ...createBuilderState('2026-11-13', 'build-493'),
    commander: 'Leader',
    commanderDetails: { images: [], art: [], colours: ['G'], printings: [], selections: [] },
    deck: [commander],
    ...overrides,
  }
  return { ...state, committedPoolKey: builderPoolKey(state) }
}
const apply = (state: BuilderState, action: BuilderAction) => {
  const result = applyBuilderAction(state, action)
  assert.equal(result.error, undefined, `${action.type}: ${result.error}`)
  return result
}
const decide = (state: BuilderState, target: Card, decision: 'add' | 'later' | 'ignore') =>
  apply(state, { type: 'decide', card: target, decision }).state
const names = (cards: { name: string }[]) => cards.map(({ name }) => name)
const pool = () => Array.from({ length: 12 }, (_, index) => card(`Card ${index}`, [`Tag ${index}`]))

test('undo in the same batch clears an Ignore and restores More like this', () => {
  const queue = pool()
  const liked = apply(builder({ queue }), { type: 'like', name: 'Card 0' }).state
  const ignored = decide(liked, queue[0], 'ignore')
  assert.deepEqual(ignored.ignoredCards, ['Card 0'])
  assert.deepEqual(names(ignored.ignoredDetails), ['Card 0'])
  assert.deepEqual(decisionUndoStatus(ignored.lastDecision, ignored), {
    kind: 'decision',
    card: queue[0],
    decision: 'ignore',
    board: 'deck',
  })
  const result = apply(ignored, { type: 'undoDecision' })
  assert.match(result.notice ?? '', /Undid Ignore for Card 0/)
  assert.deepEqual(result.state.decisions, {})
  assert.deepEqual(result.state.ignoredCards, [])
  assert.deepEqual(result.state.ignoredDetails, [])
  assert.deepEqual(result.state.liked, ['Card 0'])
  assert.equal(result.state.lastDecision, null)
})

test('undo returns a switched decision to the previous one, and an Add to undecided', () => {
  const queue = pool()
  const later = decide(builder({ queue }), queue[1], 'later')
  const added = decide(later, queue[1], 'add')
  assert.deepEqual(names(added.deck), ['Leader', 'Card 1'])
  const undone = apply(added, { type: 'undoDecision' }).state
  assert.equal(undone.decisions['Card 1'], 'later')
  assert.deepEqual(names(undone.deck), ['Leader'])
  const again = apply(decide(undone, queue[2], 'add'), { type: 'undoDecision' }).state
  assert.deepEqual(names(again.deck), ['Leader'])
  assert.equal(again.decisions['Card 2'], undefined)
})

test('pressing the chosen button again clears the undo, and only for that card', () => {
  const queue = pool()
  const ignored = decide(builder({ queue }), queue[0], 'ignore')
  assert.equal(decide(ignored, queue[0], 'ignore').lastDecision, null)
  const other = decide(decide(builder({ queue }), queue[1], 'later'), queue[0], 'later')
  assert.equal(decide(other, queue[1], 'later').lastDecision?.card.name, 'Card 0')
})

test('undo after Next recommendations brings the committed batch back unchanged', () => {
  const queue = pool()
  const start = builder({ queue })
  const added = decide(start, queue[2], 'add')
  const ignored = decide(added, queue[0], 'ignore')
  const advanced = apply(ignored, { type: 'nextBatch' }).state
  assert.equal(advanced.batchNumber, 2)
  assert.ok(advanced.preferenceScores['Tag 0'] < 0)
  assert.ok(decisionUndoStatus(advanced.lastDecision, advanced))
  const result = apply(advanced, { type: 'undoDecision' })
  assert.match(result.notice ?? '', /previous batch is back/)
  const undone = result.state
  assert.equal(undone.batchNumber, 1)
  assert.deepEqual(names(undone.queue), names(queue))
  assert.deepEqual(undone.deferredCards, start.deferredCards)
  assert.deepEqual(undone.decisions, { 'Card 2': 'add' })
  assert.deepEqual(names(undone.deck), ['Leader', 'Card 2'])
  assert.deepEqual(undone.ignoredCards, [])
  assert.deepEqual(undone.preferenceScores, start.preferenceScores)
})

test('undo after Later and Next recommendations takes the card off the waiting list', () => {
  const queue = pool()
  const advanced = apply(decide(builder({ queue }), queue[1], 'later'), {
    type: 'nextBatch',
  }).state
  assert.deepEqual(
    advanced.deferredCards.filter(({ later }) => later).map(({ card: item }) => item.name),
    ['Card 1'],
  )
  const undone = apply(advanced, { type: 'undoDecision' }).state
  assert.equal(undone.batchNumber, 1)
  assert.equal(undone.deferredCards.length, 0)
  assert.equal(undone.decisions['Card 1'], undefined)
  assert.deepEqual(names(undone.queue).slice(0, 4), names(queue).slice(0, 4))
})

test('once the player moves on, undo requeues the card and takes back what it taught', () => {
  const queue = pool()
  const start = builder({ queue })
  const reasoned = apply(decide(start, queue[0], 'ignore'), {
    type: 'ignoreReason',
    name: 'Card 0',
    reason: 'Not my style',
  }).state
  const once = apply(reasoned, { type: 'nextBatch' }).state
  const twice = apply(once, { type: 'nextBatch' }).state
  assert.equal(twice.preferenceScores['Tag 0'], -3)
  const result = apply(twice, { type: 'undoDecision' })
  assert.match(result.notice ?? '', /back in the recommendations/)
  const undone = result.state
  assert.equal(undone.batchNumber, twice.batchNumber)
  assert.deepEqual(names(undone.queue).slice(0, 4), names(twice.queue).slice(0, 4))
  assert.ok(names(undone.queue).includes('Card 0'))
  assert.deepEqual(undone.ignoredCards, [])
  assert.equal(undone.preferenceScores['Tag 0'], undefined)
})

test('undo of an Add after moving on removes only that copy and its affinity', () => {
  const queue = pool()
  const added = decide(builder({ queue }), queue[3], 'add')
  const moved = apply(apply(added, { type: 'nextBatch' }).state, { type: 'nextBatch' }).state
  assert.equal(moved.preferenceScores['Tag 3'], 2)
  const undone = apply(moved, { type: 'undoDecision' }).state
  assert.deepEqual(names(undone.deck), ['Leader'])
  assert.equal(undone.preferenceScores['Tag 3'], undefined)
  assert.ok(names(undone.queue).includes('Card 3'))
})

test('undo is withdrawn once the decision no longer matches the deck', () => {
  const queue = pool()
  const added = decide(builder({ queue }), queue[0], 'add')
  const removed = apply(added, { type: 'removeCard', board: 'deck', index: 1 }).state
  assert.equal(decisionUndoStatus(removed.lastDecision, removed), null)
  assert.match(applyBuilderAction(removed, { type: 'undoDecision' }).error ?? '', /Nothing/)
})

test('a bulk add replaces the decision undo; a later decision keeps the bulk record', () => {
  const queue = pool()
  const decided = decide(builder({ queue }), queue[0], 'later')
  const bulk = apply(decided, { type: 'addBatch' }).state
  assert.equal(bulk.lastDecision, null)
  assert.ok(bulk.bulkAdd)
  const after = apply(bulk, { type: 'nextBatch' }).state
  const next = decide(after, after.queue[0], 'ignore')
  assert.ok(next.bulkAdd)
  assert.equal(next.lastDecision?.card.name, after.queue[0].name)
})

test('Later & ignored: return, add or move a card set aside in an earlier batch', () => {
  const queue = pool()
  const setAside = decide(decide(builder({ queue }), queue[0], 'ignore'), queue[1], 'later')
  const advanced = apply(setAside, { type: 'nextBatch' }).state
  assert.equal(
    applyBuilderAction(setAside, { type: 'setAside', name: 'Card 0', to: 'return' }).error,
    'Card 0 is in this batch; decide on it there.',
  )
  const returned = apply(advanced, { type: 'setAside', name: 'Card 0', to: 'return' })
  assert.match(returned.notice ?? '', /back in the recommendations/)
  assert.deepEqual(returned.state.ignoredCards, [])
  assert.equal(returned.state.queue.at(-1)?.name, 'Card 0')
  assert.equal(returned.state.lastDecision?.card.name, 'Card 1')

  const moved = apply(advanced, { type: 'setAside', name: 'Card 0', to: 'later' }).state
  assert.deepEqual(moved.ignoredDetails, [])
  assert.deepEqual(
    moved.deferredCards.filter(({ later }) => later).map(({ card: item }) => item.name),
    ['Card 1', 'Card 0'],
  )

  const added = apply(advanced, { type: 'setAside', name: 'Card 1', to: 'add' }).state
  assert.deepEqual(names(added.deck), ['Leader', 'Card 1'])
  assert.ok(!added.deferredCards.some(({ card: item }) => item.name === 'Card 1'))
  assert.deepEqual(added.preferenceScores, advanced.preferenceScores)
  assert.equal(added.lastDecision, null, 'acting on the undo card withdraws its undo')

  const sideboard = apply(apply(advanced, { type: 'chooseZone', zone: 'sideboard' }).state, {
    type: 'setAside',
    name: 'Card 0',
    to: 'add',
  }).state
  assert.deepEqual(names(sideboard.sideboard), ['Card 0'])
})

test('an ignored name without saved card data can still be un-ignored', () => {
  const state = builder({ queue: pool(), ignoredCards: ['Old Card'] })
  assert.match(
    applyBuilderAction(state, { type: 'setAside', name: 'Old Card', to: 'add' }).error ?? '',
    /Un-ignore it instead/,
  )
  const result = apply(state, { type: 'setAside', name: 'Old Card', to: 'return' })
  assert.deepEqual(result.state.ignoredCards, [])
  assert.equal(result.notice, 'Old Card is no longer ignored.')
})

test('saves keep ignored card data and the Later mark; restore drops stale details', () => {
  const queue = pool()
  const state = apply(decide(decide(builder({ queue }), queue[0], 'ignore'), queue[1], 'later'), {
    type: 'nextBatch',
  }).state
  const saved = persistedDeckStateSchema.parse(
    JSON.parse(
      JSON.stringify(
        deckStateForStorage({
          ...state,
          savedDeckId: '',
          limitedRecommendations: false,
          prioritizeDeckHealth: true,
          commanderDetails: state.commanderDetails!,
          ignoredDetails: [...state.ignoredDetails, card('Stale')],
        }),
      ),
    ),
  )
  assert.deepEqual(names(saved.ignoredDetails ?? []), ['Card 0', 'Stale'])
  assert.equal(saved.deferredCards.find(({ card: item }) => item.name === 'Card 1')?.later, true)
  const restored = restoreBuilderState(saved, '2026-11-13', 'build-493')
  assert.deepEqual(names(restored.ignoredDetails), ['Card 0'])
  assert.equal(restored.lastDecision, null)
})
