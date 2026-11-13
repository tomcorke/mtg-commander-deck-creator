// Printable checklist (#547): Export prints a card-gathering checklist for the whole deck or the
// cards still needed, grouped by type with quantity, set and collector number. In print media it
// replaces the app on a black-on-white page in either theme, and no line overflows its column at
// the A4 or Letter printable width. PRINT_CHECKLIST_SCREENSHOTS=<dir> also saves review evidence
// and A4 and Letter PDFs.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright-core'
import { button, openScenario, withBrowser, withOwnedCards } from './fixtures/browser-harness.ts'
import { toDeckCard } from '../src/domain/card-model.ts'
import { baseCandidates, deckRecords, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.PRINT_CHECKLIST_SCREENSHOTS
const shoot = async (page: Page, name: string, fullPage = false) => {
  if (output) await page.screenshot({ path: join(output, `${name}.png`), fullPage })
}
// Printable width in CSS pixels: the paper width less the stylesheet's 12mm @page margins.
const mm = 96 / 25.4
const papers = [
  ['A4', Math.floor((210 - 24) * mm)],
  ['Letter', Math.floor((215.9 - 24) * mm)],
] as const
// A synthetic long name and printing, so the check proves a long line wraps rather than clips.
const longCard = fixtureCard(
  'B10 Our Market Research Shows That Players Like Really Long Card Names So We Made This One',
  { set: 'tstlong', collector_number: '1234★', finishes: ['etched'] },
)
const deck = [...deckRecords.slice(0, -1), longCard].map(toDeckCard)
const exportDialog = (page: Page) => page.getByRole('dialog', { name: 'Copy your deck list' })
const checklist = (page: Page) => page.locator('body > .print-checklist')

async function printLayout(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>('body > .print-checklist')!
    const shown = [...document.body.children].filter(
      (element) => getComputedStyle(element).display !== 'none',
    )
    const overflowing = [...sheet.querySelectorAll<HTMLElement>('li, li > span')]
      .filter((element) => {
        const box = element.getBoundingClientRect()
        const line = element.closest('ul')!.getBoundingClientRect()
        return element.scrollWidth > element.clientWidth + 1 || box.right > line.right + 0.5
      })
      .map((element) => element.textContent)
    const style = getComputedStyle(sheet)
    return {
      shown: shown.map((element) => element.className),
      overflowing,
      colour: style.color,
      headingColours: [
        ...new Set([...sheet.querySelectorAll('h1, h2')].map((h) => getComputedStyle(h).color)),
      ],
      background: style.backgroundColor,
      pageBackgrounds: [document.documentElement, document.body].map(
        (element) => getComputedStyle(element).backgroundColor,
      ),
      headings: [...sheet.querySelectorAll('h2')].map((heading) =>
        heading.textContent!.replace(/\s+/g, ' '),
      ),
      summary: sheet.querySelector('header p')!.textContent,
      firstLine: sheet.querySelector('li')!.textContent,
    }
  })
}

async function checkPrint(page: Page, label: string, list: string) {
  const screen = page.viewportSize()!
  await page.emulateMedia({ media: 'print' })
  try {
    for (const [paper, width] of papers) {
      await page.setViewportSize({ width, height: 1000 })
      const layout = await printLayout(page)
      assert.deepEqual(layout.shown, ['print-checklist'], 'print shows only the checklist')
      assert.deepEqual(layout.overflowing, [], `${paper}: no line overflows its column`)
      assert.equal(layout.colour, 'rgb(0, 0, 0)', 'black text in any theme')
      assert.deepEqual(layout.headingColours, ['rgb(0, 0, 0)'])
      assert.equal(layout.background, 'rgb(255, 255, 255)', 'white page in any theme')
      assert.deepEqual(layout.pageBackgrounds, ['rgb(255, 255, 255)', 'rgb(255, 255, 255)'])
      // Print ignores the screen width, so the narrow run and dark Letter add no evidence.
      if (label === 'light' || (label === 'dark' && paper === 'A4'))
        await shoot(page, `after-print-${list}-${label}-${paper.toLowerCase()}`, true)
      if (output && label === 'light')
        await page.pdf({
          path: join(output, `print-${list}-${paper.toLowerCase()}.pdf`),
          format: paper,
          preferCSSPageSize: true,
        })
    }
    return await printLayout(page)
  } finally {
    await page.emulateMedia({ media: 'screen' })
    await page.setViewportSize(screen)
  }
}

async function run(browser: Browser, base: string, label: string, dark: boolean, width: number) {
  const scenario = await openScenario(
    browser,
    base,
    makeState({ deck }),
    [...baseCandidates, longCard],
    undefined,
    async (page) => {
      await withOwnedCards(['B10 Commander', 'B10 Basic', 'B10 Theme 0'])(page)
      // Count print requests instead of opening the browser's print dialog.
      await page.addInitScript(() => {
        Object.assign(window, { printCalls: 0 })
        window.print = () => {
          ;(window as unknown as { printCalls: number }).printCalls++
        }
      })
    },
  )
  const { page } = scenario
  try {
    await page.setViewportSize({ width, height: 1000 })
    if (dark) await setDisplayPreferences(page, { 'Dark mode': true })
    assert.equal(await checklist(page).count(), 0, 'no checklist until Export opens')
    await button(page, 'Export deck').click()
    const dialog = exportDialog(page)
    await dialog.waitFor()
    assert.equal(await checklist(page).isVisible(), false, 'the checklist only shows in print')
    await shoot(page, `after-export-${label}`)
    await button(dialog, 'Print checklist').click()
    assert.equal(
      await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls),
      1,
    )

    const whole = await checkPrint(page, label, 'deck')
    assert.deepEqual(whole.headings, ['Commander 1', 'Creatures 60', 'Artifacts 4', 'Lands 35'])
    assert.match(whole.summary!, /^Whole deck: 100 cards\./)
    assert.equal(whole.firstLine, '1B10 CommanderTST B10 Commander')

    await button(dialog, 'Still needed (97)').click()
    await shoot(page, `after-export-needed-${label}`)
    const needed = await checkPrint(page, label, 'needed')
    assert.deepEqual(needed.headings, ['Creatures 59', 'Artifacts 4', 'Lands 34'])
    assert.match(needed.summary!, /^Still needed: 97 cards, commanders included,/)

    // Emulated print media hides the focused control, so focus leaves the dialog; close by ×.
    await button(dialog, 'Close export').click()
    await dialog.waitFor({ state: 'detached' })
    assert.equal(await checklist(page).count(), 0, 'closing Export removes the checklist')
    assert.deepEqual(scenario.errors, [])
  } finally {
    await scenario.context.close()
  }
}

await withBrowser('PRINT_CHECKLIST', 5347, async (browser, base) => {
  await run(browser, base, 'light', false, 1440)
  if (output) {
    await run(browser, base, 'dark', true, 1440)
    await run(browser, base, 'narrow', false, 390)
  }
  console.log(
    'Export prints a whole-deck and still-needed checklist grouped by type; print fits A4 and Letter in black on white.',
  )
})
