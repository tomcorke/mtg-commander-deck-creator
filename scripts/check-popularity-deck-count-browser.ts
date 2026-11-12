// Start's Popularity sort follows EDHREC deck counts (#514): known counts first, most decks first,
// then commanders without a count in Scryfall's EDHREC rank order. The grid reorders once, after
// every loaded identity's list settles, and the heading names the fallback.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page, Route } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { fixtureCard, themeFirstState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const leader = (name: string, colours: string[], edhrec_rank: number) =>
  fixtureCard(name, {
    type_line: 'Legendary Creature — Fixture',
    mana_cost: colours.map((colour) => `{${colour}}`).join(''),
    color_identity: colours,
    edhrec_rank,
  })
const fillers = Array.from({ length: 11 }, (_, index) =>
  leader(`Azorius filler ${index + 1}`, ['W', 'U'], 3000 + index),
)
// Scryfall's EDHREC rank order. Observed 2026-11-12: Brago ranks 2340 and Atraxa 2353, though
// Atraxa leads 46,229 EDHREC decks to Brago's 15,611.
const leaders = [
  leader('Brago, King Eternal', ['W', 'U'], 2340),
  leader("Atraxa, Praetors' Voice", ['W', 'U', 'B', 'G'], 2353),
  leader('Grixis leader', ['U', 'B', 'R'], 2500),
  ...fillers,
  leader('Witch-maw sleeper', ['W', 'U', 'B', 'G'], 9000),
]
const counts: Record<string, Record<string, number>> = {
  azorius: { 'Brago, King Eternal': 15611 },
  'witch-maw': { "Atraxa, Praetors' Voice": 46229, 'Witch-maw sleeper': 20000 },
}
const expected = [
  "Atraxa, Praetors' Voice",
  'Witch-maw sleeper',
  'Brago, King Eternal',
  'Grixis leader',
  ...fillers.map(({ name }) => name),
]

function release() {
  let open = () => {}
  const held = new Promise<void>((resolve) => (open = resolve))
  return { held, open }
}

async function mockProviders(page: Page, edhrec: string[], witchMaw: Promise<void>) {
  await page.route('https://api.scryfall.com/cards/search?*', (route: Route) => {
    const url = new URL(route.request().url())
    if (!url.searchParams.get('q')?.startsWith('is:commander legal:commander'))
      return route.fallback()
    const data =
      url.searchParams.get('order') === 'name'
        ? leaders.toSorted((left, right) => left.name.localeCompare(right.name))
        : leaders
    return route.fulfill({
      json: { object: 'list', data, has_more: false, total_cards: data.length },
    })
  })
  await page.route('https://json.edhrec.com/pages/commanders/*.json', async (route: Route) => {
    const slug = new URL(route.request().url()).pathname.split('/').at(-1)!.replace('.json', '')
    edhrec.push(slug)
    if (slug === 'witch-maw') await witchMaw
    const listed = counts[slug]
    if (!listed) return route.fulfill({ status: 503, body: 'unavailable' })
    return route.fulfill({
      json: {
        container: {
          json_dict: {
            cardlists: [
              {
                header: 'Commanders',
                tag: `${slug}commanders`,
                cardviews: Object.entries(listed).map(([name, num_decks]) => ({ name, num_decks })),
              },
            ],
          },
        },
      },
    })
  })
}

const tileNames = (page: Page) =>
  page
    .locator('.commander-discovery > .commander-grid .card-tile-title > :first-child')
    .allInnerTexts()
const orderLine = (page: Page) => page.locator('.commander-discovery-heading p').first().innerText()

await withBrowser('POPULARITY_DECK_COUNT', 5301, async (browser, base) => {
  const edhrec: string[] = []
  const witchMaw = release()
  const { page, context, errors } = await openScenario(
    browser,
    base,
    themeFirstState(),
    undefined,
    undefined,
    (page) => mockProviders(page, edhrec, witchMaw.held),
  )
  const output = process.env.POPULARITY_DECK_COUNT_SCREENSHOTS
  try {
    await page.goto(`${base}#start`)
    await heading(page, 'What do you want to play?').waitFor()
    await button(page, 'Clear filters').click()
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.commander-discovery > .commander-grid .commander-choose')
          .length === 12,
    )
    if (process.env.POPULARITY_DECK_COUNT_BEFORE) {
      witchMaw.open()
      await page.getByText('≈46.2k decks on EDHREC').waitFor()
      if (output) await capture(page, output, 'before')
      console.log('Captured the pre-change Popularity sort.')
      return
    }

    // While a list loads, the grid keeps Scryfall's rank order and says so.
    assert.equal(await page.getByRole('combobox', { name: 'Sort by' }).inputValue(), 'popularity')
    assert.match(await orderLine(page), /Sorted by EDHREC rank until deck counts load$/)
    assert.deepEqual(
      await tileNames(page),
      leaders.slice(0, 12).map(({ name }) => name),
    )
    await page.getByText('≈15.6k decks on EDHREC').waitFor()
    if (output) await capture(page, output, 'loading')

    // Once every identity has settled, known counts lead and the rest keep rank order.
    witchMaw.open()
    await page.waitForFunction(() =>
      document
        .querySelector('.commander-discovery-heading p')
        ?.textContent?.endsWith('commanders without a count'),
    )
    assert.match(
      await orderLine(page),
      /^15 commanders · Sorted by EDHREC deck count, then EDHREC rank for commanders without a count$/,
    )
    assert.deepEqual(await tileNames(page), expected.slice(0, 12))
    const deckCounts = await page
      .locator('.commander-discovery > .commander-grid .commander-deck-count')
      .allInnerTexts()
    assert.deepEqual(deckCounts.slice(0, 4), [
      '≈46.2k decks on EDHREC',
      '≈20k decks on EDHREC',
      '≈15.6k decks on EDHREC',
      '',
    ])
    assert.match(
      await page.locator('#commander-result-count').innerText(),
      /Sorted by EDHREC deck count, then EDHREC rank for commanders without a count/,
    )
    if (output) await capture(page, output, 'deck-count')

    // One cached request per loaded identity; the next page sends none.
    const requested = edhrec.length
    assert.deepEqual(new Set(edhrec), new Set(['azorius', 'witch-maw', 'grixis']))
    assert.equal(edhrec.filter((slug) => slug === 'azorius').length, 1)
    assert.equal(edhrec.filter((slug) => slug === 'witch-maw').length, 1)
    await button(page, 'Next page').click()
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.commander-discovery > .commander-grid .commander-choose')
          .length === 3,
    )
    assert.deepEqual(await tileNames(page), expected.slice(12))
    assert.equal(edhrec.length, requested, 'paging reuses the loaded lists')

    // Other sorts keep their own order and wording.
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name')
    await page.waitForFunction(() =>
      document.querySelector('.commander-discovery-heading p')?.textContent?.endsWith('A to Z'),
    )
    assert.equal(
      (await tileNames(page))[0],
      leaders.map(({ name }) => name).toSorted((left, right) => left.localeCompare(right))[0],
    )
    assert.deepEqual(errors, [], 'no browser exceptions')
  } finally {
    await context.close()
  }
  console.log('Popularity deck count browser check passed: deck-count order and rank fallback.')
})

async function capture(page: Page, output: string, name: string) {
  await mkdir(output, { recursive: true })
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.locator('.commander-discovery').screenshot({
        path: join(output, `${name}-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}
