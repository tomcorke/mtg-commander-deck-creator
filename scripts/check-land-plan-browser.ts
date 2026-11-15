// #589: Choose lands opens with a role-grouped nonbasic plan, pre-selected and removable, and
// basics filling the rest. One confirm adds the whole plan.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import type { Page } from 'playwright-core'
import { openLandFill, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { setDisplayPreferences } from './browser-display.ts'

const evidence = process.env.LAND_PLAN_SCREENSHOTS
const label = process.env.LAND_PLAN_LABEL ?? 'after'

// Synthetic records exercise the planner; they make no claims about real cards.
const simic = { color_identity: ['G', 'U'] }
const planCommander = fixtureCard('Plan Commander', {
  ...simic,
  type_line: 'Legendary Creature — Elemental',
  cmc: 3,
  mana_cost: '{1}{G}{U}',
  power: '2',
  toughness: '3',
  oracle_text:
    'Landfall — Whenever a land you control enters, put a +1/+1 counter on this creature.',
})
const forest = fixtureCard('Forest', {
  type_line: 'Basic Land — Forest',
  cmc: 0,
  mana_cost: '',
  color_identity: ['G'],
  produced_mana: ['G'],
  prices: { usd: '0.10' },
})
const island = fixtureCard('Island', {
  type_line: 'Basic Land — Island',
  cmc: 0,
  mana_cost: '',
  color_identity: ['U'],
  produced_mana: ['U'],
  prices: { usd: '0.10' },
})
const greenSpell = fixtureCard('Plan green spell', {
  type_line: 'Creature — Elf',
  mana_cost: '{1}{G}',
  color_identity: ['G'],
})
const blueSpell = fixtureCard('Plan blue spell', {
  type_line: 'Instant',
  mana_cost: '{1}{U}',
  color_identity: ['U'],
})
const cultivate = fixtureCard('Plan Cultivate', {
  type_line: 'Sorcery',
  cmc: 3,
  mana_cost: '{2}{G}',
  color_identity: ['G'],
  oracle_text:
    'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
})
const land = (name: string, overrides: Partial<ScryfallCard>) =>
  fixtureCard(name, { type_line: 'Land', cmc: 0, mana_cost: '', ...overrides })
const lands = [
  land('Plan Shockland', {
    ...simic,
    type_line: 'Land — Forest Island',
    produced_mana: ['G', 'U'],
    oracle_text:
      '({T}: Add {G} or {U}.)\nAs this land enters, you may pay 2 life. If you don’t, it enters tapped.',
  }),
  land('Plan Tapped Dual', {
    ...simic,
    produced_mana: ['G', 'U'],
    oracle_text: 'This land enters tapped.\n{T}: Add {G} or {U}.',
  }),
  land('Plan Bounce Land', {
    ...simic,
    produced_mana: ['G', 'U'],
    oracle_text:
      'This land enters tapped.\nWhen this land enters, return a land you control to its owner’s hand.\n{T}: Add {G}{U}.',
  }),
  land('Plan Landfall Grove', {
    color_identity: ['G'],
    produced_mana: ['G'],
    oracle_text:
      '{T}: Add {G}.\n{2}{G}, {T}, Sacrifice this land: Search your library for a land card, put it onto the battlefield tapped, then shuffle.',
  }),
  land('Plan Saproling Grove', {
    color_identity: ['G'],
    produced_mana: ['G'],
    oracle_text: '{T}: Add {G}.\n{3}{G}, {T}: Create a 1/1 green Saproling creature token.',
  }),
  land('Plan Passage', {
    produced_mana: ['C'],
    oracle_text: '{T}: Add {C}.\n{4}, {T}: Target creature can’t be blocked this turn.',
  }),
  land('Plan Pricey Dual', {
    ...simic,
    type_line: 'Land — Forest Island',
    produced_mana: ['G', 'U'],
    oracle_text: '({T}: Add {G} or {U}.)',
    prices: { usd: '300.00' },
  }),
]
const records = [planCommander, forest, island, greenSpell, blueSpell, cultivate, ...lands]

// 80 cards at about $1 each: commander, 10 Forests, 10 Islands, Cultivate and 58 spells. A
// 38-land target leaves 18 land slots.
const state = makeState({
  commander: planCommander.name,
  commanderDetails: {
    images: [planCommander.image_uris!.normal],
    art: [planCommander.image_uris!.normal],
    colours: ['G', 'U'],
    printings: [[]],
    selections: [0],
  },
  theme: 'Counters',
  deck: [
    toDeckCard(planCommander),
    ...Array.from({ length: 10 }, () => toDeckCard(forest)),
    ...Array.from({ length: 10 }, () => toDeckCard(island)),
    toDeckCard(cultivate),
    ...Array.from({ length: 29 }, () => toDeckCard(greenSpell)),
    ...Array.from({ length: 29 }, () => toDeckCard(blueSpell)),
  ],
  queue: lands.map((record) => toCard(record, 'Lands')),
  deckTargets: { lands: 38, ramp: 0, draw: 0, removal: 0, wipes: 0 },
  deckBudget: 150,
})

const upgraded = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('option:powerTarget', JSON.stringify('upgraded')))

type Dialog = ReturnType<Page['getByRole']>

const openDialog = async (page: Page) => {
  const dialog = await openLandFill(page)
  await page.waitForTimeout(300)
  return dialog
}
const closeDialog = async (page: Page, dialog: Dialog) => {
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
}
const noSideScroll = (dialog: Dialog) =>
  dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)

/** Light and dark, desktop and 390px captures of the whole dialog. */
async function captureEvidence(page: Page, directory: string) {
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      // Tall enough that the whole dialog, confirm button included, fits one capture.
      await page.setViewportSize({ width, height: width < 600 ? 3600 : 2400 })
      const dialog = await openDialog(page)
      assert(await noSideScroll(dialog), `no horizontal scroll at ${width}px`)
      await dialog.screenshot({
        path: `${directory}/${label}-${dark ? 'dark' : 'light'}-${width}.png`,
      })
      await closeDialog(page, dialog)
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

/** The plan as opened: heuristic label, group order, pre-selection and reasons. */
async function assertPlan(dialog: Dialog) {
  // Reasons are labelled as a heuristic, like theme-fit reasons (#501).
  assert.equal(await dialog.locator('.land-plan .generic-pick-label').innerText(), 'Land plan')
  // Fill order: fixing, then the landfall role the commander earned, then utility.
  const groups = await dialog.locator('.land-plan-group h4').allInnerTexts()
  assert.deepEqual(
    groups.map((text) => text.toLowerCase()),
    ['fixing', 'landfall and land synergy', 'utility'],
  )
  const include = (name: string) =>
    dialog.getByRole('checkbox', { name: `Include ${name}`, exact: true })
  for (const name of [
    'Plan Shockland',
    'Plan Bounce Land',
    'Plan Tapped Dual',
    'Plan Landfall Grove',
    'Plan Saproling Grove',
    'Plan Passage',
  ])
    assert.equal(await include(name).isChecked(), true, name)
  // Over budget: listed last in its group, unticked and marked.
  assert.equal(await include('Plan Pricey Dual').isChecked(), false)
  const pricey = dialog.locator('.card-tile', { hasText: 'Plan Pricey Dual' })
  assert.match(await pricey.innerText(), /Over budget/)
  // Each reason quotes the matched text and, for an earned role, the deck evidence.
  const landfall = dialog.locator('.card-tile', { hasText: 'Plan Landfall Grove' })
  assert.match(await landfall.innerText(), /Your commander: “Landfall/)
  return include
}

if (evidence) await mkdir(evidence, { recursive: true })
await withBrowser('LAND_PLAN', 5191, async (browser, base) => {
  const opened = await openScenario(browser, base, state, records, undefined, upgraded)
  const { page } = opened
  if (evidence) await captureEvidence(page, evidence)
  assert.deepEqual(opened.errors, [])
  if (label === 'before') return

  // The narrow layout never scrolls sideways, screenshots or not.
  await page.setViewportSize({ width: 390, height: 900 })
  const narrow = await openDialog(page)
  assert(await noSideScroll(narrow), 'no horizontal scroll at 390px')
  await closeDialog(page, narrow)
  await page.setViewportSize({ width: 1440, height: 1000 })

  const dialog = await openDialog(page)
  const include = await assertPlan(dialog)
  const status = dialog.locator('.basic-land-balance p')
  assert.equal(await status.innerText(), 'All 12 basics assigned')
  // Unticking gives the slot back to basics, live.
  await include('Plan Passage').uncheck()
  assert.equal(await status.innerText(), 'All 13 basics assigned')
  await dialog.getByRole('button', { name: 'Add 18 lands', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  const board = page.locator('.deck-board')
  for (const name of ['Plan Shockland', 'Plan Landfall Grove', 'Plan Saproling Grove'])
    await board.getByText(name, { exact: true }).first().waitFor()
  assert.equal(await board.getByText('Plan Passage', { exact: true }).count(), 0)
  assert.equal(await board.getByText('Plan Pricey Dual', { exact: true }).count(), 0)
  // 80 cards plus 5 nonbasics and 13 basics.
  assert.equal(await page.locator('.narrow-deck-bar').textContent(), '98/100 cards')
  assert.deepEqual(opened.errors, [])
})
console.log('Land plan browser check passed')
