// #328: the play-style step shows static role bars and no land actions; role focus returns after
// Skip; land guidance waits for 10 nonland, non-commander spells, checked live.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import type { Page } from 'playwright-core'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { baseCandidates, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'
import { defaultDeckTargets } from '../src/deck-analysis.ts'

const evidence = process.env.PLAY_STYLE_SIDEBAR_EVIDENCE_DIR
const spells = Array.from({ length: 9 }, (_, index) => fixtureCard(`Sidebar spell ${index}`))
const records = [...spells, ...baseCandidates]
const queue = baseCandidates.map((record) => toCard(record, 'Commander synergy'))
const deckTargets = { ...defaultDeckTargets }
const note = (count: number) => `Land guidance starts at 10 spells (${count} of 10).`

async function sidebar(page: Page) {
  const panel = page.locator('.analysis-panel')
  return {
    panel,
    focus: panel.locator('.deck-target-focus'),
    static: panel.locator('.deck-target-static'),
    guidance: panel.locator('details.land-guidance'),
    fillNow: button(panel, 'Fill now'),
    later: panel.locator('p.land-fill-later'),
  }
}

async function capture(page: Page, label: string) {
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${label} ${width}: no horizontal overflow`,
      )
      if (!evidence) continue
      const panel = page.locator('.analysis-panel')
      await panel.locator('.deck-targets').scrollIntoViewIfNeeded()
      await panel.screenshot({
        path: `${evidence}/${process.env.PLAY_STYLE_SIDEBAR_LABEL ?? 'after'}-${label}-${dark ? 'dark' : 'light'}-${width}.png`,
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

if (evidence) await mkdir(evidence, { recursive: true })
await withBrowser('PLAY_STYLE_SIDEBAR', 5190, async (browser, base) => {
  // Setup: the play-style step is open and the deck holds only the commander.
  const setup = await openScenario(
    browser,
    base,
    makeState({
      deck: [toDeckCard(commander)],
      deckTargets,
      queue,
      playStylePending: true,
      firstBatchPending: true,
    }),
    records,
  )
  {
    const { page } = setup
    await page.getByRole('heading', { name: 'How do you want to play?' }).waitFor()
    const side = await sidebar(page)
    assert.equal(await side.focus.count(), 0, 'No role focus buttons during setup')
    assert.equal(await side.static.count(), 5, 'Five static role bars during setup')
    assert.equal(await side.guidance.count(), 0, 'No land range during setup')
    assert.equal(await side.panel.getByRole('button', { name: /^Use \d+$/ }).count(), 0)
    assert.equal(await side.fillNow.count(), 0, 'No Fill now during setup')
    assert.equal(await side.later.textContent(), note(0))
    await capture(page, 'play-style')
    const ramp = side.panel.getByRole('spinbutton', { name: 'Ramp target', exact: true })
    assert.ok(await ramp.isEnabled(), 'Target steppers stay editable')
    await ramp.fill('12')
    await page.waitForFunction(
      () =>
        (document.querySelector('input[aria-label="Ramp target"]') as HTMLInputElement).value ===
        '12',
    )
    // Skip closes the step; role focus returns before any land guidance.
    await page.getByRole('button', { name: /^Keep current settings \(/ }).click()
    await page.locator('.card-offer').first().waitFor()
    await side.focus.first().waitFor()
    assert.equal(await side.static.count(), 0, 'Static bars give way to focus buttons after Skip')
    assert.equal(await side.later.textContent(), note(0))
    assert.deepEqual(setup.errors, [])
    await setup.context.close()
  }

  // Nine spells: below the gate. Adding one passes it; undoing the add drops below it again.
  const partial = await openScenario(
    browser,
    base,
    // A 40-land target sits outside the range, so Use N renders once guidance shows.
    makeState({
      deck: [toDeckCard(commander), ...spells.map(toDeckCard)],
      deckTargets: { ...deckTargets, lands: 40 },
      queue,
    }),
    records,
  )
  {
    const { page } = partial
    const side = await sidebar(page)
    const useLands = side.panel.getByRole('button', { name: /^Use \d+$/ })
    await side.focus.first().waitFor()
    assert.equal(await side.guidance.count(), 0, 'No land range below 10 spells')
    assert.equal(await side.fillNow.count(), 0, 'No Fill now below 10 spells')
    assert.equal(await useLands.count(), 0, 'No Use N below 10 spells')
    assert.equal(await side.later.textContent(), note(9))
    await capture(page, 'nine-spells')
    await button(page.locator('.card-offer').first(), 'Add').click()
    await side.guidance.waitFor()
    await side.fillNow.waitFor()
    await useLands.waitFor()
    assert.equal(await side.later.filter({ hasText: 'Land guidance starts' }).count(), 0)
    await capture(page, 'ten-spells')
    await button(page.locator('.bulk-actions-status'), 'Undo').click()
    await side.guidance.waitFor({ state: 'detached' })
    assert.equal(await side.fillNow.count(), 0, 'Fill now hides again below 10 spells')
    assert.equal(await useLands.count(), 0, 'Use N hides again below 10 spells')
    assert.equal(await side.later.textContent(), note(9))
    assert.deepEqual(partial.errors, [])
    await partial.context.close()
  }
  console.log(
    'Play-style sidebar browser check passed: setup static bars, Skip restores focus, 9/10/9 spell gate.',
  )
})
