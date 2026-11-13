// Share links and downloads (#504): download each export format, copy a share link for the
// 100-card fixture deck, then open it in another profile that has a deck in progress. The preview
// is read-only; copying asks before it replaces the current deck. Damaged links show an error.
// SHARE_LINK_SCREENSHOTS=<dir> also saves review evidence in light, dark and narrow layouts.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright-core'
import { toDeckCard } from '../src/domain/card-model.ts'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { deckRecords, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.SHARE_LINK_SCREENSHOTS
const layouts = output
  ? ([
      ['light', false, 1440],
      ['dark', true, 1440],
      ['narrow', false, 390],
    ] as const)
  : ([['light', false, 1440]] as const)
const shoot = async (page: Page, name: string) => {
  if (output) await page.screenshot({ path: join(output, `${name}.png`) })
}
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })
const sharedDialog = (page: Page) => page.locator('.shared-deck-modal')
const deckCount = (page: Page) => page.evaluate(() => document.title.match(/(\d+)\/100/)?.[1])

async function checkDownloads(page: Page) {
  const exportDialog = dialog(page, 'Copy your deck list')
  for (const [format, fileName] of [
    ['Moxfield', 'b10-commander-tokens-moxfield.txt'],
    ['Plain text', 'b10-commander-tokens-plain.txt'],
    ['CSV', 'b10-commander-tokens.csv'],
  ] as const) {
    await button(exportDialog, format).click()
    const list = await exportDialog.locator('textarea').inputValue()
    const download = page.waitForEvent('download')
    await button(exportDialog, `Download .${format === 'CSV' ? 'csv' : 'txt'}`).click()
    const file = await download
    assert.equal(file.suggestedFilename(), fileName)
    assert.equal(await readFile((await file.path())!, 'utf8'), `${list}\n`, `${format} file`)
  }
  await button(exportDialog, 'Moxfield').click()
}

async function copyLink(page: Page, label: string) {
  await button(page, 'Export deck').click()
  const exportDialog = dialog(page, 'Copy your deck list')
  if (label === 'light') await checkDownloads(page)
  await button(exportDialog, 'Copy share link').click()
  await exportDialog.getByText('Share link copied.').waitFor()
  await shoot(page, `${label}-export-share-copied`)
  const link = await page.evaluate(() => navigator.clipboard.readText())
  assert.match(link, /#share=1\.[\w-]+$/)
  assert(link.length < 3000, `a 100-card share link stays short: ${link.length}`)
  await page.keyboard.press('Escape')
  return link
}

async function previewThenKeep(page: Page, link: string, label: string) {
  // A link pasted into an open tab previews over the current screen without changing the deck.
  await page.goto(link)
  const preview = sharedDialog(page)
  await preview.getByText('100 main-deck cards').waitFor()
  assert.equal(new URL(page.url()).hash, '#build', 'the app route replaces the share fragment')
  assert.equal(
    await preview.getByRole('heading', { level: 2 }).innerText(),
    'B10 Commander - Tokens',
  )
  assert.match(await preview.innerText(), /COMMANDER\s*1\s*B10 Commander/i)
  assert.match(await preview.innerText(), /LANDS\s*35/i)
  assert.equal(await preview.getByText('×35').count(), 1, 'identical printings are grouped')
  await shoot(page, `${label}-shared-preview`)
  await button(preview, 'Keep my current deck').click()
  await preview.waitFor({ state: 'detached' })
  assert.equal(await deckCount(page), '10')
}

async function openFreshAndCopy(page: Page, link: string, label: string) {
  // A fresh load with the link opens the same preview once the workspace is ready.
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate((url) => {
      history.replaceState(null, '', url)
      location.reload()
    }, link),
  ])
  const preview = sharedDialog(page)
  await preview.getByText('100 main-deck cards').waitFor()
  assert.equal(await deckCount(page), '10', 'opening a link never replaces the deck by itself')
  // Card details open over the preview, read-only, and return to it.
  await preview.getByRole('button', { name: 'Show details for B10 Theme 0' }).click()
  const details = page.locator('.deck-card-modal')
  await details.waitFor()
  assert.equal(await preview.count(), 0)
  assert.equal(await details.getByRole('button', { name: /Remove|Move to/ }).count(), 0)
  await page.keyboard.press('Escape')
  await preview.waitFor()
  // Cancelling the confirmation keeps the current deck and the preview.
  await button(preview, 'Copy to my decks').click()
  const confirm = dialog(page, 'Replace the current deck?')
  await confirm.waitFor()
  await shoot(page, `${label}-shared-confirm`)
  await button(confirm.locator('.export-actions'), 'Cancel').click()
  await preview.waitFor()
  assert.equal(await deckCount(page), '10')
  await button(preview, 'Copy to my decks').click()
  await button(dialog(page, 'Replace the current deck?'), 'Copy and replace').click()
  await preview.waitFor({ state: 'detached', timeout: 30_000 })
  await page.waitForFunction(() => /^\*?100\/100 /.test(document.title))
  assert.equal(
    await page.locator('.deck-board .card-reference-name', { hasText: 'B10 Theme 57' }).count(),
    1,
  )
}

async function checkDamagedAndPasted(page: Page, link: string, base: string) {
  await page.goto(`${base}#share=1.not-a-deck`)
  const preview = sharedDialog(page)
  await preview.getByText('This share link is damaged or incomplete.').waitFor()
  assert.equal(await button(preview, 'Try again').count(), 0, 'a damaged link has no retry')
  await button(preview, 'Close').click()
  await preview.waitFor({ state: 'detached' })
  // Import accepts a pasted share link and hands it to the same preview.
  await button(page, 'Import deck').click()
  const importDialog = dialog(page, 'Import deck')
  await importDialog.getByRole('textbox', { name: 'Exported deck list' }).fill(link)
  await button(importDialog, 'Import deck').click()
  await importDialog.waitFor({ state: 'detached' })
  await preview.getByText('100 main-deck cards').waitFor()
  await button(preview, 'Keep my current deck').click()
}

async function run(browser: Browser, base: string, [label, dark, width]: (typeof layouts)[number]) {
  const sender = await openScenario(browser, base, makeState())
  await sender.context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await sender.page.setViewportSize({ width, height: 1000 })
  if (dark) await setDisplayPreferences(sender.page, { 'Dark mode': true })
  const link = await copyLink(sender.page, label)
  assert.deepEqual(sender.errors, [])
  await sender.context.close()

  // The recipient has a 10-card deck in progress.
  const recipient = await openScenario(
    browser,
    base,
    makeState({ deck: deckRecords.slice(0, 10).map(toDeckCard) }),
  )
  const { page } = recipient
  await page.setViewportSize({ width, height: 1000 })
  if (dark) await setDisplayPreferences(page, { 'Dark mode': true })
  try {
    // Hash navigation and a fresh load each open the preview from the fixture's base URL.
    const local = new URL(new URL(link).hash, base).href
    await previewThenKeep(page, local, label)
    if (label === 'light') await checkDamagedAndPasted(page, local, base)
    await openFreshAndCopy(page, local, label)
    assert.deepEqual(recipient.errors, [], 'no page errors or unexpected native dialogs')
  } finally {
    await recipient.context.close()
  }
}

await withBrowser('SHARE_LINK', 5302, async (browser, base) => {
  for (const layout of layouts) await run(browser, base, layout)
  console.log(
    'Downloads match each export format; a 100-card share link previews read-only and copies only after confirmation.',
  )
})
