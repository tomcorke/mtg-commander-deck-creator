// Early-build sidebar (#508): an unfinished deck shows quiet notes, not alarm-styled empty states.
// EARLY_SIDEBAR_SCREENSHOTS=<dir> saves the Deck overview sidebar in light, dark and 390px layouts.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright-core'
import { toDeckCard } from '../src/domain/card-model.ts'
import { openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.EARLY_SIDEBAR_SCREENSHOTS
const prefix = process.env.EARLY_SIDEBAR_PREFIX ?? 'after'
const spells = Array.from({ length: 5 }, (_, index) =>
  fixtureCard(`Early spell ${index}`, { type_line: 'Sorcery', cmc: index + 1 }),
)
const filler = fixtureCard('Early filler')
const decks = [
  ['commander-only', [commander]],
  ['early-6', [commander, ...spells]],
  [
    'full-100',
    [
      commander,
      ...Array.from({ length: 40 }, () => basic),
      ...spells,
      ...Array.from({ length: 54 }, () => filler),
    ],
  ],
] as const
const records = [commander, basic, filler, ...spells]

const sidebar = (page: Page) => page.locator('.deck-analysis')
const landDrop = (page: Page) =>
  page.getByRole('region', { name: 'Land-drop context', exact: true })
const sourcesRow = (page: Page) => page.locator('.mana-balance-row').filter({ hasText: 'Sources' })

async function capture(page: Page, label: string) {
  if (!output) return
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await sidebar(page).scrollIntoViewIfNeeded()
      await sidebar(page).screenshot({
        path: join(output, `${prefix}-${label}-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

async function checkEarly(page: Page, label: string) {
  const note = landDrop(page)
  assert.match(await note.innerText(), /^Land-drop context: provisional until 100 cards.$/)
  assert.equal(
    await note.getByRole('heading').count(),
    0,
    `${label}: land-drop note has no heading`,
  )
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    // Each wrapped line adds a client rect with its own top edge.
    const lines = await note.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
    })
    assert.equal(lines, 1, `${label}: land-drop note is one line at ${width}px`)
  }
  assert.equal(await sourcesRow(page).innerText(), 'Sources\nNo mana sources yet')
  assert.equal(await page.locator('.mana-balance .colour-empty').count(), 0)
  assert.match(
    await page.locator('.deck-analysis .curve-commander-note').innerText(),
    /^Includes your commander \(mana value 3\)\.$/,
  )
}

async function checkFull(page: Page) {
  await page.getByRole('heading', { name: 'Land-drop context', exact: true }).waitFor()
  assert.match(await landDrop(page).innerText(), /Turn 4:/)
  assert.doesNotMatch(await sourcesRow(page).innerText(), /No mana sources/)
}

async function checkDeck(browser: Browser, base: string, [label, deck]: (typeof decks)[number]) {
  const { page, context, errors } = await openScenario(
    browser,
    base,
    makeState({ deck: deck.map(toDeckCard) }),
    records,
  )
  await capture(page, label)
  if (label === 'full-100') await checkFull(page)
  else await checkEarly(page, label)
  // A phone-width sidebar never scrolls the page sideways.
  await page.setViewportSize({ width: 390, height: 1000 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    true,
    `${label}: no horizontal page scroll at 390px`,
  )
  assert.deepEqual(errors, [])
  await context.close()
}

if (output) await mkdir(output, { recursive: true })
await withBrowser('EARLY_SIDEBAR', 5263, async (browser, base) => {
  for (const deck of decks) await checkDeck(browser, base, deck)
})
console.log('Early sidebar: quiet land-drop note, source note and labelled commander curve')
