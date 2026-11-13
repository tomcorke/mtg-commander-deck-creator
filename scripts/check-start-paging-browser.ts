// Start's unfiltered list pages past Scryfall's first page (#485): reaching the end of the loaded
// commanders fetches the next search page, one request per page, and the copy names Scryfall's
// total instead of a "loaded" count.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page, Route } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { fixtureCard, themeFirstState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const leader = (index: number) =>
  fixtureCard(`Paged leader ${String(index).padStart(3, '0')}`, {
    type_line: 'Legendary Creature — Fixture',
    mana_cost: '{1}{G}',
    color_identity: ['G'],
    edhrec_rank: 1000 + index,
  })
// A full Scryfall page holds 175 cards, so the first page ends partway through grid page 15.
const firstPage = Array.from({ length: 175 }, (_, index) => leader(index + 1))
const secondPage = Array.from({ length: 20 }, (_, index) => leader(index + 176))
const total = firstPage.length + secondPage.length

function release() {
  let open = () => {}
  const held = new Promise<void>((resolve) => (open = resolve))
  return { held, open }
}

async function mockProviders(page: Page, pages: string[], second: Promise<void>) {
  await page.route('https://api.scryfall.com/cards/search?*', async (route: Route) => {
    const url = new URL(route.request().url())
    const query = url.searchParams.get('q') ?? ''
    if (!query.startsWith('is:commander legal:commander')) return route.fallback()
    // The seeded theme's search answers empty; only the unfiltered list pages.
    if (query !== 'is:commander legal:commander date<=today')
      return route.fulfill({ json: { object: 'list', data: [], has_more: false, total_cards: 0 } })
    const at = url.searchParams.get('page') ?? '1'
    pages.push(at)
    if (at === '2') await second
    return route.fulfill({
      json: {
        object: 'list',
        data: at === '1' ? firstPage : secondPage,
        has_more: at === '1',
        total_cards: total,
      },
    })
  })
  // Deck counts are optional context; failing them keeps Scryfall's rank order.
  await page.route('https://json.edhrec.com/pages/commanders/*.json', (route: Route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  )
}

const tileNames = (page: Page) =>
  page
    .locator('.commander-discovery > .commander-grid .card-tile-title > :first-child')
    .allInnerTexts()
const headingLine = (page: Page) =>
  page.locator('.commander-discovery-heading p').first().innerText()
const pagerLine = (page: Page) =>
  page.getByRole('navigation', { name: 'Commander result pages' }).innerText()

await withBrowser('START_PAGING', 5311, async (browser, base) => {
  const pages: string[] = []
  const second = release()
  const { page, context, errors } = await openScenario(
    browser,
    base,
    themeFirstState(),
    undefined,
    undefined,
    (page) => mockProviders(page, pages, second.held),
  )
  const output = process.env.START_PAGING_SCREENSHOTS
  try {
    await page.goto(`${base}#start`)
    await heading(page, 'What do you want to play?').waitFor()
    await button(page, 'Clear filters').click()
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.commander-discovery > .commander-grid .commander-choose')
          .length === 12 && !document.querySelector('.commander-discovery[aria-busy="true"]'),
    )
    if (process.env.START_PAGING_BEFORE) {
      if (output) await capture(page, output, 'before')
      console.log('Captured the pre-change unfiltered Start list.')
      return
    }

    // The heading and pager give Scryfall's total, never a "loaded" count.
    assert.match(await headingLine(page), /^195 commanders · Sorted by EDHREC/)
    assert.match(await pagerLine(page), /Showing 1–12 of 195 commanders · Page 1$/m)
    assert.doesNotMatch(await pagerLine(page), /loaded/)
    assert.match(await pagerLine(page), /Tip: narrow the filters/)
    assert.deepEqual(pages, ['1'], 'the first view sends one search request')
    if (output) await capture(page, output, 'after')

    // Paging within the first Scryfall page sends nothing.
    for (let at = 2; at <= 14; at++) {
      await button(page, 'Next page').click()
      await page.getByText(new RegExp(`· Page ${at}$`)).waitFor()
    }
    assert.deepEqual(pages, ['1'])

    // The page that reaches past it asks for the next one, once, and shows what it has meanwhile.
    await button(page, 'Next page').click()
    await page.getByText('Loading more commanders…').waitFor()
    assert.ok(await button(page, 'Next page').isDisabled(), 'one request per page')
    assert.deepEqual(pages, ['1', '2'])
    assert.deepEqual(
      await tileNames(page),
      firstPage.slice(168).map(({ name }) => name),
    )
    if (output) await capture(page, output, 'fetching')
    second.open()
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading more commanders…'),
    )
    const all = [...firstPage, ...secondPage].map(({ name }) => name)
    assert.deepEqual(await tileNames(page), all.slice(168, 180))
    assert.match(await pagerLine(page), /Showing 169–180 of 195 commanders · Page 15 of 17/)
    assert.doesNotMatch(await pagerLine(page), /narrow the filters/i)
    assert.match(
      await headingLine(page),
      /^195 commanders · Sorted by EDHREC deck count, then EDHREC rank for commanders without a count, within each batch of 175 by EDHREC rank$/,
    )
    if (output) await capture(page, output, 'second-page')

    await button(page, 'Next page').click()
    await button(page, 'Next page').click()
    await page.getByText(/· Page 17 of 17$/).waitFor()
    assert.deepEqual(await tileNames(page), all.slice(192))
    assert.ok(await button(page, 'Next page').isDisabled(), 'the last Scryfall page ends paging')
    assert.deepEqual(pages, ['1', '2'], 'paging within fetched results sends no request')
    assert.deepEqual(errors, [], 'no browser exceptions')
  } finally {
    await context.close()
  }
  console.log('Start paging browser check passed: next Scryfall page on demand, total copy.')
})

async function capture(page: Page, output: string, name: string) {
  await mkdir(output, { recursive: true })
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      const discovery = page.locator('.commander-discovery')
      await discovery.screenshot({
        path: join(output, `${name}-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
}
