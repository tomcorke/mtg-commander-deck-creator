import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { toCard, type Card } from './card-model.ts'
import { excludedByOptions, releasedBy } from './recommendation-sources.ts'
import type { RecommendationStyle } from './recommendation-types.ts'
import {
  explainCard,
  prepareCandidates,
  recommend,
  seededShuffle,
  type RecommendState,
} from '../recommendations.ts'

const card = (name: string, options: { price?: string; type?: string; reason?: string } = {}) =>
  ({
    ...toCard(
      {
        name,
        type_line: options.type ?? 'Artifact',
        color_identity: [],
        set: 'tst',
        collector_number: '1',
        oracle_text: '',
        cmc: 2,
        legalities: { commander: 'legal' },
      },
      options.reason ?? 'Commander synergy',
    ),
    price: options.price,
  }) as Card

const pool = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map((name) => card(name))

const state = (overrides: Partial<RecommendState> = {}): RecommendState => ({
  commander: 'Commander',
  identity: [],
  pool,
  deck: [],
  sideboard: [],
  ignoredCards: [],
  deferredCards: [],
  batchNumber: 1,
  preferenceScores: {},
  theme: '',
  activeSubThemes: [],
  recommendationStyle: 'balanced',
  prioritizeDeckHealth: true,
  includeCreature: false,
  maxPrice: null,
  collectionMode: 'none',
  collectionSets: [],
  ...overrides,
})

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

test('the public API needs no React, DOM or Vite modules, so Node scripts can import it', () => {
  const root = dirname(fileURLToPath(import.meta.url))
  const seen = new Set<string>()
  const external = new Set<string>()
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const [, kind, specifier] of source.matchAll(
      /^(?:import|export)(\s+type)?[^'"]*from\s+'([^']+)'/gm,
    )) {
      if (kind) continue
      if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier))
      else external.add(specifier)
    }
  }
  visit(resolve(root, '../recommendations.ts'))
  // zod validates card data and runs anywhere.
  assert.deepEqual([...external], ['zod'])
})

test('seeded shuffles are stable permutations', () => {
  const items = Array.from({ length: 20 }, (_, index) => index)
  const first = seededShuffle(items, 'seed')
  assert.deepEqual(seededShuffle(items, 'seed'), first)
  assert.notDeepEqual(seededShuffle(items, 'other'), first)
  assert.deepEqual(
    [...first].sort((left, right) => left - right),
    items,
  )
})

test('release checks and queries use the supplied date', () => {
  const options = {
    excludeGameChangers: false,
    excludeTutors: false,
    excludeExtraTurns: false,
    excludeUnreleased: true,
    powerTarget: 'upgraded' as const,
  }
  const upcoming = {
    name: 'Upcoming',
    type_line: 'Artifact',
    color_identity: [],
    legalities: { commander: 'legal' },
    released_at: '2026-11-01',
  }
  assert.equal(excludedByOptions(upcoming, { ...options, today: '2026-10-31' }), true)
  assert.equal(excludedByOptions(upcoming, { ...options, today: '2026-11-01' }), false)
  assert.equal(releasedBy('2026-10-26'), 'date<=2026-10-26')
  assert.equal(releasedBy(), 'date<=today')
})

test('preparation keeps EDHREC first and falls back deterministically', () => {
  const options = {
    identity: [],
    includeCreature: false,
    collectionMode: 'none' as const,
    collectionSets: [],
    seed: 'pool',
  }
  const edhrec = prepareCandidates(
    { edhrec: { cards: pool.slice(0, 4) }, theme: [pool[4], pool[0]] },
    options,
  )
  assert.deepEqual(
    edhrec.pool.map(({ name }) => name),
    ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'],
  )
  assert.equal(edhrec.limited, false)

  const snapshots = {
    edhrec: { cards: pool.slice(0, 3) },
    fallback: { main: pool.slice(0, 4), mana: pool.slice(4) },
  }
  const fallback = prepareCandidates(snapshots, options)
  assert.equal(fallback.limited, true)
  assert.equal(fallback.pool.length, 6)
  assert.deepEqual(prepareCandidates(snapshots, options), fallback)
})

test('preparation applies collection modes', () => {
  const owned = card('Owned')
  const base = { identity: [], includeCreature: false, seed: 'pool' }
  const edhrec = { cards: pool.slice(0, 4) }
  assert.match(
    prepareCandidates({ edhrec }, { ...base, collectionMode: 'only', collectionSets: [] }).error!,
    /Select at least one collection/,
  )
  assert.deepEqual(
    prepareCandidates(
      { edhrec, collection: { cards: [owned] } },
      { ...base, collectionMode: 'prefer', collectionSets: ['tst'] },
    ).pool.map(({ name }) => name),
    ['Owned', 'Alpha', 'Bravo', 'Charlie', 'Delta'],
  )
  assert.deepEqual(
    prepareCandidates(
      { collection: { cards: [owned] } },
      { ...base, collectionMode: 'only', collectionSets: ['tst'] },
    ).pool,
    [owned],
  )
  assert.equal(
    prepareCandidates(
      { collection: { error: 'Scryfall down' } },
      { ...base, collectionMode: 'only', collectionSets: ['tst'] },
    ).error,
    'Scryfall down',
  )
  assert.equal(
    prepareCandidates(
      { edhrec, collection: { error: 'Scryfall down' } },
      { ...base, collectionMode: 'prefer', collectionSets: ['tst'] },
    ).pool.length,
    4,
  )
})

test('recommend is deterministic, leaves frozen input untouched and supports every style', () => {
  for (const style of ['thematic', 'fun', 'balanced', 'competitive'] as RecommendationStyle[]) {
    const input = deepFreeze(state({ recommendationStyle: style }))
    const first = recommend(input)
    assert.deepEqual(recommend(input), first)
    assert.equal(first.queue.length, 6)
    assert.equal(first.batch.length, 4)
    assert.equal(first.scores[0].scoringVersion, 2)
  }
})

test('recommend errors on fewer than four legal cards', () => {
  assert.equal(recommend(state({ pool: pool.slice(0, 3) })).error, 'Too few recommendation cards')
  assert.equal(
    recommend(state({ pool: pool.slice(0, 3), collectionMode: 'only' })).error,
    'Your chosen sets have too few legal cards.',
  )
})

test('recommend reports why cards were left out', () => {
  const priced = [...pool, card('Exact', { price: '5' }), card('Pricey', { price: '5.01' })]
  const result = recommend(
    state({
      pool: priced,
      ignoredCards: ['Alpha'],
      deferredCards: [{ card: pool[1], eligibleBatch: 3 }],
      deck: [{ ...pool[2] }],
      maxPrice: 5,
    }),
  )
  assert.deepEqual(
    result.exclusions.map(({ name, reason }) => [name, reason]),
    [
      ['Alpha', 'ignored'],
      ['Bravo', 'deferred'],
      ['Charlie', 'in-deck'],
      ['Pricey', 'over-price-cap'],
    ],
  )
  assert.ok(result.queue.some(({ name }) => name === 'Exact'))
  assert.equal(result.deferredCards[0].available, true)
})

test('released deferrals rejoin the pool', () => {
  const result = recommend(
    state({ batchNumber: 3, deferredCards: [{ card: pool[1], eligibleBatch: 3 }] }),
  )
  assert.deepEqual(result.deferredCards, [])
  assert.ok(result.queue.some(({ name }) => name === 'Bravo'))
})

test('explainCard covers every outcome', () => {
  const input = state({ ignoredCards: ['Alpha'] })
  assert.deepEqual(explainCard(input, 'Commander'), { status: 'commander' })
  assert.deepEqual(explainCard(input, 'Nowhere'), { status: 'not-in-pool' })
  assert.deepEqual(explainCard(input, 'alpha'), {
    status: 'excluded',
    reason: 'ignored',
    detail: undefined,
  })
  const ranked = explainCard(input, 'Bravo')
  assert.equal(ranked.status, 'ranked')
  assert.equal(ranked.status === 'ranked' && ranked.name, 'Bravo')
})
