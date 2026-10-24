// `pnpm check:card-references:browser` fails when a rendered card name is plain text instead of
// the shared CardReference (docs/agents/ui.md). CARD_REFERENCES_URL may point at a running server.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { allRecords, makeState } from './fixtures/b10-browser.ts'

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
const names = allRecords.map(({ name }) => name).sort((a, b) => b.length - a.length)

async function bareNames(page: Page, screen: string) {
  const found = await page.evaluate(
    ({ names, allowed }) => {
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
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const results: string[] = []
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!
        const name = names.find((candidate) => node!.textContent!.includes(candidate))
        if (!name || parent.closest(allowed.join(',')) || !parent.checkVisibility()) continue
        results.push(`${name} in ${pathOf(parent)}`)
      }
      return [...new Set(results)]
    },
    { names, allowed },
  )
  return found.map((item) => `${screen}: ${item}`)
}

await withBrowser('CARD_REFERENCES', 5242, async (browser, base) => {
  const scenario = await openScenario(browser, base, makeState())
  const { page } = scenario
  const failures: string[] = []
  const check = async (screen: string) => failures.push(...(await bareNames(page, screen)))
  try {
    await check('Builder')
    await button(page, '+ Search & add cards').click()
    await page.getByPlaceholder('Any name').fill('B10')
    await button(page, 'Search cards').click()
    await page.locator('.card-reference').first().waitFor()
    await check('Card search')
    await button(page, 'Back to builder').click()
    await button(page, 'Deck review').click()
    await heading(page, 'Diagnose').waitFor()
    await check('Deck review: Diagnose')
    await button(page, '2 Choose changes').click()
    await check('Deck review: Choose changes')
    await page.keyboard.press('Escape')
    await button(page, 'Saved decks').click()
    await check('Saved decks')
    await page.keyboard.press('Escape')
    assert.deepEqual(scenario.errors, [], 'no page errors or unexpected dialogs')
  } finally {
    await scenario.context.close()
  }
  assert.deepEqual(failures, [], `card names outside CardReference:\n${failures.join('\n')}`)
  console.log('Card reference gate passed.')
})
