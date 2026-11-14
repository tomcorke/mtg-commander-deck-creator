// Colour identity match mode on Start (#482): Exactly, Within and Including send matching
// Scryfall terms, the pips name the combination, the summary names the mode, and widening offers
// the other modes.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Locator, Page, Route } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { fixtureCard, themeFirstState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const leaders = (
  [
    ['Mono-black leader', ['B']],
    ['Mono-green leader', ['G']],
    ['Golgari leader', ['B', 'G']],
    ['Sultai leader', ['B', 'G', 'U']],
    ['Izzet leader', ['R', 'U']],
    ['Colourless leader', []],
  ] as const
).map(([name, colours]) =>
  fixtureCard(name, {
    type_line: 'Legendary Creature — Fixture',
    mana_cost: colours.map((colour) => `{${colour}}`).join('') || '{3}',
    color_identity: [...colours],
  }),
)

/** Scryfall's identity comparison for `id=`, `id<=` and `id>=`. */
function identityMatches(query: string, identity: string[]) {
  const match = /\bid(=|<=|>=)([wubrg]+)/.exec(query)
  if (!match) return true
  const chosen = [...match[2].toUpperCase()]
  const within = identity.every((colour) => chosen.includes(colour))
  const including = chosen.every((colour) => identity.includes(colour))
  return match[1] === '<=' ? within : match[1] === '>=' ? including : within && including
}

async function mockDiscovery(page: Page, queries: string[]) {
  await page.route('https://api.scryfall.com/cards/search?*', (route: Route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? ''
    if (!query.startsWith('is:commander legal:commander')) return route.fallback()
    queries.push(query)
    const data = leaders.filter((card) => identityMatches(query, card.color_identity))
    return route.fulfill({
      json: { object: 'list', data, has_more: false, total_cards: data.length },
    })
  })
}

const tileNames = (page: Page) =>
  page
    .locator('.commander-discovery > .commander-grid .card-tile-title > :first-child')
    .allInnerTexts()

async function expectLeaders(page: Page, names: string[]) {
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll('.commander-discovery > .commander-grid .commander-choose')
        .length === count && !document.querySelector('.commander-discovery[aria-busy="true"]'),
    names.length,
  )
  assert.deepEqual((await tileNames(page)).toSorted(), names.toSorted())
}

const pressed = async (scope: Locator) => scope.getAttribute('aria-pressed')

await withBrowser('COLOUR_IDENTITY_MODE', 5298, async (browser, base) => {
  const queries: string[] = []
  const { page, context, errors } = await openScenario(
    browser,
    base,
    themeFirstState(),
    undefined,
    undefined,
    (page) => mockDiscovery(page, queries),
  )
  const output = process.env.COLOUR_IDENTITY_MODE_SCREENSHOTS
  try {
    await page.goto(`${base}#start`)
    await heading(page, 'What do you want to play?').waitFor()
    // The seeded workspace starts on a Tokens theme; colour identity is checked on its own.
    await button(page, 'Clear filters').click()
    await expectLeaders(
      page,
      leaders.map(({ name }) => name),
    )
    await button(page, 'Black').click()
    await button(page, 'Green').click()
    await expectLeaders(page, ['Golgari leader'])
    if (process.env.COLOUR_IDENTITY_MODE_BEFORE) {
      if (output) await capture(page, output, 'exactly-golgari')
      console.log('Captured the pre-change Start colour filter.')
      return
    }

    // Exactly is the default, and the copy says so.
    const mode = page.getByRole('group', { name: 'Colour identity match' })
    assert.equal(await pressed(button(mode, 'Exactly')), 'true')
    assert.equal(await pressed(button(mode, 'Within')), 'false')
    assert.equal(await pressed(button(mode, 'Including')), 'false')
    const filters = page.locator('#commander-filter-controls')
    assert.match(await filters.innerText(), /Exactly, the default/)
    assert.equal(await page.locator('#colour-identity-name').innerText(), 'Golgari · Black, Green')
    // The grid header names the count, then the active filters (#488).
    const summaryLine = page.locator('.commander-discovery-summary')
    const summary = {
      innerText: async () => (await summaryLine.innerText()).replace(/^.*?commanders?…? · /, ''),
    }
    assert.equal(await summary.innerText(), 'Colour identity exactly Golgari (Black, Green)')
    assert(queries.at(-1)!.endsWith('id=bg'), 'exact query')

    // The near-empty result offers the other modes as one-click widening.
    const widen = page.getByRole('group', { name: /Only 1 commander matches/ })
    await widen.waitFor()
    for (const label of ['Allow fewer colours', 'Allow more colours', 'Remove Black'])
      await button(widen, label).waitFor()
    if (output) await capture(page, output, 'exactly-golgari')

    await button(widen, 'Allow more colours').click()
    assert(
      await page
        .locator('#commander-discovery-title')
        .evaluate((node) => node === document.activeElement),
      'focus moves to the grid heading',
    )
    await expectLeaders(page, ['Golgari leader', 'Sultai leader'])
    assert.equal(await pressed(button(mode, 'Including')), 'true')
    assert(queries.at(-1)!.endsWith('id>=bg'), 'including query')
    assert.equal(await summary.innerText(), 'Colour identity including Golgari (Black, Green)')
    if (output) await capture(page, output, 'including-golgari')

    // Within uses the keyboard: Tab from Exactly reaches it, and Space presses it.
    await button(mode, 'Exactly').focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    await expectLeaders(page, [
      'Mono-black leader',
      'Mono-green leader',
      'Golgari leader',
      'Colourless leader',
    ])
    assert.equal(await pressed(button(mode, 'Within')), 'true')
    assert(queries.at(-1)!.endsWith('id<=bg'), 'within query')
    assert.equal(await summary.innerText(), 'Colour identity within Golgari (Black, Green)')
    if (output) await capture(page, output, 'within-golgari')

    // A single colour has no combination name.
    await button(page, 'Green').click()
    await expectLeaders(page, ['Mono-black leader', 'Colourless leader'])
    assert.equal(await page.locator('#colour-identity-name').innerText(), 'Black')
    assert.equal(await summary.innerText(), 'Colour identity within Black')
    assert.deepEqual(errors, [], 'no browser exceptions')
  } finally {
    await context.close()
  }
  console.log('Colour identity mode browser check passed: Exactly, Within, Including and widening.')
})

async function capture(page: Page, output: string, name: string) {
  await mkdir(output, { recursive: true })
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.locator('.commander-filters').screenshot({
        path: join(output, `${name}-filters-${dark ? 'dark' : 'light'}-${width}.png`),
      })
      await page.locator('.commander-discovery').screenshot({
        path: join(output, `${name}-results-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}
