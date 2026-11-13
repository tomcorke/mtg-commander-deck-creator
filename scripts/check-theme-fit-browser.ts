// Theme fit (#501): a theme-matching offer leads its reason with the theme and the card text that
// matched, and Deck targets tracks theme cards against an editable, heuristic target.
// THEME_FIT_SCREENSHOTS=<dir> saves the first batch and the sidebar in light, dark and 390px layouts.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'
import { openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.THEME_FIT_SCREENSHOTS
const prefix = process.env.THEME_FIT_PREFIX ?? 'after'
const tokenMaker = (name: string) =>
  fixtureCard(name, {
    type_line: 'Creature — Elf',
    color_identity: ['G'],
    power: '1',
    toughness: '1',
    oracle_text: 'When this creature enters, create a 1/1 green Elf creature token.',
  })
const themeRamp = fixtureCard('Theme fit ramp', {
  color_identity: ['G'],
  produced_mana: ['G'],
  oracle_text:
    '{T}: Add {G}.\nWhenever you cast a creature spell, create a 1/1 green Saproling creature token.',
})
const plainRamp = fixtureCard('Theme fit plain ramp', {
  color_identity: ['G'],
  produced_mana: ['G'],
  oracle_text: '{T}: Add {G}.',
})
const spares = Array.from({ length: 4 }, (_, index) => fixtureCard(`Theme fit spare ${index}`))
const deckMakers = Array.from({ length: 12 }, (_, index) => tokenMaker(`Theme fit maker ${index}`))
const records = [commander, basic, themeRamp, plainRamp, ...spares, ...deckMakers]
const state = makeState({
  theme: 'Tokens',
  queue: [themeRamp, plainRamp, ...spares].map((record) => toCard(record, 'Commander synergy')),
  deck: [commander, ...Array.from({ length: 10 }, () => basic), ...deckMakers].map(toDeckCard),
  deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
})

const offer = (page: Page, name: string) => page.locator('.card-offer').filter({ hasText: name })
const themeRow = (page: Page) => page.locator('.deck-target-row.theme-target')

async function capture(page: Page) {
  if (!output) return
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      const mode = `${dark ? 'dark' : 'light'}-${width}`
      const batch = page.locator('.card-grid').first()
      await batch.scrollIntoViewIfNeeded()
      await batch.screenshot({ path: join(output, `${prefix}-offers-${mode}.png`) })
      const targets = page.locator('.deck-analysis .deck-targets')
      await targets.scrollIntoViewIfNeeded()
      await page
        .locator('.deck-analysis')
        .screenshot({ path: join(output, `${prefix}-sidebar-${mode}.png`) })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

if (output) await mkdir(output, { recursive: true })
await withBrowser('THEME_FIT', 5271, async (browser, base) => {
  const { page, context, errors } = await openScenario(browser, base, state, records)
  await offer(page, themeRamp.name).waitFor()
  await capture(page)

  // Theme fit leads the reason, quoting the matching sentence; other offers keep role reasons.
  const theme = offer(page, themeRamp.name)
  assert.equal(await theme.locator('.suggestion-type').innerText(), 'TOKENS THEME')
  assert.equal(
    await theme.locator('.offer-reason').innerText(),
    'Text matches your Tokens theme: “Whenever you cast a creature spell, create a 1/1 green Saproling creature token.”',
  )
  assert.match(
    await offer(page, plainRamp.name).locator('.offer-reason').innerText(),
    /^Adds ramp your deck needs/,
  )

  // Deck targets: the theme row counts matching main-deck cards against an editable target.
  const row = themeRow(page)
  assert.match(await row.innerText(), /^Tokens cards\s+12 \/\s*$/)
  const input = row.getByRole('spinbutton', { name: 'Tokens cards target', exact: true })
  assert.equal(await input.inputValue(), '25')
  assert.match(await page.locator('.deck-analysis .theme-target-note').innerText(), /heuristic/i)
  await input.fill('12')
  assert.match(await row.innerText(), /Target met/)
  await page.reload()
  await themeRow(page).waitFor()
  assert.equal(
    await themeRow(page)
      .getByRole('spinbutton', { name: 'Tokens cards target', exact: true })
      .inputValue(),
    '12',
  )

  // A phone-width sidebar never scrolls the page sideways.
  await page.setViewportSize({ width: 390, height: 1000 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    true,
    'no horizontal page scroll at 390px',
  )
  assert.deepEqual(errors, [])
  await context.close()
})
console.log('Theme fit: theme-first quoted reasons and an editable theme target')
