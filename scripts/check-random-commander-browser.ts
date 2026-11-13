import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Route } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { commander, fixtureCard, themeFirstState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const second = fixtureCard('Random second commander', {
  ...commander,
  name: 'Random second commander',
  oracle_id: 'random-second',
  layout: 'transform',
  oracle_text: undefined,
  card_faces: [
    {
      type_line: commander.type_line,
      mana_cost: '{2}{G}',
      oracle_text: 'Sacrifice a creature: Draw a card.',
      image_uris: commander.image_uris,
    },
    {
      type_line: 'Creature',
      mana_cost: '',
      oracle_text: 'Whenever a creature dies, create a token.',
      image_uris: commander.image_uris,
    },
  ],
})
const blank = fixtureCard('Random simple commander', {
  ...commander,
  name: 'Random simple commander',
  oracle_id: 'random-simple',
  type_line: 'Legendary Creature',
  oracle_text: 'Vigilance',
})

// eslint-disable-next-line max-lines-per-function -- Sequential interaction states share one provider and browser session.
await withBrowser('RANDOM_COMMANDER', 5294, async (browser, base) => {
  let fail = false
  let held: Promise<void> | undefined
  let release: (() => void) | undefined
  const draws = [commander, second, blank]
  const queries: string[] = []
  async function randomRoute(route: Route) {
    const query = new URL(route.request().url()).searchParams.get('q')!
    queries.push(query)
    await held
    if (fail) return route.fulfill({ status: 503, json: {} })
    const card = draws.find((candidate) => !query.includes(`-oracleid:${candidate.oracle_id}`))!
    await route.fulfill({ json: card }).catch(() => undefined)
  }
  const scenario = await openScenario(
    browser,
    base,
    themeFirstState(),
    [commander, second, blank],
    undefined,
    async (page) => {
      await page.route('**/cards/random?*', randomRoute)
    },
  )
  const { page } = scenario
  const dialog = page.getByRole('dialog', { name: 'Random commander', exact: true })
  const open = async () => {
    await button(page, 'Random commander').click()
    await dialog.locator('.card-reference-name').waitFor()
    await button(dialog, 'Select and continue').waitFor({ state: 'visible' })
  }
  try {
    await page.goto(`${base}#start`)
    await heading(page, 'What do you want to play?').waitFor()
    await page
      .getByRole('textbox', { name: 'Search commanders', exact: true })
      .fill('Unmatched filter')
    await open()
    assert.equal(queries[0], 'is:commander legal:commander date<=today')
    assert.equal(await dialog.locator('.deck-card-description').innerText(), commander.oracle_text)
    // #486: the type line comes first; power/toughness follows the rules text on its own.
    assert.equal(await dialog.locator('.card-type-line').first().innerText(), commander.type_line)
    assert.equal(
      await dialog.locator('.card-power-toughness').textContent(),
      `Power and toughness ${commander.power}/${commander.toughness}`,
    )
    assert(await pressed('All commanders'), 'draws ignore filters by default')
    assert(await dialog.getByRole('listitem').filter({ hasText: 'Tokens' }).count())
    assert(
      await button(dialog, 'Cancel random commander').evaluate(
        (node) => node === document.activeElement,
      ),
    )
    await page.keyboard.press('Shift+Tab')
    assert(
      await button(dialog, 'Select and continue').evaluate(
        (node) => node === document.activeElement,
      ),
      'focus wraps',
    )
    await button(dialog, 'Re-roll').click()
    await dialog
      .getByRole('button', { name: `Show details for ${second.name}`, exact: true })
      .waitFor()
    assert(queries.at(-1)!.includes(`-oracleid:${commander.oracle_id}`))
    assert(
      (await dialog.locator('.deck-card-description').innerText()).includes(
        second.card_faces![1].oracle_text!,
      ),
    )
    assert(await dialog.getByRole('listitem').filter({ hasText: 'Sacrifice' }).count())
    await button(dialog, `Show details for ${second.name}`).focus()
    await page.locator('.card-image-preview:popover-open').waitFor()
    await button(dialog, `Show details for ${second.name}`).click()
    await page.getByRole('dialog', { name: second.name, exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await dialog.waitFor()
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    assert(
      await button(page, 'Random commander').evaluate((node) => node === document.activeElement),
    )
    assert.equal(
      await page.getByRole('textbox', { name: 'Search commanders', exact: true }).inputValue(),
      'Unmatched filter',
    )
    await open()
    await button(dialog, 'Cancel').click()
    await open()
    await page.locator('.modal-backdrop').click({ position: { x: 1, y: 1 } })
    await dialog.waitFor({ state: 'detached' })
    held = new Promise<void>((resolve) => {
      release = resolve
    })
    await button(page, 'Random commander').click()
    await dialog.getByRole('status').filter({ hasText: 'Finding' }).waitFor()
    assert(await button(dialog, 'Select and continue').isDisabled())
    await button(dialog, 'Cancel').click()
    release!()
    held = undefined
    fail = true
    await button(page, 'Random commander').click()
    await dialog.getByRole('alert').waitFor()
    assert(await button(dialog, 'Select and continue').isDisabled())
    fail = false
    await button(dialog, 'Re-roll').click()
    await dialog.locator('.card-reference-name').waitFor()
    await button(dialog, 'Cancel').click()
    draws.unshift(blank)
    await open()
    assert((await dialog.innerText()).includes('No themes identified'))
    await button(dialog, 'Cancel').click()
    draws.shift()
    await checkFilteredDraws()
    await renderLayouts()
    await button(dialog, 'Select and continue').click()
    await page.getByRole('heading', { name: 'How do you want to play?', exact: true }).waitFor()
    assert.equal(new URL(page.url()).hash, '#build')
    assert.deepEqual(scenario.errors, [], 'no browser exceptions')
  } finally {
    release?.()
    await scenario.context.close()
  }
  async function pressed(label: string) {
    return (await button(dialog, label).getAttribute('aria-pressed')) === 'true'
  }
  async function search(text: string) {
    await page.getByRole('textbox', { name: 'Search commanders', exact: true }).fill(text)
  }
  /** #486: "My filters" draws from the Start results, with an empty state when there are none. */
  async function checkFilteredDraws() {
    const output = process.env.RANDOM_COMMANDER_SCREENSHOTS
    await button(page, 'Clear filters').click()
    await open()
    assert.equal(await dialog.getByRole('group', { name: 'Draw from' }).count(), 0)
    await button(dialog, 'Cancel').click()
    await search('Unmatched filter')
    await open()
    let drawn = queries.length
    await button(dialog, 'My filters').click()
    await dialog.getByRole('heading', { name: 'No commanders match your filters' }).waitFor()
    assert(await pressed('My filters'))
    assert(await button(dialog, 'Re-roll').isDisabled())
    assert(await button(dialog, 'Select and continue').isDisabled())
    assert.equal(queries.length, drawn, 'filtered draws make no random request')
    if (output) await page.screenshot({ path: join(output, 'random-filters-empty.png') })
    await button(dialog, 'Draw from all commanders').click()
    await dialog.locator('.card-reference-name').waitFor()
    assert(await pressed('All commanders'))
    assert.equal(queries.length, drawn + 1)
    await button(dialog, 'Cancel').click()
    await search('Random')
    await page.locator('.commander-choose').first().waitFor()
    await open()
    drawn = queries.length
    await button(dialog, 'My filters').click()
    await dialog.locator('.card-reference-name').waitFor()
    const pool = [second.name, blank.name]
    const first = await dialog.locator('.card-reference-name').innerText()
    assert(pool.includes(first), `filtered draw ${first}`)
    assert((await dialog.innerText()).includes('from your 2 filtered results: Name: Random.'))
    if (output) await page.screenshot({ path: join(output, 'random-filters.png') })
    await button(dialog, 'Re-roll').click()
    await dialog.locator('.card-reference-name').waitFor()
    const next = await dialog.locator('.card-reference-name').innerText()
    assert(pool.includes(next) && next !== first, `re-roll changes ${first} to ${next}`)
    assert.equal(queries.length, drawn, 'filtered draws make no random request')
    await button(dialog, 'Cancel').click()
  }
  async function renderLayouts() {
    const output = process.env.RANDOM_COMMANDER_SCREENSHOTS
    if (output) await mkdir(output, { recursive: true })
    for (const dark of [false, true]) {
      await setDisplayPreferences(page, { 'Dark mode': dark })
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await open()
        assert(
          await dialog.evaluate((node) => node.scrollWidth === node.clientWidth),
          'dialog fits viewport',
        )
        await page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all(
            [...document.images].filter((img) => img.checkVisibility()).map((img) => img.decode()),
          )
        })
        if (output)
          await page.screenshot({
            path: join(output, `random-${dark ? 'dark' : 'light'}-${width}.png`),
          })
        await button(dialog, 'Cancel').click()
      }
    }
    await open()
  }
  console.log(
    'Random commander browser check passed: selection, re-roll, cancel, errors, focus and layouts.',
  )
})
