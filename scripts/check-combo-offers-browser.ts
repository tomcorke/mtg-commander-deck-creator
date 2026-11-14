// Combo offers (#502): an offer that alone completes a known Commander Spellbook combo with deck
// cards carries a note framed by Power (Core: caution; Upgraded: neutral; High: ranks it higher),
// names the deck pieces as card references and links the combo. At High, the next batch ranks a
// combo-completing card first and "Why this card" shows the combo factor, which a game-ending
// combo raises (#569); Core leaves order alone.
// COMBO_OFFERS_SCREENSHOTS=<dir> saves the first batch at Core and High in light, dark and 390px;
// COMBO_OFFERS_PREFIX (default "after") names the files. Capture runs before the assertions.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Locator, Page } from 'playwright-core'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'
import type { ComboIndex } from '../src/domain/combo-index.ts'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { withComboIndex } from './fixtures/combo-index.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.COMBO_OFFERS_SCREENSHOTS
const prefix = process.env.COMBO_OFFERS_PREFIX ?? 'after'
const altar = fixtureCard('Combo check altar')
const spares = Array.from({ length: 11 }, (_, index) => fixtureCard(`Combo check spare ${index}`))
// Last in the restored queue, so only ranking can bring it into the next batch.
const piece = fixtureCard('Combo check piece')
const queue = [...spares, piece]
const records = [commander, basic, altar, ...queue]
const id = (name: string) => `b10:${name}`
// Synthetic rows over fixture cards; they make no claims about real combos.
const index: ComboIndex = {
  version: 1,
  metadata: {
    exportedAt: '2026-11-13T14:13:00+00:00',
    exportVersion: 'fixture',
    generatedAt: '2026-11-13T16:00:00.000Z',
  },
  cards: [
    [altar.name, id(altar.name), null],
    [spares[0].name, id(spares[0].name), null],
    [piece.name, id(piece.name), null],
  ],
  results: ['Infinite mana', 'Win the game'],
  combos: [
    ['combo-check-visible', [0, 1], [0], 'C', 20],
    // Its result ends the game, so High ranks the piece ahead of the visible combo (#569).
    ['combo-check-piece', [0, 2], [1], 'C', 10],
  ],
}
const state = makeState({
  theme: '',
  queue: queue.map((record) => toCard(record, 'Commander synergy')),
  deck: [commander, altar, ...Array.from({ length: 10 }, () => basic)].map(toDeckCard),
  deckTargets: { lands: 10, ramp: 0, draw: 0, removal: 0, wipes: 0 },
})

const offer = (page: Page, name: string) => page.locator('.card-offer').filter({ hasText: name })
const note = (page: Page, name: string) => offer(page, name).locator('.combo-offer')
const text = async (page: Page, name: string) =>
  ((await note(page, name).textContent()) ?? '').replace(/\s+/g, ' ')

async function open(browser: Browser, base: string, power: string, combos = true) {
  return openScenario(browser, base, state, records, undefined, async (page) => {
    await page.addInitScript(
      (target) => localStorage.setItem('option:powerTarget', JSON.stringify(target)),
      power,
    )
    if (combos) await withComboIndex(index)(page)
  })
}

async function capture(page: Page, power: string) {
  if (!output) return
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      // The phone batch is a sideways rail, so capture the combo offer rather than the grid.
      const target = width < 600 ? offer(page, spares[0].name) : page.locator('.card-grid').first()
      await target.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
      await target.screenshot({
        path: join(output, `${prefix}-${power}-offers-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

// The High "Why this card" panel, hovering its combo row so the row's description shows.
async function captureWhy(page: Page, why: Locator) {
  if (!output) return
  const row = why.locator('.score-factor-row').filter({ hasText: 'Combo completion' })
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    await row.scrollIntoViewIfNeeded()
    await row.hover()
    await page.waitForTimeout(200)
    const box = (await why.boundingBox())!
    await page.screenshot({
      path: join(output, `${prefix}-high-why-${dark ? 'dark' : 'light'}-1440.png`),
      clip: {
        x: Math.max(0, box.x - 280),
        y: Math.max(0, box.y - 160),
        width: box.width + 560,
        height: box.height + 200,
      },
    })
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
}

const firstOffer = async (page: Page) =>
  ((await page.locator('.card-offer').first().textContent()) ?? '').includes(piece.name)

async function checkHigh(browser: Browser, base: string) {
  const { page, context, errors } = await open(browser, base, 'high')
  try {
    await offer(page, spares[0].name).waitFor()
    if (output) await page.waitForTimeout(1_000)
    await capture(page, 'high')
    const shown = note(page, spares[0].name)
    await shown.waitFor()
    assert.match(
      await text(page, spares[0].name),
      /Completes a combo ?With Combo check altar\. High power ranks it higher\./,
    )
    assert.equal(await shown.locator('.deck-review-status.good').count(), 1)
    assert.equal(
      await shown.getByRole('link', { name: 'View on Commander Spellbook' }).getAttribute('href'),
      'https://commanderspellbook.com/combo/combo-check-visible/',
    )
    // Only the combo offer carries a note.
    assert.equal(await page.locator('.card-offer .combo-offer').count(), 1)
    // The deck piece opens its details.
    await button(shown, `Show details for ${altar.name}`).click()
    const details = page.getByRole('dialog', { name: altar.name })
    await details.waitFor()
    await page.keyboard.press('Escape')
    await details.waitFor({ state: 'detached' })
    // "Why this card" scores the combo at High power.
    const why = offer(page, spares[0].name).locator('.score-breakdown')
    await why.locator('summary').click()
    await captureWhy(page, why)
    // The visible combo does not end the game, so it scores 3 rather than a winning combo's 7.
    assert.match(await why.innerText(), /Combo completion\s*3 \/ 10/)
    assert.match(await why.innerText(), /Positive factors total 118 points/)
    // A phone-width batch never scrolls the page sideways.
    await page.setViewportSize({ width: 390, height: 1000 })
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
      'no horizontal page scroll at 390px',
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    // The last card in the queue completes a combo, so High ranks it first in the next batch.
    await button(page, 'Next recommendations').click()
    await offer(page, piece.name).waitFor()
    assert(await firstOffer(page), 'combo piece leads the next batch at High power')
    await note(page, piece.name).getByText('Completes a combo').waitFor()
    const pieceWhy = offer(page, piece.name).locator('.score-breakdown')
    await pieceWhy.locator('summary').click()
    assert.match(await pieceWhy.innerText(), /Combo completion\s*7 \/ 10/)
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }
}

async function checkCore(browser: Browser, base: string) {
  const { page, context, errors } = await open(browser, base, 'precon')
  try {
    await offer(page, spares[0].name).waitFor()
    if (output) await page.waitForTimeout(1_000)
    await capture(page, 'core')
    const shown = note(page, spares[0].name)
    await shown.waitFor()
    assert.match(
      await text(page, spares[0].name),
      /Completes a combo ?With Combo check altar\. Core power: add it only on purpose, and tell your table\./,
    )
    assert.equal(await shown.locator('.deck-review-status.attention').count(), 1)
    assert.doesNotMatch(await shown.innerText(), /Bracket/)
    const why = offer(page, spares[0].name).locator('.score-breakdown')
    await why.locator('summary').click()
    assert.doesNotMatch(await why.innerText(), /Combo completion/)
    // Core warns but never re-ranks: the piece stays behind the cards ahead of it.
    await button(page, 'Next recommendations').click()
    await offer(page, spares[4].name).waitFor()
    assert.equal(await offer(page, piece.name).count(), 0)
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }
}

async function checkUpgradedAndUnavailable(browser: Browser, base: string) {
  {
    const { page, context, errors } = await open(browser, base, 'upgraded')
    const shown = note(page, spares[0].name)
    await shown.waitFor()
    assert.match(await text(page, spares[0].name), /Worth mentioning to your table\./)
    assert.equal(await shown.locator('.deck-review-status.neutral').count(), 1)
    assert.deepEqual(errors, [])
    await context.close()
  }
  // Without combo data, offers carry no note and the builder still works.
  const { page, context, errors } = await open(browser, base, 'high', false)
  await offer(page, spares[0].name).waitFor()
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.card-offer .combo-offer').count(), 0)
  assert.deepEqual(errors, [])
  await context.close()
}

if (output) await mkdir(output, { recursive: true })
await withBrowser('COMBO_OFFERS', 5379, async (browser, base) => {
  await checkHigh(browser, base)
  await checkCore(browser, base)
  await checkUpgradedAndUnavailable(browser, base)
})
console.log('Combo offers: Power-framed notes on combo-completing offers; High ranks them first')
