// `pnpm check:card-references:browser` fails when a rendered card name is plain text instead of
// the shared CardReference (docs/agents/ui.md). CARD_REFERENCES_URL may point at a running server.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import {
  button,
  heading,
  openLandFill,
  openScenario,
  openSetAside,
  withBrowser,
  withOwnedCards,
} from './fixtures/browser-harness.ts'
import { allRecords, baseCandidates, themeFirstState } from './fixtures/b10-browser.ts'
import { offerFixtureComboIndex, withComboIndex } from './fixtures/combo-index.ts'
import { landPlanGateRecords, landPlanGateState, upgraded } from './fixtures/land-plan.ts'

const allowed = [
  '.card-reference',
  // Form values, screen-reader-only and live status text.
  'textarea',
  'input',
  '.sr-only',
  '[role="status"]',
  // The commander title opens Card details itself; card details describe their own card.
  '.commander-name',
  '.card-details',
  // Saved deck names often contain the commander's name.
  '.saved-deck-details > b',
]
const byLength = (records: { name: string }[]) =>
  records.map(({ name }) => name).sort((a, b) => b.length - a.length)
const names = byLength(allRecords)
// Basic land types also appear inside type lines ("Land — Forest Island"), so Choose lands looks
// for its nonbasic and spell names across the dialog, and for basic names only in its basic rows.
const isBasic = ({ type_line }: { type_line: string }) => type_line.startsWith('Basic Land')
const landPlanNames = byLength(landPlanGateRecords.filter((record) => !isBasic(record)))
const basicNames = byLength(landPlanGateRecords.filter(isBasic))

async function bareNames(page: Page, screen: string, names: string[], scope = 'body') {
  const found = await page.evaluate(
    ({ names, allowed, scope }) => {
      const pathOf = (element: Element) => {
        const parts = []
        for (
          let node: Element | null = element;
          node && node !== document.body;
          node = node.parentElement
        )
          parts.unshift(
            node.tagName.toLowerCase() + (node.classList[0] ? `.${node.classList[0]}` : ''),
          )
        return parts.join(' > ')
      }
      const results: string[] = []
      for (const root of document.querySelectorAll(scope)) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement!
          const name = names.find((candidate) => node!.textContent!.includes(candidate))
          if (!name || parent.closest(allowed.join(',')) || !parent.checkVisibility()) continue
          results.push(`${name} in ${pathOf(parent)}`)
        }
      }
      return [...new Set(results)]
    },
    { names, allowed, scope },
  )
  return found.map((item) => `${screen}: ${item}`)
}

await withBrowser('CARD_REFERENCES', 5242, async (browser, base) => {
  const scenario = await openScenario(
    browser,
    base,
    themeFirstState(),
    undefined,
    undefined,
    async (page) => {
      await withOwnedCards(baseCandidates.map(({ name }) => name))(page)
      await withComboIndex(offerFixtureComboIndex)(page)
    },
  )
  const { page } = scenario
  const failures: string[] = []
  const check = async (screen: string) => failures.push(...(await bareNames(page, screen, names)))
  try {
    await page.locator('.health-lane .card-reference').first().waitFor()
    // A combo offer note names its deck pieces (#502).
    await page.locator('.card-offer .combo-offer').waitFor()
    await check('Builder')
    await openSetAside(page)
    await check('Later & ignored')
    await page.keyboard.press('Escape')
    await check('Builder with an undo')
    await button(page, 'Recommendation settings').click()
    await button(page, 'View or import owned cards').click()
    await page.locator('.owned-card-grid .card-reference').first().waitFor()
    await check('Owned cards')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await button(page, '+ Search & add cards').click()
    await page.getByPlaceholder('Card name or rules text').fill('B10')
    await button(page, 'Search cards').click()
    await page.locator('.card-reference').first().waitFor()
    await check('Card search')
    await button(page, 'Back to builder').click()
    await button(page, 'Deck review').click()
    await heading(page, 'Diagnose').waitFor()
    await page.locator('.deck-review-combo').first().waitFor()
    await check('Deck review: Diagnose')
    await button(page, '2 Choose changes').click()
    await check('Deck review: Choose changes')
    await page.keyboard.press('Escape')
    await button(page, 'Saved decks').click()
    await check('Saved decks')
    await page.keyboard.press('Escape')
    await page.goto(`${base}#start`)
    await button(page, 'Random commander').click()
    await page.locator('.random-commander-modal .card-reference').waitFor()
    await check('Random commander')
    assert.deepEqual(scenario.errors, [], 'no page errors or unexpected dialogs')
  } finally {
    await scenario.context.close()
  }
  // Choose lands (#589, #601) with picks, a held alternative and an over-budget land.
  const lands = await openScenario(
    browser,
    base,
    landPlanGateState,
    landPlanGateRecords,
    undefined,
    upgraded,
  )
  try {
    const dialog = await openLandFill(lands.page)
    await dialog.locator('.land-plan .doctor-card-status').waitFor()
    await dialog.locator('.land-price strong').waitFor()
    failures.push(...(await bareNames(lands.page, 'Choose lands', landPlanNames)))
    // Each basic row names its basic (#608); the rows must be there for the check to mean anything.
    const rows = dialog.locator('.basic-land-plan > li')
    assert.equal(await rows.count(), basicNames.length, 'a row for each fixture basic')
    failures.push(
      ...(await bareNames(
        lands.page,
        'Choose lands basic rows',
        basicNames,
        '.basic-land-plan > li',
      )),
    )
    assert.deepEqual(lands.errors, [], 'no page errors or unexpected dialogs')
  } finally {
    await lands.context.close()
  }
  assert.deepEqual(failures, [], `card names outside CardReference:\n${failures.join('\n')}`)
  console.log('Card reference gate passed.')
})
