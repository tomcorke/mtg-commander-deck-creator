import assert from 'node:assert/strict'
import { buildLocalCardIndex } from './build-card-index.ts'
import { withBrowser } from './fixtures/browser-harness.ts'

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
  return { json: mode === 'corrupt' ? { invalid: true } : index }
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
