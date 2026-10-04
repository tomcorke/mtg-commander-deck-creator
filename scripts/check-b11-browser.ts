// Start `pnpm dev --host 127.0.0.1 --port 5231`, then run `pnpm check:b11:browser`.
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { chromium } from 'playwright-core'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { defaultDeckTargets } from '../src/deck-analysis.ts'
import { persistedDeckStateSchema } from '../src/deck-state.ts'

const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

const image = (name: string) => `https://cards.scryfall.io/normal/front/${name}.jpg`
const card = (
  name: string,
  type_line: string,
  cmc: number,
  options: Partial<ScryfallCard> = {},
): ScryfallCard => ({
  name,
  type_line,
  cmc,
  mana_cost: cmc ? `{${cmc}}` : '',
  color_identity: [],
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: '1',
  prints_search_uri: `https://api.scryfall.com/cards/search?q=${encodeURIComponent(name)}`,
  image_uris: { normal: image(name) },
  ...options,
})
const commander = card('Browser Commander', 'Legendary Creature — Human', 3, {
  oracle_id: 'commander',
  power: '2',
  toughness: '2',
})
const doubleFaced = card('Browser DFC', 'Creature — Human', 2, {
  layout: 'transform',
  oracle_id: 'browser-dfc',
  power: '2',
  toughness: '2',
  card_faces: [
    {
      type_line: 'Creature — Human',
      mana_cost: '{2}',
      image_uris: { normal: image('front-face') },
    },
    { type_line: 'Creature — Beast', image_uris: { normal: image('back-face') } },
  ],
})
const deck = [
  toDeckCard(commander),
  { ...toDeckCard(card('Foil Artifact', 'Artifact', 2)), finish: 'foil' as const },
  { ...toDeckCard(card('Etched Artifact', 'Artifact', 3)), finish: 'etched' as const },
  toDeckCard(card('Ramp Rock', 'Artifact', 2, { oracle_text: '{T}: Add {G}.' })),
  toDeckCard(doubleFaced),
  toDeckCard(card('Forest', 'Basic Land — Forest', 0, { produced_mana: ['G'] })),
]
const makeCandidate = (index: number) =>
  toCard(
    card(`Candidate ${index}`, 'Artifact', 2, { oracle_id: `candidate-${index}` }),
    'Test fixture',
  )
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
  queue: Array.from({ length: 12 }, (_, index) => makeCandidate(index + 1)),
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
  deck,
  sideboard: [],
  preferredPrintSet: '',
  deckTargets: defaultDeckTargets,
})

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
try {
  const context = await browser.newContext({ viewport: { width: 1365, height: 950 } })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    if (url.hostname === 'cards.scryfall.io')
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      })
    if (url.hostname === 'api.scryfall.com') {
      if (url.pathname === '/sets') return route.fulfill({ json: { data: [] } })
      if (url.pathname === '/cards/collection') return route.fulfill({ json: { data: [] } })
      if (url.pathname === '/cards/search')
        return route.fulfill({ json: { data: [], has_more: false } })
      return route.fulfill({ json: commander })
    }
    if (url.hostname === 'json.edhrec.com')
      return route.fulfill({ json: { container: { json_dict: { cardlists: [] } } } })
    return route.fulfill({ status: 204, body: '' })
  })
  await page.addInitScript((saved) => {
    localStorage.clear()
    localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state: saved }))
    localStorage.setItem('option:cardEffects', 'true')
    localStorage.setItem('option:darkMode', 'false')
    localStorage.setItem('option:commanderStyling', 'false')
  }, state)
  const base = process.env.B11_URL ?? 'http://127.0.0.1:5231/'
  await page.goto(`${base}#build`)
  await page.getByRole('heading', { name: 'Deck overview', exact: true }).waitFor()
  const sections = page.locator('.deck-group-details')
  assert.ok((await sections.count()) >= 2, 'type sections render as native details')
  assert.equal(
    await page.locator('.commander-header summary').count(),
    0,
    'Commander heading is not collapsible',
  )
  const lands = page.locator('.deck-group').filter({ has: page.locator('.basic-land-row') })
  assert.match(await lands.locator('summary').innerText(), /LANDS/i)
  assert.equal(
    await lands.locator('.basic-land-row').count(),
    1,
    'basic land stays grouped inside Lands',
  )
  assert.equal(
    await page.getByRole('heading', { name: /^Basics/ }).count(),
    0,
    'no separate Basics group',
  )

  const foilReference = page.getByRole('button', { name: 'Show details for Foil Artifact' })
  const artifactDetails = sections.nth(2)
  const artifactSummary = artifactDetails.locator('summary')
  await artifactSummary.focus()
  await page.keyboard.press('Enter')
  assert.equal(await artifactDetails.evaluate((node) => (node as HTMLDetailsElement).open), false)
  await artifactSummary.focus()
  await page.keyboard.press('Space')
  assert.equal(await artifactDetails.evaluate((node) => (node as HTMLDetailsElement).open), true)
  await artifactSummary.focus()
  await page.keyboard.press('Space')
  assert.equal(await artifactDetails.evaluate((node) => (node as HTMLDetailsElement).open), false)
  await page.getByRole('button', { name: 'Next recommendations', exact: false }).first().click()
  assert.equal(
    await artifactDetails.evaluate((node) => (node as HTMLDetailsElement).open),
    false,
    'toggle survives unrelated render',
  )

  const landsDetails = sections.nth(3)
  await landsDetails.locator('summary').focus()
  await page.keyboard.press('Space')
  assert.equal(await landsDetails.evaluate((node) => (node as HTMLDetailsElement).open), false)
  const manaTwo = page.getByRole('button', { name: /^Mana value 2:/ }).first()
  await manaTwo.click()
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('[data-highlighted]')].some((node) =>
      node.closest('details')?.matches('[open]'),
    ),
  )
  assert.equal(await artifactDetails.evaluate((node) => (node as HTMLDetailsElement).open), true)
  assert.equal(await landsDetails.evaluate((node) => (node as HTMLDetailsElement).open), false)
  await page.getByRole('button', { name: 'Clear highlight', exact: true }).click()
  assert.equal(
    await artifactDetails.evaluate((node) => (node as HTMLDetailsElement).open),
    true,
    'clearing a highlight does not close sections',
  )
  assert.equal(
    await landsDetails.evaluate((node) => (node as HTMLDetailsElement).open),
    false,
    'manual closed state remains closed',
  )

  await page.getByRole('button', { name: 'Deck review', exact: true }).click()
  await page.locator('#deck-review-overview').waitFor()
  const rampFilter = page.locator('.deck-review-role-filter').filter({ hasText: 'Ramp' })
  await rampFilter.click()
  await page.getByRole('button', { name: 'Clear highlight', exact: true }).waitFor()
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('[data-highlighted]')].some((node) =>
      node.closest('details')?.matches('[open]'),
    ),
  )
  const roleMatchGroup = page
    .locator('[data-highlighted]')
    .first()
    .locator('xpath=ancestor::details[1]')
  assert.equal(await roleMatchGroup.evaluate((node) => (node as HTMLDetailsElement).open), true)
  await page.getByRole('button', { name: 'Clear highlight', exact: true }).click()
  assert.equal(await roleMatchGroup.evaluate((node) => (node as HTMLDetailsElement).open), true)

  assert.equal(
    await page.getByRole('button', { name: /Search & add cards/ }).count(),
    1,
    'one Search & add control',
  )
  assert.equal(
    await page.locator('.card-offer').count(),
    4,
    'recommendations remain a four-card batch',
  )
  await foilReference.focus()
  const foilPreview = foilReference.locator('xpath=..').locator('.card-image-preview')
  await foilPreview.waitFor({ state: 'visible' })
  assert.equal(await foilPreview.evaluate((node) => node.matches(':popover-open')), true)
  assert.equal(
    await foilPreview.locator('.holo-card').count(),
    1,
    'foil effect appears in focused preview',
  )
  assert.equal(
    await foilPreview.locator('.tilting-card').count(),
    1,
    'motion preference applies to the preview',
  )
  assert.equal(
    await foilPreview.locator('.card-flip-button').count(),
    0,
    'hover preview has no interactive flip',
  )
  assert.ok((await foilPreview.locator('.finished-card img').count()) >= 1)
  const thumbnail = foilReference.locator('.card-reference-thumbnail')
  await thumbnail.hover()
  assert.equal(
    await foilPreview.evaluate((node) => node.matches(':popover-open')),
    true,
    'image hover also opens preview',
  )
  const etchedReference = page.getByRole('button', { name: 'Show details for Etched Artifact' })
  await etchedReference.hover()
  const etchedPreview = etchedReference.locator('xpath=..').locator('.card-image-preview')
  await etchedPreview.waitFor({ state: 'visible' })
  assert.equal(await etchedPreview.evaluate((node) => node.matches(':popover-open')), true)
  assert.equal(
    await etchedPreview.locator('.etched-card').count(),
    1,
    'etched effect appears in hovered preview',
  )

  await page.getByRole('button', { name: 'Show details for Browser DFC' }).click()
  const details = page.getByRole('dialog')
  const flip = details.getByRole('button', { name: 'Show back of Browser DFC' })
  await flip.click()
  assert.match(
    (await details.locator('.deck-card-modal-art img').first().getAttribute('src')) ?? '',
    /back-face/,
  )
  await page.getByRole('button', { name: 'Close Browser DFC details' }).click()

  const perf = await page.evaluate(async () => {
    const entries: number[] = []
    const observer = new PerformanceObserver((list) =>
      entries.push(...list.getEntries().map(({ duration }) => duration)),
    )
    observer.observe({ type: 'longtask', buffered: false })
    await new Promise((resolve) => setTimeout(resolve, 1800))
    observer.disconnect()
    return {
      count: entries.length,
      maxMs: Math.max(0, ...entries).toFixed(1),
      totalMs: entries.reduce((a, b) => a + b, 0).toFixed(1),
    }
  })
  assert.ok(Number(perf.maxMs) < 150, `steady-state longest task ${perf.maxMs} ms is below 150 ms`)
  assert.deepEqual(errors, [], `no page errors: ${errors.join('; ')}`)
  console.log(
    `B11 browser OK: keyboard/details, highlight, previews, DFC details, 4 offers; long tasks=${perf.count}, max=${perf.maxMs}ms, total=${perf.totalMs}ms`,
  )
  await context.close()
} finally {
  await browser.close()
}
