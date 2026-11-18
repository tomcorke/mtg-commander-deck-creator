// #589: Choose lands opens with a role-grouped nonbasic plan, pre-selected and removable, and
// basics filling the rest. One confirm adds the whole plan.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import type { Page } from 'playwright-core'
import { openLandFill, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import {
  landPlanRecords as records,
  landPlanState as state,
  upgraded,
} from './fixtures/land-plan.ts'
import { setDisplayPreferences } from './browser-display.ts'

const evidence = process.env.LAND_PLAN_SCREENSHOTS
const label = process.env.LAND_PLAN_LABEL ?? 'after'

type Dialog = ReturnType<Page['getByRole']>

const openDialog = async (page: Page) => {
  const dialog = await openLandFill(page)
  await page.waitForTimeout(300)
  return dialog
}
const closeDialog = async (page: Page, dialog: Dialog) => {
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
}
const noSideScroll = (dialog: Dialog) =>
  dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)

/** The sidebar's land guidance (#379), expanded so each adjustment behind the range shows. */
async function captureGuidance(page: Page, path: string) {
  const guidance = page.locator('.land-guidance').first()
  if (!(await guidance.isVisible())) return
  await guidance.evaluate((node) => ((node as HTMLDetailsElement).open = true))
  await guidance.screenshot({ path })
  await guidance.evaluate((node) => ((node as HTMLDetailsElement).open = false))
}

/** Light and dark, desktop and 390px captures of the guidance and the whole dialog. */
async function captureEvidence(page: Page, directory: string) {
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      const variant = `${dark ? 'dark' : 'light'}-${width}`
      // Tall enough that the whole dialog, confirm button included, fits one capture.
      await page.setViewportSize({ width, height: width < 600 ? 3600 : 2400 })
      await captureGuidance(page, `${directory}/${label}-guidance-${variant}.png`)
      const dialog = await openDialog(page)
      assert(await noSideScroll(dialog), `no horizontal scroll at ${width}px`)
      await dialog.screenshot({ path: `${directory}/${label}-${variant}.png` })
      await closeDialog(page, dialog)
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

/** The plan as opened: heuristic label, group order, pre-selection and reasons. */
async function assertPlan(dialog: Dialog) {
  // Reasons are labelled as a heuristic, like theme-fit reasons (#501).
  assert.equal(await dialog.locator('.land-plan .generic-pick-label').innerText(), 'Land plan')
  // Fill order: fixing, then the landfall role the commander earned, then the utility step, where
  // Big mana (#596) groups after Utility's higher-scoring pick.
  const groups = await dialog.locator('.land-plan-group h4').allInnerTexts()
  assert.deepEqual(
    groups.map((text) => text.toLowerCase()),
    ['fixing', 'landfall and land synergy', 'utility', 'big mana'],
  )
  const include = (name: string) =>
    dialog.getByRole('checkbox', { name: `Include ${name}`, exact: true })
  for (const name of [
    'Plan Shockland',
    'Plan Bounce Land',
    'Plan Tapped Dual',
    'Plan Landfall Grove',
    'Plan Saproling Grove',
    'Plan Passage',
    'Plan Forest Coffers',
  ])
    assert.equal(await include(name).isChecked(), true, name)
  // Over budget: listed last in its group, unticked and marked.
  assert.equal(await include('Plan Pricey Dual').isChecked(), false)
  const pricey = dialog.locator('.card-tile', { hasText: 'Plan Pricey Dual' })
  assert.match(await pricey.innerText(), /Over budget/)
  // Each reason quotes the matched text and, for an earned role, the deck evidence.
  const landfall = dialog.locator('.card-tile', { hasText: 'Plan Landfall Grove' })
  assert.match(await landfall.innerText(), /Your commander: “Landfall/)
  // Big mana shows its restrictions and says a text match is not a measured payout.
  const coffers = await dialog.locator('.card-tile', { hasText: 'Plan Forest Coffers' }).innerText()
  assert.match(coffers, /Scales with each Forest you control/)
  assert.match(coffers, /not proof of useful net mana or enough board support/)
  return include
}

/** The element under the centre of a locator's box, which tells which dialog is on top. */
const topmostDialog = (target: ReturnType<Page['locator']>) =>
  target.evaluate((node) => {
    const box = node.getBoundingClientRect()
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return hit?.closest('[role="dialog"]')?.getAttribute('aria-labelledby') ?? null
  })
const focusedLabel = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement
    return active?.closest('.basic-land-modal') ? active.getAttribute('aria-label') : null
  })

/**
 * #645: card details opened from Choose lands stack above it, and closing them returns to the
 * same dialog with its choices and focus intact. Drives the issue's repro by keyboard (lower
 * Forest, open its details, Escape), then the nonbasic tile with backdrop dismissal.
 */
async function assertDetailsRoundTrip(page: Page) {
  const dialog = await openDialog(page)
  const details = page.locator('.deck-card-modal')
  const forest = dialog.locator('.basic-land-plan > li', { hasText: 'Forest' })
  const forestCount = forest.getByRole('spinbutton', { name: 'Forest count', exact: true })
  const include = (name: string) =>
    dialog.getByRole('checkbox', { name: `Include ${name}`, exact: true })
  const artButton = forest.locator('.compact-action')

  // Choices that a remount would reset: an unticked plan land, a lowered count and picked art
  // with its gallery still open.
  await include('Plan Passage').uncheck()
  await artButton.click()
  await forest.getByRole('group', { name: 'Forest printings' }).getByRole('button').first().click()
  const art = await forest.locator('.basic-land-name small').innerText()
  const lowered = Number(await forestCount.inputValue()) - 1
  await forest.getByRole('button', { name: 'One fewer Forest', exact: true }).click()
  const expectChoices = async (step: string) => {
    assert.equal(Number(await forestCount.inputValue()), lowered, `${step}: Forest count`)
    assert.equal(await include('Plan Passage').isChecked(), false, `${step}: Passage unticked`)
    assert.equal(await include('Plan Shockland').isChecked(), true, `${step}: Shockland ticked`)
    assert.equal(await forest.locator('.basic-land-name small').innerText(), art, `${step}: art`)
    assert.equal(await artButton.getAttribute('aria-expanded'), 'true', `${step}: gallery open`)
  }
  assert.notEqual(art, 'Default printing')
  await expectChoices('before details')

  // The basic row's name, by keyboard.
  const forestName = forest.getByRole('button', { name: 'Show details for Forest', exact: true })
  await forestName.focus()
  await page.keyboard.press('Enter')
  await details.waitFor()
  if (evidence) await page.screenshot({ path: `${evidence}/${label}-details-over-lands.png` })
  assert.equal(await topmostDialog(details), 'deck-card-title', 'details render above')
  assert(await dialog.isVisible(), 'Choose lands stays open beneath details')
  await page.keyboard.press('Escape')
  await details.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.activeElement?.closest('.basic-land-modal'))
  if (evidence) await dialog.screenshot({ path: `${evidence}/${label}-after-details-escape.png` })
  assert(await dialog.isVisible(), 'Escape closes only the details')
  assert.equal(await focusedLabel(page), 'Show details for Forest', 'focus returns to the name')
  await expectChoices('after basic details')

  // A nonbasic plan tile's art, by keyboard, dismissed from the backdrop.
  const tileArt = dialog
    .locator('.card-tile', { hasText: 'Plan Shockland' })
    .locator('.doctor-card-art')
  await tileArt.focus()
  await page.keyboard.press('Enter')
  await details.waitFor()
  assert.equal(await topmostDialog(details), 'deck-card-title', 'tile details render above')
  await page.mouse.click(8, 8)
  await details.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.activeElement?.closest('.basic-land-modal'))
  assert(await dialog.isVisible(), 'backdrop dismissal closes only the details')
  assert.equal(
    await focusedLabel(page),
    'Show details for Plan Shockland',
    'focus returns to the tile',
  )
  await expectChoices('after tile details')

  // Browser Back closes the details; Forward reopens them, still above the same dialog.
  await forestName.focus()
  await page.keyboard.press('Enter')
  await details.waitFor()
  await page.goBack()
  await details.waitFor({ state: 'detached' })
  await expectChoices('after Back')
  await page.goForward()
  await details.waitFor()
  assert.equal(await topmostDialog(details), 'deck-card-title', 'Forward reopens details above')
  await expectChoices('after Forward')
  await page.keyboard.press('Escape')
  await details.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.activeElement?.closest('.basic-land-modal'))
  assert.equal(await focusedLabel(page), 'Show details for Forest', 'focus after Forward')
  await expectChoices('after Forward and Escape')
  await closeDialog(page, dialog)
}

if (evidence) await mkdir(evidence, { recursive: true })
await withBrowser('LAND_PLAN', 5191, async (browser, base) => {
  const opened = await openScenario(browser, base, state, records, undefined, upgraded)
  const { page } = opened
  if (evidence) await captureEvidence(page, evidence)
  assert.deepEqual(opened.errors, [])
  if (label === 'before') return

  // The narrow layout never scrolls sideways, screenshots or not.
  await page.setViewportSize({ width: 390, height: 900 })
  const narrow = await openDialog(page)
  assert(await noSideScroll(narrow), 'no horizontal scroll at 390px')
  await closeDialog(page, narrow)
  await page.setViewportSize({ width: 1440, height: 1000 })

  await assertDetailsRoundTrip(page)

  const dialog = await openDialog(page)
  const include = await assertPlan(dialog)
  const status = dialog.locator('.basic-land-balance p')
  assert.equal(await status.innerText(), 'All 11 basics assigned')
  // Unticking gives the slot back to basics, live.
  await include('Plan Passage').uncheck()
  assert.equal(await status.innerText(), 'All 12 basics assigned')
  await dialog.getByRole('button', { name: 'Add 18 lands', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  const board = page.locator('.deck-board')
  for (const name of [
    'Plan Shockland',
    'Plan Landfall Grove',
    'Plan Saproling Grove',
    'Plan Forest Coffers',
  ])
    await board.getByText(name, { exact: true }).first().waitFor()
  assert.equal(await board.getByText('Plan Passage', { exact: true }).count(), 0)
  assert.equal(await board.getByText('Plan Pricey Dual', { exact: true }).count(), 0)
  // 80 cards plus 6 nonbasics and 12 basics.
  assert.equal(await page.locator('.narrow-deck-bar').textContent(), '98/100 cards')
  assert.deepEqual(opened.errors, [])
})
console.log('Land plan browser check passed')
