// The set browser loads each set's sample legends only when its row nears the viewport (#424):
// opening it with 40 matching sets queues a few Scryfall searches, not one per row; scrolling
// loads the rest, and loaded sets stay cached when the search changes.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Locator, Page, Route } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { fixtureCard, themeFirstState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const codes = Array.from({ length: 40 }, (_, index) => `f${String(index + 1).padStart(2, '0')}`)
const sets = codes.map((code, index) => ({
  code,
  name: `Fixture Set ${code.slice(1)}`,
  set_type: 'expansion',
  card_count: 250,
  released_at: `20${String(25 - Math.floor(index / 12)).padStart(2, '0')}-0${(index % 9) + 1}-01`,
}))
const legend = (code: string) =>
  fixtureCard(`Legend of ${code}`, {
    type_line: 'Legendary Creature — Fixture',
    mana_cost: '{1}{G}',
    color_identity: ['G'],
    set: code,
    image_uris: {
      normal: `https://cards.scryfall.io/normal/front/${code}.jpg`,
      art_crop: `https://cards.scryfall.io/art_crop/front/${code}.jpg`,
    },
  })

async function mockProviders(page: Page, requested: string[]) {
  await page.route('https://api.scryfall.com/sets', (route: Route) =>
    route.fulfill({ json: { object: 'list', data: sets } }),
  )
  await page.route('https://api.scryfall.com/cards/search?*', (route: Route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? ''
    const code = /^e:(\w+) is:legendary t:creature not:reprint$/.exec(query)?.[1]
    if (!code) return route.fallback()
    requested.push(code)
    return route.fulfill({
      json: { object: 'list', data: [legend(code)], has_more: false, total_cards: 1 },
    })
  })
}

/** Scryfall searches the app has queued or sent but not finished, read from its own scheduler. */
const scryfallBacklog = (page: Page) =>
  page.evaluate(async () => {
    const path = '/src/adapters/request-scheduler.ts'
    const { getRequestActivity } = (await import(/* @vite-ignore */ path)) as {
      getRequestActivity: () => { providers: { name: string; active: number; queued: number }[] }
    }
    const scryfall = getRequestActivity().providers.find(({ name }) => name === 'Scryfall')!
    return { active: scryfall.active, queued: scryfall.queued }
  })

const rowsNearViewport = (page: Page) =>
  page.locator('.set-picker-rows.browsing > .set-picker-row').evaluateAll(
    (rows) =>
      rows.filter((row) => {
        const { top, bottom } = row.getBoundingClientRect()
        return bottom > -300 && top < innerHeight + 300
      }).length,
  )

const rows = (page: Page) => page.locator('.set-picker-rows > .set-picker-row')
const rowCode = async (row: Locator) =>
  `f${(await row.locator('.set-picker-name').innerText()).slice(-2)}`
const findSet = (page: Page) => page.getByRole('textbox', { name: 'Find a set' })

await withBrowser('SET_BROWSER', 5312, async (browser, base) => {
  const requested: string[] = []
  const { page, context, errors } = await openScenario(
    browser,
    base,
    themeFirstState(),
    undefined,
    undefined,
    (page) => mockProviders(page, requested),
  )
  const output = process.env.SET_BROWSER_SCREENSHOTS
  try {
    await page.goto(`${base}#start`)
    await heading(page, 'What do you want to play?').waitFor()
    await page.locator('summary', { hasText: /^Sets/ }).click()
    await findSet(page).fill('Fixture')
    await page.locator('.set-picker-row').nth(39).waitFor()
    // Let Start's own searches finish so the backlog below is the browser's alone.
    for (let tries = 0; ; tries++) {
      const { active, queued } = await scryfallBacklog(page)
      if (active + queued === 0) break
      assert.ok(tries < 100, 'Start settles before the browser opens')
      await page.waitForTimeout(100)
    }
    await button(page, 'Browse sets').click()
    await page.locator('.set-picker-rows.browsing').waitFor()
    await rows(page).first().scrollIntoViewIfNeeded()
    // Wait for the first row's legends so the observer has reported every row in view.
    await rows(page).first().getByText('Legends lean').waitFor()

    const { active, queued } = await scryfallBacklog(page)
    const backlog = active + queued
    const near = await rowsNearViewport(page)
    console.log(`Opening the browser: ${backlog} Scryfall searches pending, ${near} rows in view.`)
    if (process.env.SET_BROWSER_BEFORE) {
      await page.waitForFunction(() => !!document.querySelector('img.set-guide-art'))
      if (output) await capture(page, output, 'before')
      console.log('Captured the pre-change set browser.')
      return
    }

    assert.ok(near < 40, 'the fixture leaves rows out of view')
    // Sent searches (each in `requested` once dispatched) plus queued ones cover only rows in view.
    const searched = new Set(requested).size + queued
    assert.ok(searched <= near, `searches (${searched}) cover only rows in view (${near})`)

    // Rows in view still show art and colour leanings.
    const first = rows(page).first()
    const firstCode = await rowCode(first)
    const lastCode = await rowCode(rows(page).nth(39))
    await first.locator('img.set-guide-art').waitFor()
    await first.getByText('Legends lean').waitFor()
    await first.getByText(`Legend of ${firstCode}`).waitFor()
    assert.ok(!requested.includes(lastCode), 'rows out of view send nothing')
    if (output) await capture(page, output, 'after')

    // Scrolling to the end loads the last row's legends.
    const last = rows(page).nth(39)
    await last.scrollIntoViewIfNeeded()
    await last.locator('img.set-guide-art').waitFor()
    await last.getByText(`Legend of ${lastCode}`).waitFor()
    assert.ok(requested.includes(lastCode))

    // Loaded sets stay cached when a search change unmounts and remounts their rows.
    await rows(page).first().scrollIntoViewIfNeeded()
    const loaded = [...requested]
    await findSet(page).fill('Fixture Set 3')
    await page.waitForFunction(() => document.querySelectorAll('.set-picker-row').length === 10)
    assert.notEqual(await rowCode(rows(page).first()), firstCode)
    await findSet(page).fill('Fixture')
    await rows(page).nth(39).waitFor()
    await rows(page).first().getByText(`Legend of ${firstCode}`).waitFor()
    const again = requested.slice(loaded.length).filter((code) => loaded.includes(code))
    assert.deepEqual(again, [], 'loaded sets are not requested again')
    assert.equal(new Set(requested).size, requested.length, 'each set is requested once')
    console.log(`Requested ${requested.length} of 40 sets after scrolling to the end and back.`)
    assert.deepEqual(errors, [], 'no browser exceptions')
  } finally {
    await context.close()
  }
  console.log('Set browser check passed: legends load as rows near the viewport, then stay cached.')
})

async function capture(page: Page, output: string, name: string) {
  await mkdir(output, { recursive: true })
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      // The seeded theme collapses the filters on narrow screens.
      const show = button(page, 'Show filters')
      if (await show.isVisible()) await show.click()
      await rows(page).first().scrollIntoViewIfNeeded()
      await page.screenshot({
        path: join(output, `${name}-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}
