import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { withBrowser, openScenario } from './fixtures/browser-harness.ts'
import { makeState, fixtureCard } from './fixtures/b10-browser.ts'

const output = join(tmpdir(), 'issue-606-evidence')
await mkdir(output, { recursive: true })
await withBrowser('CARD_VIEW_ERROR', 5298, async (browser, base) => {
  const { page, context, errors } = await openScenario(browser, base, makeState())
  const diagnostics: string[] = []
  page.on('console', (message) => {
    if (message.text().startsWith('Card view render failed')) diagnostics.push(message.text())
  })
  const saved = await page.evaluate(() => localStorage.getItem('commander-deck-state'))
  for (const dark of [false, true]) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.reload()
      await page.locator('.deck-board').waitFor()
      await page.getByRole('button', { name: 'Display', exact: true }).click()
      await page.getByLabel('Dark mode', { exact: true }).setChecked(dark)
      await page.getByRole('button', { name: 'Display', exact: true }).click()
      assert.equal(
        await page.locator('#root > div').evaluate((el) => el.classList.contains('dark')),
        dark,
      )
      await page.screenshot({ path: join(output, `before-${dark}-${width}.png`) })
      for (const failure of ['details', 'conversion']) {
        await page.evaluate(
          async ({ raw, failure }) => {
            const reactPath = '/node_modules/.vite/deps/react.js'
            const domPath = '/node_modules/.vite/deps/react-dom_client.js'
            const viewPath = '/src/app/AppView.tsx'
            const { createElement: h } = (await import(reactPath)).default
            const { createRoot } = (await import(domPath)).default
            const { DeckCardModalView } = await import(viewPath)
            const host = document.createElement('div')
            document.querySelector('#root > div')!.append(host)
            const root = createRoot(host)
            const broken = { ...raw }
            Object.defineProperty(broken, 'type_line', {
              get() {
                throw new Error('PRIVATE DECK CONTENT')
              },
            })
            const selected = { name: 'Broken details' }
            Object.defineProperty(selected, 'name', {
              get() {
                throw new Error('PRIVATE DECK CONTENT')
              },
            })
            const state = {
              showDeckCard: true,
              selectedManualCard: failure === 'conversion' ? raw : null,
              manualPrintings: [broken],
              selectedDeckCard: selected,
              selectedDeckCardIsCommander: true,
              selectedCollectionCard: null,
              collectionMode: 'none',
              collectionSets: [],
              deck: [],
              sideboard: [],
            }
            root.render(
              h(DeckCardModalView, {
                state,
                builderData: {},
                actions: {
                  closeDeckCard() {
                    root.unmount()
                    host.remove()
                  },
                },
              }),
            )
          },
          { raw: fixtureCard('Manual fixture'), failure },
        )
        const fallback = page.getByRole('dialog', { name: 'Unable to show card details' })
        await fallback.waitFor()
        assert(await page.locator('.deck-board').isVisible(), 'builder remains mounted')
        assert(await fallback.evaluate((el) => el.scrollWidth <= el.clientWidth), 'fallback fits')
        await page.screenshot({ path: join(output, `after-${failure}-${dark}-${width}.png`) })
        if (failure === 'details') await page.keyboard.press('Escape')
        else await fallback.getByRole('button', { name: 'Close card details', exact: true }).click()
        await fallback.waitFor({ state: 'detached' })
        await page.locator('.deck-board .deck-card-name').first().click()
        await page.locator('.deck-card-modal').waitFor()
        await page.keyboard.press('Escape')
      }
    }
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('commander-deck-state')), saved)
  assert.equal(diagnostics.length, 8)
  assert(diagnostics.every((message) => !message.includes('PRIVATE DECK CONTENT')))
  assert.deepEqual(errors, [])
  await context.close()
  console.log(
    `Boundary, render conversion, dismissal, reopening and deck preservation passed. Evidence: ${output}`,
  )
})
