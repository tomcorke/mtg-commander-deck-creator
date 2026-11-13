// Known combos (#502): Deck review lists Commander Spellbook combos in the main deck and cards one
// away, credits the source, and changes how combos are framed by Power. Card names open details,
// "Show in deck" filters the deck list, and missing data says combos are not checked.
// DECK_COMBOS_SCREENSHOTS=<dir> also saves light, dark and 390px review evidence.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright-core'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { makeState } from './fixtures/b10-browser.ts'
import { withComboIndex } from './fixtures/combo-index.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.DECK_COMBOS_SCREENSHOTS
const combos = (page: Page) => page.locator('section.deck-review-combos')
const signal = (page: Page, label: string) =>
  page.locator('.deck-review-type-filter').filter({ hasText: label })

async function openReview(
  browser: Browser,
  base: string,
  power: string,
  { dark = false, width = 1440, index = true } = {},
) {
  const scenario = await openScenario(
    browser,
    base,
    makeState(),
    undefined,
    undefined,
    async (page) => {
      await page.addInitScript(
        (target) => localStorage.setItem('option:powerTarget', JSON.stringify(target)),
        power,
      )
      if (index) await withComboIndex()(page)
    },
  )
  const { page } = scenario
  await page.setViewportSize({ width, height: 1000 })
  if (dark) await setDisplayPreferences(page, { 'Dark mode': true })
  await button(page, 'Deck review').click()
  await combos(page).waitFor()
  return scenario
}

async function shoot(page: Page, name: string) {
  if (!output) return
  await combos(page).scrollIntoViewIfNeeded()
  await combos(page).screenshot({ path: join(output, `${name}-combos.png`) })
  const signals = page
    .locator('.deck-review-section')
    .filter({ hasText: 'Play experience signals' })
  await signals.screenshot({ path: join(output, `${name}-signals.png`) })
}

async function checkHigh(browser: Browser, base: string) {
  const { page, context, errors } = await openReview(browser, base, 'high')
  try {
    const section = combos(page)
    await section.getByText('2 in deck').waitFor()
    assert.match((await section.textContent()) ?? '', /High power treats combos as a way to win/)
    assert.equal(await section.locator('.deck-review-status.good').count(), 1)
    assert.equal(
      await section
        .getByRole('link', { name: 'Commander Spellbook', exact: true })
        .getAttribute('href'),
      'https://commanderspellbook.com/',
    )
    // Fewer cards first: the two-card combo, then the commander combo; the off-colour one is hidden.
    const rows = section.locator('.deck-review-combo')
    assert.equal(await rows.count(), 3)
    assert.match(
      (await rows.nth(0).textContent()) ?? '',
      /Infinite colored mana · Infinite card draw/,
    )
    assert.match((await rows.nth(1).textContent()) ?? '', /and 1 more/)
    assert.equal(
      await rows.nth(0).getByRole('link').getAttribute('href'),
      'https://commanderspellbook.com/combo/fixture-two/',
    )
    await section.getByText('Add one card to complete a combo (1)').waitFor()
    assert.match(
      (await rows.nth(2).textContent()) ?? '',
      /B10 Ramp draw.*completes 1 combo.*B10 Theme 1/,
    )
    assert.doesNotMatch((await section.textContent()) ?? '', /Red outsider/)

    assert.match((await signal(page, 'Two-card combos').textContent()) ?? '', /Two-card combos1/)
    assert.match((await signal(page, 'Win-the-game text').textContent()) ?? '', /0/)

    // A missing piece opens read-only details fetched by name.
    await button(rows.nth(2), 'Show details for B10 Ramp draw').click()
    const details = page.getByRole('dialog', { name: 'B10 Ramp draw' })
    await details.waitFor()
    await details.getByText('Card details').waitFor()
    await page.keyboard.press('Escape')
    await details.waitFor({ state: 'detached' })

    // Narrow layouts wrap rows instead of scrolling sideways.
    await page.setViewportSize({ width: 390, height: 1000 })
    const overflow = await section.evaluate(
      (element) =>
        element.scrollWidth -
        element.clientWidth +
        Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    assert.equal(overflow, 0, 'no horizontal overflow at 390px')
    await page.setViewportSize({ width: 1440, height: 1000 })

    await button(rows.nth(0), 'Show the 2 cards of this combo in the deck list').click()
    await page
      .locator('.deck-review-filter-status')
      .getByText('Combo: B10 Existing ramp A + B10 Last draw')
      .waitFor()
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }
}

async function checkCore(browser: Browser, base: string) {
  const { page, context, errors } = await openReview(browser, base, 'precon')
  try {
    const section = combos(page)
    await section.getByText('2 in deck').waitFor()
    assert.equal(await section.locator('.deck-review-status.attention').count(), 1)
    const text = (await section.textContent()) ?? ''
    assert.match(text, /Core power treats combos as a caution/)
    assert.match(text, /no intentional two-card infinite combos in Brackets 1–2/)
    assert.match(text, /Cards that would add a combo \(1\)/)
    assert.doesNotMatch(text, /is Bracket|in Bracket \d deck/)
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }
}

async function checkUnavailable(browser: Browser, base: string) {
  const { page, context, errors } = await openReview(browser, base, 'upgraded', { index: false })
  try {
    await combos(page).getByText('Combo data is unavailable right now').waitFor()
    assert.equal(await signal(page, 'Two-card combos').count(), 0)
    assert.match(
      (await page
        .locator('.deck-review-section')
        .filter({ hasText: 'Play experience' })
        .textContent()) ?? '',
      /they are unavailable/,
    )
    assert.deepEqual(errors, [])
  } finally {
    await context.close()
  }
}

await withBrowser('DECK_COMBOS', 5361, async (browser, base) => {
  await checkHigh(browser, base)
  await checkCore(browser, base)
  await checkUnavailable(browser, base)
  if (output)
    for (const [power, name] of [
      ['high', 'high'],
      ['precon', 'core'],
    ] as const)
      for (const [label, options] of [
        ['light', {}],
        ['dark', { dark: true }],
        ['narrow', { width: 390 }],
      ] as const) {
        const { page, context } = await openReview(browser, base, power, options)
        await combos(page).getByText('2 in deck').waitFor()
        await page.waitForTimeout(300)
        await shoot(page, `after-${name}-${label}`)
        await context.close()
      }
  console.log(
    'Deck review lists sourced Spellbook combos and one-card-away cards, framed by Power; missing data says combos are not checked.',
  )
})
