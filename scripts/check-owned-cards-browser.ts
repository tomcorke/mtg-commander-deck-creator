// Owned cards (#505, #521): import a list into this browser, view it, use it in recommendations,
// review and export the cards still needed, preview owned art from the local card index, then
// clear it. OWNED_CARDS_SCREENSHOTS=<dir> also saves review evidence.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright-core'
import { buildLocalCardIndex } from './build-card-index.ts'
import { serializeLocalCardIndex } from '../src/domain/local-card-index.ts'
import { button, openScenario, withBrowser, withOwnedCards } from './fixtures/browser-harness.ts'
import { baseCandidates, deckRecords, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.OWNED_CARDS_SCREENSHOTS
const ownedList = [
  '1 B10 Ramp two',
  '2x B10 Spare 3',
  '35 B10 Basic',
  'B10 Commander',
  '0 B10 Spare 4',
]
const shoot = async (page: Page, name: string) => {
  if (output) await page.screenshot({ path: join(output, `${name}.png`) })
}

const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true })
const settings = (page: Page) => dialog(page, 'Recommendation settings')
const owned = (page: Page) => dialog(page, 'Owned cards')
const batchNames = (page: Page) =>
  page.locator('.card-offer .card-copy .card-reference-name').allInnerTexts()

async function openOwnedCards(page: Page) {
  await button(page, 'Recommendation settings').click()
  await settings(page).getByText('Owned cards', { exact: true }).scrollIntoViewIfNeeded()
  await button(settings(page), 'Import owned cards')
    .or(button(settings(page), 'View or import owned cards'))
    .click()
  await owned(page).waitFor()
}

async function importList(page: Page, label: string) {
  await openOwnedCards(page)
  await shoot(page, `${label}-owned-empty`)
  await owned(page).getByRole('textbox', { name: 'Owned card list' }).fill(ownedList.join('\n'))
  const status = owned(page).locator('.import-summary')
  await status.getByText('Found 4 cards (39 copies) in this list.').waitFor()
  await status.getByText('Skipped 1 line: line 5 (No owned copies).').waitFor()
  await shoot(page, `${label}-owned-preview`)
  await button(owned(page), 'Save owned cards').click()
  await status.getByText('Saved 4 cards (39 copies).').waitFor()
  const list = owned(page).locator('.owned-card-grid .card-reference-name')
  assert.deepEqual(await list.allInnerTexts(), [
    'B10 Basic',
    'B10 Commander',
    'B10 Ramp two',
    'B10 Spare 3',
  ])
  await owned(page).getByRole('searchbox', { name: 'Find an owned card' }).fill('spare')
  assert.deepEqual(await list.allInnerTexts(), ['B10 Spare 3'])
  await owned(page).getByRole('searchbox', { name: 'Find an owned card' }).fill('')
  await shoot(page, `${label}-owned-list`)
}

async function checkRecommendations(page: Page, label: string) {
  // Done returns to settings, where the mode applies once settings close.
  await button(owned(page), 'Done').click()
  await settings(page).waitFor()
  assert.match(await settings(page).innerText(), /4 cards \(39 copies\) saved in this browser\./)
  const mode = settings(page).getByRole('combobox', { name: 'Use owned cards' })
  await mode.selectOption('only')
  await mode.scrollIntoViewIfNeeded()
  await shoot(page, `${label}-settings`)
  await page.keyboard.press('Escape')
  await settings(page).waitFor({ state: 'detached' })
  await page
    .locator('.recommendation-settings-summary')
    .getByText(/Owned only/)
    .waitFor()
  // The rebuilt batch holds only the two owned, offerable cards (the others are in the deck).
  await page.waitForFunction(() => {
    const names = [...document.querySelectorAll('.card-offer .card-copy .card-reference-name')]
    return names.length === 2 && !document.querySelector('.card-offer:not(:has(.owned-badge))')
  })
  const names = await batchNames(page)
  assert.deepEqual(names.toSorted(), ['B10 Ramp two', 'B10 Spare 3'])
  assert.equal(await page.locator('.card-offer .owned-badge').count(), names.length)
  await page
    .locator('.recommendations')
    .first()
    .screenshot(output ? { path: join(output, `${label}-batch.png`) } : {})
}

async function checkStillNeeded(page: Page, label: string) {
  await button(page, 'Export deck').click()
  const exportDialog = dialog(page, 'Copy your deck list')
  await button(exportDialog, 'Still needed (64)').click()
  await button(exportDialog, 'Plain text').click()
  const list = await exportDialog.locator('textarea').inputValue()
  assert(!list.includes('B10 Basic') && !list.includes('B10 Commander'), 'owned cards are left out')
  assert.match(list, /^DECK:\n1 B10 Existing ramp A/)
  await shoot(page, `${label}-export`)
  await button(exportDialog, 'Whole deck').click()
  assert.match(await exportDialog.locator('textarea').inputValue(), /35 B10 Basic/)
  await page.keyboard.press('Escape')
}

async function checkDeckReview(page: Page, label: string) {
  await button(page, 'Deck review').click()
  const review = page.locator('#still-needed')
  await review.getByRole('heading', { name: 'Still needed' }).waitFor()
  assert.match(
    await page.locator('.deck-review-overview').innerText(),
    /64 main-deck cards still needed/,
  )
  assert.match(await review.innerText(), /^64 main-deck cards, commanders included/m)
  // Owned cards cover the commander, 35 basics and the owned spare; they are not listed.
  const names = await review.locator('.doctor-card-tile .card-reference-name').allInnerTexts()
  assert(names.includes('B10 Existing ramp A') && !names.includes('B10 Basic'))
  await button(page, 'See still needed').click()
  await shoot(page, `${label}-review-still-needed`)
  await button(review, 'Show 64 still-needed cards in the deck list').click()
  await page
    .locator('.deck-review-filter-status')
    .getByText(/highlighted for Still needed/)
    .waitFor()
  assert.equal(
    await page
      .locator('[data-highlighted] .card-reference-name', { hasText: 'B10 Commander' })
      .count(),
    0,
  )
  await button(page, 'Clear highlight').click()
}

const localIndexBody = serializeLocalCardIndex(
  buildLocalCardIndex({
    bulkUpdatedAt: '2026-10-24T10:00:00Z',
    sets: [{ code: 'tst', name: 'B10 Fixture Alpha', released_at: '2020-01-01', card_count: 1 }],
    creatureTypes: ['Human'],
    cards: [...new Map([...deckRecords, ...baseCandidates].map((c) => [c.name, c])).values()],
  }),
)

/** Owned names the local card index knows preview their art on hover and keyboard focus. */
async function checkOwnedPreviews(browser: Browser, base: string) {
  const { page, context, errors } = await openScenario(
    browser,
    base,
    makeState(),
    baseCandidates,
    (route) => route.fulfill({ contentType: 'application/json', body: localIndexBody }),
    withOwnedCards(['B10 Ramp two', 'Unknown owned card']),
  )
  await openOwnedCards(page)
  const known = owned(page).locator('.card-reference', { hasText: 'B10 Ramp two' })
  await known.locator('.card-reference-thumbnail').waitFor()
  await known.locator('.card-reference-name').focus()
  await known.locator('.card-image-preview:popover-open img').waitFor()
  await known.locator('.card-reference-name').blur()
  await known.locator('.card-reference-name').hover()
  await known.locator('.card-image-preview:popover-open img').waitFor()
  const unknown = owned(page).locator('.card-reference', { hasText: 'Unknown owned card' })
  assert.equal(await unknown.locator('.card-reference-thumbnail, .card-image-preview').count(), 0)
  assert.deepEqual(errors, [])
  await context.close()
}

async function clearOwnedCards(page: Page) {
  await openOwnedCards(page)
  await button(owned(page), 'Clear owned cards').click()
  await button(dialog(page, 'Clear owned cards?'), 'Clear owned cards').click()
  await owned(page).getByRole('button', { name: 'Save owned cards' }).waitFor()
  assert.equal(await owned(page).locator('.owned-card-grid').count(), 0)
  await button(owned(page), 'Done').click()
  await button(settings(page), 'Import owned cards').waitFor()
  assert(await settings(page).getByRole('combobox', { name: 'Use owned cards' }).isDisabled())
}

await withBrowser('OWNED_CARDS', 5243, async (browser, base) => {
  if (output) await mkdir(output, { recursive: true })
  for (const [label, width, dark] of [
    ['light-1366', 1366, false],
    ['dark-1366', 1366, true],
    ['dark-390', 390, true],
  ] as const) {
    if (!output && label !== 'light-1366') continue
    const { page, context, errors } = await openScenario(browser, base, makeState())
    await page.setViewportSize({ width, height: 1000 })
    if (dark) await setDisplayPreferences(page, { 'Dark mode': true })
    await importList(page, label)
    await checkRecommendations(page, label)
    // The owned list is stored in this browser and survives a reload.
    await page.reload()
    await button(page, 'Deck review').waitFor()
    await page.locator('.card-offer .owned-badge').first().waitFor()
    await checkStillNeeded(page, label)
    await checkDeckReview(page, label)
    await clearOwnedCards(page)
    assert.deepEqual(errors, [])
    await context.close()
  }
  await checkOwnedPreviews(browser, base)
  console.log(
    'Owned cards: import, view, Owned only, reload, still-needed review and export, previews and clear pass',
  )
})
