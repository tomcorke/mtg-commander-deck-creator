// Commander basics (#489): reachable from Start and the builder; Start's invitation stays dismissed.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { themeFirstState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const primer = (page: Page) => page.getByRole('dialog', { name: 'Commander basics', exact: true })

async function openAndClose(page: Page, opener: string) {
  const trigger = button(page, opener)
  await trigger.click()
  const dialog = primer(page)
  await dialog.waitFor()
  for (const section of ['The format', 'The deck skeleton', 'Power and brackets'])
    await dialog.getByRole('heading', { name: section, exact: true }).waitFor()
  assert(await dialog.getByText('Comprehensive Rules 903.5a, 702.124b').isVisible())
  assert(await dialog.getByText('Heuristic', { exact: true }).first().isVisible())
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert(await trigger.evaluate((element) => element === document.activeElement))
}

await withBrowser('PRIMER', 5296, async (browser, base) => {
  const { page, errors } = await openScenario(browser, base, themeFirstState())
  const output = process.env.PRIMER_SCREENSHOTS
  try {
    await openAndClose(page, 'Commander basics')

    await page.goto(`${base}#start`)
    await heading(page, 'What do you want to play?').waitFor()
    const card = page.getByRole('region', { name: 'New to Commander?', exact: true })
    await card.waitFor()
    await openAndClose(page, 'Read Commander basics')
    await openAndClose(page, 'Commander basics')

    if (output) {
      await mkdir(output, { recursive: true })
      for (const dark of [false, true]) {
        await setDisplayPreferences(page, { 'Dark mode': dark })
        for (const [label, width] of [
          ['desktop', 1440],
          ['narrow', 390],
        ] as const) {
          await page.setViewportSize({ width, height: width > 400 ? 1000 : 844 })
          const theme = dark ? 'dark' : 'light'
          await page.screenshot({ path: join(output, `start-${label}-${theme}.png`) })
          await button(page, 'Commander basics').click()
          await primer(page).waitFor()
          await page.screenshot({ path: join(output, `primer-${label}-${theme}.png`) })
          await page.keyboard.press('Escape')
        }
      }
      await setDisplayPreferences(page, { 'Dark mode': false })
      await page.setViewportSize({ width: 1440, height: 1000 })
    }

    await button(page, 'Dismiss New to Commander').click()
    await card.waitFor({ state: 'detached' })
    assert(
      await heading(page, 'What do you want to play?').evaluate(
        (element) => element === document.activeElement,
      ),
    )
    assert.equal(await page.evaluate(() => localStorage.getItem('option:primerDismissed')), 'true')
    // The harness clears storage on every load, so carry the stored value across this reload.
    await page.addInitScript(() => localStorage.setItem('option:primerDismissed', 'true'))
    await page.reload()
    await heading(page, 'What do you want to play?').waitFor()
    assert.equal(await card.count(), 0, 'dismissal is remembered')
    await openAndClose(page, 'Commander basics')
    assert.deepEqual(errors, [])
    console.log('Commander basics: Start and builder entry, focus return and dismissal pass')
  } finally {
    await page.context().close()
  }
})
