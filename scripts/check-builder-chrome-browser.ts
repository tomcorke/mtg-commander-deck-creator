// Builder chrome (#507): grouped header actions and a restore notice that stays quiet.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { BrowserContext, Page } from 'playwright-core'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const notice = (page: Page) => page.getByRole('region', { name: 'Draft recovery', exact: true })
const ready = (page: Page) => button(page, 'Deck review').waitFor()

// openScenario clears storage on every load; keep the restored workspace across reloads.
async function keepStorage(page: Page) {
  const snapshot = await page.evaluate(() => JSON.stringify(localStorage))
  await page.addInitScript((saved) => {
    if (sessionStorage.getItem('__507_kept')) return
    localStorage.clear()
    for (const [key, value] of Object.entries(JSON.parse(saved) as Record<string, string>))
      localStorage.setItem(key, value)
    sessionStorage.setItem('__507_kept', 'true')
  }, snapshot)
}

async function headerGroups(page: Page) {
  return page.locator('header .header-actions').evaluate((actions) =>
    [...actions.children].map((child) => ({
      className: child.className,
      buttons: [...child.querySelectorAll('button')].map((b) => ({
        name: b.textContent!.trim(),
        className: b.className,
      })),
    })),
  )
}

async function checkWidth(page: Page, width: number) {
  await page.setViewportSize({ width, height: width > 400 ? 1000 : 844 })
  // Park the pointer on the brand so no card preview covers the header.
  await page.locator('header .brand').hover()
  // Only the header chrome is in scope; offer rails have their own narrow-layout rules.
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll('header *, .workspace-notice *')]
      .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
      .map((element) => element.textContent),
  )
  assert.deepEqual(overflowing, [], `header fits at ${width}px`)
  // Display sits at the right edge, so its panel opens leftwards inside the viewport.
  await button(page, 'Display').click()
  const panel = await page
    .locator('.display-settings-panel')
    .evaluate((element) => element.getBoundingClientRect().toJSON())
  assert(panel.left >= 0 && panel.right <= width, `Display panel fits at ${width}px`)
  await page.keyboard.press('Escape')
}

// Light and dark at each header layout; screenshots only when an output folder is set.
async function layouts(page: Page, output: string | undefined) {
  if (output) await mkdir(output, { recursive: true })
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const [label, width] of [
      ['wide', 1600],
      ['desktop', 1440],
      ['medium', 1100],
      ['tablet', 600],
      ['narrow', 390],
    ] as const) {
      await checkWidth(page, width)
      if (output)
        await page.screenshot({
          path: join(output, `after-${label}-${dark ? 'dark' : 'light'}.png`),
          clip: { x: 0, y: 0, width, height: width > 400 ? 360 : 640 },
        })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

async function newTab(context: BrowserContext, url: string) {
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  await page.goto(url)
  await ready(page)
  await page.getByText('Checking card data…').waitFor({ state: 'detached' })
  return page
}

await withBrowser('BUILDER_CHROME', 5297, async (browser, base) => {
  const { page, context, errors } = await openScenario(browser, base, makeState())
  const output = process.env.BUILDER_CHROME_SCREENSHOTS
  try {
    await notice(page).waitFor()
    await layouts(page, output)

    // Header: deck actions together with Export emphasised; Start over in its own group.
    const groups = await headerGroups(page)
    const names = groups.map(({ buttons }) => buttons.map(({ name }) => name))
    assert.deepEqual(
      names.filter((group) => group.length),
      [
        ['Saved decks', 'Import deck', 'Export deck'],
        ['Start over'],
        ['Commander basics', 'Display'],
      ],
      'header action groups',
    )
    const exportButton = groups[0].buttons.find(({ name }) => name === 'Export deck')!
    assert.match(exportButton.className, /\bprimary\b/, 'Export deck is the emphasised action')
    assert.match(groups[1].className, /header-start-over/)

    // A reload in the same tab keeps the restored deck without repeating the notice.
    await keepStorage(page)
    await page.reload()
    await ready(page)
    await page.getByText('Checking card data…').waitFor({ state: 'detached' })
    assert.equal(await notice(page).count(), 0, 'no notice on a same-tab reload')

    // A fresh tab announces the restore; card-data hydration alone does not dismiss it.
    const fresh = await newTab(context, `${base}#build`)
    await notice(fresh).waitFor()
    await fresh.waitForTimeout(1500)
    assert.equal(await notice(fresh).count(), 1, 'notice survives load without edits')
    // The first deck edit collapses it.
    const remove = fresh.locator('.deck-remove').first()
    await remove.click({ force: true })
    await fresh.locator('.deck-remove.confirm').click({ force: true })
    await notice(fresh).waitFor({ state: 'detached' })
    await fresh.close()

    assert.deepEqual(errors, [])
    console.log('Builder chrome: grouped header, quiet reload and collapse on first edit pass')
  } finally {
    await page.context().close()
  }
})
