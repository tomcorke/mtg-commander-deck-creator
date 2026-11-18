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
