import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBuilderAction,
  createBuilderState,
  reconcileOwnership,
  type BuilderState,
  type BuilderAction,
} from './builder-state.ts'
import { builderPoolKey } from './builder-settings.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import { cardScoreBreakdown } from './recommendation-queue.ts'
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

test('with no theme, the first builder choice becomes the theme and rebuilds on Next', () => {
  const queue = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map(card)
  const start = initial({ commander: 'Leader', queue })
  const chosen = apply(start, { type: 'selectSubTheme', name: 'Artifacts' })
  assert.equal(chosen.theme, 'Artifacts')
  assert.deepEqual(chosen.activeSubThemes, [])
  // The current batch stays on screen; the changed pool key rebuilds on Next recommendations.
  assert.equal(chosen.recommendationOptionsChanged, false)
  assert.notEqual(builderPoolKey(chosen), start.committedPoolKey)
  const next = applyBuilderAction(chosen, { type: 'nextBatch' })
  assert.deepEqual(next.fetchRequests, [{ kind: 'pool', boundary: 'commitSettings' }])
  assert.equal(next.state.batchNumber, 1)
  const loaded = apply(next.state, {
    type: 'poolLoaded',
    queue,
    deferredCards: next.state.deferredCards,
    poolKey: builderPoolKey(chosen),
  })
  assert.equal(apply(loaded, { type: 'nextBatch' }).batchNumber, 2)
  // Scored under the Theme factor, not Extra themes.
  const score = cardScoreBreakdown(
    { ...card('Golem Foundry'), tags: ['Artifacts'] },
    buildRecommendationContext(loaded, []),
  )
  assert.ok(score.theme > 0)
  assert.equal(score.subThemes, 0)
})

test('later builder choices are extra themes, capped at two', () => {
  let state = apply(initial(), { type: 'selectSubTheme', name: 'Artifacts' })
  state = apply(state, { type: 'selectSubTheme', name: 'Tokens' })
  state = apply(state, { type: 'selectSubTheme', name: 'Artifacts' })
  state = apply(state, { type: 'selectSubTheme', name: 'Sacrifice' })
  state = apply(state, { type: 'selectSubTheme', name: 'Lifegain' })
  assert.equal(state.theme, 'Artifacts')
  assert.deepEqual(state.activeSubThemes, ['Tokens', 'Sacrifice'])
  const declared = apply(initial({ theme: 'Zombies' }), { type: 'selectSubTheme', name: 'Tokens' })
  assert.equal(declared.theme, 'Zombies')
  assert.deepEqual(declared.activeSubThemes, ['Tokens'])
  // A deck saved with extra themes but no theme promotes its first extra theme on the next choice.
  const legacy = apply(initial({ activeSubThemes: ['Tokens'] }), {
    type: 'selectSubTheme',
    name: 'Sacrifice',
  })
  assert.equal(legacy.theme, 'Tokens')
  assert.deepEqual(legacy.activeSubThemes, ['Sacrifice'])
})

test('removing the theme promotes the first extra theme and refreshes', () => {
  const state = initial({ theme: 'Artifacts', activeSubThemes: ['Tokens', 'Sacrifice'] })
  const removed = apply(state, { type: 'removeSubTheme', name: 'Artifacts' })
  assert.equal(removed.theme, 'Tokens')
  assert.deepEqual(removed.activeSubThemes, ['Sacrifice'])
  assert.equal(removed.recommendationOptionsChanged, true)
  const extra = apply(state, { type: 'removeSubTheme', name: 'Tokens' })
  assert.equal(extra.theme, 'Artifacts')
  assert.deepEqual(extra.activeSubThemes, ['Sacrifice'])
  const last = apply(initial({ theme: 'Artifacts' }), { type: 'removeSubTheme', name: 'Artifacts' })
  assert.equal(last.theme, '')
  assert.deepEqual(last.activeSubThemes, [])
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

test('deck budget setting normalises input and sets remaining budget from the main deck', () => {
  const priced = (name: string, price: string) => ({ ...card(name), price })
  const deck = [priced('Commander', '10.00'), priced('Rock', '2.50')]
  const budgeted = apply(initial({ deck }), { type: 'settings', settings: { deckBudget: 20 } })
  assert.equal(budgeted.deckBudget, 20)
  assert.equal(budgeted.recommendationOptionsChanged, true)
  assert.equal(buildRecommendationContext(budgeted, []).remainingBudget, 7.5)
  const cleared = apply(budgeted, {
    type: 'settings',
    settings: { deckBudget: '' as unknown as null },
  })
  assert.equal(cleared.deckBudget, null)
  assert.equal(buildRecommendationContext(cleared, []).remainingBudget, null)
  assert.equal(
    apply(budgeted, { type: 'settings', settings: { maxPrice: 3 } }).deckBudget,
    20,
    'other settings keep the budget',
  )
})

test('owned cards stay with the player across restores; Owned only rebuilds its pool', () => {
  const list = { cards: [{ name: 'Sol Ring', quantity: 2 }], updatedAt: '2026-11-12T10:00:00Z' }
  const ignoring = apply(initial(), { type: 'ownedCards', list })
  assert.deepEqual(ignoring.ownedCards, { 'sol ring': 2 })
  assert.equal(ignoring.recommendationOptionsChanged, false, 'Ignore needs no re-rank')
  const preferring = apply(initial({ ownershipMode: 'prefer' }), { type: 'ownedCards', list })
  assert.equal(preferring.recommendationOptionsChanged, true)
  assert.equal(builderPoolKey(preferring), builderPoolKey(initial({ ownershipMode: 'prefer' })))
  const only = apply(initial({ ownershipMode: 'only' }), { type: 'ownedCards', list })
  assert.notEqual(builderPoolKey(only), builderPoolKey(initial({ ownershipMode: 'only' })))
  const restored = apply(ignoring, { type: 'restore', state: initial() })
  assert.deepEqual(restored.ownedCards, { 'sol ring': 2 })
  assert.equal(restored.ownedRevision, list.updatedAt)
  const cleared = apply(ignoring, { type: 'ownedCards', list: null })
  assert.deepEqual(cleared.ownedCards, {})
  assert.equal(
    buildRecommendationContext({ ...preferring, ownershipMode: 'only' }, []).ownershipMode,
    'only',
  )
})

test('a restored queue drops unowned cards under Owned only and rebuilds its pool', () => {
  const list = { cards: [{ name: 'Mine', quantity: 1 }], updatedAt: '2026-11-12T10:00:00Z' }
  const current = apply(initial({ ownershipMode: 'only' }), { type: 'ownedCards', list })
  const saved = initial({ ownershipMode: 'only', queue: [card('Mine'), card('Theirs')] })
  const restored = apply(
    { ...current, recommendationOptionsChanged: false },
    {
      type: 'restore',
      state: saved,
    },
  )
  assert.deepEqual(
    restored.queue.map(({ name }) => name),
    ['Mine'],
  )
  assert.equal(restored.recommendationOptionsChanged, true)
  assert.notEqual(restored.committedPoolKey, builderPoolKey(restored), 'the pool rebuilds')
  // An already-owned queue restores untouched.
  const owned = initial({ ownershipMode: 'only', queue: [card('Mine')] })
  const kept = apply(current, { type: 'restore', state: owned })
  assert.equal(kept.queue, owned.queue)
  assert.equal(reconcileOwnership(initial({ queue: [card('Theirs')] })).queue.length, 1)
})
