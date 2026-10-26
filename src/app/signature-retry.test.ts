import { cardDataKey } from '../domain/card-data.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBuilderAction,
  createBuilderState,
  builderPoolKey,
  planFetches,
  type BuilderState,
  type PlannedFetch,
  type FetchResponse,
} from '../recommendations.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { executeSignatureFetch } from './signature-actions.ts'
import { nextBatch } from '../features/builder/interactions.ts'
import type { AppActionContext } from './builder-action.ts'
const raw = (name: string, text = 'Put a +1/+1 counter on target creature.'): ScryfallCard => ({
  name,
  type_line: 'Creature',
  oracle_text: text,
  color_identity: ['G'],
  cmc: 2,
  legalities: { commander: 'legal' },
  game_changer: false,
  released_at: '2020-01-01',
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
})
const initial = (): BuilderState => {
  const state: BuilderState = {
    ...createBuilderState('2026-10-26', 'build'),
    commander: 'Commander',
    commanderDetails: { colours: ['G'], images: [], art: [], printings: [], selections: [] },
    deck: [
      toDeckCard(raw('Commander', '')),
      toDeckCard(
        raw(
          'Engine A',
          'If a +1/+1 counter would be put on a creature, put an additional one instead.',
        ),
      ),
      toDeckCard(raw('Engine B', '{G}: Put a +1/+1 counter on target creature.')),
      toDeckCard(raw('Peer')),
    ],
    queue: Array.from({ length: 12 }, (_, i) => toCard(raw(`Queued ${i}`), 'Initial')),
  }
  return { ...state, committedPoolKey: builderPoolKey(state) }
}
const page = (name: string) => ({
  container: {
    json_dict: {
      cardlists: [
        { tag: 'creatures', header: 'Creatures', cardviews: [{ name, lift: 2, num_decks: 200 }] },
      ],
    },
  },
})
const settle = (state: BuilderState, work: PlannedFetch, response: FetchResponse) =>
  applyBuilderAction(state, { type: 'settleFetch', id: work.id, response }).state
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    Object.values(value).forEach(freeze)
  }
  return value
}

test('atomic quotas, ordered settlement, missing and duplicated responses, and frozen replay', () => {
  const start = freeze(initial())
  const planned = applyBuilderAction(start, { type: 'nextBatch' }).state
  assert.equal(planned.batchNumber, 1)
  assert.equal(planned.pendingFetches.length, 2)
  assert.deepEqual(planFetches(planned).state, planned)
  assert.equal(planned.signatureQuota.pages, 2)
  const works = planned.pendingFetches
  const forward = works.reduce(
    (state, work, i) => settle(state, work, { outcome: 'success', page: page(`New ${i}`) }),
    planned,
  )
  let reversed = settle(planned, works[1], { outcome: 'success', page: page('New 1') })
  assert.equal(reversed.batchNumber, 1) // Missing is pending, never failure.
  assert.deepEqual(reversed.queue, start.queue)
  assert.equal(reversed.completedFetches.length, 0)
  assert.equal(settle(reversed, works[1], { outcome: 'success-empty' }), reversed)
  reversed = settle(reversed, works[0], { outcome: 'success', page: page('New 0') })
  assert.deepEqual(forward, reversed)
  assert.deepEqual(forward.pendingFetches[0].request.kind, 'signature-cards')
  const lookup = forward.pendingFetches[0]
  const response: FetchResponse = { outcome: 'success', cards: [raw('New 1'), raw('New 0')] }
  const complete = settle(freeze(forward), lookup, response)
  assert.equal(complete.batchNumber, 2)
  assert(complete.queue.some((card) => card.name === 'New 0'))
  assert(complete.queue.some((card) => card.name === 'New 1'))
  assert.deepEqual(complete, settle(structuredClone(reversed), lookup, structuredClone(response)))
  assert.equal(settle(complete, lookup, response), complete)
  assert.equal(complete.signatureQuota.cards, 1)
})

test('stale commander, workspace and settings completions are ignored', () => {
  for (const changes of [{ signatureDeckKey: 'other' }, { commander: 'Other' }, { maxPrice: 1 }]) {
    const planned = applyBuilderAction(initial(), { type: 'nextBatch' }).state
    const changed = applyBuilderAction(planned, { type: 'data', changes }).state
    assert.equal(changed.fetchBoundary, null)
    assert.equal(
      settle(changed, planned.pendingFetches[0], { outcome: 'success', page: page('Old') }),
      changed,
    )
  }
})

test('transient and cancelled attempts retry only at later boundaries; per-build quota does not refill', () => {
  let state = initial()
  for (let boundary = 0; boundary < 4; boundary++) {
    state = applyBuilderAction(state, { type: 'nextBatch' }).state
    assert.equal(state.pendingFetches[0].attempt, boundary + 1)
    const work = [...state.pendingFetches]
    for (const item of work)
      state = settle(state, item, { outcome: boundary % 2 ? 'cancelled' : 'transient-failure' })
    assert.equal(state.batchNumber, boundary + 2)
  }
  assert.equal(state.signatureQuota.pages, 8)
  state = applyBuilderAction(state, { type: 'nextBatch' }).state
  assert.equal(state.pendingFetches.length, 0)
  assert.equal(state.signatureQuota.pages, 8)
  const independent = applyBuilderAction(initial(), { type: 'nextBatch' }).state
  assert.equal(independent.signatureQuota.pages, 2)
  const reset = applyBuilderAction(state, {
    type: 'startOver',
    today: state.today,
    signatureDeckKey: 'new',
  }).state
  assert.deepEqual(reset.signatureQuota, { pages: 0, cards: 0 })
})

test('partial and malformed responses settle without resurrecting ignored or deferred cards', () => {
  let state = initial()
  state.decisions = { 'Queued 0': 'later' }
  state.ignoredCards = ['Blocked']
  state = applyBuilderAction(state, { type: 'nextBatch' }).state
  for (const [i, work] of [...state.pendingFetches].entries())
    state = settle(
      state,
      work,
      i ? { outcome: 'invalid' } : { outcome: 'success', page: page('New') },
    )
  state = settle(state, state.pendingFetches[0], {
    outcome: 'partial',
    cards: [raw('New'), { name: 'Malformed' } as ScryfallCard, raw('Blocked')],
  })
  assert.equal(state.batchNumber, 2)
  assert(state.deferredCards.some(({ card }) => card.name === 'Queued 0'))
  assert(!state.queue.some(({ name }) => ['Blocked', 'Malformed', 'Queued 0'].includes(name)))
  assert(state.queue.some(({ name }) => name === 'New'))
})

test('app boundary handler and Node action replay match including signature additions', async () => {
  let current = initial(),
    replay = structuredClone(current)
  const host: AppActionContext = {
    ...current,
    builderState: current,
    getBuilderState: () => current,
    dispatchBuilder: (action) => {
      const actual = applyBuilderAction(current, action),
        expected = applyBuilderAction(replay, structuredClone(action))
      assert.deepEqual(actual, expected)
      current = actual.state
      replay = expected.state
      Object.assign(host, current, { builderState: current })
      return actual
    },
    recommendationState: 'idle',
    recommendationRefreshInFlight: { current: false },
    loadPrintings: async () => undefined,
    setBatchAnnouncement: () => undefined,
    start: async () => assert.fail('No pool refresh'),
  }
  await nextBatch(host)
  assert.equal(current.batchNumber, 1)
  const fetcher: typeof fetch = async (_url, init) =>
    Response.json(init?.body ? { data: [raw('New')] } : page('New'))
  while (current.pendingFetches.length) {
    const work = [...current.pendingFetches].reverse()
    for (const item of work)
      host.dispatchBuilder({
        type: 'settleFetch',
        id: item.id,
        response: await executeSignatureFetch(item, new AbortController().signal, fetcher),
      })
  }
  assert.equal(current.batchNumber, 2)
  assert(current.queue.some(({ name }) => name === 'New'))
  assert.deepEqual(current, replay)
})

test('short and exhausted queues keep newly fetched cards for the next batch', () => {
  for (const size of [0, 2, 4]) {
    let state = initial()
    state.queue = state.queue.slice(0, size)
    state = applyBuilderAction(state, { type: 'nextBatch' }).state
    for (const work of [...state.pendingFetches])
      state = settle(state, work, { outcome: 'success', page: page('New') })
    state = settle(state, state.pendingFetches[0], { outcome: 'success', cards: [raw('New')] })
    assert.equal(state.batchNumber, size ? 4 : 2)
    assert(state.queue.some(({ name }) => name === 'New'))
  }
})

test('settled page snapshots never resurrect a previously offered or consumed name', () => {
  let state = applyBuilderAction(initial(), { type: 'nextBatch' }).state
  for (const work of [...state.pendingFetches])
    state = settle(state, work, { outcome: 'success', page: page('Queued 0') })
  assert.equal(state.batchNumber, 2)
  assert(!state.queue.some(({ name }) => name === 'Queued 0'))
  state = applyBuilderAction(state, { type: 'nextBatch' }).state
  assert.equal(state.pendingFetches.length, 0)
  assert.equal(state.signatureQuota.cards, 0)
})

test('hydration is planned before signature discovery and never advances with a missing result', () => {
  const source = initial()
  source.deck[1] = { ...source.deck[1], dataStatus: 'pending' }
  let state = applyBuilderAction(source, { type: 'nextBatch' }).state
  assert.equal(state.pendingFetches[0].request.kind, 'current-data')
  assert.equal(state.signatureQuota.pages, 0)
  assert.equal(state.batchNumber, 1)
  state = settle(state, state.pendingFetches[0], { outcome: 'transient-failure' })
  assert.equal(state.deck[1].dataStatus, 'pending')
  assert.equal(state.batchNumber, 1) // Signature pages remain pending.
  for (const work of [...state.pendingFetches])
    state = settle(state, work, { outcome: 'success', page: page('New') })
  state = settle(state, state.pendingFetches[0], { outcome: 'success-empty', cards: [] })
  assert.equal(state.batchNumber, 2)
})

test('restoring the same workspace cannot accept a pre-restore completion with the same logical boundary', () => {
  const start = initial()
  const before = applyBuilderAction(start, { type: 'nextBatch' }).state
  const restored = applyBuilderAction(before, {
    type: 'restore',
    state: structuredClone(start),
  }).state
  const after = applyBuilderAction(restored, { type: 'nextBatch' }).state
  assert.notEqual(after.pendingFetches[0].id, before.pendingFetches[0].id)
  assert.equal(
    settle(after, before.pendingFetches[0], { outcome: 'success', page: page('Old') }),
    after,
  )
})

test('initialisation hydration finishing after Next cannot cancel its reserved boundary', () => {
  const source = initial()
  source.deck[1] = { ...source.deck[1], dataStatus: 'pending' }
  let state = applyBuilderAction(source, { type: 'nextBatch' }).state
  const reservation = state.pendingFetches[0]
  const hydration: [string, ScryfallCard][] = [
    [cardDataKey(source.deck[1]), raw('Engine A', source.deck[1].detail)],
  ]
  const standalone = applyBuilderAction(state, { type: 'hydrate', results: hydration })
  assert.equal(standalone.state, state)
  assert.equal(standalone.state.pendingFetches[0], reservation)
  state = settle(state, reservation, { outcome: 'success', hydration })
  assert.equal(state.deck[1].dataStatus, undefined)
  assert.equal(state.batchNumber, 1)
  for (const work of [...state.pendingFetches])
    state = settle(state, work, { outcome: 'success', page: page('New') })
  state = settle(state, state.pendingFetches[0], { outcome: 'success', cards: [raw('New')] })
  assert.equal(state.batchNumber, 2)
  assert(state.queue.some(({ name }) => name === 'New'))
})
