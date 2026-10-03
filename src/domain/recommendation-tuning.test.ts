import assert from 'node:assert/strict'
import test from 'node:test'

import { rolesForCard } from '../deck-analysis.ts'
import { toCard, type Card } from './card-model.ts'
import {
  advanceRecommendationQueue,
  rankRecommendationCards,
  updatePreferenceScores,
} from './recommendation-queue.ts'
import { recommendationScore } from './recommendation-scoring.ts'
import type { RecommendationScoreContext } from './recommendation-types.ts'
import {
  focusedRecommendations,
  hasWaitingFocusedRecommendations,
  migrateRecommendationPriority,
  normalizeMaxPrice,
  suggestedPriceCap,
  withinPriceCap,
} from './recommendation-tuning.ts'

const context: RecommendationScoreContext = {
  theme: 'Tokens',
  activeSubThemes: [],
  pickedTags: new Set(),
  preferenceScores: {},
  neededRoles: new Set(),
  cardRoles: [],
}
const card = (name: string, detail = '', price?: string): Card => ({
  ...toCard(
    {
      name,
      type_line: 'Artifact',
      color_identity: [],
      set: 'tst',
      collector_number: '1',
      oracle_text: detail,
    },
    'Commander synergy',
  ),
  price,
})

test('legacy styles and health overrides fold into four priorities', () => {
  for (const [style, health, expected] of [
    ['thematic', false, 'thematic'],
    ['thematic', true, 'balanced'],
    ['balanced', false, 'thematic'],
    ['balanced', true, 'balanced'],
    ['competitive', false, 'competitive'],
    ['competitive', true, 'competitive'],
    ['fun', false, 'fun'],
    ['fun', true, 'fun'],
    ['story', false, 'thematic'],
    ['optimized', true, 'competitive'],
    ['unknown', undefined, 'balanced'],
  ] as const)
    assert.equal(migrateRecommendationPriority(style, health), expected)
})

test('price cap includes the boundary and unpriced cards, and offers a rounded cap', () => {
  for (const value of ['', ' ', null, undefined, false, true, [], -1, 'invalid', Infinity])
    assert.equal(normalizeMaxPrice(value), null)
  assert.equal(normalizeMaxPrice('5.25'), 5.25)
  assert.equal(normalizeMaxPrice('0'), 0)
  assert.equal(suggestedPriceCap({ price: '7.80' }), 7)
  assert.equal(suggestedPriceCap({ price: '0.50' }), 1)
  assert.equal(suggestedPriceCap({}), null)
  for (const price of [undefined, '', 'invalid', '5.00', '0']) assert(withinPriceCap({ price }, 5))
  assert(!withinPriceCap({ price: '5.01' }, 5))
  const cards = [card('Priced', '', '5.00'), card('Expensive', '', '5.01'), card('Unpriced')]
  assert.deepEqual(
    rankRecommendationCards(cards, { ...context, maxPrice: 5 }, false).map(({ name }) => name),
    ['Priced', 'Unpriced'],
  )
  assert.equal(rankRecommendationCards(cards, context, false).length, 3)
})

test('ignore reasons change existing preference scoring without treating cost as dislike', () => {
  const ignored = { ...card('Ignored'), tags: ['Artifacts'] }
  const decisions = { Ignored: 'ignore' as const }
  const scores = (reason: Parameters<typeof updatePreferenceScores>[4]) =>
    updatePreferenceScores([ignored], decisions, ['Ignored'], {}, reason, ['Tokens'])
  assert.deepEqual(scores({ Ignored: 'Not my style' }), { Artifacts: -3 })
  assert.deepEqual(scores({ Ignored: 'Too expensive' }), { Artifacts: 0 })
  assert.deepEqual(scores({ Ignored: 'Have something similar' }), { Artifacts: -2 })
  const offTheme = scores({ Ignored: 'Off-theme' })
  assert.deepEqual(offTheme, { Artifacts: -2, Tokens: 2 })
  const token = { ...card('Token pick'), tags: ['Tokens'] }
  assert(
    recommendationScore(token, { ...context, preferenceScores: offTheme }) >
      recommendationScore(token, context),
  )
  const artifact = { ...card('Artifact pick'), tags: ['Artifacts'] }
  assert(
    recommendationScore(artifact, {
      ...context,
      preferenceScores: scores({ Ignored: 'Not my style' }),
    }) < recommendationScore(artifact, context),
  )
  assert.deepEqual(
    updatePreferenceScores([ignored], { Ignored: 'later' }, [], {}, { Ignored: 'Off-theme' }, [
      'Tokens',
    ]),
    { Artifacts: 0 },
  )
})

test('focused batches have four role matches and preserve every unseen non-role candidate', () => {
  const ramps = Array.from({ length: 8 }, (_, i) => card(`Ramp ${i}`, '{T}: Add {G}.'))
  const other = Array.from({ length: 5 }, (_, i) => card(`Other ${i}`))
  const queue = [other[0], ramps[0], other[1], ...ramps.slice(1), ...other.slice(2)]
  const visible = focusedRecommendations(queue, 'ramp', rolesForCard).slice(0, 4)
  assert.equal(visible.length, 4)
  assert(visible.every((candidate) => rolesForCard(candidate).includes('ramp')))
  const next = advanceRecommendationQueue({
    queue,
    deferredCards: [],
    batchNumber: 3,
    decisions: {
      [visible[0].name]: 'add',
      [visible[1].name]: 'later',
      [visible[2].name]: 'ignore',
    },
    liked: [],
    preferenceScores: {},
    activeSubThemes: [],
    theme: '',
    includeCreature: false,
    focusedRole: 'ramp',
    cardRoles: rolesForCard,
    ignoreReasons: { [visible[2].name]: 'Not my style' },
  })
  assert.equal(next.batchNumber, 4)
  assert.equal(focusedRecommendations(next.queue, 'ramp', rolesForCard).slice(0, 4).length, 4)
  for (const candidate of other) assert(next.queue.some(({ name }) => name === candidate.name))
  assert.equal(
    next.deferredCards.find(({ card }) => card.name === visible[1].name)?.eligibleBatch,
    7,
  )
  assert.equal(
    next.deferredCards.find(({ card }) => card.name === visible[3].name)?.eligibleBatch,
    6,
  )
  assert(!next.queue.some(({ name }) => name === visible[2].name))
  assert.equal(focusedRecommendations(next.queue, null, rolesForCard), next.queue)
})

test('empty focused queues advance one batch without shortening role deferrals', () => {
  const ramp = card('Returning ramp', '{T}: Add {G}.')
  const other = card('Unseen other')
  const next = advanceRecommendationQueue({
    queue: [other],
    deferredCards: [
      { card: card('Other deferral'), eligibleBatch: 3 },
      { card: ramp, eligibleBatch: 7 },
    ],
    batchNumber: 3,
    decisions: {},
    liked: [],
    preferenceScores: {},
    activeSubThemes: [],
    theme: '',
    includeCreature: false,
    focusedRole: 'ramp',
    cardRoles: rolesForCard,
  })
  assert.equal(next.batchNumber, 4)
  assert.deepEqual(focusedRecommendations(next.queue, 'ramp', rolesForCard), [])
  assert(next.queue.some(({ name }) => name === other.name))
  assert.equal(next.deferredCards.find(({ card }) => card.name === ramp.name)?.eligibleBatch, 7)
})

test('focused empty-state return message requires an available matching deferral still waiting', () => {
  const ramp = card('Returning ramp', '{T}: Add {G}.')
  const waiting = [{ card: ramp, eligibleBatch: 5 }]
  assert.equal(hasWaitingFocusedRecommendations(waiting, 'ramp', 3, rolesForCard), true)
  assert.equal(hasWaitingFocusedRecommendations([], 'ramp', 3, rolesForCard), false)
  assert.equal(hasWaitingFocusedRecommendations(waiting, 'wipes', 3, rolesForCard), false)
  assert.equal(hasWaitingFocusedRecommendations(waiting, 'ramp', 5, rolesForCard), false)
  assert.equal(
    hasWaitingFocusedRecommendations(
      [{ ...waiting[0], available: false }],
      'ramp',
      3,
      rolesForCard,
    ),
    false,
  )
})

test('returning deferred cards respect the price cap too', () => {
  const next = advanceRecommendationQueue({
    queue: [],
    deferredCards: [
      { card: card('Too expensive', '', '8'), eligibleBatch: 3 },
      { card: card('Affordable', '', '2'), eligibleBatch: 3 },
    ],
    batchNumber: 2,
    decisions: {},
    liked: [],
    preferenceScores: {},
    activeSubThemes: [],
    theme: '',
    includeCreature: false,
    maxPrice: 5,
  })
  assert.deepEqual(
    next.queue.map(({ name }) => name),
    ['Affordable'],
  )
})
