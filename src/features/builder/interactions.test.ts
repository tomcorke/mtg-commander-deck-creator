import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets, rolesForCard } from '../../deck-analysis.ts'
import { persistedDeckStateSchema } from '../../deck-state.ts'
import { toCard, toDeckCard, type Card } from '../../domain/card-model.ts'
import { rankRecommendationCards, releaseNextDeferred } from '../../recommendations.ts'
import { decide } from '../../app/deck-actions.ts'
import { buildRecommendationContext } from '../../app/recommendation-context.ts'
import {
  recommendationPoolKey,
  start,
  type ActionDeps,
  type RecommendationProgress,
} from '../../app/recommendation-actions.ts'
import {
  nextBatch,
  refreshRecommendationSettings,
  type BuilderInteractionDeps,
} from './interactions.ts'

const raw = (name: string, set = 'tst') => ({
  name,
  type_line: 'Artifact',
  color_identity: [],
  set,
  collector_number: '1',
  prints_search_uri: '',
  finishes: ['nonfoil' as const],
})

function fixture() {
  const names = ['Later', 'Added', 'Ignored', 'Liked']
  const records = [
    ...names.map((name) => raw(name)),
    ...Array.from({ length: 48 }, (_, index) => raw(`Unseen ${index}`)),
    raw('Existing deferred'),
    raw('Outside', 'other'),
  ]
  const state: Record<string, any> = {
    commander: 'Commander',
    commanderDetails: { images: [], art: [], colours: [], printings: [], selections: [] },
    activeModal: null,
    activeSubThemes: [],
    dismissedSubThemes: [],
    commanderSubThemes: [],
    collectionMode: 'none',
    collectionSets: [],
    collectionGroups: [],
    deck: [toDeckCard(raw('Commander'))],
    sideboard: [],
    deckTargets: defaultDeckTargets,
    queue: records.slice(0, -2).map((record) => ({
      ...toCard(record, 'Popular inclusion'),
      tags: [`${record.name} tag`],
    })),
    deferredCards: [
      { card: toCard(raw('Existing deferred'), 'Popular inclusion'), eligibleBatch: 10 },
    ],
    batchNumber: 7,
    decisions: {},
    liked: [],
    ignoredCards: [],
    preferenceScores: { Existing: 3 },
    theme: '',
    includeCreature: false,
    powerTarget: 'upgraded',
    excludeGameChangers: true,
    excludeTutors: true,
    excludeExtraTurns: true,
    excludeUnreleased: true,
    prioritizeDeckHealth: false,
    recommendationStyle: 'balanced',
    recommendationOptionsChanged: false,
    recommendationState: 'idle',
    limitedRecommendations: false,
    preferredPrintSet: '',
    recommendationRefreshInFlight: { current: false },
  }
  state.recommendationPoolKey = { current: recommendationPoolKey(state) }
  for (const key of [
    ...Object.keys(state),
    'batchAnnouncement',
    'collectionError',
    'collectionState',
    'collectionPoolSize',
    'recommendationLoadingStep',
    'recommendationLoadingTitle',
  ]) {
    state[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: any) => {
      state[key] = typeof value === 'function' ? value(state[key]) : value
    }
  }
  state.navigateView = () => {}
  state.freshRecommendationCycle = () => assert.fail('Settings must not start a fresh cycle')
  state.fetchCard = async (name: string) => raw(name)
  state.fetchPrintings = async () => []
  state.fetchEdhrec = async () => ({
    container: {
      json_dict: {
        cardlists: [{ header: 'High Synergy Cards', tag: 'highsynergy', cardviews: records }],
      },
    },
  })
  state.fetchCards = async (ids: { name: string }[]) =>
    records.filter((record) => ids.some(({ name }) => record.name === name))
  state.searchCards = async () => assert.fail('Fixture should not use fallback search')
  state.fetchCollection = async () => records.filter(({ set }) => set === 'tst')
  state.rankRecommendationCards = rankRecommendationCards
  state.loadPrintings = async () => {}
  const deps = state as BuilderInteractionDeps & ActionDeps
  state.start = (name: string, preserveDeck?: boolean, progress?: RecommendationProgress) =>
    start({ ...deps }, name, preserveDeck, progress)
  return deps
}

function chooseBatch(deps: BuilderInteractionDeps & ActionDeps) {
  const batch: Card[] = deps.queue.slice(0, 4)
  decide(deps, batch[0], 'later')
  decide(deps, batch[1], 'add')
  decide(deps, batch[2], 'ignore')
  deps.setLiked(['Added', 'Liked'])
}

const hasCard = (cards: Card[], name: string) => cards.some((card) => card.name === name)

test('ranking refresh records decisions and likes without spending undecided cards or the batch', async () => {
  const deps = fixture()
  chooseBatch(deps)
  deps.start = async () => assert.fail('Ranking-only settings must not re-fetch')
  deps.recommendationStyle = 'competitive'
  deps.prioritizeDeckHealth = true
  deps.includeCreature = true
  deps.recommendationOptionsChanged = true
  const candidates = deps.queue.filter(
    (card: Card) => !['Later', 'Added', 'Ignored'].includes(card.name),
  )

  await refreshRecommendationSettings(deps)

  assert.equal(deps.batchNumber, 7)
  assert.equal(deps.recommendationOptionsChanged, false)
  assert.deepEqual(deps.decisions, {})
  assert.deepEqual(deps.liked, [])
  assert.equal(deps.preferenceScores['Added tag'], 6)
  assert.equal(deps.preferenceScores['Liked tag'], 4)
  assert.equal(deps.preferenceScores['Ignored tag'], -1)
  assert.equal(deps.preferenceScores.Existing, 3)
  assert.ok(hasCard(deps.deck, 'Added'))
  assert.deepEqual(deps.ignoredCards, ['Ignored'])
  assert.ok(hasCard(deps.queue, 'Liked'), 'A like must not spend an undecided card')
  assert.deepEqual(
    deps.deferredCards.map(({ card, eligibleBatch }: { card: Card; eligibleBatch: number }) => [
      card.name,
      eligibleBatch,
    ]),
    [
      ['Existing deferred', 10],
      ['Later', 11],
    ],
  )
  assert.deepEqual(
    deps.queue,
    rankRecommendationCards(
      candidates,
      buildRecommendationContext(deps, candidates),
      true,
      rolesForCard,
    ),
  )

  deps.prioritizeDeckHealth = false
  deps.recommendationOptionsChanged = true
  await refreshRecommendationSettings(deps)
  assert.equal(deps.batchNumber, 7)
  assert.equal(deps.preferenceScores['Liked tag'], 4, 'Recorded likes must not be counted twice')
  for (let batchNumber = 8; batchNumber <= 10; batchNumber++) {
    await nextBatch(deps)
    assert.equal(deps.batchNumber, batchNumber)
    assert.ok(!hasCard(deps.queue, 'Later'))
    assert.equal(
      deps.deferredCards.find(({ card }: { card: Card }) => card.name === 'Later').eligibleBatch,
      11,
    )
  }
  await nextBatch(deps)
  assert.equal(deps.batchNumber, 11)
  assert.ok(hasCard(deps.queue, 'Later'))
  assert.ok(!hasCard(deps.queue, 'Added'))
  assert.ok(!hasCard(deps.queue, 'Ignored'))
})

test('Only refresh keeps ignores and all deferrals, including cards temporarily outside the pool', async () => {
  const deps = fixture()
  chooseBatch(deps)
  deps.deferredCards.push({
    card: toCard(raw('Outside', 'other'), 'Popular inclusion'),
    eligibleBatch: 8,
  })
  const fetchCollection = deps.fetchCollection
  let fetches = 0
  deps.fetchCollection = async (...args: unknown[]) => {
    fetches++
    return fetchCollection(...args)
  }
  deps.collectionSets = ['tst']
  deps.collectionMode = 'only'
  deps.recommendationOptionsChanged = true

  await refreshRecommendationSettings(deps)

  assert.equal(fetches, 1)
  assert.equal(deps.batchNumber, 7)
  assert.equal(deps.recommendationOptionsChanged, false)
  assert.equal(deps.recommendationPoolKey.current, recommendationPoolKey(deps))
  assert.ok(deps.queue.every((card: Card) => card.collectionMatch))
  assert.ok(
    !['Later', 'Added', 'Ignored', 'Outside', 'Existing deferred'].some((name) =>
      hasCard(deps.queue, name),
    ),
  )
  assert.equal(deps.preferenceScores['Added tag'], 6)
  assert.equal(deps.preferenceScores['Liked tag'], 4)
  const outside = deps.deferredCards.find(({ card }: { card: Card }) => card.name === 'Outside')
  assert.equal(outside.eligibleBatch, 8)
  assert.equal(outside.available, false)
  const persisted = persistedDeckStateSchema.parse(deps)
  assert.equal(
    persisted.deferredCards.find(({ card }) => card.name === 'Outside')?.available,
    false,
  )

  for (let batchNumber = 8; batchNumber <= 10; batchNumber++) {
    await nextBatch(deps)
    assert.equal(deps.batchNumber, batchNumber)
    assert.ok(!hasCard(deps.queue, 'Later'))
    assert.ok(
      !hasCard(deps.queue, 'Outside'),
      'Off-pool deferred cards must never leak into Only mode',
    )
    assert.ok(deps.deferredCards.some(({ card }: { card: Card }) => card.name === 'Outside'))
  }
  deps.collectionSets = []
  deps.collectionMode = 'none'
  deps.recommendationOptionsChanged = true
  await refreshRecommendationSettings(deps)
  assert.equal(deps.batchNumber, 10)
  assert.ok(
    hasCard(deps.queue, 'Outside'),
    'Restored settings release a card whose original cooldown elapsed',
  )
  assert.ok(!hasCard(deps.queue, 'Later'))
  assert.ok(!hasCard(deps.queue, 'Ignored'))
  await nextBatch(deps)
  assert.equal(deps.batchNumber, 11)
  assert.ok(hasCard(deps.queue, 'Later'))
})

test('Prefer on and off re-fetch because selected collection cards change the candidate pool', async () => {
  const deps = fixture()
  const collectionOnly = raw('Collection-only pick')
  let fetches = 0
  deps.fetchCollection = async () => {
    fetches++
    return [collectionOnly, ...Array.from({ length: 4 }, (_, index) => raw(`Set pick ${index}`))]
  }
  deps.collectionMode = 'prefer'
  deps.collectionSets = ['tst']
  deps.recommendationOptionsChanged = true
  await refreshRecommendationSettings(deps)
  assert.equal(fetches, 1)
  assert.ok(hasCard(deps.queue, collectionOnly.name))
  assert.equal(deps.batchNumber, 7)

  deps.deferredCards.push({ card: toCard(collectionOnly, 'Collection match'), eligibleBatch: 11 })
  deps.collectionMode = 'none'
  deps.collectionSets = []
  deps.recommendationOptionsChanged = true
  await refreshRecommendationSettings(deps)
  assert.equal(fetches, 1, 'Turning Prefer off fetches the core pool, not the collection')
  assert.ok(!hasCard(deps.queue, collectionOnly.name))
  assert.equal(
    deps.deferredCards.find(({ card }: { card: Card }) => card.name === collectionOnly.name)
      .available,
    false,
  )
  assert.equal(deps.batchNumber, 7)
})

test('pool refresh failure and Retry retain progress and do not record feedback twice', async () => {
  const deps = fixture()
  chooseBatch(deps)
  const previousKey = deps.recommendationPoolKey.current
  const fetchCollection = deps.fetchCollection
  let attempts = 0
  deps.fetchCollection = async () => {
    attempts++
    throw new Error('Collection unavailable')
  }
  deps.collectionMode = 'only'
  deps.collectionSets = ['tst']
  deps.recommendationOptionsChanged = true
  await Promise.all([refreshRecommendationSettings(deps), refreshRecommendationSettings(deps)])
  assert.equal(attempts, 1)
  assert.equal(deps.recommendationState, 'error')
  assert.equal(deps.recommendationOptionsChanged, true)
  assert.equal(deps.recommendationPoolKey.current, previousKey)
  assert.equal(deps.batchNumber, 7)
  assert.equal(deps.preferenceScores['Added tag'], 6)
  assert.equal(deps.preferenceScores['Liked tag'], 4)
  assert.equal(
    deps.deferredCards.find(({ card }: { card: Card }) => card.name === 'Later').eligibleBatch,
    11,
  )
  assert.ok(hasCard(deps.deck, 'Added'))
  deps.fetchCollection = fetchCollection
  await deps.start(deps.commander, true)
  assert.equal(deps.recommendationState, 'idle')
  assert.equal(deps.recommendationOptionsChanged, false)
  assert.equal(deps.batchNumber, 7)
  assert.equal(deps.preferenceScores['Liked tag'], 4)
  assert.ok(!hasCard(deps.queue, 'Later'))
  assert.ok(!hasCard(deps.queue, 'Ignored'))
})

test('pool key ignores ranking controls but includes every fetch constraint', () => {
  const deps = fixture()
  const key = recommendationPoolKey(deps)
  for (const change of [
    { recommendationStyle: 'thematic' },
    { prioritizeDeckHealth: true },
    { includeCreature: true },
    { deckTargets: { ...defaultDeckTargets, draw: 20 } },
  ])
    assert.equal(recommendationPoolKey({ ...deps, ...change }), key)
  for (const change of [
    { powerTarget: 'high' },
    { excludeGameChangers: false },
    { excludeTutors: false },
    { excludeExtraTurns: false },
    { excludeUnreleased: false },
    { collectionMode: 'prefer' },
    { collectionMode: 'only' },
    { collectionSets: ['tst'] },
    { activeSubThemes: ['Tokens'] },
    { theme: 'Tokens' },
  ])
    assert.notEqual(recommendationPoolKey({ ...deps, ...change }), key)
  assert.equal(
    recommendationPoolKey({ ...deps, collectionSets: ['a', 'b'] }),
    recommendationPoolKey({ ...deps, collectionSets: ['b', 'a'] }),
  )
})

test('unavailable deferrals do not shorten or force a jump past an available cooldown', () => {
  const blocked = { card: raw('Blocked'), eligibleBatch: 3, available: false }
  const available = { card: raw('Available'), eligibleBatch: 5 }
  const released = releaseNextDeferred([blocked, available], 2, false)
  assert.equal(released.batchNumber, 5)
  assert.deepEqual(released.ready, [available.card])
  assert.deepEqual(released.waiting, [blocked])
  assert.deepEqual(releaseNextDeferred([blocked], 2, false), {
    batchNumber: 2,
    ready: [],
    waiting: [blocked],
  })
})
