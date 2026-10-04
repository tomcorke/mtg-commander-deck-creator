import assert from 'node:assert/strict'
import { setDisplayPreferences } from './browser-display.ts'
import childProcess from 'node:child_process'
import { chromium } from 'playwright-core'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { defaultDeckTargets } from '../src/deck-analysis.ts'
import { persistedDeckStateSchema } from '../src/deck-state.ts'

const originalSpawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? originalSpawn(command, args, { ...options, windowsHide: true })
    : originalSpawn(command, { ...args, windowsHide: true })) as typeof childProcess.spawn
const img = 'https://cards.scryfall.io/normal/front/test.jpg'
const card = (name: string): ScryfallCard => ({
  name,
  type_line: 'Legendary Creature — Human',
  cmc: 3,
  mana_cost: '{3}',
  color_identity: [],
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: '1',
  oracle_id: name,
  prints_search_uri: `https://api.scryfall.com/cards/search?q=${name}`,
  image_uris: { normal: img },
})
const leader = card('Browser Commander')
const saved = persistedDeckStateSchema.parse({
  commander: leader.name,
  commanderDetails: { images: [img], art: [img], colours: [], printings: [[]], selections: [0] },
  theme: '',
  recommendationStyle: 'balanced',
  queue: Array.from({ length: 4 }, (_, i) => toCard(card(`Candidate ${i}`), 'test')),
  limitedRecommendations: false,
  decisions: {},
  ignoredCards: [],
  liked: [],
  activeSubThemes: [],
  dismissedSubThemes: [],
  preferenceScores: {},
  commanderSubThemes: [],
  deferredCards: [],
  batchNumber: 1,
  deck: [toDeckCard(leader), toDeckCard(card('A card'))],
  sideboard: [],
  preferredPrintSet: '',
  deckTargets: defaultDeckTargets,
})
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  chromiumSandbox: true,
  args: ['--enable-automation'],
})
try {
  const cdp = await browser.newBrowserCDPSession()
  assert.equal(
    (await cdp.send('Browser.getBrowserCommandLine')).arguments.includes('--no-sandbox'),
    false,
  )
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    if (url.hostname === 'cards.scryfall.io')
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      })
    if (url.hostname === 'api.scryfall.com')
      return route.fulfill({
        json:
          url.pathname === '/sets'
            ? { data: [] }
            : url.pathname === '/cards/search'
              ? { data: [], has_more: false }
              : { data: [] },
      })
    if (url.hostname === 'json.edhrec.com')
      return route.fulfill({ json: { container: { json_dict: { cardlists: [] } } } })
    return route.fulfill({ status: 204, body: '' })
  })
  await page.addInitScript((state) => {
    localStorage.clear()
    localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state }))
    localStorage.setItem('option:darkMode', 'false')
    localStorage.setItem('option:commanderStyling', 'false')
  }, saved)
  await page.goto(`${process.env.A15_URL ?? 'http://127.0.0.1:5235/'}#build`)
  await page.getByRole('heading', { name: 'Deck overview', exact: true }).waitFor()
  const opener = page.getByRole('button', { name: 'Recommendation settings', exact: true })
  const checkHelpGeometry = async (width: number, dark: boolean) => {
    await page.setViewportSize({ width, height: 950 })
    await setDisplayPreferences(page, { 'Dark mode': dark })
    await opener.click()
    const settings = page.getByRole('dialog', { name: 'Recommendation settings' })
    const triggers = settings.locator('.setting-help-button')
    assert.equal(await triggers.count(), 10, 'all ten setting help triggers render')
    const focusable = settings.locator(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary',
    )
    await settings.getByRole('button', { name: 'Close recommendation settings' }).focus()
    for (let index = 0; index < (await triggers.count()); index++) {
      const trigger = triggers.nth(index)
      const limit = await focusable.count()
      for (let tab = 0; tab < limit; tab++) {
        if (await trigger.evaluate((el) => el === document.activeElement)) break
        await page.keyboard.press('Tab')
      }
      assert.equal(
        await trigger.evaluate((el) => el === document.activeElement),
        true,
        `Tab reaches help ${await trigger.getAttribute('aria-label')} at ${width}px`,
      )
      const id = await trigger.getAttribute('aria-describedby')
      assert.ok(id)
      const tip = settings.locator(`#${id}`)
      assert.equal(await tip.evaluate((el) => getComputedStyle(el).visibility), 'visible')
      const [tipBox, triggerBox, modalBox] = await Promise.all([
        tip.boundingBox(),
        trigger.boundingBox(),
        settings.boundingBox(),
      ])
      const labelBox = await trigger.evaluate((el) => {
        const group = el.closest(
          '.recommendation-setting, .recommendation-setting-toggle, .collection-mode-setting, legend',
        )
        const label = group?.querySelector('label, legend > span:not(.setting-help-wrap)')
        return label?.getBoundingClientRect().toJSON() ?? null
      })
      assert.ok(
        tipBox && triggerBox && modalBox && labelBox,
        `measured tooltip, label and trigger: ${await trigger.getAttribute('aria-label')}`,
      )
      assert.ok(
        tipBox.x >= modalBox.x &&
          tipBox.y >= modalBox.y &&
          tipBox.x + tipBox.width <= modalBox.x + modalBox.width &&
          tipBox.y + tipBox.height <= modalBox.y + modalBox.height,
        `tooltip inside ${width}px ${dark ? 'dark' : 'light'} modal: ${await trigger.getAttribute('aria-label')} ${JSON.stringify({ tipBox, modalBox })}`,
      )
      const overlaps = (
        a: { x: number; y: number; width: number; height: number },
        b: { x: number; y: number; width: number; height: number },
      ) =>
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
      assert.equal(
        overlaps(tipBox, labelBox),
        false,
        `tooltip does not cover setting label: ${await trigger.getAttribute('aria-label')}`,
      )
      assert.equal(
        overlaps(tipBox, triggerBox),
        false,
        `tooltip does not cover help trigger: ${await trigger.getAttribute('aria-label')}`,
      )
    }
    await page.keyboard.press('Escape')
    await settings.waitFor({ state: 'detached' })
  }
  for (const width of [1440, 1024, 768, 390]) {
    await checkHelpGeometry(width, false)
    await checkHelpGeometry(width, true)
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 390, height: 844 })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Recommendation settings' })
  const help = dialog.getByRole('button', { name: 'Explain Priority' })
  await dialog.getByRole('button', { name: 'Close recommendation settings' }).focus()
  for (let i = 0; i < 5 && !(await help.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab')
  assert.equal(
    await help.evaluate((el) => el === document.activeElement),
    true,
    'Tab reaches help trigger',
  )
  assert.notEqual(
    await help.evaluate((el) => getComputedStyle(el).outlineStyle),
    'none',
    'focus indicator visible',
  )
  const id = await help.getAttribute('aria-describedby')
  assert.ok(id)
  const tip = dialog.locator(`#${id}`)
  assert.equal(await tip.getAttribute('role'), 'tooltip')
  assert.equal(await tip.evaluate((el) => getComputedStyle(el).visibility), 'visible')
  const [tipBox, modalBox] = await Promise.all([tip.boundingBox(), dialog.boundingBox()])
  assert.ok(
    tipBox &&
      modalBox &&
      tipBox.x >= modalBox.x &&
      tipBox.x + tipBox.width <= modalBox.x + modalBox.width,
    'tooltip stays inside modal at 390px',
  )
  const text = await dialog.innerText()
  assert.match(text, /Exclude tutors \(preference\)/)
  assert.match(text, /Exclude extra turns \(preference\)/)
  const focusable = dialog.locator(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary',
  )
  const firstFocusable = focusable.first()
  const lastFocusable = focusable.last()
  await firstFocusable.focus()
  await page.keyboard.press('Shift+Tab')
  assert.equal(
    await lastFocusable.evaluate((el) => el === document.activeElement),
    true,
    'Shift+Tab wraps to dialog end',
  )
  await page.keyboard.press('Tab')
  assert.equal(
    await firstFocusable.evaluate((el) => el === document.activeElement),
    true,
    'Tab wraps to dialog start',
  )
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert.equal(
    await opener.evaluate((el) => el === document.activeElement),
    true,
    'Escape restores opener focus',
  )
  await setDisplayPreferences(page, { 'Dark mode': true })
  const darkOpener = page.getByRole('button', { name: 'Recommendation settings', exact: true })
  await darkOpener.click()
  const darkDialog = page.getByRole('dialog', { name: 'Recommendation settings' })
  const darkHelp = darkDialog.getByRole('button', { name: 'Explain Priority' })
  await darkHelp.focus()
  assert.ok(
    (await darkDialog
      .locator('.dark')
      .count()
      .then((count) => count > 0)) || (await page.locator('main.dark').count()),
    'dark theme is active',
  )
  const darkTip = darkDialog.locator(`#${await darkHelp.getAttribute('aria-describedby')}`)
  const [darkTipBox, darkModalBox] = await Promise.all([
    darkTip.boundingBox(),
    darkDialog.boundingBox(),
  ])
  assert.ok(
    darkTipBox &&
      darkModalBox &&
      darkTipBox.x >= darkModalBox.x &&
      darkTipBox.x + darkTipBox.width <= darkModalBox.x + darkModalBox.width,
    'dark tooltip stays in modal at 390px',
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Export deck', exact: true }).click()
  const exportDialog = page.getByRole('dialog', { name: 'Copy your deck list' })
  assert.match(await exportDialog.innerText(), /This 1-card mainboard list omits your commander/)
  assert.match(await exportDialog.innerText(), /set Browser Commander as your commander/)
  assert.doesNotMatch(await exportDialog.innerText(), /Moxfield cannot import/i)
  assert.deepEqual(errors, [])
  console.log(
    `A15 browser gate passed: Chrome ${browser.version()}, sandbox enabled; all 10 help triggers keyboard-checked at 1440/1024/768/390px in light/dark, plus preference/export copy and dialog focus behavior.`,
  )
  await context.close()
} finally {
  await browser.close()
}
