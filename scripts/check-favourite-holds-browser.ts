// Theme favourites on hold (#632): under Theme first and Balanced, a majority-inclusion commander
// theme favourite that ranking holds back shows a labelled lane naming the gate (mana support,
// deck budget). Weaker or off-theme favourites and other priorities show nothing.
// FAVOURITE_HOLDS_SCREENSHOTS=<dir> saves the lane in light, dark and 390px layouts.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import type { ScryfallCard } from '../src/domain/card-model.ts'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'
import type { RecommendationStyle } from '../src/domain/recommendation-types.ts'
import { openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.FAVOURITE_HOLDS_SCREENSHOTS
const prefix = process.env.FAVOURITE_HOLDS_PREFIX ?? 'after'
const tokens = 'When this enters, create two 1/1 green Elf creature tokens.'
const offers = Array.from({ length: 4 }, (_, index) =>
  fixtureCard(`Hold check offer ${index}`, {
    type_line: 'Creature — Elf',
    color_identity: ['G'],
    mana_cost: '{1}{G}',
    power: '1',
    toughness: '1',
    oracle_text: tokens,
  }),
)
// A seven-drop creature: with ten sources against a 45-source target, mana fit holds it back.
const bigFavourite = fixtureCard('Hold check big favourite', {
  type_line: 'Creature — Elf',
  cmc: 7,
  mana_cost: '{5}{G}{G}',
  color_identity: ['G'],
  power: '6',
  toughness: '6',
  oracle_text: tokens,
})
// Affordable on its own, but more than the deck budget has left.
const pricyFavourite = fixtureCard('Hold check pricey favourite', {
  type_line: 'Enchantment',
  color_identity: ['G'],
  oracle_text: `At the beginning of your upkeep, ${tokens.charAt(0).toLowerCase()}${tokens.slice(1)}`,
  prices: { usd: '30.00' },
})
// Same gate, but off theme or under half inclusion: no lane entry.
const offTheme = fixtureCard('Hold check off-theme favourite', {
  type_line: 'Creature — Beast',
  cmc: 7,
  mana_cost: '{5}{G}{G}',
  color_identity: ['G'],
  power: '7',
  toughness: '7',
  oracle_text: 'Trample',
})
const minority = fixtureCard('Hold check minority favourite', {
  type_line: 'Creature — Elf',
  cmc: 7,
  mana_cost: '{5}{G}{G}',
  color_identity: ['G'],
  power: '5',
  toughness: '5',
  oracle_text: tokens,
})
const favourite = (record: ScryfallCard, inclusion: number) => ({
  ...toCard(record, 'Commander favourite'),
  source: 'edhrec' as const,
  inclusion,
})
const records = [commander, basic, ...offers, bigFavourite, pricyFavourite, offTheme, minority]
const stateFor = (recommendationStyle: RecommendationStyle) =>
  makeState({
    theme: 'Tokens',
    recommendationStyle,
    // Restore reads Balanced without deck health as Theme first.
    prioritizeDeckHealth: recommendationStyle !== 'thematic',
    queue: [
      ...offers.map((record) => toCard(record, 'Commander synergy')),
      favourite(bigFavourite, 62),
      favourite(pricyFavourite, 55),
      favourite(offTheme, 70),
      favourite(minority, 40),
    ],
    deck: [commander, ...Array.from({ length: 10 }, () => basic)].map(toDeckCard),
    deckBudget: 20,
    deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
  })

const lane = (page: Page) => page.locator('section.favourite-holds')
const tile = (page: Page, name: string) => lane(page).locator('.favourite-hold', { hasText: name })

async function capture(page: Page) {
  if (!output) return
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      // Before #632 there is no lane, so capture the batch the player sees instead.
      const target = (await lane(page).count()) ? lane(page) : page.locator('.card-grid').first()
      await target.scrollIntoViewIfNeeded()
      await target.screenshot({
        path: join(output, `${prefix}-holds-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

if (output) await mkdir(output, { recursive: true })
await withBrowser('FAVOURITE_HOLDS', 5274, async (browser, base) => {
  for (const style of ['thematic', 'balanced'] as const) {
    const { page, context, errors } = await openScenario(browser, base, stateFor(style), records)
    await page.locator('.card-offer').first().waitFor()
    if (style === 'thematic') await capture(page)
    await lane(page).waitFor()
    const heading = lane(page).getByRole('heading', { name: 'Theme favourites on hold' })
    assert.equal(await heading.count(), 1, `${style}: lane heading`)
    assert.match(
      await lane(page).locator('.health-lane-heading').innerText(),
      /Heuristic: .*Inclusion shows popularity, not card quality\./s,
    )
    const big = tile(page, bigFavourite.name)
    assert.match(await big.innerText(), /Waits for mana/i)
    assert.match(await big.innerText(), /In 62% of B10 Commander decks on EDHREC/)
    assert.match(
      await big.innerText(),
      /Mana-fit penalty -\d+ \/ 10: mana value 7 against 10 of 45 land and ramp sources so far\./,
    )
    const pricy = tile(page, pricyFavourite.name)
    assert.match(await pricy.innerText(), /Over deck budget/i)
    assert.match(
      await pricy.innerText(),
      /\$30\.00 is more than the \$\d+\.\d\d left in your deck budget/,
    )
    // Strongest inclusion first; off-theme and minority favourites never appear.
    assert.deepEqual(
      await lane(page).locator('.favourite-hold .card-reference-name').allInnerTexts(),
      [bigFavourite.name, pricyFavourite.name],
    )
    await page.setViewportSize({ width: 390, height: 1000 })
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
      `${style}: no horizontal page scroll at 390px`,
    )
    assert.deepEqual(errors, [])
    await context.close()
  }
  // Power first ranks without the favourite reservation, so it explains no holds.
  const { page, context, errors } = await openScenario(
    browser,
    base,
    stateFor('competitive'),
    records,
  )
  await page.locator('.card-offer').first().waitFor()
  assert.equal(await lane(page).count(), 0, 'competitive: no lane')
  assert.deepEqual(errors, [])
  await context.close()
})
console.log('Theme favourites on hold: labelled in Theme first and Balanced only')
