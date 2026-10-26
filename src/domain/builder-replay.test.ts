import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBuilderAction,
  builderPoolKey,
  createBuilderState,
  type BuilderAction,
  type BuilderState,
} from '../recommendations.ts'
import { toCard, toDeckCard, type ScryfallCard } from './card-model.ts'
import { cardDataKey } from './card-data.ts'
import { ignoreReasons } from './recommendation-tuning.ts'

const raw = (name: string, changes: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
  game_changer: false,
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: name,
  oracle_text: '',
  ...changes,
})
const card = (name: string) => toCard(raw(name), 'Commander synergy')
const state = (changes: Partial<BuilderState> = {}): BuilderState => ({
  ...createBuilderState('2026-10-26', 'build'),
  ...changes,
})
const run = (state: BuilderState, action: BuilderAction) => {
  const result = applyBuilderAction(state, action)
  assert.equal(result.error, undefined)
  return result.state
}
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    Object.values(value).forEach(freeze)
  }
  return value
}

test('all styles and ignore reasons replay identically with frozen, cloned and interleaved inputs', () => {
  for (const style of ['balanced', 'thematic', 'fun', 'competitive'] as const)
    for (const reason of ignoreReasons) {
      const queue = Array.from({ length: 12 }, (_, i) => ({
        ...card(`Card ${i}`),
        tags: ['Tokens'],
      }))
      let first = state({ queue })
      let second = structuredClone(first)
      const log: BuilderAction[] = [
        { type: 'settings', settings: { recommendationStyle: style } },
        { type: 'commitSettings' },
        { type: 'decide', card: queue[0], decision: 'later' },
        { type: 'like', name: queue[1].name },
        { type: 'decide', card: queue[2], decision: 'ignore' },
        { type: 'ignoreReason', name: queue[2].name, reason },
        { type: 'nextBatch' },
      ]
      for (const action of log) {
        const result = applyBuilderAction(freeze(first), freeze(action))
        applyBuilderAction(state(), { type: 'theme', theme: 'Unrelated' })
        const replay = applyBuilderAction(structuredClone(second), structuredClone(action))
        assert.deepEqual(result, replay)
        first = result.state
        second = replay.state
      }
      assert.equal(first.batchNumber, 2)
      assert.deepEqual(first.ignoreReasons, {})
    }
})

test('next batch detects pending pool settings from state without a controller reference', () => {
  const initial = state({ queue: ['A', 'B', 'C', 'D', 'E'].map(card) })
  const selected = run(initial, { type: 'selectSubTheme', name: 'Tokens' })
  assert.equal(selected.recommendationOptionsChanged, false)
  const refreshed = applyBuilderAction(selected, { type: 'nextBatch' })
  assert.equal(refreshed.state.batchNumber, 1)
  assert.deepEqual(refreshed.fetchRequests, [{ kind: 'pool', boundary: 'commitSettings' }])
  const loaded = run(refreshed.state, {
    type: 'poolLoaded',
    queue: selected.queue,
    deferredCards: refreshed.state.deferredCards,
    poolKey: builderPoolKey(selected),
  })
  assert.equal(run(loaded, { type: 'nextBatch' }).batchNumber, 2)
})

test('single commanders and pairs validate metadata and derive identity from the cards', () => {
  const details = { images: [], art: [], colours: ['R'], printings: [], selections: [] }
  const partner = (name: string, colour: string) =>
    toDeckCard(
      raw(name, {
        type_line: 'Legendary Creature — Elf',
        color_identity: [colour],
        oracle_text: 'Partner',
      }),
    )
  const alpha = partner('Alpha', 'G')
  const bravo = partner('Bravo', 'U')
  const single = run(state(), {
    type: 'commanders',
    cards: [alpha],
    details,
    signatureDeckKey: 'single',
  })
  assert.deepEqual(single.commanderDetails?.colours, ['G'])
  const pair = run(state(), {
    type: 'commanders',
    cards: [alpha, bravo],
    details,
    signatureDeckKey: 'pair',
  })
  assert.equal(pair.commander, 'Alpha & Bravo')
  assert.deepEqual(pair.commanderDetails?.colours, ['G', 'U'])
  assert.ok(
    applyBuilderAction(state(), {
      type: 'commanders',
      cards: [alpha, { ...bravo, detail: '' }],
      details,
      signatureDeckKey: 'invalid',
    }).error,
  )
  assert.ok(
    applyBuilderAction(state(), {
      type: 'commanders',
      cards: [{ ...alpha, colorIdentity: undefined }],
      details,
      signatureDeckKey: 'unknown',
    }).error,
  )
})

test('the reducer owns overflow, explicit zone choices, copy checks and free zone moves', () => {
  const deck = Array.from({ length: 100 }, (_, i) => toDeckCard(raw(`Owned ${i}`)))
  const full = state({ deck })
  const overflow = run(full, { type: 'decide', card: card('New'), decision: 'add' })
  assert.equal(overflow.deck.length, 100)
  assert.equal(overflow.sideboard[0].name, 'New')
  const explicit = run(full, { type: 'chooseZone', zone: 'deck' })
  assert.equal(run(explicit, { type: 'addGuidance', card: card('New') }).deck.length, 101)
  const searched = run(state({ deck: deck.slice(0, 99) }), {
    type: 'addSearch',
    cards: [raw('A'), raw('B')],
  })
  assert.equal(searched.deck.length, 100)
  assert.equal(searched.sideboard[0].name, 'B')
  const moved = run(overflow, { type: 'moveCard', board: 'sideboard', index: 0 })
  assert.equal(moved.deck.length, 101)
  assert.deepEqual(moved.sideboard, [])
  assert.ok(applyBuilderAction(explicit, { type: 'addCollection', card: raw('Owned 0') }).error)
  assert.equal(run(full, { type: 'removeCard', board: 'deck', index: -1 }), full)
  const removed = run(overflow, { type: 'removeCard', board: 'sideboard', index: 0 })
  assert.equal(removed.decisions.New, undefined)
})

test('basic fill validates counts, caps at 100, and a row addition can go past 100', () => {
  const basic = toDeckCard(raw('Wastes', { type_line: 'Basic Land', cmc: 0 }))
  const full = state({ deck: Array.from({ length: 99 }, (_, i) => toDeckCard(raw(`Owned ${i}`))) })
  const filled = run(full, { type: 'addBasics', cards: [{ card: basic, count: 3 }] })
  assert.equal(filled.deck.length, 100)
  assert.equal(run(filled, { type: 'addOneBasic', card: basic }).deck.length, 101)
  for (const count of [-1, 1.5, 101])
    assert.ok(
      applyBuilderAction(full, { type: 'addBasics', cards: [{ card: basic, count }] }).error,
    )
  assert.ok(
    applyBuilderAction(full, { type: 'addBasics', cards: [{ card: card('Not basic'), count: 1 }] })
      .error,
  )
})

test('hydration is data-only, refreshes identity, and preserves the selected printing', () => {
  const original = {
    ...card('Leader'),
    dataStatus: 'pending' as const,
    image: 'selected-art',
    finish: 'foil' as const,
  }
  const initial = state({
    commander: 'Leader',
    commanderDetails: {
      images: ['selected-art'],
      art: [],
      colours: [],
      printings: [],
      selections: [],
    },
    deck: [original],
    queue: [{ ...card('Queued'), dataStatus: 'pending' }],
    deferredCards: [{ card: { ...card('Deferred'), dataStatus: 'pending' }, eligibleBatch: 5 }],
  })
  const action: BuilderAction = {
    type: 'hydrate',
    results: [[cardDataKey(original), raw('Leader', { color_identity: ['G'] })]],
  }
  const hydrated = run(freeze(initial), freeze(action))
  assert.deepEqual(hydrated, run(structuredClone(initial), structuredClone(action)))
  assert.deepEqual(hydrated.commanderDetails?.colours, ['G'])
  assert.equal(hydrated.deck[0].image, 'selected-art')
  assert.equal(hydrated.deck[0].finish, 'foil')
  assert.equal(hydrated.queue[0].dataStatus, 'unavailable')
  assert.equal(hydrated.deferredCards[0].eligibleBatch, 5)
  const retry = run(hydrated, { type: 'retryData' })
  assert.equal(retry.queue[0].dataStatus, 'pending')
  assert.equal(retry.deck[0], hydrated.deck[0])
})

test('printing actions update ranking inputs and protect newer manual choices', () => {
  const original = { ...card('A'), image: 'manual', printingManuallySelected: true }
  const printings = [{ image: 'automatic', set: 'new', collectorNumber: '2', price: '9' }]
  const initial = state({ queue: [original] })
  const automatic: BuilderAction = {
    type: 'printing',
    board: 'queue',
    index: 0,
    name: 'A',
    printings,
    selection: 0,
    automatic: true,
  }
  assert.equal(run(initial, automatic), initial)
  const selected = run(initial, { ...automatic, automatic: false })
  assert.equal(selected.queue[0].price, '9')
  assert.equal(selected.queue[0].set, 'new')
  assert.equal(run(initial, { ...automatic, name: 'Stale card' }), initial)
  assert.equal(run(initial, { ...automatic, selection: -1 }), initial)
})

test('build lifecycle takes IDs and dates from actions and preserves resolved preferences', () => {
  const previous = state({
    recommendationStyle: 'fun',
    maxPrice: 5,
    theme: 'Tokens',
    activeSubThemes: ['Artifacts'],
    deck: [card('Owned')],
    sideboard: [card('Later')],
    batchNumber: 9,
  })
  const action: BuilderAction = {
    type: 'beginRecommendations',
    commander: 'Leader',
    preserveDeck: false,
    today: '2026-11-01',
    signatureDeckKey: 'new-build',
    extraCreatureTypes: ['Elf', 'Druid', 'Wizard'],
  }
  const begun = run(previous, action)
  assert.equal(begun.today, '2026-11-01')
  assert.equal(begun.signatureDeckKey, 'new-build')
  assert.equal(begun.recommendationStyle, 'fun')
  assert.equal(begun.theme, 'Tokens')
  assert.deepEqual(begun.activeSubThemes, ['Elf', 'Druid'])
  assert.deepEqual(begun.deck, [])
  const refreshed = run(previous, {
    ...action,
    preserveDeck: true,
    progress: { batchNumber: 9, deferredCards: [], preferenceScores: { Tokens: 3 } },
  })
  assert.equal(refreshed.today, previous.today)
  assert.equal(refreshed.signatureDeckKey, previous.signatureDeckKey)
  assert.equal(refreshed.deck, previous.deck)
  const cleared = run(previous, {
    type: 'startOver',
    today: '2026-11-02',
    signatureDeckKey: 'empty',
  })
  assert.equal(cleared.maxPrice, 5)
  assert.equal(cleared.theme, '')
  assert.deepEqual(cleared.sideboard, [])
  assert.deepEqual(applyBuilderAction(previous, { type: 'discoverDoctor' }).fetchRequests, [
    { kind: 'doctor-candidates', boundary: 'deckEdit' },
  ])
})

test('promotion uses shared construction rules and moves displaced cards to the sideboard', () => {
  const candidate = toDeckCard(raw('New leader', { type_line: 'Legendary Creature — Elf' }))
  const previous = state({
    commander: 'Old leader',
    deck: [
      card('Old leader'),
      candidate,
      ...Array.from({ length: 99 }, (_, i) => card(`Owned ${i}`)),
    ],
  })
  const promoted = run(previous, {
    type: 'promote',
    candidate,
    outgoingNames: ['Old leader'],
    keepOutgoing: true,
    details: null,
  })
  assert.equal(promoted.commander, 'New leader')
  assert.equal(promoted.deck.length, 100)
  assert.equal(promoted.sideboard.length, 1)
  assert.equal(promoted.deck[0].name, 'New leader')
  assert.ok(
    applyBuilderAction(previous, {
      type: 'promote',
      candidate: card('Not legendary'),
      outgoingNames: ['Old leader'],
      keepOutgoing: false,
      details: null,
    }).error,
  )
})
