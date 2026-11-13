// Generic picks (#560): in Theme first, an offer that matches no selected theme carries a visible,
// heuristic-labelled "Generic pick" mark; theme-matching offers and other priorities never do.
// GENERIC_PICK_SCREENSHOTS=<dir> saves the first batch in light, dark and 390px layouts.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'
import { openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.GENERIC_PICK_SCREENSHOTS
const prefix = process.env.GENERIC_PICK_PREFIX ?? 'after'
const themeRamp = fixtureCard('Generic check theme ramp', {
  color_identity: ['G'],
  produced_mana: ['G'],
  oracle_text:
    '{T}: Add {G}.\nWhenever you cast a creature spell, create a 1/1 green Saproling creature token.',
})
const plainRamp = fixtureCard('Generic check plain ramp', {
  color_identity: ['G'],
  produced_mana: ['G'],
  oracle_text: '{T}: Add {G}.',
})
const plainDraw = fixtureCard('Generic check plain draw', {
  type_line: 'Sorcery',
  color_identity: ['G'],
  oracle_text: 'Draw two cards.',
})
const tokenMaker = fixtureCard('Generic check token maker', {
  type_line: 'Creature — Elf',
  color_identity: ['G'],
  power: '1',
  toughness: '1',
  oracle_text: 'When this creature enters, create a 1/1 green Elf creature token.',
})
const offered = [themeRamp, plainRamp, plainDraw, tokenMaker]
const records = [commander, basic, ...offered]
const stateFor = (recommendationStyle: 'thematic' | 'balanced', theme = 'Tokens') =>
  makeState({
    theme,
    recommendationStyle,
    // Restore reads Balanced without deck health as Theme first.
    prioritizeDeckHealth: recommendationStyle !== 'thematic',
    queue: offered.map((record) => toCard(record, 'Commander synergy')),
    deck: [commander, ...Array.from({ length: 10 }, () => basic)].map(toDeckCard),
    deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
  })

const offer = (page: Page, name: string) => page.locator('.card-offer').filter({ hasText: name })
const marks = (page: Page, name: string) => offer(page, name).locator('.generic-pick')

async function capture(page: Page) {
  if (!output) return
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      // The phone batch is a sideways rail, so capture a generic offer rather than the first.
      const batch = width < 600 ? offer(page, plainRamp.name) : page.locator('.card-grid').first()
      await batch.scrollIntoViewIfNeeded()
      await batch.screenshot({
        path: join(output, `${prefix}-offers-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

if (output) await mkdir(output, { recursive: true })
await withBrowser('GENERIC_PICK', 5273, async (browser, base) => {
  // Theme first with a theme: offers matching no theme tag carry the mark; theme matches never do.
  {
    const { page, context, errors } = await openScenario(
      browser,
      base,
      stateFor('thematic'),
      records,
    )
    // Wait until offers hydrate and the theme match leads its reason.
    await offer(page, themeRamp.name)
      .locator('.suggestion-type', { hasText: /tokens theme/i })
      .waitFor()
    await capture(page)
    for (const card of [themeRamp, tokenMaker])
      assert.equal(await marks(page, card.name).count(), 0)
    for (const card of [plainRamp, plainDraw]) {
      const mark = marks(page, card.name)
      assert.equal(await mark.count(), 1, `${card.name} is marked generic`)
      assert.match(await mark.innerText(), /^Generic pick/)
      assert.match(await mark.innerText(), /Heuristic: matches no theme tag/)
    }
    // A phone-width batch never scrolls the page sideways.
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
  }
  // Other priorities, and Theme first with no theme, show no mark.
  for (const [style, theme] of [
    ['balanced', 'Tokens'],
    ['thematic', ''],
  ] as const) {
    const { page, context, errors } = await openScenario(
      browser,
      base,
      stateFor(style, theme),
      records,
    )
    await offer(page, plainRamp.name)
      .locator('.offer-reason', { hasText: /^Adds ramp/ })
      .waitFor()
    assert.equal(await page.locator('.card-offer .generic-pick').count(), 0, `${style} '${theme}'`)
    assert.deepEqual(errors, [])
    await context.close()
  }
})
console.log('Generic picks: marked in Theme first only, never on theme matches')
