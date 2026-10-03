// Run against pnpm dev with an installed Playwright module; no test dependency is added.
// PLAYWRIGHT_MODULE=file:///.../@playwright/test/index.mjs node --experimental-strip-types scripts/check-deck-review.ts
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { defaultDeckTargets } from '../src/deck-analysis.ts'
import { persistedDeckStateSchema } from '../src/deck-state.ts'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test')
const base = process.env.REVIEW_URL ?? 'http://127.0.0.1:5229/'
const output = process.env.REVIEW_SCREENSHOTS ?? 'screenshots'
await mkdir(output, { recursive: true })
const records: ScryfallCard[] = []
for (const name of [
  'Meren of Clan Nel Toth',
  'Forest',
  'Sol Ring',
  'Arcane Signet',
  'Savra, Queen of the Golgari',
]) {
  const response = await fetch(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
    { headers: { 'User-Agent': 'CommanderCreatorBrowserCheck/1.0', Accept: 'application/json' } },
  )
  assert.equal(response.status, 200)
  records.push(await response.json())
  await new Promise((resolve) => setTimeout(resolve, 120))
}
const [commander, forest, solRing, signet, alternative] = records
const state = persistedDeckStateSchema.parse({
  commander: commander.name,
  commanderDetails: {
    images: [commander.image_uris!.normal],
    art: [commander.image_uris!.art_crop],
    colours: commander.color_identity,
    printings: [
      [
        {
          image: commander.image_uris!.normal,
          set: commander.set,
          collectorNumber: commander.collector_number,
        },
      ],
    ],
    selections: [0],
  },
  theme: 'Graveyard',
  recommendationStyle: 'balanced',
  queue: [
    toCard(solRing, 'Adds mana'),
    toCard(signet, 'Adds mana'),
    ...Array.from({ length: 14 }, (_, index) =>
      toCard({ ...solRing, name: `Candidate ${index}` }, 'Adds mana'),
    ),
  ],
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
  deck: [toDeckCard(commander), ...Array.from({ length: 98 }, () => toDeckCard(forest))],
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors: string[] = []
  let discardAccepted = true
  page.on('dialog', (dialog: any) => (discardAccepted ? dialog.accept() : dialog.dismiss()))
  page.on('pageerror', (error: Error) => errors.push(error.message))
  await page.route('https://api.scryfall.com/**', async (route: any) => {
    const url = new URL(route.request().url())
    const record = records.find(({ name }) => name === url.searchParams.get('exact')) ?? commander
    const body = url.pathname.endsWith('/named')
      ? record
      : {
          data: [url.searchParams.get('q')?.includes('is:commander') ? alternative : record],
          has_more: false,
        }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  await page.route('https://json.edhrec.com/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ container: { json_dict: { cardlists: [] } } }),
    }),
  )
  await page.addInitScript((saved: unknown) => {
    if (location.origin === 'null') return
    localStorage.clear()
    localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state: saved }))
    localStorage.setItem('option:darkMode', 'false')
    localStorage.setItem('option:cardEffects', 'false')
    localStorage.setItem('option:commanderStyling', 'false')
  }, state)
  await page.goto(`${base}#build`)
  const review = page.getByRole('button', { name: 'Deck review', exact: true })
  assert.equal(await review.count(), 1)
  assert.equal(await page.locator('.card-offer').count(), 4)
  await review.click()
  await page.getByRole('heading', { name: 'Diagnose', exact: true }).waitFor()
  assert.equal(await page.locator('#doctor-changes').count(), 0)
  await page.getByText('How review works', { exact: true }).click()
  await page.screenshot({ path: `${output}/diagnose-light.png`, fullPage: true })
  await page.getByRole('button', { name: 'Choose changes', exact: true }).click()
  await page.getByRole('heading', { name: 'Choose changes', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Adjust goals and filters', exact: true }).click()
  await page
    .getByRole('button', { name: 'Close recommendation settings', exact: true })
    .press('Escape')
  await page.waitForURL('**/#build/review-changes')
  assert.equal(await page.locator('#doctor-diagnosis').count(), 0)
  assert.equal(await page.locator('.doctor-plan').count(), 0)
  assert.equal(await page.locator('.doctor-additions-grid .doctor-card-tile').count(), 12)
  assert.ok(await page.getByRole('button', { name: 'Confirm changes', exact: true }).isDisabled())
  await page.getByRole('checkbox', { name: 'Add Sol Ring', exact: true }).check()
  await page.getByRole('button', { name: 'Confirm changes', exact: true }).click()
  await page.getByRole('heading', { name: 'Confirm', exact: true }).waitFor()
  assert.equal(await page.locator('#doctor-changes').count(), 0)
  const tray = page.getByRole('region', { name: 'Pending changes', exact: true })
  assert.match(await tray.innerText(), /Cutting 0 · Adding 1/)
  const savedCount = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('commander-deck-state')!).state.deck.length)
  assert.equal(await savedCount(), 99, 'Confirm must not apply a plan')
  await page.getByRole('button', { name: 'Show details for Sol Ring', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Close Sol Ring details', exact: true }).press('Escape')
  await page.waitForURL('**/#build/review-confirm')
  assert.match(await tray.innerText(), /Adding 1/)
  await page.keyboard.press('Escape')
  await page.waitForURL('**/#build/review-changes')
  assert.ok(await page.getByRole('checkbox', { name: 'Add Sol Ring', exact: true }).isChecked())
  await page.getByRole('button', { name: 'Confirm changes', exact: true }).click()
  await page.goBack()
  await page.waitForURL('**/#build/review-changes')
  await page.getByRole('button', { name: 'Confirm changes', exact: true }).click()
  await page.getByRole('button', { name: 'Change history (0)', exact: true }).click()
  await page.getByRole('dialog', { name: 'Change history', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Close change history', exact: true }).press('Escape')
  await page.waitForURL('**/#build/review-confirm')
  assert.match(await tray.innerText(), /Adding 1/)
  await page.getByRole('button', { name: 'Apply 1 change', exact: true }).click()
  await page.getByRole('heading', { name: 'Diagnose', exact: true }).waitFor()
  assert.equal(await savedCount(), 100)
  assert.equal(await page.locator('.doctor-apply-bar').count(), 0)
  await page.getByRole('button', { name: 'Change history (1)', exact: true }).click()
  await page.screenshot({ path: `${output}/history-light.png` })
  await page.getByRole('dialog', { name: 'Change history', exact: true }).waitFor()
  await page
    .getByRole('dialog', { name: 'Change history', exact: true })
    .getByRole('button', { name: 'Show details for Sol Ring', exact: true })
    .first()
    .click()
  await page.getByRole('button', { name: 'Close Sol Ring details', exact: true }).press('Escape')
  await page.waitForURL('**/#build/doctor-history')
  await page.getByRole('button', { name: 'Undo adding Sol Ring', exact: true }).click()
  assert.equal(await savedCount(), 99)
  await page.getByRole('button', { name: 'Close change history', exact: true }).click()
  await page.waitForURL('**/#build/review')
  await page.getByRole('button', { name: 'Compare commanders', exact: true }).click()
  await page.getByRole('dialog', { name: 'Compare commanders', exact: true }).waitFor()
  await page.locator('.doctor-commander-pair').waitFor()
  assert.equal(await page.locator('.doctor-commander-pair .doctor-card-art img').count(), 4)
  assert.match(await page.locator('.doctor-commander-pair').innerText(), /In deck/)
  await page.screenshot({ path: `${output}/commanders-light.png` })
  await page
    .getByRole('dialog', { name: 'Compare commanders', exact: true })
    .getByRole('button', { name: 'Show details for Savra, Queen of the Golgari', exact: true })
    .first()
    .click()
  await page
    .getByRole('button', { name: 'Close Savra, Queen of the Golgari details', exact: true })
    .press('Escape')
  await page.waitForURL('**/#build/review')
  assert.ok(
    await page.evaluate(
      () => document.activeElement?.closest('[aria-labelledby="doctor-commander-title"]') !== null,
    ),
  )
  await page
    .getByRole('button', { name: 'Close commander comparison', exact: true })
    .press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  await page.getByRole('button', { name: 'Choose changes', exact: true }).click()
  await page.getByLabel('Other main-deck cards').selectOption('all')
  await page.getByRole('spinbutton', { name: 'Copies of Forest to cut', exact: true }).fill('1')
  await page.getByRole('checkbox', { name: 'Add Sol Ring', exact: true }).check()
  const reference = page.locator('.doctor-additions-grid .card-reference').first()
  await reference.getByRole('button').focus()
  await page.waitForTimeout(250)
  assert.ok(
    await reference
      .locator('.card-image-preview')
      .evaluate((element: HTMLElement) => getComputedStyle(element).opacity === '1'),
  )
  await page.locator('.doctor-additions-grid .doctor-card-art').first().hover()
  await page.waitForTimeout(250)
  assert.ok(
    await page
      .locator('.doctor-additions-grid .doctor-card-art .card-image-preview')
      .first()
      .evaluate((element: HTMLElement) => getComputedStyle(element).opacity === '1'),
  )
  await page.getByRole('button', { name: 'Confirm changes', exact: true }).click()
  assert.equal(await page.locator('.doctor-plan-pair .doctor-card-tile').count(), 2)
  await page.screenshot({ path: `${output}/confirm-light.png`, fullPage: true })
  await page.getByLabel('Commander art and colours', { exact: true }).check()
  await page.screenshot({ path: `${output}/confirm-themed-light.png`, fullPage: true })
  await page.getByLabel('Commander art and colours', { exact: true }).uncheck()
  await page.getByRole('button', { name: '☀ Light', exact: true }).click()
  await page.screenshot({ path: `${output}/confirm-dark.png`, fullPage: true })
  await page.getByLabel('Commander art and colours', { exact: true }).check()
  await page.screenshot({ path: `${output}/confirm-themed-dark.png`, fullPage: true })
  await page.getByLabel('Commander art and colours', { exact: true }).uncheck()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${output}/confirm-narrow-dark.png`, fullPage: true })
  await page.getByRole('button', { name: 'Change history (0)', exact: true }).click()
  await page.screenshot({ path: `${output}/history-narrow-dark.png` })
  await page.getByRole('button', { name: 'Close change history', exact: true }).press('Escape')
  await page.waitForURL('**/#build/review-confirm')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.getByRole('button', { name: 'Back to Choose changes', exact: true }).click()
  await page.screenshot({ path: `${output}/changes-narrow-dark.png`, fullPage: true })
  await page.getByRole('button', { name: '◐ Dark', exact: true }).click()
  await page.screenshot({ path: `${output}/changes-narrow-light.png`, fullPage: true })
  assert.ok(
    await tray.evaluate(
      (element: HTMLElement) => element.getBoundingClientRect().bottom <= innerHeight,
    ),
  )
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.keyboard.press('Escape')
  await page.waitForURL('**/#build/review')
  assert.match(await tray.innerText(), /Cutting 1 · Adding 1/)
  await page.screenshot({ path: `${output}/diagnose-pending-narrow-light.png` })
  discardAccepted = false
  await page.getByRole('button', { name: 'Back to builder', exact: true }).first().click()
  assert.ok(page.url().endsWith('#build/review'))
  assert.match(await tray.innerText(), /Adding 1/)
  discardAccepted = true
  await page.keyboard.press('Escape')
  await page.waitForURL('**/#build')
  assert.equal(await review.count(), 1)
  await page.goBack()
  assert.ok(
    !page.url().includes('/review'),
    'Leaving review must not leave empty review steps behind the builder',
  )
  await page.goForward()
  await page.waitForURL('**/#build')
  await page.goto(`${base}#build/review-confirm`)
  await page.getByRole('heading', { name: 'Confirm', exact: true }).waitFor()
  assert.ok(await page.getByRole('button', { name: 'Apply 0 changes', exact: true }).isDisabled())
  await page.keyboard.press('Escape')
  await page.waitForURL('**/#build/review-changes')
  await page.keyboard.press('Escape')
  await page.waitForURL('**/#build/review')
  await page.keyboard.press('Escape')
  await page.waitForURL('**/#build')
  await page.goto(`${base}#build/review-changes`)
  await page.getByLabel('Other main-deck cards').selectOption('all')
  await page.getByRole('spinbutton', { name: 'Copies of Forest to cut', exact: true }).fill('1')
  await page.getByRole('checkbox', { name: 'Add Sol Ring', exact: true }).check()
  await page.getByRole('button', { name: 'Adjust goals and filters', exact: true }).click()
  await page.locator('#power-target').selectOption('upgraded')
  await page.waitForFunction(() =>
    document.querySelector('.doctor-apply-bar')?.textContent?.includes('Adding 0'),
  )
  await page
    .getByRole('button', { name: 'Close recommendation settings', exact: true })
    .press('Escape')
  await page.waitForURL('**/#build/review-changes')
  assert.match(await tray.innerText(), /Cutting 1 · Adding 0/)
  assert.deepEqual(errors, [])

  const partial = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await partial.addInitScript(
    (saved: unknown) => {
      localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state: saved }))
      localStorage.setItem('option:darkMode', 'false')
      localStorage.setItem('option:cardEffects', 'false')
      localStorage.setItem('option:commanderStyling', 'false')
    },
    { ...state, deck: state.deck.slice(0, 2) },
  )
  await partial.route('https://api.scryfall.com/**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: records, has_more: false }),
    }),
  )
  await partial.goto(`${base}#build/review`)
  await partial.getByRole('heading', { name: 'Add 98 more cards', exact: true }).waitFor()
  await partial
    .locator('.doctor-gap-list')
    .getByRole('button', { name: /^Ramp:/ })
    .click()
  await partial.getByRole('heading', { name: 'Choose changes', exact: true }).waitFor()
  assert.equal(await partial.locator('.doctor-other-cuts').getAttribute('open'), null)
  await partial.getByRole('checkbox', { name: 'Add Sol Ring', exact: true }).check()
  await partial.getByRole('button', { name: 'Confirm changes', exact: true }).click()
  assert.match(
    await partial.getByRole('region', { name: 'Pending changes' }).innerText(),
    /Cutting 0 · Adding 1/,
  )
  await partial.screenshot({ path: `${output}/partial-confirm-narrow-light.png`, fullPage: true })
  await partial.close()
  console.log(
    'Deck review: light, dark, narrow, steps, Back/Escape, drafts, card previews, apply and history passed.',
  )
} finally {
  await browser.close()
}
