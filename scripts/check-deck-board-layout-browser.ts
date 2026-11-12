// Deck board layout (#499): List view leaves no column empty, and Tiles view never gives a
// one-card group a full-width row. DECK_BOARD_SCREENSHOTS=<dir> also saves review evidence.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser, Locator, Page } from 'playwright-core'
import { toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { baseCandidates, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.DECK_BOARD_SCREENSHOTS
const forest = fixtureCard('Forest', {
  type_line: 'Basic Land — Forest',
  cmc: 0,
  mana_cost: '',
  color_identity: ['G'],
  produced_mana: ['G'],
})
const typed = (prefix: string, type_line: string, count: number) =>
  Array.from({ length: count }, (_, index) =>
    fixtureCard(`Board ${prefix} ${index}`, { type_line, color_identity: ['G'] }),
  )
const planeswalker = typed('Walker', 'Legendary Planeswalker — Fixture', 1)
const deckFor = (parts: ScryfallCard[][]) => [commander, ...parts.flat()]
// The issue's 17-card deck: no Enchantments, Artifacts or other permanents.
const issueDeck = deckFor([
  planeswalker,
  typed('Creature', 'Creature — Elf', 6),
  typed('Sorcery', 'Sorcery', 2),
  typed('Instant', 'Instant', 2),
  typed('Land', 'Land', 2),
  Array.from({ length: 3 }, () => forest),
])
const fullDeck = deckFor([
  planeswalker,
  typed('Creature', 'Creature — Elf', 30),
  typed('Artifact', 'Artifact', 8),
  typed('Enchantment', 'Enchantment', 6),
  typed('Sorcery', 'Sorcery', 8),
  typed('Instant', 'Instant', 9),
  typed('Land', 'Land', 5),
  Array.from({ length: 32 }, () => forest),
])
const sideboard = typed('Side', 'Artifact', 2)
const decks = [
  ['commander-only', [commander]],
  ['issue-17', issueDeck],
  ['full-100', fullDeck],
] as const
assert.equal(issueDeck.length, 17)
assert.equal(fullDeck.length, 100)
const records = [
  ...new Map(
    [...baseCandidates, ...fullDeck, ...issueDeck, ...sideboard].map((card) => [card.name, card]),
  ).values(),
]

type Layout = {
  columnCount: number
  columns: { groups: string[]; height: number }[]
  groups: { name: string; entries: number; width: number }[]
  listWidth: number
  overflow: boolean
}

// List view is one flat list in CSS columns, so a column is the groups sharing a left edge.
const readLayout = (page: Page) =>
  page.locator('.deck-board .deck-list').evaluate((list): Layout => {
    const name = (group: Element) =>
      group.querySelector('h3')?.firstChild?.textContent?.trim() ?? ''
    const slots = [...list.querySelectorAll(':scope > .deck-board-slot')]
    const columns = new Map<number, { groups: string[]; height: number }>()
    for (const slot of slots) {
      const box = slot.getBoundingClientRect()
      const column = columns.get(Math.round(box.left)) ?? { groups: [], height: 0 }
      column.groups.push(name(slot))
      column.height += box.height
      columns.set(Math.round(box.left), column)
    }
    const listBox = list.getBoundingClientRect()
    return {
      columnCount: Number(getComputedStyle(list).columnCount) || 0,
      columns: [...columns.values()],
      groups: slots.map((slot) => ({
        name: name(slot),
        entries: slot.querySelectorAll('ol > li').length,
        width: slot.getBoundingClientRect().width,
      })),
      listWidth: listBox.width,
      overflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth ||
        slots.some((slot) => slot.getBoundingClientRect().right > listBox.right + 1),
    }
  })

const failures: string[] = []
const check = (ok: boolean, message: string) => {
  if (!ok) failures.push(message)
}
const viewToggle = (page: Page, view: 'List' | 'Tiles') =>
  button(page.getByRole('group', { name: 'Deck board view' }), view)
const isOpen = (details: Locator) =>
  details.evaluate((element) => (element as HTMLDetailsElement).open)

async function showView(page: Page, view: 'List' | 'Tiles') {
  await viewToggle(page, view).click()
  const tiles = view === 'Tiles' ? '.deck-list--tiles' : ':not(.deck-list--tiles)'
  await page.locator(`.deck-list${tiles}`).waitFor()
  await page.waitForTimeout(100)
}

function checkLayout(layout: Layout, state: string, tiles: boolean, width: number) {
  const columns = layout.columns.map(({ groups, height }) => [groups.join('+'), Math.round(height)])
  console.log(state, JSON.stringify(columns))
  check(!layout.overflow, `${state}: page scrolls horizontally`)
  if (!tiles)
    check(
      layout.columns.length === layout.columnCount,
      `${state}: ${layout.columnCount} columns but only ${layout.columns.length} hold groups`,
    )
  // A phone shows one group per row; wider boards let a one-card group share its row.
  if (!tiles || width < 1024) return
  for (const group of layout.groups.filter(({ entries }) => entries === 1))
    check(
      group.width < layout.listWidth / 2,
      `${state}: one-card ${group.name} spans ${Math.round(group.width)} of ${Math.round(layout.listWidth)}px`,
    )
}

// Re-placing groups must not remount them: a collapsed group stays collapsed, and the same
// element survives a view switch and a resize that rebalances the columns.
async function checkGroupsStayMounted(page: Page) {
  const creatures = page.locator('.deck-group-details', { hasText: 'Creatures' })
  await creatures.evaluate((details) => details.setAttribute('data-check-mounted', ''))
  await creatures.locator('summary').click()
  await showView(page, 'List')
  assert.equal(await isOpen(creatures), false)
  await page.setViewportSize({ width: 1024, height: 1000 })
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.deck-board .deck-list')!).columnCount === '3',
  )
  assert.equal(await isOpen(creatures), false)
  assert.equal(await page.locator('[data-check-mounted]').count(), 1, 'Creatures stays mounted')
  await creatures.locator('summary').click()
  assert.equal(await isOpen(creatures), true)
}

async function checkDeck(
  browser: Browser,
  base: string,
  [label, deck]: (typeof decks)[number],
  width: number,
  dark: boolean,
) {
  const { page, context, errors } = await openScenario(
    browser,
    base,
    makeState({
      deck: deck.map(toDeckCard),
      sideboard: label === 'full-100' ? sideboard.map(toDeckCard) : [],
    }),
    records,
  )
  await page.setViewportSize({ width, height: 1000 })
  if (dark) await setDisplayPreferences(page, { 'Dark mode': true })
  for (const view of ['List', 'Tiles'] as const) {
    await showView(page, view)
    const state = `${label} ${view} ${width}${dark ? ' dark' : ''}`
    checkLayout(await readLayout(page), state, view === 'Tiles', width)
    if (output)
      await page.locator('.deck-board').screenshot({
        path: join(output, `${label}-${view.toLowerCase()}-${width}${dark ? '-dark' : ''}.png`),
      })
  }
  if (label === 'issue-17' && width === 1366 && !dark) await checkGroupsStayMounted(page)
  assert.deepEqual(errors, [])
  await context.close()
}

await withBrowser('DECK_BOARD', 5247, async (browser, base) => {
  if (output) await mkdir(output, { recursive: true })
  for (const deck of decks)
    for (const [width, dark] of [
      [1366, false],
      [1024, false],
      [390, false],
      [1366, true],
    ] as const)
      if (output || !dark) await checkDeck(browser, base, deck, width, dark)
})
assert.deepEqual(failures, [], failures.join('\n'))
console.log('Deck board layout: no empty List column, one-card Tile groups share their row')
