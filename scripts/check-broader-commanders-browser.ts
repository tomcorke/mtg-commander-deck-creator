// Broader Start results (#481): Sacrifice + Black + Green shows more than the curated picks, in a
// separately labelled section, and a near-empty result offers one-click widening.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page, Route } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { fixtureCard, themeFirstState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const picked = ['Meren of Clan Nel Toth', 'Mazirek, Kraul Death Priest']
const leader = (name: string, colours = ['B', 'G']) =>
  fixtureCard(name, {
    type_line: 'Legendary Creature — Fixture',
    mana_cost: '{2}{B}{G}',
    color_identity: colours,
    oracle_text: 'Whenever you sacrifice a creature, draw a card.',
  })
// Every other curated pick is mono-black here, so only two curated commanders are Golgari.
const curatedRecord = (name: string) => leader(name, picked.includes(name) ? ['B', 'G'] : ['B'])
const broader = [
  curatedRecord(picked[0]),
  ...Array.from({ length: 14 }, (_, n) => leader(`Golgari sacrificer ${n + 1}`)),
]

async function mockDiscovery(page: Page, queries: string[]) {
  await page.route('https://api.scryfall.com/cards/collection', (route: Route) => {
    const { identifiers } = route.request().postDataJSON() as { identifiers: { name?: string }[] }
    if (!identifiers.some(({ name }) => name === picked[0])) return route.fallback()
    const data = identifiers.map(({ name }) => curatedRecord(name!))
    return route.fulfill({ json: { object: 'list', data, not_found: [] } })
  })
  await page.route('https://api.scryfall.com/cards/search?*', (route: Route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? ''
    if (!query.includes('(o:sacrifice)')) return route.fallback()
    queries.push(query)
    const data = query.includes('name:') ? [] : broader
    return route.fulfill({
      json: { object: 'list', data, has_more: false, total_cards: data.length },
    })
  })
}

await withBrowser('BROADER_COMMANDERS', 5297, async (browser, base) => {
  const queries: string[] = []
  const { page, context, errors } = await openScenario(
    browser,
    base,
    themeFirstState(),
    undefined,
    undefined,
    (page) => mockDiscovery(page, queries),
  )
  const output = process.env.BROADER_COMMANDERS_SCREENSHOTS
  try {
    await page.goto(`${base}#start`)
    await heading(page, 'What do you want to play?').waitFor()
    await page.getByRole('searchbox', { name: 'Search themes', exact: true }).fill('Sacrifice')
    await button(page, 'Sacrifice').click()
    await button(page, 'Black').click()
    await button(page, 'Green').click()

    const more = page.getByRole('region', { name: 'More commanders that mention Sacrifice' })
    await more.waitFor()
    assert(
      queries.some((query) => /id=bg \(o:sacrifice\)$/.test(query)),
      'broader query',
    )
    const discovery = page.locator('.commander-discovery')
    const curatedTiles = discovery.locator(':scope > .commander-grid .commander-choose')
    const broaderTiles = more.locator('.commander-choose')
    assert.equal(await curatedTiles.count(), 2, 'the curated two stay first')
    assert.match(
      await discovery.locator('.commander-discovery-heading p').first().innerText(),
      /^2 commanders · Picked for Sacrifice decks/,
    )
    assert.match(
      await more.innerText(),
      /14 commanders · Found by rules text or type, not picked for this theme/,
    )
    assert.equal(await broaderTiles.count(), 12, 'the broader section pages on its own')
    assert(!(await more.innerText()).includes('Picked for'), 'no curated label in the section')
    assert(!(await more.innerText()).includes(picked[0]), 'curated picks are not repeated')
    assert.equal(await page.locator('.commander-widen').count(), 0, 'no widening with 16 results')

    // Arrow keys continue from the curated grid into the broader one.
    await curatedTiles.nth(1).focus()
    await page.keyboard.press('ArrowDown')
    assert(await broaderTiles.first().evaluate((node) => node === document.activeElement))

    if (output) await capture(page, output, 'broader')

    // A name search leaves one curated match and no broader ones, so widening is offered.
    await page.getByRole('textbox', { name: 'Search commanders', exact: true }).fill('Meren')
    const widen = page.getByRole('group', { name: /Only 1 commander matches/ })
    await widen.waitFor()
    for (const label of [
      'Remove Black',
      'Remove Green',
      'Remove Sacrifice theme',
      'Clear name search',
    ])
      await button(widen, label).waitFor()
    if (output) await capture(page, output, 'widen')
    await button(widen, 'Remove Sacrifice theme').click()
    assert.equal(await button(page, 'Sacrifice').getAttribute('aria-pressed'), 'false')
    assert(
      await page
        .locator('#commander-discovery-title')
        .evaluate((node) => node === document.activeElement),
      'focus moves to the grid heading',
    )
    assert.deepEqual(errors, [], 'no browser exceptions')
  } finally {
    await context.close()
  }
  console.log('Broader commanders browser check passed: Sacrifice + B + G, labels and widening.')
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
