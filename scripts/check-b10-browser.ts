// `pnpm check:b10:browser` starts/stops its own Vite server and disposable installed Chrome.
// B10_URL may point at an existing server. No screenshots, browser download, or dialog answers.
import assert from 'node:assert/strict'
import type { Locator, Page } from 'playwright-core'
import { setDisplayPreferences } from './browser-display.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { storedDeckStateSchema, type PersistedDeckState } from '../src/deck-state.ts'
import { autosavePrefix, workspaceRecoveryKey, workspaceSessionKey } from '../src/autosaves.ts'
import {
  button,
  heading,
  openScenario,
  withBrowser,
  type Scenario,
} from './fixtures/browser-harness.ts'
import {
  baseCandidates,
  basic,
  deckRecords,
  fixtureCard,
  goalCandidates,
  makeState,
  preferenceCandidates,
} from './fixtures/b10-browser.ts'

const rampFinding = (page: Page) =>
  page.locator('.doctor-finding').filter({ has: heading(page, 'Ramp may be short') })
const rows = (page: Page) => rampFinding(page).locator('.doctor-suggestion')
async function savedState(page: Page): Promise<PersistedDeckState> {
  const raw = await page.evaluate(
    ({ prefix, sessionKey, recoveryKey }) =>
      localStorage.getItem(prefix + sessionStorage.getItem(sessionKey)) ??
      sessionStorage.getItem(recoveryKey),
    { prefix: autosavePrefix, sessionKey: workspaceSessionKey, recoveryKey: workspaceRecoveryKey },
  )
  assert.ok(raw, 'Current tab must have an autosave or recovery snapshot')
  return storedDeckStateSchema.parse(JSON.parse(raw).state)
}
async function waitForCard(page: Page, name: string, present = true) {
  await page.waitForFunction(
    ({ prefix, sessionKey, recoveryKey, name, present }) => {
      const raw =
        localStorage.getItem(prefix + sessionStorage.getItem(sessionKey)) ??
        sessionStorage.getItem(recoveryKey)
      return (
        raw !== null &&
        JSON.parse(raw).state.deck.some((card: { name: string }) => card.name === name) === present
      )
    },
    {
      prefix: autosavePrefix,
      sessionKey: workspaceSessionKey,
      recoveryKey: workspaceRecoveryKey,
      name,
      present,
    },
  )
  assert.equal(
    (await savedState(page)).deck.some((card) => card.name === name),
    present,
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
  await locator
    .page()
    .waitForFunction((node) => document.activeElement === node, await locator.elementHandle(), {
      timeout: 3_000,
    })
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
  const manaRows = page.locator('.deck-review-colour-filter')
  assert.equal(await manaRows.filter({ hasText: 'Colourless' }).count(), 0)
  assert.equal(await manaRows.filter({ hasText: 'Snow' }).count(), 0)
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
  const announcement = `Swapped ${cut} for ${add}. Undo in Change history.`
  assert.equal(await page.getByRole('status').filter({ hasText: announcement }).count(), 1)
  await button(page, 'Change history (1)').press('Enter')
  const history = page.getByRole('dialog', { name: 'Change history' })
  await button(history, 'Close change history').press('Escape')
  await focusIs(button(page, 'Change history (1)'))
  assert.equal(await page.getByRole('status').filter({ hasText: announcement }).count(), 1)
  await button(page, 'Change history (1)').press('Enter')
  assert.equal(await history.locator('.doctor-history-item').count(), 1)
  await button(history, `Undo ${add} for ${cut}`).press('Enter')
  await waitForCard(page, cut)
  assert.deepEqual((await savedState(page)).deck, before)
  assert.equal(await page.getByRole('status').filter({ hasText: announcement }).count(), 0)
  await button(history, 'Close change history').press('Escape')
  await focusIs(button(page, 'Change history (0)'))
  assert.equal(await page.getByRole('status').filter({ hasText: announcement }).count(), 0)
  await button(page, 'Back to builder').click()
  await button(page, 'Deck review').waitFor()
  assert.equal(await page.locator('.card-offer').count(), 4)
  const afterSizes = await page
    .locator('.card-offer .offered-image')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width))
  assert.deepEqual(afterSizes, beforeSizes, 'review did not shrink builder art')
}

async function snowManaDemand({ page }: Scenario) {
  await enterReview(page)
  const row = page.locator('.deck-review-colour-filter').filter({ hasText: 'Snow' })
  assert.equal(await row.count(), 1)
  assert.match(await row.innerText(), /1 symbols/)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const darkMode of [false, true]) {
      await setDisplayPreferences(page, { 'Dark mode': darkMode })
      assert.equal(await row.isVisible(), true)
    }
    if (width === 390)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
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
  await focusIs(button(page, 'Change history (0)'))
  assert.equal(
    await page.getByRole('status').filter({ hasText: 'Undo in Change history' }).count(),
    0,
  )
  await rampFinding(page).waitFor()
}

async function stageAndCheckPairToggles(page: Page) {
  const originalDeck = (await savedState(page)).deck
  const expectedPairs = [] as string[][]
  for (const index of [0, 1]) {
    const row = rows(page).nth(index)
    expectedPairs.push(await rowNames(row))
    await button(row, 'Add to plan').press('Enter')
    const remove = button(row, 'Remove from plan')
    assert.equal(await remove.isEnabled(), true)
    await focusIs(remove)
    await remove.press('Space')
    await focusIs(button(row, 'Add to plan'))
    assert.match(
      await page
        .getByRole('status')
        .filter({ hasText: 'removed from the pending plan' })
        .innerText(),
      /removed from the pending plan/,
    )
    await page.keyboard.press('Enter')
    await focusIs(remove)
    assert.equal(await button(row, 'Apply swap').isDisabled(), true)
    assert.match(
      await row.innerText(),
      /Finish or discard your pending plan before applying directly/,
    )
    assert.deepEqual((await savedState(page)).deck, originalDeck)
  }
  // Re-pair the first addition with the second cut. Neither old row may remove this pair.
  await button(page, 'Continue choosing changes').press('Enter')
  await page
    .getByRole('checkbox', { name: `Cut ${expectedPairs[0][0]}`, exact: true })
    .press('Space')
  await button(page, 'Back to Diagnose').press('Enter')
  for (const index of [0, 1]) {
    const row = rows(page).nth(index)
    assert.equal(await button(row, 'Remove from plan').count(), 0)
    assert.equal(await button(row, 'Used in another choice').isDisabled(), true)
  }
  assert.match(
    await page.getByRole('region', { name: 'Pending changes' }).innerText(),
    /Cutting 1 · Adding 2/,
  )
  await button(page, 'Continue choosing changes').press('Enter')
  await page
    .getByRole('checkbox', { name: `Cut ${expectedPairs[1][0]}`, exact: true })
    .press('Space')
  for (const [, add] of expectedPairs)
    await page.getByRole('checkbox', { name: `Add ${add}`, exact: true }).press('Space')
  await button(page, 'Back to Diagnose').press('Enter')
  for (const index of [0, 1]) await button(rows(page).nth(index), 'Add to plan').press('Enter')
  return expectedPairs
}

async function stagedPlansAndExits({ page }: Scenario) {
  await enterReview(page)
  const expectedPairs = await stageAndCheckPairToggles(page)
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
  assert.equal(
    await page.getByRole('status').filter({ hasText: 'added to the pending plan' }).count(),
    0,
  )
  await button(page, 'Confirm changes').click()
  await heading(page, 'Confirm').waitFor()
  assert.equal(
    await page.getByRole('status').filter({ hasText: 'added to the pending plan' }).count(),
    0,
  )
  const pairs = page.locator('.doctor-plan-pair')
  assert.equal(await pairs.count(), 2)
  for (const index of [0, 1])
    assert.deepEqual(await rowNames(pairs.nth(index)), expectedPairs[index])
  await button(page, 'Change history (0)').click()
  await button(page, 'Close change history').press('Escape')
  await focusIs(button(page, 'Change history (0)'))
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
    await button(row, 'Add to plan').press('Enter')
    await focusIs(button(row, 'Remove from plan'))
    assert.equal(await button(row, 'Add card').isDisabled(), true)
    assert.match(await row.innerText(), /Finish or discard your pending plan/)
    await page.keyboard.press('Space')
    await focusIs(button(row, 'Add to plan'))
    assert.equal(await page.locator('.doctor-apply-bar').count(), 0)
    await button(row, 'Add card').press('Enter')
    await waitForCard(page, add)
    assert.equal((await savedState(page)).deck.length, 90)
    await button(page, 'Change history (1)').click()
    await button(page, `Undo adding ${add}`).press('Enter')
    await waitForCard(page, add, false)
    assert.equal((await savedState(page)).deck.length, 89)
    await button(page, 'Close change history').press('Escape')
    await focusIs(button(page, 'Change history (0)'))
    assert.equal(
      await page.getByRole('status').filter({ hasText: 'Undo in Change history' }).count(),
      0,
    )
  } else {
    assert.equal(state.deck.length, 90)
    assert.equal(await row.locator('.doctor-card-tile').count(), 2)
    assert.match(await row.innerText(), /Ramp 2 → 3 · Mana value: 2 → 3/)
    const [, add] = await rowNames(row)
    await button(row, 'Apply swap').click()
    await waitForCard(page, add)
    assert.equal((await savedState(page)).deck.length, 90)
  }
}

async function landImpactAndContrast({ page }: Scenario) {
  await enterReview(page)
  const row = rows(page).first()
  assert.match(await row.innerText(), /Mana value: land → 2/)
  assert.doesNotMatch(await row.innerText(), /Curve land/)
  const contrast = (foreground: string, background: string) => {
    const luminance = (colour: string) => {
      const rgb = colour
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
      return rgb.reduce((sum, channel, index) => {
        const value = channel / 255
        return (
          sum +
          (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][index]
        )
      }, 0)
    }
    const a = luminance(foreground)
    const b = luminance(background)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [dark, themed] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ]) {
      await setDisplayPreferences(page, { 'Dark mode': dark, 'Commander art and colours': themed })
      const art = row.locator('.doctor-card-art').first()
      await art.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await focusIs(art)
      const colours = await art.evaluate((node) => {
        const pair = node.closest('.doctor-suggestion')!
        const outline = getComputedStyle(node)
        return {
          background: getComputedStyle(pair).backgroundColor,
          arrow: getComputedStyle(pair.querySelector('.doctor-pair-arrow')!).color,
          outline: outline.outlineColor,
          width: outline.outlineWidth,
          style: outline.outlineStyle,
          visible: node.matches(':focus-visible'),
        }
      })
      assert.equal(colours.visible, true)
      assert.equal(colours.width, '3px')
      assert.equal(colours.style, 'solid')
      assert(contrast(colours.arrow, colours.background) >= 3, 'pair arrow contrast at least 3:1')
      assert(contrast(colours.outline, colours.background) >= 3, 'art focus contrast at least 3:1')
      await button(row, 'Add to plan').press('Enter')
      await focusIs(button(row, 'Remove from plan'))
      const bounds = (await row.boundingBox())!
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width, 'suggestion fits viewport')
      for (const action of await row.getByRole('button').all()) {
        const box = (await action.boundingBox())!
        assert(
          box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1,
          'actions fit suggestion',
        )
      }
      await page.keyboard.press('Space')
      await focusIs(button(row, 'Add to plan'))
    }
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
    await dialog.locator('#power-target').selectOption('precon')
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
  await page.waitForFunction(
    ({ prefix, sessionKey, recoveryKey }) => {
      const raw =
        localStorage.getItem(prefix + sessionStorage.getItem(sessionKey)) ??
        sessionStorage.getItem(recoveryKey)
      return raw && JSON.parse(raw).state.ignoredCards.includes('B10 Ramp draw')
    },
    { prefix: autosavePrefix, sessionKey: workspaceSessionKey, recoveryKey: workspaceRecoveryKey },
  )
  assert((await savedState(page)).ignoredCards.includes('B10 Ramp draw'))
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

const snowCost = fixtureCard('B10 Snow cost', { mana_cost: '{S}' })
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
    'snow mana demand appears only when a deck includes a snow cost',
    makeState({
      deck: [...deckRecords.slice(0, -1), snowCost].map(toDeckCard),
    }),
    snowManaDemand,
    [snowCost],
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
    'land mana-value label, light/dark/commander arrow and keyboard-focus contrast, narrow actions',
    makeState({
      deck: [deckRecords[0], ...Array.from({ length: 99 }, () => basic)].map(toDeckCard),
      queue: [toCard(baseCandidates[0], 'Commander synergy')],
    }),
    landImpactAndContrast,
  ],
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
await withBrowser('B10', 5240, async (browser, base) => {
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
})
