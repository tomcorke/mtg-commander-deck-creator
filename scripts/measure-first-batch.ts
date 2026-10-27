import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { start } from '../src/app/recommendation-actions.ts'
import { withBuilderActions } from '../src/app/builder-test-fixture.ts'
import { rankRecommendationCards } from '../src/recommendations.ts'
import {
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  fetchScryfallPrintings,
  searchScryfallCached,
} from '../src/adapters/scryfall.ts'
import { fetchEdhrecCommander } from '../src/adapters/edhrec.ts'
import { baseCandidates, commander, makeState } from './fixtures/b10-browser.ts'

// Immediate synthetic responses through the production caches and paced dispatchers.
// Measures pool readiness, excluding DOM rendering, startup traffic and real network latency.
const dispatches: { stage: string; path: string; ms: number }[] = []
let stage = '',
  origin = 0
const fetcher: typeof fetch = async (input, init) => {
  const url = new URL(String(input))
  dispatches.push({
    stage,
    path: url.hostname + url.pathname,
    ms: Math.round(performance.now() - origin),
  })
  if (url.hostname === 'json.edhrec.com')
    return Response.json({
      container: {
        json_dict: {
          cardlists: [
            {
              tag: 'highsynergycards',
              header: 'High Synergy Cards',
              cardviews: baseCandidates.map(({ name }) => ({ name, synergy: 0.3 })),
            },
          ],
        },
      },
    })
  if (url.pathname === '/cards/named') return Response.json(commander)
  if (url.pathname === '/cards/collection') {
    const { identifiers } = JSON.parse(String(init?.body))
    return Response.json({
      data: identifiers
        .map(({ name }: { name: string }) =>
          [commander, ...baseCandidates].find((card) => card.name === name),
        )
        .filter(Boolean),
      not_found: [],
    })
  }
  return Response.json({
    data: baseCandidates,
    has_more: false,
    total_cards: baseCandidates.length,
  })
}
const source = await readFile(
  new URL('../src/app/recommendation-actions.ts', import.meta.url),
  'utf8',
)
const setters = Object.fromEntries(
  [...new Set(source.match(/\bset[A-Z]\w+/g))].map((name) => [name, () => {}]),
)
for (const temperature of ['cold', 'warm']) {
  dispatches.length = 0
  origin = performance.now()
  const stages: { stage: string; ms: number }[] = []
  const timed = async <T>(name: string, work: () => Promise<T>) => {
    stage = name
    const before = performance.now()
    const value = await work()
    stages.push({ stage: name, ms: Math.round(performance.now() - before) })
    return value
  }
  const host = withBuilderActions({
    ...makeState({ queue: [], firstBatchPending: true }),
    ...setters,
    today: '2026-10-27',
    powerTarget: 'high',
    includeCreature: false,
    excludeGameChangers: false,
    excludeTutors: false,
    excludeExtraTurns: false,
    excludeUnreleased: false,
    freshRecommendationCycle: () => ({ deferredCards: [], batchNumber: 1 }),
    loadPrintings: () => {},
    rankRecommendationCards,
    localCardsIfReady: () => undefined,
    fetchLocalCards: () => new Promise<never>(() => {}),
    fetchCard: (name: string) => timed('commander', () => fetchScryfallCard(name, fetcher)),
    fetchPrintings: (uri: string) =>
      timed('commander printings', () => fetchScryfallPrintings(uri, fetcher)),
    fetchEdhrec: (slug: string) => timed('EDHREC', () => fetchEdhrecCommander(slug, fetcher)),
    fetchCards: (ids: { name: string }[]) =>
      timed('EDHREC hydration', () => fetchScryfallCardsByIdentifiers(ids, fetcher)),
    searchCards: (query: string, signal?: AbortSignal, order?: string, pages?: number) =>
      timed(query.includes('otag:') ? 'role gaps' : 'theme/mechanic', () =>
        searchScryfallCached(query, fetcher, signal, order, pages),
      ),
  })
  assert.equal(await start(host, commander.name, true), true)
  assert.ok(host.getBuilderState().queue.length >= 4)
  console.log(
    JSON.stringify(
      {
        temperature,
        readyMs: Math.round(performance.now() - origin),
        requestCount: dispatches.length,
        stages,
        dispatches,
      },
      null,
      2,
    ),
  )
}
