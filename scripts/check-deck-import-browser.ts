import assert from 'node:assert/strict'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, makeState } from './fixtures/b10-browser.ts'

// Exercise the complete modal -> AppView -> action path, including the found-card retry.
await withBrowser('DECK_IMPORT', 5248, async (browser, base) => {
  for (const missing of [false, true]) {
    const scenario = await openScenario(browser, base, makeState())
    const { page } = scenario
    try {
      await button(page, 'Import deck').click()
      const dialog = page.getByRole('dialog', { name: 'Import deck', exact: true })
      await dialog
        .getByRole('textbox', { name: 'Exported deck list' })
        .fill(`1 ${commander.name}\n3 ${basic.name}${missing ? '\n1 Missing fixture card' : ''}`)
      assert.ok(await button(dialog, 'Import deck').isDisabled())
      await dialog.getByLabel('Commander', { exact: true }).selectOption(commander.name)
      await button(dialog, 'Import deck').click()
      await button(
        page.getByRole('dialog', { name: 'Replace the current deck?' }),
        'Import and replace',
      ).click()
      if (missing) await button(dialog, 'Import 4 found cards').click()
      await dialog.waitFor({ state: 'detached' })
      await page.waitForFunction(() => /^\*?4\/100 /.test(document.title))
      assert.deepEqual(scenario.errors, [], 'no page errors or unexpected native dialogs')
    } finally {
      await scenario.context.close()
    }
  }
  console.log(
    'Headerless import and missing-card retry preserve the selected commander through AppView.',
  )
})
