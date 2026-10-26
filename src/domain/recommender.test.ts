import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { toCard, type Card, type ScryfallCard } from './card-model.ts'
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

const raw = (name: string): ScryfallCard => ({
  name,
  type_line: 'Artifact',
  color_identity: [],
  legalities: { commander: 'legal' },
  cmc: 2,
  released_at: '2026-01-01',
})
const source = (...names: string[]) => ({
  cards: names.map((name) => ({ card: raw(name), reason: 'Test source' })),
})
const preparationOptions = {
  identity: [],
  includeCreature: false,
  collectionMode: 'none' as const,
  collectionSets: [],
  seed: 'pool',
  today: '2026-10-26',
}
const edhrecSnapshot = (names: string[]) => ({
  entries: names.map((name) => ({ name, tag: 'topcards', header: 'Top Cards' })),
  cards: names.map(raw),
})

test('raw preparation preserves source precedence, provenance and deterministic fallback', () => {
  const snapshots = deepFreeze({
    edhrec: edhrecSnapshot(['A', 'B', 'C', 'D']),
    theme: source('E', 'A'),
    mechanic: source('F'),
    roleGap: source('G'),
  })
  const result = prepareCandidates(snapshots, preparationOptions)
  assert.deepEqual(
    result.pool.map(({ name }) => name),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  )
  assert.equal(result.pool[0].source, 'edhrec')
  assert.equal(result.limited, false)
  const fallback = {
    edhrec: { error: 'Unavailable' },
    fallback: { main: source('A', 'B', 'C', 'D'), mana: source('E', 'F') },
  }
  const first = prepareCandidates(fallback, preparationOptions)
  assert.equal(first.limited, true)
  assert.equal(first.pool.length, 6)
  assert.deepEqual(prepareCandidates(fallback, preparationOptions), first)
  assert.equal(
    prepareCandidates(
      { fallback: { main: { error: 'Failed' }, mana: source() } },
      preparationOptions,
    ).error,
    'Failed',
  )
})

test('raw preparation filters release dates before EDHREC fallback and keeps collection errors', () => {
  const edhrec = edhrecSnapshot(['A', 'B', 'C', 'D'])
  edhrec.cards[0].released_at = '2026-10-27'
  const options = { ...preparationOptions, excludeUnreleased: true }
  assert.equal(prepareCandidates({ edhrec }, options).limited, true)
  assert.equal(prepareCandidates({ edhrec }, { ...options, today: '2026-10-27' }).limited, false)
  const only = { ...options, collectionMode: 'only' as const, collectionSets: ['tst'] }
  assert.match(prepareCandidates({}, { ...only, collectionSets: [] }).error!, /Select at least/)
  assert.equal(prepareCandidates({ collection: { error: 'Down' } }, only).error, 'Down')
  assert.deepEqual(
    prepareCandidates({ edhrec, collection: source('Owned') }, only).pool.map(({ name }) => name),
    ['Owned'],
  )
  assert.equal(
    prepareCandidates(
      { edhrec, collection: { error: 'Down' } },
      { ...only, collectionMode: 'prefer' },
    ).pool.length,
    0,
  )
  assert.equal(
    prepareCandidates({ theme: { error: 'Rate limit', fatal: true } }, options).error,
    'Rate limit',
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
