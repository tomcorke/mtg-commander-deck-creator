import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium, type BrowserContext, type Page } from 'playwright-core'

import { firstUseCards } from './fixtures/a2-a9.ts'
import { commanderConstructionError } from '../src/domain/commander-construction.ts'
import { cardNameKey, toDeckCard } from '../src/domain/card-model.ts'
import { autosavePrefix, workspaceSessionKey } from '../src/autosaves.ts'
import { storedDeckStateSchema } from '../src/deck-state.ts'

const commanders = firstUseCards.filter((card) => !commanderConstructionError([toDeckCard(card)]))
const support = firstUseCards.filter((card) => !commanders.includes(card))
const chosen = firstUseCards[0]
const screenshotDir = join(tmpdir(), 'a2-a9-browser')
const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

function mockSearchResults(query: string) {
  const printing = firstUseCards.find((card) => query.includes(card.oracle_id ?? 'unmatched'))
  if (printing) return [printing]
  if (query.includes('is:commander'))
    return [
      ...commanders,
      {
        ...chosen,
        name: 'Banned fixture',
        oracle_id: 'banned-fixture',
        legalities: { commander: 'banned' },
      },
    ]
  const mana = (card: typeof chosen) =>
    card.type_line.includes('Land') || /add \{/i.test(card.oracle_text ?? '')
  if (query.includes('-t:land -o:"add {"')) return support.filter((card) => !mana(card))
  if (query.includes('(t:land or o:"add {")')) return support.filter(mana)
  return support
}

async function mockProviders(context: BrowserContext) {
  const requests: string[] = []
  await context.route('https://api.scryfall.com/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url.href)
    if (url.pathname === '/symbology') return route.continue()
    if (url.pathname === '/sets')
      return route.fulfill({
        json: {
          data: [
            {
              code: chosen.set,
              name: chosen.set_name,
              set_type: 'expansion',
              released_at: '2020-01-01',
            },
          ],
        },
      })
    if (url.pathname === '/cards/collection') {
      const identifiers = route.request().postDataJSON().identifiers as { name: string }[]
      const cards = identifiers.flatMap(
        ({ name }) =>
          firstUseCards.find((card) => cardNameKey(card.name) === cardNameKey(name)) ?? [],
      )
      return route.fulfill({ json: { data: cards } })
    }
    if (url.pathname === '/cards/named') {
      const card = firstUseCards.find(
        (card) => cardNameKey(card.name) === cardNameKey(url.searchParams.get('exact') ?? ''),
      )
      return card
        ? route.fulfill({ json: card })
        : route.fulfill({ status: 404, json: { object: 'error' } })
    }
    const query = url.searchParams.get('q') ?? ''
    const data = mockSearchResults(query)
    return route.fulfill({ json: { data, total_cards: data.length, has_more: false } })
  })
  await context.route('https://json.edhrec.com/**', (route) => {
    requests.push(route.request().url())
    return route.fulfill({ json: { container: { json_dict: { cardlists: [] } } } })
  })
  return requests
}

async function press(page: Page, locator: ReturnType<Page['getByRole']>) {
  await locator.focus()
  await page.keyboard.press('Enter')
}
async function batch(page: Page) {
  await page.locator('.card-offer').first().waitFor()
  await page.waitForFunction(
    () =>
      document.activeElement?.id === 'recommendation-batch-title' ||
      Boolean(document.querySelector('.intro-guide')),
  )
}
async function currentDraft(page: Page) {
  const raw = await page.evaluate(
    ({ prefix, key }) => localStorage.getItem(prefix + sessionStorage.getItem(key)),
    { prefix: autosavePrefix, key: workspaceSessionKey },
  )
  assert.ok(raw)
  return { raw, state: storedDeckStateSchema.parse(JSON.parse(raw).state) }
}
async function noOverflow(page: Page) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No horizontal overflow',
  )
}
async function showAllThemes(page: Page) {
  while (!(await page.getByRole('button', { name: 'Tokens', exact: true }).count()))
    await press(page, page.getByRole('button', { name: 'Show more themes' }))
}
async function chooseCommander(page: Page) {
  await press(page, page.getByRole('button', { name: `Choose ${chosen.name}`, exact: false }))
  await page.getByRole('heading', { name: 'How do you want to play?' }).waitFor()
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'play-style-title')
  assert.equal(await page.locator('.card-offer').count(), 0)
}

async function discoveryAndDisplay(page: Page, label: string) {
  await page.locator('.commander-tile').nth(11).waitFor()
  assert.equal(await page.getByRole('button', { name: /Choose Banned fixture/ }).count(), 0)
  assert.equal(await page.locator('.step').count(), 0)
  const art = page.locator('.commander-discovery-art').first()
  await art.focus()
  await page.waitForFunction(() =>
    Boolean(document.querySelector('.commander-discovery-art .card-image-preview:popover-open')),
  )
  await art.hover()
  assert.ok(
    await art
      .locator('.card-image-preview')
      .evaluate((element) => element.matches(':popover-open')),
  )
  await press(page, page.locator('.commander-tile .card-reference-name').first())
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const dfc = page.locator('.commander-tile').filter({ hasText: 'Ojer Taq' })
  const front = await dfc
    .locator('.commander-discovery-art > .finished-card > img')
    .getAttribute('src')
  await press(page, dfc.getByRole('button', { name: /Show back of/ }))
  assert.notEqual(
    await dfc.locator('.commander-discovery-art > .finished-card > img').getAttribute('src'),
    front,
  )
  await page.getByRole('button', { name: 'Display', exact: true }).focus()
  const before = await page.locator('.start').boundingBox()
  await page.keyboard.press('Enter')
  assert.equal(
    await page.getByRole('button', { name: 'Display', exact: true }).getAttribute('aria-expanded'),
    'true',
  )
  assert.deepEqual(
    await page.locator('.start').boundingBox(),
    before,
    'Display panel must not shift content',
  )
  const panel = await page.getByRole('group', { name: 'Display settings' }).boundingBox()
  assert.ok(panel && panel.x >= 0 && panel.x + panel.width <= (page.viewportSize()?.width ?? 0))
  await page.keyboard.press('Escape')
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Display')
  await press(page, page.getByRole('button', { name: 'Display', exact: true }))
  await page.getByRole('heading', { name: 'What do you want to play?' }).click()
  assert.equal(
    await page.getByRole('button', { name: 'Display', exact: true }).getAttribute('aria-expanded'),
    'false',
  )
  await showAllThemes(page)
  await press(page, page.getByRole('button', { name: 'Tokens', exact: true }))
  await press(page, page.getByRole('button', { name: 'Green', exact: true }))
  await press(page, page.getByRole('button', { name: 'White', exact: true }))
  await page.getByRole('button', { name: `Choose ${chosen.name}`, exact: false }).waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Tokens', exact: true }).getAttribute('aria-pressed'),
    'true',
  )
  const names = await page
    .locator('.commander-tile > .card-reference .card-reference-name')
    .allTextContents()
  assert.deepEqual(
    names.sort(),
    [chosen.name, "Trostani, Selesnya's Voice", 'Maja, Bretagard Protector'].sort(),
  )
  await page.getByRole('textbox', { name: 'Search commanders' }).fill('Rhys')
  await page.waitForFunction(() => document.querySelectorAll('.commander-tile').length === 1)
  assert.match(
    await page.getByRole('status').filter({ hasText: 'Searching within this theme' }).innerText(),
    /Tokens.*Green.*White/,
  )
  await page.getByRole('textbox', { name: 'Search commanders' }).fill('No such leader')
  await page.getByRole('heading', { name: 'No commanders match these filters' }).waitFor()
  await press(page, page.getByRole('button', { name: 'Clear filters', exact: true }).first())
  await page.locator('.commander-tile').nth(11).waitFor()
  await noOverflow(page)
  await page.screenshot({ path: join(screenshotDir, `${label}-start.png`), fullPage: true })
}

async function checkGuide(page: Page) {
  const guide = page.getByRole('dialog', { name: 'Choose what happens to each card' })
  await guide.waitFor()
  assert.equal(
    await page.evaluate(() => localStorage.getItem('option:introGuideRequested')),
    'false',
  )
  for (const name of ['Back', 'Next', 'Skip'])
    assert.ok(await guide.getByRole('button', { name, exact: true }).isVisible())
  await page.waitForFunction(() =>
    document.querySelector('.intro-guide')?.contains(document.activeElement),
  )
  for (const key of ['Tab', 'Shift+Tab'])
    for (let index = 0; index < 7; index++) {
      await page.keyboard.press(key)
      assert.ok(
        await page
          .locator('.intro-guide')
          .evaluate((element) => element.contains(document.activeElement)),
      )
    }
  await press(page, guide.getByRole('button', { name: 'Next', exact: true }))
  const second = page.getByRole('dialog', { name: 'More like this', exact: true })
  await second.waitFor()
  await press(page, second.getByRole('button', { name: 'Back', exact: true }))
  await guide.waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.intro-guide').waitFor({ state: 'hidden' })
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'recommendation-batch-title')
  await page.reload()
  await page.locator('.card-offer').first().waitFor()
  assert.equal(await page.locator('.intro-guide').count(), 0)
}

async function preferences(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      [
        'powerTarget',
        'recommendationStyle',
        'excludeGameChangers',
        'excludeTutors',
        'excludeExtraTurns',
        'excludeUnreleased',
      ].map((key) => [key, JSON.parse(localStorage.getItem('option:' + key) ?? 'null')]),
    ),
  )
}
async function styleAndResume(page: Page, requests: string[], label: string) {
  const guideOption = page.getByRole('checkbox', {
    name: 'Show a quick guide when I start my next deck',
  })
  assert.ok(await guideOption.isChecked())
  await chooseCommander(page)
  assert.equal(
    requests.filter((url) => url.includes('json.edhrec.com')).length,
    0,
    'No first batch before style choice',
  )
  await press(page, page.getByRole('button', { name: 'Choose sets to build from' }))
  await page.getByRole('dialog', { name: 'Recommendation settings' }).waitFor()
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'recommendation-sets')
  await page.getByRole('checkbox', { name: chosen.set_name, exact: false }).check()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    'Choose sets to build from',
  )
  await page.screenshot({ path: join(screenshotDir, `${label}-style.png`), fullPage: true })
  await press(page, page.getByRole('button', { name: /^Casual/ }))
  await batch(page)
  assert.deepEqual(await preferences(page), {
    powerTarget: 'precon',
    recommendationStyle: 'thematic',
    excludeGameChangers: true,
    excludeTutors: true,
    excludeExtraTurns: true,
    excludeUnreleased: true,
  })
  await checkGuide(page)
  assert.deepEqual((await currentDraft(page)).state.collectionSets, [chosen.set])
  await press(page, page.getByRole('button', { name: 'Display', exact: true }))
  await page.getByRole('checkbox', { name: 'Motion and finishes', exact: true }).uncheck()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: join(screenshotDir, `${label}-batch.png`), fullPage: true })
  const stored = await currentDraft(page)
  await page.goto('http://127.0.0.1:5282/#start')
  await page.getByRole('heading', { name: 'Continue building' }).waitFor()
  assert.equal(await page.locator('.workspace-notice').count(), 0)
  assert.ok(!(await guideOption.isChecked()))
  assert.equal((await currentDraft(page)).raw, stored.raw)
  await press(page, page.getByRole('button', { name: 'Choose another draft', exact: true }))
  await page.getByRole('dialog', { name: 'Drafts and saved decks' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await press(page, page.getByRole('button', { name: 'Continue building', exact: true }))
  await page.locator('.card-offer').first().waitFor()
  assert.equal(await page.locator('.play-style-step').count(), 0)
  await noOverflow(page)
}

async function skipAndReload(context: BrowserContext) {
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5282/#start')
  await page.locator('.commander-tile').first().waitFor()
  await page
    .getByRole('checkbox', { name: 'Show a quick guide when I start my next deck' })
    .uncheck()
  const before = await preferences(page)
  await chooseCommander(page)
  await press(page, page.getByRole('button', { name: 'Skip — use current settings', exact: true }))
  await batch(page)
  assert.deepEqual(await preferences(page), before)
  assert.equal(await page.locator('.intro-guide').count(), 0)
  await page.goto('http://127.0.0.1:5282/#start')
  await page.locator('.commander-tile').first().waitFor()
  await chooseCommander(page)
  await page.waitForFunction(
    ({ prefix, key }) => {
      const raw = localStorage.getItem(prefix + sessionStorage.getItem(key))
      return raw && JSON.parse(raw).state.firstBatchPending === true
    },
    { prefix: autosavePrefix, key: workspaceSessionKey },
  )
  await page.reload()
  await page.locator('.card-offer').first().waitFor()
  assert.equal(
    await page.locator('.play-style-step').count(),
    0,
    'Prepared draft resumes without another style step',
  )
  assert.ok(!(await currentDraft(page)).state.firstBatchPending)
  await page.close()
}

await mkdir(screenshotDir, { recursive: true })
const server = await createServer({
  configFile: false,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('a2-a9-check') },
  server: { host: '127.0.0.1', port: 5282, strictPort: true },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  })
  for (const [label, dark, width] of [
    ['light', false, 1440],
    ['dark', true, 1440],
    ['narrow', true, 390],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    })
    await context.addInitScript(
      ({ dark }) => {
        if (!localStorage.getItem('option:darkMode'))
          localStorage.setItem('option:darkMode', JSON.stringify(dark))
      },
      { dark },
    )
    const requests = await mockProviders(context)
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:5282')
    await discoveryAndDisplay(page, label)
    await styleAndResume(page, requests, label)
    await skipAndReload(context)
    assert.deepEqual(errors, [], label)
    console.log(
      `${label}: discovery, previews/DFC/details, display, preset/sets, guide keyboard/Escape, resume, skip and pre-batch reload passed`,
    )
    await context.close()
  }
  console.log(`Rendered screenshots: ${screenshotDir}`)
} finally {
  await browser?.close()
  await server.close()
}
