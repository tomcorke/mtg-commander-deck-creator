// #498: Choose lands shows each nonbasic land's price, hides lands over the max price and
// marks lands that would take the deck past its budget, like recommendations do.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { baseCandidates, basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import type { PersistedDeckState } from '../src/deck-state.ts'
import { setDisplayPreferences } from './browser-display.ts'

const evidence = process.env.LAND_FILL_BUDGET_EVIDENCE_DIR
// Synthetic lands: each adds green and has a utility ability, so each beats a basic.
const land = (name: string, prices: ScryfallCard['prices']) =>
  fixtureCard(name, {
    type_line: 'Land',
    cmc: 0,
    mana_cost: '',
    color_identity: ['G'],
    produced_mana: ['G'],
    oracle_text: '{T}: Add {G}.\n{2}{G}, {T}: Create a 1/1 green Saproling creature token.',
    prices,
  })
const lands = [
  land('Budget Grove', { usd: '0.50' }),
  land('Pricey Grove', { usd: '300.00' }),
  land('Unpriced Grove', { usd: null }),
]
const spell = fixtureCard('Land fill spell')
const records = [...lands, ...baseCandidates]
// 90 cards at $1.00 each: commander, 30 basics and 59 spells, so 5 land slots remain.
const scenario = (overrides: Partial<PersistedDeckState>) =>
  makeState({
    deck: [
      toDeckCard(commander),
      ...Array.from({ length: 30 }, () => toDeckCard(basic)),
      ...Array.from({ length: 59 }, () => toDeckCard(spell)),
    ],
    queue: records.map((record) => toCard(record, 'Commander synergy')),
    ...overrides,
  })

if (evidence) await mkdir(evidence, { recursive: true })
await withBrowser('LAND_FILL_BUDGET', 5189, async (browser, base) => {
  const open = async (overrides: Partial<PersistedDeckState>) => {
    const opened = await openScenario(browser, base, scenario(overrides), [
      commander,
      basic,
      spell,
      ...records,
    ])
    const { page } = opened
    await page.locator('.basic-land-button, .land-fill-later button').first().click()
    const dialog = page.getByRole('dialog', { name: 'Choose lands', exact: true })
    await dialog.getByRole('heading', { name: 'Start with nonbasic lands' }).waitFor()
    const rows = dialog.locator('.nonbasic-land-list li')
    const rowText = async () =>
      (await rows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' '))
    return { ...opened, dialog, rows, rowText }
  }

  // A $100 budget leaves $10 after the $90 deck, so the $300 land is over budget.
  const budget = await open({ deckBudget: 100 })
  const reopen = async (dark: boolean) => {
    await budget.page.keyboard.press('Escape')
    await budget.dialog.waitFor({ state: 'detached' })
    await setDisplayPreferences(budget.page, { 'Dark mode': dark })
    await budget.page.locator('.basic-land-button, .land-fill-later button').first().click()
    await budget.dialog.getByRole('heading', { name: 'Start with nonbasic lands' }).waitFor()
  }
  if (evidence) {
    for (const dark of [false, true]) {
      await reopen(dark)
      for (const width of [1440, 390]) {
        await budget.page.setViewportSize({ width, height: 1000 })
        await budget.dialog.locator('.nonbasic-land-list').scrollIntoViewIfNeeded()
        await budget.dialog.screenshot({
          path: `${evidence}/${process.env.LAND_FILL_BUDGET_LABEL ?? 'after'}-budget-${dark ? 'dark' : 'light'}-${width}.png`,
        })
      }
    }
    await budget.page.setViewportSize({ width: 1440, height: 1000 })
    await reopen(false)
  }
  const budgetRows = await budget.rowText()
  assert.equal(budgetRows.length, 3, budgetRows.join('\n'))
  assert.match(budgetRows[0], /Budget Grove.*\$0\.50/)
  assert.doesNotMatch(budgetRows[0], /Over budget/)
  assert.match(budgetRows[1], /Unpriced Grove.*Unpriced/)
  assert.doesNotMatch(budgetRows[1], /Over budget/)
  // Over-budget lands wait behind the rest, as recommendations do, and say why.
  assert.match(budgetRows[2], /Pricey Grove.*\$300\.00.*Over budget/)
  assert.deepEqual(budget.errors, [])
  await budget.context.close()

  // Without a budget or price cap, every land is listed and priced.
  const open1 = await open({})
  const plain = await open1.rowText()
  assert.equal(plain.length, 3, plain.join('\n'))
  assert(plain.some((text) => /Pricey Grove.*\$300\.00/.test(text)))
  assert(!plain.some((text) => /Over budget/.test(text)))
  // Each price links to its seller, like recommendation offers.
  await open1.dialog.getByRole('link', { name: /\$300\.00/ }).waitFor()
  // Adding the over-budget land still works; the mark informs, it does not block.
  await button(open1.dialog, 'Add Pricey Grove to deck').click()
  await open1.page.locator('.deck-board').getByText('Pricey Grove').first().waitFor()
  assert.deepEqual(open1.errors, [])
  await open1.context.close()

  // A max price hides lands above it, as it hides recommendations.
  const capped = await open({ maxPrice: 5 })
  const cappedRows = await capped.rowText()
  assert.equal(cappedRows.length, 2, cappedRows.join('\n'))
  assert(!cappedRows.some((text) => /Pricey Grove/.test(text)))
  assert.deepEqual(capped.errors, [])
  await capped.context.close()
})
console.log('Land fill budget browser check passed')
