// `pnpm check:b10:browser` starts/stops its own Vite server and disposable installed Chrome.
// B10_URL may point at an existing server. No screenshots, browser download, or dialog answers.
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from 'playwright-core'
import { createServer } from 'vite'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import type { PersistedDeckState } from '../src/deck-state.ts'
import type { EdhrecCommanderPage } from '../src/adapters/edhrec.ts'
import {
  allRecords,
  baseCandidates,
  deckRecords,
  fixtureCard,
  goalCandidates,
  makeState,
  preferenceCandidates,
} from './fixtures/b10-browser.ts'

// Playwright launches installed Chrome through child_process; keep Windows child windows hidden.
const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

type Provider = {
  records: ScryfallCard[]
  queries: string[]
  holdEdhrec?: Promise<void>
  failNamed?: boolean
}
type Scenario = { page: Page; context: BrowserContext; errors: string[]; provider: Provider }
const imageBody =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="224"><rect width="160" height="224" fill="#777"/></svg>'
const button = (scope: Page | Locator, name: string) =>
  scope.getByRole('button', { name, exact: true })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })
const rampFinding = (page: Page) =>
  page.locator('.doctor-finding').filter({ has: heading(page, 'Ramp may be short') })
const rows = (page: Page) => rampFinding(page).locator('.doctor-suggestion')
const recordFor = (provider: Provider, name: string) =>
  [...provider.records, ...allRecords].find(
    (record) => record.name.toLowerCase() === name.toLowerCase(),
  )
const list = (data: ScryfallCard[]) => ({
  object: 'list',
  data,
  has_more: false,
  total_cards: data.length,
})

function searchRecords(query: string, provider: Provider) {
  if (query.startsWith('oracleid:'))
    return [...provider.records, ...allRecords]
      .filter((record) => record.oracle_id === query.slice('oracleid:'.length))
      .slice(0, 1)
  const sets = [...query.matchAll(/set:(\w+)/g)].map((match) => match[1])
  return provider.records.filter((record) => {
    const text = record.oracle_text ?? ''
    return (
      record.legalities?.commander === 'legal' &&
      record.color_identity.every((colour) => colour === 'G') &&
      (!sets.length || sets.includes(record.set)) &&
      (!query.includes('-is:gamechanger') || !record.game_changer) &&
      (!query.includes('-otag:tutor') || !/search your library/i.test(text)) &&
      (!query.includes('-otag:extra-turn') || !/extra turn/i.test(text)) &&
      (!query.includes('date<=today') || (record.released_at ?? '') <= '2026-10-03') &&
      (!query.includes('o:token') || /token/i.test(text))
    )
  })
}

async function mockScryfall(route: Route, provider: Provider) {
  const url = new URL(route.request().url())
  if (url.pathname === '/sets')
    return route.fulfill({
      json: {
        data: [
          {
            code: 'tst',
            name: 'B10 Fixture Alpha',
            set_type: 'expansion',
            released_at: '2020-01-01',
          },
          {
            code: 'oth',
            name: 'B10 Fixture Beta',
            set_type: 'expansion',
            released_at: '2019-01-01',
          },
        ],
      },
    })
  if (url.pathname === '/symbology')
    return route.fulfill({
      json: {
        data: ['1', '2', '3', '4', '5', '6', '7', 'G'].map((symbol) => ({
          symbol: `{${symbol}}`,
          english: `Fixture mana ${symbol}`,
          svg_uri: `https://svgs.scryfall.io/card-symbols/${symbol}.svg`,
        })),
      },
    })
  if (url.pathname === '/cards/named') {
    if (provider.failNamed)
      return route.fulfill({ status: 503, json: { object: 'error', details: 'Fixture failure' } })
    const record = recordFor(provider, url.searchParams.get('exact') ?? '')
    if (!record)
      return route.fulfill({
        status: 404,
        json: {
          object: 'error',
          code: 'not_found',
          status: 404,
          details: 'No record in the synthetic fixture.',
        },
      })
    return route.fulfill({ json: record })
  }
  if (url.pathname === '/cards/collection') {
    const identifiers = route.request().postDataJSON().identifiers as {
      name?: string
      set?: string
      collector_number?: string
    }[]
    const data = identifiers.map((identifier) =>
      identifier.name
        ? recordFor(provider, identifier.name)
        : [...provider.records, ...allRecords].find(
            (record) =>
              record.set === identifier.set &&
              record.collector_number === identifier.collector_number,
          ),
    )
    // Unmodelled basics requested by the manual chooser remain explicit provider misses.
    return route.fulfill({
      json: {
        ...list(data.filter((record): record is ScryfallCard => Boolean(record))),
        not_found: identifiers.filter((_, index) => !data[index]),
      },
    })
  }
  assert.equal(url.pathname, '/cards/search', `known Scryfall endpoint: ${url}`)
  const query = url.searchParams.get('q') ?? ''
  provider.queries.push(query)
  return route.fulfill({ json: list(searchRecords(query, provider)) })
}

async function mockRequest(route: Route, scenario: Scenario, base: string) {
  const url = new URL(route.request().url())
  if (url.origin === new URL(base).origin) return route.continue()
  if (url.hostname === 'cards.scryfall.io' || url.hostname === 'svgs.scryfall.io')
    return route.fulfill({ contentType: 'image/svg+xml', body: imageBody })
  if (url.hostname === 'api.scryfall.com') return mockScryfall(route, scenario.provider)
  if (url.hostname === 'json.edhrec.com') {
    await scenario.provider.holdEdhrec
    const data: EdhrecCommanderPage = {
      container: {
        json_dict: {
          cardlists: [
            {
              header: 'High Synergy Cards',
              tag: 'highsynergycards',
              cardviews: scenario.provider.records.map(({ name }) => ({ name })),
            },
          ],
        },
      },
    }
    return route.fulfill({ json: data })
  }
  assert(
    ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname),
    `no unmocked external request: ${url}`,
  )
  return route.fulfill({ status: 204, body: '' })
}

async function openScenario(
  browser: Browser,
  base: string,
  state: PersistedDeckState,
  records = baseCandidates,
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const scenario: Scenario = { page, context, errors: [], provider: { records, queries: [] } }
  page.on('pageerror', (error) => scenario.errors.push(error.message))
  // Record, never answer native dialogs. An unexpected dialog blocks the action and fails the gate.
  page.on('dialog', (dialog) =>
    scenario.errors.push(`Unexpected native ${dialog.type()}: ${dialog.message()}`),
  )
  await context.route('**/*', async (route) => {
    try {
      await mockRequest(route, scenario, base)
    } catch (error) {
      scenario.errors.push(
        `Mock contract: ${error instanceof Error ? error.message : String(error)}`,
      )
      await route.fulfill({ status: 503, body: 'Mock contract failure' }).catch(() => undefined)
    }
  })
  await page.addInitScript((saved) => {
    localStorage.clear()
    localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state: saved }))
    const options = {
      darkMode: false,
      commanderStyling: false,
      cardEffects: false,
      powerTarget: 'high',
      includeCreature: false,
      excludeGameChangers: false,
      excludeTutors: false,
      excludeExtraTurns: false,
      excludeUnreleased: false,
    }
    for (const [key, value] of Object.entries(options))
      localStorage.setItem(`option:${key}`, JSON.stringify(value))
  }, state)
  await page.goto(`${base}#build`)
  await button(page, 'Deck review').waitFor()
  return scenario
}

async function savedState(page: Page): Promise<PersistedDeckState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('commander-deck-state')!).state)
}
async function waitForCard(page: Page, name: string, present = true) {
  await page.waitForFunction(
    ({ name, present }) =>
      JSON.parse(localStorage.getItem('commander-deck-state')!).state.deck.some(
        (card: { name: string }) => card.name === name,
      ) === present,
    { name, present },
  )
}
async function enterReview(page: Page) {
  await button(page, 'Deck review').click()
  await heading(page, 'Diagnose').waitFor()
}
async function rowNames(row: Locator) {
  return row.locator('.card-reference-name').allTextContents()
}
async function focusIs(locator: Locator) {
  await locator.page().waitForFunction(
    (selector) => document.activeElement?.matches(selector),
    await locator.evaluate((element) => {
      if (element.id) return `#${element.id}`
      return `.doctor-finding[aria-label=${JSON.stringify(element.getAttribute('aria-label'))}]`
    }),
  )
}
async function checkPreviews(page: Page, row: Locator) {
  for (const tile of await row.locator('.doctor-card-tile').all()) {
    const name = (await tile.locator('.card-reference-name').innerText()).trim()
    const reference = tile.locator('.card-reference')
    await reference.locator('button').focus()
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('.card-reference')].some(
          (node) =>
            node.textContent?.trim() === name &&
            node.querySelector('.card-image-preview')?.matches(':popover-open'),
        ),
      name,
    )
    await page.keyboard.press('Shift+Tab')
    assert.equal(
      await tile.locator('.doctor-card-art').evaluate((node) => node === document.activeElement),
      true,
    )
    const artPreview = tile.locator('.small-card-image .card-image-preview')
    await artPreview.waitFor({ state: 'visible' })
    await page.waitForFunction(
      (node) => getComputedStyle(node).opacity === '1',
      await artPreview.elementHandle(),
    )
    assert.equal(await artPreview.evaluate((node) => getComputedStyle(node).opacity), '1')
    assert(
      (await artPreview.boundingBox())!.width >
        (await tile.locator('.small-card-image-thumbnail').boundingBox())!.width,
    )
    await tile.locator('.doctor-card-art').hover()
    assert.equal(await artPreview.evaluate((node) => getComputedStyle(node).visibility), 'visible')
    await tile.locator('.doctor-card-art').press('Enter')
    await page.getByRole('dialog').waitFor()
    await button(page, `Close ${name} details`).press('Escape')
    await heading(page, 'Diagnose').waitFor()
  }
}

async function pairingApplyUndo({ page }: Scenario) {
  assert.equal(await page.locator('.card-offer').count(), 4)
  const beforeSizes = await page
    .locator('.card-offer .offered-image')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
  assert(
    beforeSizes.every((width) => width >= 180),
    'recommendation art remains large',
  )
  await enterReview(page)
  assert.equal(await rows(page).count(), 3)
  const protectedNames = new Set([
    'B10 Commander',
    'B10 Basic',
    'B10 Last draw',
    'B10 Existing ramp A',
    'B10 Existing ramp B',
  ])
  for (const row of await page.locator('.doctor-suggestion').all()) {
    const [cut] = await rowNames(row)
    assert(!protectedNames.has(cut), `protected card is not a cut: ${cut}`)
    assert.equal(await row.locator('.doctor-card-tile').count(), 2)
    assert.match(await row.locator('.doctor-card-status').first().innerText(), /In deck/)
  }
  const row = rows(page).filter({
    has: page.locator('.card-reference-name', { hasText: 'B10 Ramp draw' }),
  })
  assert.match(await row.innerText(), /Ramp 2 → 3 · Card draw 1 → 2/)
  assert.doesNotMatch(await row.innerText(), /Curve/)
  const [cut, add] = await rowNames(row)
  await checkPreviews(page, row)
  const before = (await savedState(page)).deck
  await button(row, 'Apply swap').press('Enter')
  await waitForCard(page, add)
  await focusIs(rampFinding(page))
  assert.equal((await savedState(page)).deck.length, 100)
  assert(!(await savedState(page)).deck.some((card) => card.name === cut))
  assert.match(await rampFinding(page).innerText(), /3 cards detected against a target of 10/)
  assert(!(await rows(page).allTextContents()).some((text) => text.includes(add)))
  await button(page, 'Change history (1)').click()
  const history = page.getByRole('dialog', { name: 'Change history' })
  assert.equal(await history.locator('.doctor-history-item').count(), 1)
  await button(history, `Undo ${add} for ${cut}`).press('Enter')
  await waitForCard(page, cut)
  assert.deepEqual((await savedState(page)).deck, before)
  await button(history, 'Close change history').press('Escape')
  await button(page, 'Back to builder').click()
  await button(page, 'Deck review').waitFor()
  assert.equal(await page.locator('.card-offer').count(), 4)
  const afterSizes = await page
    .locator('.card-offer .offered-image')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
  assert.deepEqual(afterSizes, beforeSizes, 'review did not shrink builder art')
}

async function resolvingFinding({ page }: Scenario) {
  await enterReview(page)
  const row = rows(page).first()
  const [cut, add] = await rowNames(row)
  await button(row, 'Apply swap').press('Enter')
  await waitForCard(page, add)
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('.doctor-finding h3')].some(
        (node) => node.textContent === 'Ramp may be short',
      ),
  )
  assert.equal(await rampFinding(page).count(), 0, 'filled role finding disappears')
  assert.equal(
    await page.evaluate(
      () =>
        document.activeElement?.matches('.doctor-finding') ||
        document.activeElement?.textContent === 'Diagnose',
    ),
    true,
    'resolved finding falls back to another finding or the step heading',
  )
  await button(page, 'Change history (1)').click()
  await button(page, `Undo ${add} for ${cut}`).click()
  await button(page, 'Close change history').press('Escape')
  await rampFinding(page).waitFor()
}

async function stagedPlansAndExits({ page }: Scenario) {
  await enterReview(page)
  const expectedPairs = [] as string[][]
  for (const index of [0, 1]) {
    const row = rows(page).nth(index)
    expectedPairs.push(await rowNames(row))
    await button(row, 'Add to plan').press('Enter')
    assert.equal(await button(row, 'Apply swap').isDisabled(), true)
  }
  const tray = page.getByRole('region', { name: 'Pending changes' })
  assert.match(await tray.innerText(), /Cutting 2 · Adding 2/)
  const before = (await savedState(page)).deck
  for (const keep of ['Keep choices', 'Escape', 'Close and keep choices']) {
    await button(page, 'Back to builder').click()
    const prompt = page.getByRole('dialog', { name: 'Discard your choices?' })
    await prompt.waitFor()
    if (keep === 'Escape') await page.keyboard.press('Escape')
    else await button(prompt, keep).press('Enter')
    await focusIs(page.locator('#deck-review-title'))
    assert.match(await tray.innerText(), /Cutting 2 · Adding 2/)
  }
  await button(page, 'Continue choosing changes').click()
  await heading(page, 'Choose changes').waitFor()
  await button(page, 'Confirm changes').click()
  await heading(page, 'Confirm').waitFor()
  const pairs = page.locator('.doctor-plan-pair')
  assert.equal(await pairs.count(), 2)
  for (const index of [0, 1])
    assert.deepEqual(await rowNames(pairs.nth(index)), expectedPairs[index])
  await button(page, 'Change history (0)').click()
  await button(page, 'Close change history').press('Escape')
  await heading(page, 'Confirm').waitFor()
  await page.goBack()
  await heading(page, 'Choose changes').waitFor()
  assert.match(await tray.innerText(), /Cutting 2 · Adding 2/)
  await button(page, 'Confirm changes').click()
  await button(page, 'Apply 4 changes').press('Enter')
  for (const [, add] of expectedPairs) await waitForCard(page, add)
  assert.equal(await page.locator('.doctor-apply-bar').count(), 0)
  await button(page, 'Change history (2)').click()
  for (const [cut, add] of expectedPairs.toReversed())
    await button(page, `Undo ${add} for ${cut}`).click()
  assert.deepEqual((await savedState(page)).deck, before)
  await button(page, 'Close change history').press('Escape')
  await button(rows(page).first(), 'Add to plan').click()
  await page.goBack()
  await heading(page, 'Choose changes').waitFor()
  await page.goBack()
  await heading(page, 'Diagnose').waitFor()
  await page.goBack()
  const prompt = page.getByRole('dialog', { name: 'Discard your choices?' })
  await prompt.waitFor()
  await button(prompt, 'Keep choices').click()
  await focusIs(page.locator('#deck-review-title'))
  await button(page, 'Back to builder').click()
  await button(prompt, 'Discard and leave').click()
  await button(page, 'Deck review').waitFor()
  await enterReview(page)
  assert.equal(await page.locator('.doctor-apply-bar').count(), 0)
}

async function readinessAndCurve({ page }: Scenario) {
  await enterReview(page)
  const state = await savedState(page)
  const row = rows(page).first()
  if (state.deck.length === 89) {
    assert.equal(await row.locator('.doctor-card-tile').count(), 1)
    assert.equal(await row.locator('.doctor-pair-arrow').count(), 0)
    assert.match(await row.innerText(), /Curve: \+1 at 3/)
    const [add] = await rowNames(row)
    await button(row, 'Add card').press('Enter')
    await waitForCard(page, add)
    assert.equal((await savedState(page)).deck.length, 90)
    await button(page, 'Change history (1)').click()
    await button(page, `Undo adding ${add}`).click()
    assert.equal((await savedState(page)).deck.length, 89)
  } else {
    assert.equal(state.deck.length, 90)
    assert.equal(await row.locator('.doctor-card-tile').count(), 2)
    assert.match(await row.innerText(), /Ramp 2 → 3 · Curve 2 → 3/)
    const [, add] = await rowNames(row)
    await button(row, 'Apply swap').click()
    await waitForCard(page, add)
    assert.equal((await savedState(page)).deck.length, 90)
  }
}

async function loadingErrorAndRecovery(scenario: Scenario) {
  const { page, provider } = scenario
  await enterReview(page)
  assert.equal(await rows(page).count(), 0)
  assert.match(await rampFinding(page).innerText(), /No safe swap found/)
  provider.failNamed = true
  await button(page, 'Find more legal replacements').click()
  await page.getByRole('status').filter({ hasText: 'Scryfall card unavailable' }).waitFor()
  assert.equal(await rows(page).count(), 0)
  provider.failNamed = false
  let release!: () => void
  provider.holdEdhrec = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await button(page, 'Find more legal replacements').click()
    const loading = button(page, 'Searching Scryfall and EDHREC…')
    await loading.waitFor()
    assert.equal(await loading.isDisabled(), true)
  } finally {
    release()
  }
  await rows(page).first().waitFor()
  assert.equal(await rows(page).count(), 3)
  assert.equal(await page.locator('.doctor-error').count(), 0)
}

async function adjustSettings(page: Page, change: (dialog: Locator) => Promise<void>) {
  await button(page, 'Adjust goals and filters').click()
  const dialog = page.getByRole('dialog', { name: 'Recommendation settings' })
  await change(dialog)
  await button(dialog, 'Done').click()
  await page.waitForFunction(
    () =>
      !document
        .querySelector('.doctor-goal-settings')
        ?.textContent?.includes('Refresh replacements below'),
  )
}

async function manualNames(page: Page) {
  if (page.url().endsWith('/review')) await button(page, 'Choose changes').click()
  await heading(page, 'Choose changes').waitFor()
  await page.locator('.doctor-additions-grid').waitFor()
  return page.locator('.doctor-additions-grid .card-reference-name').allTextContents()
}

async function goalUpdates({ page }: Scenario) {
  await enterReview(page)
  assert.equal((await rowNames(rows(page).first()))[1], 'B10 Theme ramp')
  await adjustSettings(page, async (dialog) => {
    await dialog.getByLabel('Priority', { exact: true }).selectOption('thematic')
  })
  assert.match(await page.locator('.doctor-goal-settings').innerText(), /Theme first/)
  assert.equal((await savedState(page)).recommendationStyle, 'thematic')
  await rows(page).first().waitFor()
  assert.equal(
    (await rowNames(rows(page).first()))[1],
    'B10 Theme ramp',
    'Thematic shared scoring keeps the theme-supporting pair',
  )
  await adjustSettings(page, async (dialog) => {
    await dialog.getByLabel('Priority', { exact: true }).selectOption('competitive')
  })
  assert.equal((await savedState(page)).recommendationStyle, 'competitive')
  await rows(page).first().waitFor()
  assert.equal((await rowNames(rows(page).first()))[1], 'B10 Nearby ramp')
}

async function pricePowerExclusions({ page, provider }: Scenario) {
  await enterReview(page)
  assert((await rows(page).allTextContents()).some((text) => text.includes('B10 Expensive')))
  await adjustSettings(page, async (dialog) => {
    await dialog.getByLabel('Max price per card', { exact: true }).fill('5')
  })
  assert.equal((await savedState(page)).maxPrice, 5)
  assert(!(await rows(page).allTextContents()).some((text) => text.includes('B10 Expensive')))
  let available = await manualNames(page)
  assert(!available.includes('B10 Expensive'))
  assert(available.includes('Lotus Petal'))
  await adjustSettings(page, async (dialog) => {
    await dialog.getByLabel('Power target', { exact: true }).selectOption('precon')
    for (const id of [
      'exclude-game-changers',
      'exclude-tutors',
      'exclude-extra-turns',
      'exclude-unreleased',
    ])
      await dialog.locator(`#${id}`).check()
  })
  available = await manualNames(page)
  for (const forbidden of [
    'B10 Expensive',
    'Lotus Petal',
    'B10 Game Changer',
    'B10 Tutor',
    'B10 Extra turn',
    'B10 Future',
  ])
    assert(!available.includes(forbidden), `filtered replacement: ${forbidden}`)
  assert(available.includes('B10 Selected set'))
  assert.equal(await page.evaluate(() => localStorage.getItem('option:powerTarget')), '"precon"')
  assert(
    provider.queries.some(
      (query) =>
        query.includes('-is:gamechanger') &&
        query.includes('-otag:tutor') &&
        query.includes('-otag:extra-turn') &&
        query.includes('date<=today'),
    ),
  )
  await button(page, 'Back to Diagnose').click()
  assert(
    !(await rows(page).allTextContents()).some((text) =>
      /B10 Expensive|Lotus Petal|B10 Game Changer|B10 Tutor|B10 Extra turn|B10 Future/.test(text),
    ),
  )
}

async function setPreferences({ page, provider }: Scenario) {
  await enterReview(page)
  await adjustSettings(page, async (dialog) => {
    await dialog.getByRole('checkbox', { name: /B10 Fixture Alpha/ }).check()
  })
  const preferred = await savedState(page)
  assert.equal(preferred.collectionMode, 'prefer')
  assert.deepEqual(preferred.collectionSets, ['tst'])
  const firstAdd = (await rowNames(rows(page).first()))[1]
  assert.equal(
    preferenceCandidates.find(({ name }) => name === firstAdd)?.set,
    'tst',
    'Prefer ranks the selected set ahead of otherwise equal candidates',
  )
  await adjustSettings(page, async (dialog) => {
    await dialog.locator('#collection-mode').selectOption('only')
  })
  const available = await manualNames(page)
  assert(!available.includes('B10 Other set'))
  assert(available.includes('B10 Selected set'))
  assert.equal((await savedState(page)).collectionMode, 'only')
  assert(provider.queries.some((query) => query.includes('set:tst')))
  await button(page, 'Back to Diagnose').click()
  assert(!(await rows(page).allTextContents()).some((text) => text.includes('B10 Other set')))
}

async function ignoredUpdates({ page }: Scenario) {
  const offer = page.locator('.card-offer').filter({ has: heading(page, 'B10 Ramp draw') })
  await button(offer, 'Ignore').press('Enter')
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem('commander-deck-state')!).state.ignoredCards.includes(
      'B10 Ramp draw',
    ),
  )
  await enterReview(page)
  assert(!(await rows(page).allTextContents()).some((text) => text.includes('B10 Ramp draw')))
  assert(!(await manualNames(page)).includes('B10 Ramp draw'))
  await button(page, 'Back to Diagnose').click()
  await button(page, 'Find more legal replacements').click()
  await button(page, 'Refresh legal recommendations').waitFor()
  assert(!(await rows(page).allTextContents()).some((text) => text.includes('B10 Ramp draw')))
}

async function stagedSettingsRefresh({ page }: Scenario) {
  await enterReview(page)
  const row = rows(page).first()
  const [, add] = await rowNames(row)
  await button(row, 'Add to plan').click()
  const before = (await savedState(page)).deck
  await adjustSettings(page, async (dialog) => {
    await dialog.getByLabel('Max price per card', { exact: true }).fill('0')
  })
  const tray = page.getByRole('region', { name: 'Pending changes' })
  await page.waitForFunction(() =>
    document.querySelector('.doctor-apply-bar')?.textContent?.includes('Cutting 1 · Adding 0'),
  )
  assert.match(await tray.innerText(), /Cutting 1 · Adding 0/)
  assert.match(
    await page.getByRole('status').filter({ hasText: 'Removed from picked additions' }).innerText(),
    new RegExp(add),
  )
  assert.deepEqual(
    (await savedState(page)).deck,
    before,
    'a settings refresh never applies or drops the remaining cut',
  )
  assert.equal(await rows(page).count(), 0)
}

async function constructionAndEmpty({ page }: Scenario) {
  await enterReview(page)
  assert.equal(await rows(page).count(), 0)
  assert.match(await rampFinding(page).innerText(), /No safe swap found for this finding/)
  assert.equal(await button(page, 'Apply swap').count(), 0)
  await button(page, 'Choose changes').click()
  assert.equal(await page.locator('.doctor-additions-grid').count(), 0)
  assert.match(await page.locator('#doctor-adds').innerText(), /No legal replacement cards/)
}

const server = process.env.B10_URL
  ? undefined
  : await createServer({
      server: { host: '127.0.0.1', port: Number(process.env.B10_PORT ?? 5240), strictPort: true },
      clearScreen: false,
    })
let browser: Browser | undefined
try {
  await server?.listen()
  const base = process.env.B10_URL ?? server!.resolvedUrls!.local[0]
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    chromiumSandbox: true,
    args: ['--enable-automation'],
  })
  const { arguments: args } = await (
    await browser.newBrowserCDPSession()
  ).send('Browser.getBrowserCommandLine')
  assert(!args.includes('--no-sandbox'), 'Chrome sandbox enabled')
  console.log(
    `Chrome ${browser.version()}: headless, sandbox enabled; no screenshots or native-dialog answers`,
  )
  const cases: [
    string,
    PersistedDeckState,
    (scenario: Scenario) => Promise<void>,
    ScryfallCard[]?,
  ][] = [
    [
      'safe pairing, impact, previews/details, apply/findings/focus/history/undo, four large offers',
      makeState(),
      pairingApplyUndo,
    ],
    [
      'lands and last-role protection below target',
      makeState({ deckTargets: { lands: 36, ramp: 10, draw: 2, removal: 0, wipes: 0 } }),
      pairingApplyUndo,
    ],
    [
      'resolved finding removal and keyboard focus fallback',
      makeState({ deckTargets: { lands: 35, ramp: 3, draw: 1, removal: 0, wipes: 0 } }),
      resolvingFinding,
    ],
    [
      'paired drafts, direct-Apply guard, Choose/Confirm/history/Back, exit protection and cancel focus',
      makeState(),
      stagedPlansAndExits,
    ],
    ...[89, 90].map((size): (typeof cases)[number] => [
      `${size}-card readiness boundary and curve impact`,
      makeState({
        deck: deckRecords.slice(0, size).map(toDeckCard),
        queue: [toCard(baseCandidates[3], 'Commander synergy')],
      }),
      readinessAndCurve,
    ]),
    [
      'loading, provider error, empty state and recovery',
      makeState({ queue: [] }),
      loadingErrorAndRecovery,
    ],
    [
      'goal changes re-rank current finding pairs',
      makeState({ queue: goalCandidates.map((record) => toCard(record, 'Commander synergy')) }),
      goalUpdates,
      goalCandidates,
    ],
    [
      'price, Core power and all exclusions refresh replacements and suggestions',
      makeState({
        queue: preferenceCandidates.map((record) => toCard(record, 'Commander synergy')),
      }),
      pricePowerExclusions,
      preferenceCandidates,
    ],
    [
      'Prefer and Only set updates',
      makeState({
        queue: preferenceCandidates.map((record) => toCard(record, 'Commander synergy')),
      }),
      setPreferences,
      preferenceCandidates,
    ],
    ['ignored cards stay out after replacement fetching', makeState(), ignoredUpdates],
    [
      'settings reconcile staged additions without losing cuts or editing the deck',
      makeState(),
      stagedSettingsRefresh,
    ],
    [
      'construction failures never become weak swaps',
      makeState({
        queue: [
          toCard(
            fixtureCard('B10 Wrong identity', { color_identity: ['U'], produced_mana: ['G'] }),
            'Commander synergy',
          ),
          toCard(
            fixtureCard('B10 Banned', {
              legalities: { commander: 'banned' },
              produced_mana: ['G'],
            }),
            'Commander synergy',
          ),
          toCard(
            fixtureCard('B10 Unknown mana', { cmc: undefined, produced_mana: ['G'] }),
            'Commander synergy',
          ),
          toCard(
            fixtureCard('B10 Oracle alias', {
              oracle_id: deckRecords[1].oracle_id,
              produced_mana: ['G'],
            }),
            'Commander synergy',
          ),
        ],
      }),
      constructionAndEmpty,
    ],
  ]
  for (const [name, state, run, records] of cases) {
    const scenario = await openScenario(browser, base, state, records)
    try {
      await run(scenario)
      assert.deepEqual(scenario.errors, [], 'no page errors or unexpected dialogs')
      console.log(`PASS ${name}`)
    } finally {
      await scenario.context.close()
    }
  }
  console.log(
    `B10 browser gate: ${cases.length} scenarios passed. Appearance review remains separate.`,
  )
} finally {
  await browser?.close()
  await server?.close()
  childProcess.spawn = spawn
}
