import assert from 'node:assert/strict'
import test from 'node:test'
import type { ScryfallCard } from '../domain/card-model.ts'
import { toCard } from '../domain/card-model.ts'
import { ScryfallRateLimitError } from '../adapters/scryfall.ts'
import { recommendationScoreBreakdown } from '../domain/recommendation-scoring.ts'
import { currentCardData } from '../domain/current-card-data.ts'
import {
  appendBackgroundCandidates,
  enrichWithLocalCards,
  fallbackRecommendations,
  fetchDeckDoctorCandidates,
  mergeRecommendationCandidates,
  roleGapRecommendations,
  themeRecommendations,
} from './recommendation-actions.ts'

const card = (name: string, text = 'Create a 1/1 white Cat creature token.'): ScryfallCard => ({
  name,
  oracle_id: name,
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
  game_changer: false,
  legalities: { commander: 'legal' },
  released_at: '2020-01-01',
  oracle_text: text,
  set: 'tst',
  collector_number: '1',
  prints_search_uri: '',
})
const options = {
  excludeGameChangers: false,
  excludeTutors: false,
  excludeExtraTurns: false,
  excludeUnreleased: false,
  powerTarget: 'high',
  includeCreature: true,
}

test('theme retrieval supplements local breadth with live Tagger results and live fields win', async () => {
  const queries: string[] = []
  const local = card('Snapshot')
  const live = { ...local, name: 'Renamed', oracle_text: 'Draw two cards.' }
  const found = await themeRecommendations(
    {
      ...options,
      fetchLocalCards: async (query: unknown) => {
        assert.deepEqual(query, { colours: ['W'], themes: ['Tokens'] })
        return [local, card('Local only')]
      },
      searchCards: async (query: string) => {
        queries.push(query)
        return [live, card('Live only')]
      },
    },
    ['W'],
    ['Tokens'],
  )
  assert.equal(queries.length, 1)
  assert.deepEqual(
    found.map(({ name }) => name),
    ['Renamed', 'Live only', 'Local only'],
  )
  assert.equal(found[0].detail, live.oracle_text)
})

test('stale data adds a release-ordered live search so new cards are not hidden by popular old cards', async () => {
  const queries: [string, string][] = []
  const found = await themeRecommendations(
    {
      ...options,
      fetchLocalCards: async () => [card('Snapshot')],
      localCardIndexStatus: () => ({ state: 'stale', bulkUpdatedAt: '2026-10-24T09:00:00Z' }),
      searchCards: async (query: string, _signal: unknown, order: string) => {
        queries.push([query, order])
        return [card(order === 'released' ? 'Newest card' : 'Popular card')]
      },
    },
    [],
    ['Tokens'],
  )
  assert.equal(queries.length, 2)
  assert.match(queries[1][0], /date>=2026-10-24/)
  assert.equal(queries[1][1], 'released')
  assert.deepEqual(
    found.map(({ name }) => name),
    ['Newest card', 'Popular card', 'Snapshot'],
  )
})

test('missing index preserves live retrieval; unavailable live searches retain local breadth', async () => {
  for (const fetchLocalCards of [
    undefined,
    async () => [],
    async () => {
      throw new Error('Bad asset')
    },
  ]) {
    const found = await themeRecommendations(
      { ...options, fetchLocalCards, searchCards: async () => [card('Live')] },
      [],
      ['Tokens'],
    )
    assert.deepEqual(
      found.map(({ name }) => name),
      ['Live'],
    )
  }
  const deps = {
    ...options,
    fetchLocalCards: async () => [card('Local')],
    searchCards: async () => {
      throw new Error('Offline')
    },
  }
  assert.equal((await themeRecommendations(deps, [], ['Tokens']))[0].name, 'Local')
  assert.equal((await fallbackRecommendations(deps, []))[0].name, 'Local')
  await assert.rejects(
    themeRecommendations(
      {
        ...deps,
        searchCards: async () => {
          throw new ScryfallRateLimitError(Date.now() + 30_000, false)
        },
      },
      [],
      ['Tokens'],
    ),
    ScryfallRateLimitError,
  )
})

test('local role candidates still run the live Tagger query and share exclusions and role validation', async () => {
  let searched = false
  const found = await roleGapRecommendations(
    {
      ...options,
      excludeGameChangers: true,
      fetchLocalCards: async () => [
        card('Repeatable mana', '{T}: Add {C}.'),
        card('Not ramp', 'Draw two cards.'),
        { ...card('Excluded mana', '{T}: Add {C}.'), game_changer: true },
      ],
      searchCards: async (query: string) => {
        searched = true
        assert.match(query, /otag:ramp/)
        return []
      },
    },
    [],
    ['ramp'],
    [],
  )
  assert.equal(searched, true)
  assert.deepEqual(
    found.map(({ name }) => name),
    ['Repeatable mana'],
  )
})

test('Oracle deduplication keeps live EDHREC evidence rather than replacing it with a snapshot', () => {
  const live = {
    ...toCard(card('Live name'), 'Commander synergy'),
    source: 'edhrec' as const,
    inclusion: 70,
    synergy: 0.4,
  }
  const local = toCard({ ...card('Old name'), oracle_id: live.oracleId }, 'Interesting new pick')
  assert.deepEqual(mergeRecommendationCandidates([live], [local]), [live])
})

test('cross-query merges replace an earlier snapshot with live fields and never do the reverse', async () => {
  const snapshot = { ...toCard(card('Old name'), 'Popular inclusion'), localIndexSnapshot: true }
  const live = {
    ...toCard({ ...card('Current name'), oracle_id: snapshot.oracleId }, 'Interesting new pick'),
    localIndexSnapshot: false,
  }
  assert.deepEqual(
    mergeRecommendationCandidates(
      [snapshot],
      [live, toCard(card('Current name'), 'Duplicate legacy name')],
    ),
    [live],
  )
  assert.deepEqual(mergeRecommendationCandidates([live], [snapshot]), [live])
  const [local] = await themeRecommendations(
    { ...options, fetchLocalCards: async () => [card('Snapshot')], searchCards: async () => [] },
    [],
    ['Tokens'],
  )
  assert.equal(local.localIndexSnapshot, true)
  assert.equal(local.reason, 'Local card match')
  const context = {
    theme: '',
    activeSubThemes: [],
    pickedTags: new Set<string>(),
    preferenceScores: {},
    neededRoles: new Set<string>(),
    cardRoles: [],
  }
  assert.equal(recommendationScoreBreakdown(local, context).evidence, 0)
  assert.equal(currentCardData(local, card('Snapshot')).localIndexSnapshot, false)
})

test('Deck Doctor receives local candidates through the same production retrieval and keeps EDHREC evidence', async () => {
  const staples = Array.from({ length: 4 }, (_, index) => card(`Staple ${index}`))
  const found = await fetchDeckDoctorCandidates({
    ...options,
    activeSubThemes: [],
    collectionMode: 'none',
    collectionSets: [],
    commander: 'Test Commander',
    commanderDetails: { colours: [] },
    deck: [],
    sideboard: [],
    ignoredCards: [],
    theme: 'Tokens',
    fetchCard: async () => card('Test Commander'),
    fetchCards: async () => staples,
    fetchEdhrec: async () => ({
      container: {
        json_dict: {
          cardlists: [
            {
              header: 'High Synergy Cards',
              tag: 'highsynergycards',
              cardviews: staples.map(({ name }) => ({ name, synergy: 0.3 })),
            },
          ],
        },
      },
    }),
    fetchLocalCards: async () => [card('Local Doctor candidate'), staples[0]],
    searchCards: async () => [],
    setCommanderSubThemes: () => {},
    setLimitedRecommendations: () => {},
  })
  assert.ok(found.some(({ name }) => name === 'Local Doctor candidate'))
  assert.equal(found.filter(({ oracleId }) => oracleId === staples[0].oracle_id).length, 1)
  assert.equal(found.find(({ name }) => name === staples[0].name)?.synergy, 0.3)
})

test('a pending local index never delays live results; its queries are recorded for enrichment', async () => {
  const pendingLocal: unknown[] = []
  const found = await themeRecommendations(
    {
      ...options,
      pendingLocal,
      localCardsIfReady: () => undefined,
      fetchLocalCards: () => new Promise(() => {}),
      searchCards: async () => [card('Live')],
    },
    [],
    ['Tokens'],
  )
  assert.deepEqual(
    found.map(({ name }) => name),
    ['Live'],
  )
  assert.deepEqual(pendingLocal, [
    {
      query: { colours: [], themes: ['Tokens'] },
      liveQuery: 'id<=c legal:commander (o:token) ',
      reason: 'Interesting new pick',
    },
  ])
})

test('background enrichment keeps the active batch and every decision, appending only new cards', async () => {
  const queue = ['A', 'B', 'C', 'D', 'E'].map((name) => toCard(card(name), 'Popular inclusion'))
  let next = queue
  const pending = [{ query: { colours: [] }, liveQuery: '', reason: 'Popular inclusion' }]
  await enrichWithLocalCards(
    {
      ...options,
      fetchLocalCards: async () =>
        ['A', 'Ignored', 'In deck', 'Deferred', 'New', 'E'].map((name) => card(name)),
      getCurrentState: () => ({
        commander: 'Commander',
        ignoredCards: ['Ignored'],
        deck: [toCard(card('In deck'), '')],
        sideboard: [],
        deferredCards: [{ card: toCard(card('Deferred'), ''), eligibleBatch: 4 }],
        focusedRole: null,
      }),
      setQueue: (update: (queue: typeof next) => typeof next) => (next = update(next)),
    },
    pending,
    [],
    () => true,
  )
  assert.deepEqual(
    next.map(({ name }) => name),
    ['A', 'B', 'C', 'D', 'E', 'New'],
  )
  assert.deepEqual(next.slice(0, 4), queue.slice(0, 4))
  assert.equal(next[5].localIndexSnapshot, true)
  // A short visible batch is never filled mid-decision, and a superseded request writes nothing.
  assert.deepEqual(
    appendBackgroundCandidates(queue.slice(0, 2), [toCard(card('New'), '')], [], null),
    queue.slice(0, 2),
  )
  let wrote = false
  await enrichWithLocalCards(
    { ...options, fetchLocalCards: async () => [card('New')], setQueue: () => (wrote = true) },
    pending,
    [],
    () => false,
  )
  assert.equal(wrote, false)
})
