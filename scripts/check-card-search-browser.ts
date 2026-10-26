// Start `pnpm dev --host 127.0.0.1 --port 5232`, then run `pnpm check:card-search:browser`.
// Set SCREENSHOTS=<dir> to save light, dark and narrow captures; set SKIP_ASSERTS=1 to only capture.
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import path from 'node:path'
import { chromium, type Page } from 'playwright-core'
import { setDisplayPreferences } from './browser-display.ts'
import { toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { defaultDeckTargets } from '../src/deck-analysis.ts'
import { persistedDeckStateSchema } from '../src/deck-state.ts'

const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

const image = (name: string) => `https://cards.scryfall.io/normal/front/${name}.jpg`
const card = (name: string): ScryfallCard => ({
  name,
  type_line: 'Artifact',
  cmc: 2,
  mana_cost: '{2}',
  color_identity: [],
  legalities: { commander: 'legal' },
  game_changer: false,
  set: 'tst',
  collector_number: '1',
  oracle_id: name,
  prints_search_uri: `https://api.scryfall.com/cards/search?q=${encodeURIComponent(name)}`,
  image_uris: { normal: image(name) },
})
const commander = { ...card('Browser Commander'), type_line: 'Legendary Creature — Human' }
const resultName = (index: number) => `Result ${String(index).padStart(3, '0')}`
// These results are already in the deck, so search hides them by default.
const inDeck = [resultName(2), resultName(5)]
const scryfallPageSize = 60
const totalCards = 150
const state = persistedDeckStateSchema.parse({
  commander: commander.name,
  commanderDetails: {
    images: [image(commander.name)],
    art: [image(commander.name)],
    colours: [],
    printings: [[]],
    selections: [0],
  },
  theme: '',
  recommendationStyle: 'balanced',
  queue: [],
  limitedRecommendations: false,
  decisions: {},
  ignoredCards: [],
  liked: [],
  activeSubThemes: [],
  dismissedSubThemes: [],
  preferenceScores: {},
  commanderSubThemes: [],
  deferredCards: [],
  batchNumber: 1,
  deck: [toDeckCard(commander), ...inDeck.map((name) => toDeckCard(card(name)))],
  sideboard: [],
  preferredPrintSet: '',
  deckTargets: defaultDeckTargets,
})

const gridColumns = (page: Page) =>
  page
    .locator('.card-search-grid')
    .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
const shownNames = async (page: Page) =>
  (
    await page
      .locator('.card-search-grid .search-card-art')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')!))
  ).map((label) => label.replace(/^View | card$/g, ''))

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  chromiumSandbox: true,
  args: ['--enable-automation'],
})
try {
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    if (url.hostname === 'cards.scryfall.io')
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 680"><rect width="488" height="680" fill="#8a8"/></svg>',
      })
    if (url.hostname === 'api.scryfall.com') {
      if (url.pathname === '/sets') return route.fulfill({ json: { data: [] } })
      if (url.pathname === '/cards/collection') return route.fulfill({ json: { data: [] } })
      if (url.pathname === '/cards/search') {
        const number = Number(url.searchParams.get('page') ?? 1)
        const first = (number - 1) * scryfallPageSize + 1
        const last = Math.min(totalCards, first + scryfallPageSize - 1)
        const data = Array.from({ length: last - first + 1 }, (_, index) =>
          card(resultName(first + index)),
        )
        return route.fulfill({
          json: { data, total_cards: totalCards, has_more: last < totalCards },
        })
      }
      return route.fulfill({ json: commander })
    }
    if (url.hostname === 'json.edhrec.com')
      return route.fulfill({ json: { container: { json_dict: { cardlists: [] } } } })
    return route.fulfill({ status: 204, body: '' })
  })
  await page.addInitScript((saved) => {
    localStorage.clear()
    localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state: saved }))
    localStorage.setItem('option:cardEffects', 'false')
    localStorage.setItem('option:darkMode', 'false')
    localStorage.setItem('option:commanderStyling', 'false')
  }, state)
  const base = process.env.CARD_SEARCH_URL ?? 'http://127.0.0.1:5232/'
  await page.goto(`${base}#build`)
  await page.getByRole('button', { name: /Search & add cards/ }).click()
  await page.getByRole('button', { name: 'Search cards', exact: true }).click()
  await page.locator('.card-search-grid .search-card').first().waitFor()

  const shots = process.env.SCREENSHOTS
  const capture = async (name: string) => {
    if (!shots) return
    await page.locator('#card-search-results-title').scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true })
  }
  await capture('wide-light')
  await setDisplayPreferences(page, { 'Dark mode': true })
  await capture('wide-dark')
  await setDisplayPreferences(page, { 'Dark mode': false })

  if (!process.env.SKIP_ASSERTS) {
    const summary = page.locator('.search-results-heading p')
    assert.match(await summary.innerText(), /150 matching cards/)
    assert.match(await summary.innerText(), /60 loaded/)
    assert.match(await summary.innerText(), /2 already in your deck or sideboard, hidden/)

    const columns = await gridColumns(page)
    const first = await shownNames(page)
    assert.ok(columns >= 9, `wide layout shows at least nine columns, got ${columns}`)
    assert.equal(first.length % columns, 0, 'a full page fills complete rows')

    // Walk every page; Next fetches more results when it reaches past the loaded ones.
    const seen: string[] = []
    const pagination = page.getByRole('navigation', { name: 'Search result pages' })
    const next = pagination.getByRole('button', { name: 'Next page' })
    for (;;) {
      seen.push(...(await shownNames(page)))
      if (!(await next.isEnabled())) break
      await next.click()
      await page.locator('[aria-busy="true"]').waitFor({ state: 'detached' })
    }
    const expected = Array.from({ length: totalCards }, (_, index) => resultName(index + 1)).filter(
      (name) => !inDeck.includes(name),
    )
    assert.deepEqual(seen, expected, 'paging visits every visible result once, in order')
    assert.match(await pagination.innerText(), /of 148 cards/)

    await page.getByRole('checkbox', { name: 'Show cards already in deck or sideboard' }).check()
    assert.doesNotMatch(await summary.innerText(), /hidden/)
    assert.match(await pagination.innerText(), /of 150 cards/)

    await page.setViewportSize({ width: 390, height: 900 })
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.card-search-grid .search-card').length %
          getComputedStyle(document.querySelector('.card-search-grid')!).gridTemplateColumns.split(
            ' ',
          ).length ===
        0,
    )
  } else await page.setViewportSize({ width: 390, height: 900 })
  await capture('narrow-light')
  assert.deepEqual(errors, [])
  console.log('Card search browser check passed')
} finally {
  await browser.close()
}
