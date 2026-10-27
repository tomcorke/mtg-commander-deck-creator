import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBuilderAction,
  createBuilderState,
  type BuilderState,
  type BuilderAction,
} from './builder-state.ts'
import { builderPoolKey } from './builder-settings.ts'
import { toCard, type Card } from './card-model.ts'

const card = (name: string): Card =>
  toCard(
    {
      name,
      type_line: 'Artifact',
      color_identity: [],
      cmc: 2,
      set: 'tst',
      collector_number: '1',
      oracle_text: '',
      game_changer: false,
      legalities: { commander: 'legal' },
    },
    'Commander synergy',
  )
const initial = (overrides: Partial<BuilderState> = {}): BuilderState => ({
  ...createBuilderState('2026-10-26', 'build-1'),
  ...overrides,
})
const apply = (state: BuilderState, action: BuilderAction) =>
  applyBuilderAction(state, action).state
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    Object.values(value).forEach(freeze)
  }
  return value
}

test('decision replay is deterministic, immutable and reversible across zones', () => {
  const alpha = card('Alpha')
  const state = freeze(initial({ queue: [alpha] }))
  const add: BuilderAction = { type: 'decide', card: alpha, decision: 'add' }
  const added = apply(state, add)
  assert.deepEqual(
    added.deck.map((card) => card.name),
    ['Alpha'],
  )
  assert.deepEqual(apply(state, structuredClone(add)), added)
  assert.deepEqual(apply(added, add), state)
  const later = apply(added, { ...add, decision: 'later' })
  assert.deepEqual(later.deck, [])
  assert.equal(later.decisions.Alpha, 'later')
  const selectedSideboard = apply(state, { type: 'chooseZone', zone: 'sideboard' })
  const overflow = apply(selectedSideboard, add)
  assert.equal(overflow.sideboard[0].name, 'Alpha')
  assert.deepEqual(apply(overflow, add), selectedSideboard)
})

test('validation leaves all decisions and boards untouched', () => {
  const state = initial({ ignoreReasons: { Alpha: 'Too expensive' } })
  const result = applyBuilderAction(state, {
    type: 'decide',
    card: { ...card('Alpha'), dataStatus: 'pending' },
    decision: 'add',
  })
  assert.ok(result.error)
  assert.equal(result.state, state)
})

test('ignore reasons clear independently and ignore removes likes', () => {
  const alpha = card('Alpha')
  const liked = apply(initial(), { type: 'like', name: alpha.name })
  const ignored = apply(liked, {
    type: 'decide',
    card: alpha,
    decision: 'ignore',
  })
  assert.deepEqual(ignored.liked, [])
  assert.deepEqual(ignored.ignoredCards, ['Alpha'])
  const explained = apply(ignored, { type: 'ignoreReason', name: 'Alpha', reason: 'Too expensive' })
  assert.deepEqual(
    apply(explained, { type: 'ignoreReason', name: 'Alpha', reason: null }).ignoreReasons,
    {},
  )
  assert.deepEqual(
    apply(explained, { type: 'decide', card: alpha, decision: 'later' }).ignoreReasons,
    {},
  )
})

test('collection links preserve only with no sets and last-set removal turns it off', () => {
  let state = apply(initial(), { type: 'collectionMode', mode: 'only' })
  assert.equal(state.collectionMode, 'only')
  state = apply(state, { type: 'toggleSet', code: 'tst' })
  assert.equal(state.collectionMode, 'only')
  state = apply(state, { type: 'toggleSet', code: 'tst' })
  assert.equal(state.collectionMode, 'none')
  state = apply(state, { type: 'toggleSet', code: 'abc' })
  assert.equal(state.collectionMode, 'prefer')
  assert.deepEqual(apply(state, { type: 'collectionMode', mode: 'none' }).collectionSets, [])
})

test('sub-theme removal is not dismissal, and dismissal preserves its evidence count', () => {
  let state = apply(initial(), { type: 'selectSubTheme', name: 'Artifacts' })
  state = apply(state, { type: 'removeSubTheme', name: 'Artifacts' })
  assert.deepEqual(state.dismissedSubThemes, [])
  state = apply(state, { type: 'dismissSubTheme', name: 'Artifacts', evidenceCount: 3 })
  assert.deepEqual(state.dismissedSubThemes, ['Artifacts:3'])
})

test('settings commits feedback without advancing cooldowns; next with dirty settings only refreshes', () => {
  const queue = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map(card)
  const state = initial({
    queue,
    decisions: { Alpha: 'later' },
    recommendationOptionsChanged: true,
  })
  const committed = applyBuilderAction(state, { type: 'commitSettings' })
  assert.equal(committed.state.batchNumber, 1)
  assert.equal(committed.state.deferredCards[0].card.name, 'Alpha')
  assert.deepEqual(committed.state.decisions, {})
  assert.deepEqual(applyBuilderAction(state, { type: 'nextBatch' }), committed)
  const changedPool = apply(state, { type: 'theme', theme: 'Tokens' })
  const refetch = applyBuilderAction(changedPool, { type: 'commitSettings' })
  assert.deepEqual(refetch.fetchRequests, [{ kind: 'pool', boundary: 'commitSettings' }])
  assert.equal(refetch.state.batchNumber, 1)
  assert.equal(apply(committed.state, { type: 'nextBatch' }).batchNumber, 2)
})

test('failed Doctor undo keeps history, and caller supplies the swap ID', () => {
  const alpha = card('Alpha')
  const bravo = card('Bravo')
  const state = initial({ commander: 'Leader', deck: [card('Leader'), alpha] })
  const result = applyBuilderAction(state, {
    type: 'doctorApply',
    id: 'swap-1',
    cuts: [{ cutIndex: 1, cutCard: alpha }],
    additions: [bravo],
    moveCutToSideboard: false,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.state.deckDoctorHistory[0].id, 'swap-1:0')
  const failed = applyBuilderAction(result.state, {
    type: 'doctorUndo',
    id: 'swap-1:0',
    refreshedCut: { ...alpha, dataStatus: 'unavailable' },
  })
  assert.ok(failed.error)
  assert.equal(failed.state, result.state)
  assert.ok(applyBuilderAction(result.state, { type: 'doctorUndo', id: 'swap-1:0' }).error)
})

test('late local candidates enter only at a settled batch boundary and cannot reoffer outgoing or blocked cards', () => {
  const queue = ['A', 'B', 'C', 'D', 'E'].map(card)
  let state = initial({
    queue,
    decisions: { A: 'later', B: 'ignore' },
    ignoredCards: ['B'],
    deck: [card('Owned')],
    deferredCards: [{ card: card('Deferred'), eligibleBatch: 99 }],
  })
  state = { ...state, committedPoolKey: builderPoolKey(state) }
  const buffered = apply(state, {
    type: 'data',
    changes: {
      localCandidateBuffer: ['A', 'B', 'Owned', 'Deferred', 'New'].map(card),
    },
  })
  assert.deepEqual(buffered.queue, queue)
  assert.deepEqual(buffered.decisions, state.decisions)
  const next = apply(buffered, { type: 'nextBatch' })
  assert.ok(next.queue.some(({ name }) => name === 'New'))
  assert.ok(next.queue.every(({ name }) => !['A', 'B', 'Owned', 'Deferred'].includes(name)))
  assert.deepEqual(next.localCandidateBuffer, [])
  assert.ok(next.deferredCards.some(({ card }) => card.name === 'A'))
})

test('saved local enrichment survives restore until its next batch boundary', async () => {
  const { restoreBuilderState } = await import('../app/builder-restore.ts')
  const { makeState, fixtureCard } = await import('../../scripts/fixtures/b10-browser.ts')
  const saved = makeState({
    localCandidateBuffer: [toCard(fixtureCard('Saved local'), 'Local card match')],
  })
  const restored = apply(initial(), {
    type: 'restore',
    state: restoreBuilderState(saved, '2026-10-27', 'restored-build'),
  })
  assert.deepEqual(restored.localCandidateBuffer, saved.localCandidateBuffer)
  assert.deepEqual(restored.queue, saved.queue)
  const next = apply(restored, { type: 'nextBatch' })
  assert.ok(next.queue.some(({ name }) => name === 'Saved local'))
  assert.deepEqual(next.localCandidateBuffer, [])
  const replaced = apply(restored, {
    type: 'poolLoaded',
    queue: [],
    deferredCards: [],
    poolKey: '',
  })
  assert.deepEqual(replaced.localCandidateBuffer, [])
})
