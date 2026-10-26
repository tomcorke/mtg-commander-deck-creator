// `pnpm check:contrast:browser` fails when visible text on the main screens and dialogs falls
// below WCAG AA (4.5:1, or 3:1 for large text) in light, dark and commander-themed states.
// CONTRAST_URL may point at a running server.
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { setDisplayPreferences } from './browser-display.ts'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { makeState } from './fixtures/b10-browser.ts'

// These run in the page: self-contained, installed by `lowContrast` through a script tag.
// Paint layers in order so alpha and color-mix() resolve exactly as the browser composites.
function composite(layers: string[]) {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  for (const layer of ['#fff', ...layers]) {
    context.fillStyle = layer
    context.fillRect(0, 0, 1, 1)
  }
  return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
}
function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Background layers from the nearest opaque one inward, or null over an image (WCAG-exempt). */
function backgroundLayers(element: Element) {
  const layers: string[] = []
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    const { backgroundImage, backgroundColor } = getComputedStyle(ancestor)
    if (backgroundImage !== 'none') return null
    if (backgroundColor !== 'rgba(0, 0, 0, 0)') layers.unshift(backgroundColor)
    if (/^rgb\(|\/ 1\)$/.test(backgroundColor)) break
  }
  return layers
}
function textFailure(node: Node) {
  const element = node.parentElement!
  if (!node.textContent!.trim() || !element.checkVisibility({ opacityProperty: true })) return
  // WCAG exempts disabled controls.
  if (element.closest(':disabled, [aria-disabled="true"], .sr-only')) return
  const layers = backgroundLayers(element)
  if (!layers) return
  const style = getComputedStyle(element)
  const background = composite(layers)
  const text = composite([...layers, style.color])
  const [light, dark] = [luminance(text), luminance(background)].sort((a, b) => b - a)
  const ratio = (light + 0.05) / (dark + 0.05)
  const size = parseFloat(style.fontSize)
  const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
  if (ratio >= (large ? 3 : 4.5)) return
  const hex = (rgb: number[]) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('')
  const label = [element.tagName.toLowerCase(), ...element.classList].join('.')
  return `${label} "${node.textContent!.trim().slice(0, 30)}" ${ratio.toFixed(2)}:1 (${hex(text)} on ${hex(background)})`
}
function textFailures() {
  const walker = document.createTreeWalker(
    // Text behind an open dialog sits under its backdrop; check only the dialog.
    [...document.querySelectorAll('[aria-modal="true"]')].at(-1) ?? document.body,
    NodeFilter.SHOW_TEXT,
  )
  const results = new Set<string>()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const failure = textFailure(node)
    if (failure) results.add(failure)
  }
  return [...results]
}

async function lowContrast(page: Page, screen: string) {
  // Measure settled colours, not a theme switch or hover transition midway.
  await page.addStyleTag({ content: '*, ::before, ::after { transition: none !important; }' })
  await page.addScriptTag({
    content: [composite, luminance, backgroundLayers, textFailure, textFailures].join('\n'),
  })
  const found = await page.evaluate(() => (window as any).textFailures() as string[])
  return found.map((item) => `${screen}: ${item}`)
}

const themes = [
  { name: 'light', values: { 'Dark mode': false, 'Commander art and colours': false } },
  { name: 'dark', values: { 'Dark mode': true, 'Commander art and colours': false } },
  { name: 'light themed', values: { 'Dark mode': false, 'Commander art and colours': true } },
  { name: 'dark themed', values: { 'Dark mode': true, 'Commander art and colours': true } },
] as const

await withBrowser('CONTRAST', 5243, async (browser, base) => {
  const failures: string[] = []
  for (const theme of themes) {
    const scenario = await openScenario(browser, base, makeState())
    const { page } = scenario
    const check = async (screen: string) =>
      failures.push(...(await lowContrast(page, `${theme.name} ${screen}`)))
    // Shared dialogs mount beside each full-page mode's <main>, so check them from every mode.
    const checkDialogs = async (screen: string) => {
      await button(page, 'Saved decks').click()
      await heading(page, 'Drafts and saved decks').waitFor()
      await check(`${screen} > Saved decks`)
      await page.keyboard.press('Escape')
      await button(page, 'Export deck').click()
      await check(`${screen} > Export`)
      await button(page, 'Close export').click()
    }
    try {
      await setDisplayPreferences(page, theme.values)
      await check('Builder')
      // A manual save adds the second row type next to the current autosaved draft.
      await button(page, 'Saved decks').click()
      await page.getByRole('textbox', { name: 'Deck name' }).fill('Contrast check')
      await button(page, 'Save deck').click()
      await page.locator('.saved-deck-list article').nth(1).waitFor()
      await page.keyboard.press('Escape')
      await checkDialogs('Builder')
      await button(page, '+ Search & add cards').click()
      await page.getByPlaceholder('Any name').fill('B10')
      await button(page, 'Search cards').click()
      await page.locator('.card-reference').first().waitFor()
      await check('Card search')
      await checkDialogs('Card search')
      await button(page, 'Back to builder').click()
      await button(page, 'Deck review').click()
      await heading(page, 'Diagnose').waitFor()
      await check('Deck review: Diagnose')
      await checkDialogs('Deck review')
      await button(page, '2 Choose changes').click()
      await check('Deck review: Choose changes')
      await page.keyboard.press('Escape')
      await page.setViewportSize({ width: 390, height: 900 })
      await check('Narrow builder')
      await checkDialogs('Narrow builder')
      await page.goto(`${base}#start`)
      await heading(page, 'What do you want to play?').waitFor()
      await check('Narrow start')
      await page.setViewportSize({ width: 1440, height: 1000 })
      await check('Start')
      await button(page, 'Import deck').click()
      await check('Start > Import')
      assert.deepEqual(scenario.errors, [], 'no page errors or unexpected dialogs')
    } finally {
      await scenario.context.close()
    }
  }
  assert.deepEqual(failures, [], `text below WCAG AA contrast:\n${failures.join('\n')}`)
  console.log('Contrast gate passed.')
})
