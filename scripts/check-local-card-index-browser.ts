import assert from 'node:assert/strict'
import { buildLocalCardIndex } from './build-card-index.ts'
import { serializeLocalCardIndex } from '../src/domain/local-card-index.ts'
import type { Page } from 'playwright-core'
import { openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { baseCandidates, fixtureCard, makeState } from './fixtures/b10-browser.ts'

const index = buildLocalCardIndex({
  bulkUpdatedAt: '2026-10-24T10:00:00Z',
  sets: [{ code: 'tst', name: 'Test Set', released_at: '2026-10-24', card_count: 1 }],
  creatureTypes: ['Cat'],
  cards: [
    {
      name: 'Indexed Cat',
      oracle_id: 'test-cat',
      type_line: 'Creature — Cat',
      color_identity: ['G'],
      cmc: 1,
      oracle_text: '{T}: Add {G}.',
      game_changer: false,
      legalities: { commander: 'legal' },
      set: 'tst',
      collector_number: '1',
      prints_search_uri: '',
    },
  ],
})

function artifactResponse(mode: string) {
  if (mode === 'missing') return { status: 404, body: 'Missing' }
  return {
    json: mode === 'corrupt' ? { invalid: true } : JSON.parse(serializeLocalCardIndex(index)),
  }
}

await withBrowser('LOCAL_CARD_INDEX', 5244, async (browser, base) => {
  for (const mode of ['fresh', 'stale', 'missing', 'corrupt'] as const) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors: string[] = []
    let indexRequests = 0
    const states: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.text().includes('[local-card-index]')) states.push(message.text())
    })
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin === new URL(base).origin) {
        if (url.pathname !== '/local-card-index.json') return route.continue()
        indexRequests++
        return route.fulfill(artifactResponse(mode))
      }
      if (url.hostname === 'api.scryfall.com') {
        if (url.pathname === '/sets') return route.fulfill({ json: { data: index.metadata.sets } })
        if (url.pathname === '/catalog/creature-types')
          return route.fulfill({
            json: {
              data: mode === 'stale' ? ['Cat', 'Newtype'] : ['Cat'],
              total_values: mode === 'stale' ? 2 : 1,
            },
          })
        return route.fulfill({ json: { data: [], has_more: false, total_cards: 0 } })
      }
      assert.ok(
        ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname),
        `Unexpected external request: ${url}`,
      )
      return route.fulfill({ status: 204, body: '' })
    })
    try {
      const discovery = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/cards/search',
      )
      await page.goto(base)
      await discovery
      await page.locator('.start').waitFor()
      assert.equal(indexRequests, 0, 'start screen never requests the bulk index')
      const result = await page.evaluate(async () => {
        const modulePath = '/src/adapters/local-card-index.ts'
        const source = await import(modulePath)
        const query = { colours: ['G'], creatureTypes: ['Cat'] }
        const [cards, count] = await Promise.all([
          source.fetchLocalCards(query),
          source.countLocalCards(query),
        ])
        return {
          names: cards.map((card: { name: string }) => card.name),
          count,
          status: source.localCardIndexStatus(),
        }
      })
      assert.equal(indexRequests, 1, 'concurrent local consumers share a single lazy request')
      if (mode === 'fresh' || mode === 'stale') {
        assert.deepEqual(result.names, ['Indexed Cat'])
        assert.equal(result.count, 1)
        assert.equal(result.status.state, mode)
        if (mode === 'stale')
          assert.deepEqual(result.status.reasons, ['New creature type: Newtype'])
      } else {
        assert.deepEqual(result.names, [])
        assert.equal(result.count, undefined)
        assert.equal(result.status.state, 'unavailable')
      }
      assert.equal(states.length, 1, 'freshness or load failure is visible in browser logs')
      assert.deepEqual(errors, [])
    } finally {
      await context.close()
    }
  }
  console.log(
    'Local card index browser gate passed: lazy, shared, fresh/stale, missing/corrupt fallback.',
  )
})

// #151: the optional index never gates the first live batch, and background enrichment keeps the
// visible batch and its decisions. Each mode releases or fails the index only after the batch shows.
const extra = fixtureCard('Indexed Saproling Maker', {
  color_identity: ['G'],
  oracle_text: 'Create a 1/1 green Saproling creature token.',
})
const enrichment = buildLocalCardIndex({
  bulkUpdatedAt: '2026-10-24T10:00:00Z',
  sets: [{ code: 'tst', name: 'B10 Fixture Alpha', released_at: '2020-01-01', card_count: 1 }],
  creatureTypes: ['Saproling'],
  cards: [extra],
})
const offeredNames = (page: Page) =>
  page
    .locator('.card-offer .action-help[id^="later-"]')
    .evaluateAll((nodes) => nodes.map((node) => node.id.slice('later-'.length)))

await withBrowser('LOCAL_CARD_INDEX', 5245, async (browser, base) => {
  for (const mode of ['delayed', 'missing', 'failed'] as const) {
    let release = () => {}
    const released = new Promise<void>((resolve) => (release = resolve))
    let requested = () => {}
    const indexRequested = new Promise<void>((resolve) => (requested = resolve))
    const dispatches: { path: string; ms: number }[] = []
    const started = performance.now()
    const scenario = await openScenario(
      browser,
      base,
      makeState({ queue: [], firstBatchPending: true }),
      baseCandidates,
      async (route) => {
        requested()
        await released
        if (mode === 'delayed')
          return route.fulfill({
            body: serializeLocalCardIndex(enrichment),
            contentType: 'application/json',
          })
        if (mode === 'missing') return route.fulfill({ status: 404, body: 'Missing' })
        return route.abort('failed')
      },
      async (page) => {
        page.setDefaultTimeout(60_000)
        // The fixture explicitly owns release; retain production pacing and all progressive assertions.
        page.on('request', (request) => {
          const url = new URL(request.url())
          if (['api.scryfall.com', 'json.edhrec.com'].includes(url.hostname))
            dispatches.push({ path: url.pathname, ms: Math.round(performance.now() - started) })
        })
        await page.addInitScript(() => {
          const fetch = window.fetch.bind(window)
          window.fetch = (input, init) =>
            input === '/local-card-index.json'
              ? fetch(input, { ...init, signal: undefined })
              : fetch(input, init)
        })
      },
    )
    const { page } = scenario
    try {
      await indexRequested
      // The index is still held open here, so a visible batch proves it did not wait.
      await page.locator('.card-offer').first().waitFor()
      console.log(
        JSON.stringify({
          mode,
          coldFirstBatchMs: Math.round(performance.now() - started),
          dispatches,
        }),
      )
      const batch = await offeredNames(page)
      assert.equal(batch.length, 4)
      const status = await page.evaluate(async () => {
        const modulePath = '/src/adapters/local-card-index.ts'
        return (await import(modulePath)).localCardIndexStatus().state
      })
      assert.equal(status, 'unloaded', 'the first batch rendered before the index settled')
      await page.locator('.card-offer').first().getByRole('button', { name: 'Later' }).click()
      const unavailable =
        mode === 'delayed'
          ? undefined
          : page.waitForEvent('console', (message) => message.text().includes('unavailable'))
      release()
      if (mode === 'delayed')
        await page.waitForFunction(
          (name) =>
            [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) =>
              value.includes(name),
            ),
          extra.name,
        )
      else await unavailable
      assert.deepEqual(await offeredNames(page), batch, 'enrichment keeps the active batch')
      assert.equal(
        await page
          .locator('.card-offer')
          .first()
          .getByRole('button', { name: 'Later' })
          .getAttribute('aria-pressed'),
        'true',
        'enrichment keeps decisions',
      )
      assert.deepEqual(scenario.errors, [])
      console.log(`PASS first live batch with ${mode} local index`)
    } finally {
      release()
      await scenario.context.close()
    }
  }
})
