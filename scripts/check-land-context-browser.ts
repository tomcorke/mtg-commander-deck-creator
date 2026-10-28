import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { withBrowser, openScenario } from './fixtures/browser-harness.ts'
import { makeState, commander, basic, fixtureCard } from './fixtures/b10-browser.ts'
import { toDeckCard } from '../src/domain/card-model.ts'
import { setDisplayPreferences } from './browser-display.ts'
const evidence = process.env.LAND_EVIDENCE_DIR
const spell = fixtureCard('Land context spell')
const state = makeState({
  deck: [
    toDeckCard(commander),
    ...Array.from({ length: 40 }, () => toDeckCard(basic)),
    ...Array.from({ length: 59 }, () => toDeckCard(spell)),
  ],
})
if (evidence) await mkdir(evidence, { recursive: true })
await withBrowser('LAND_CONTEXT', 5187, async (browser, base) => {
  const { page, context } = await openScenario(browser, base, state, [commander, basic, spell])
  const panel = page.getByRole('region', { name: 'Land-drop context', exact: true })
  assert.match(await panel.innerText(), /Turn 4: Likely/)
  assert.doesNotMatch(await panel.innerText(), /72\.63/)
  await panel.getByText('About these likelihood labels').click()
  assert.match(await panel.innerText(), /60% to below 80%/)
  await panel.getByText('About these likelihood labels').click()
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page
        .getByRole('heading', { name: 'Land-drop context', exact: true })
        .scrollIntoViewIfNeeded()
      if (evidence)
        await page.screenshot({
          path: `${evidence}/after-${dark ? 'dark' : 'light'}-${width}.png`,
        })
    }
  }
  assert.equal(
    await page.getByRole('spinbutton', { name: 'Lands target', exact: true }).inputValue(),
    '35',
  )
  await page.getByRole('spinbutton', { name: 'Lands target', exact: true }).fill('43')
  assert.match(await panel.innerText(), /40 land opportunities/)
  assert.match(await panel.innerText(), /Turn 4: Likely/)
  await page.waitForFunction(() => {
    const raw = sessionStorage.getItem('commander-workspace-recovery')
    return raw !== null && JSON.parse(raw).state.deckTargets.lands === 43
  })
  await context.close()
  const partial = await openScenario(browser, base, makeState({ deck: state.deck.slice(0, 60) }), [
    commander,
    basic,
    spell,
  ])
  assert.match(
    await partial.page.getByRole('region', { name: 'Land-drop context', exact: true }).innerText(),
    /Provisional/,
  )
  await partial.context.close()
})
