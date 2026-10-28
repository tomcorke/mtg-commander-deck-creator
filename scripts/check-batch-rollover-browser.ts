import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { withBrowser, openScenario, button } from './fixtures/browser-harness.ts'
import { makeState } from './fixtures/b10-browser.ts'

await withBrowser('BATCH_ROLLOVER', 5253, async (browser, base) => {
  const { page, context, errors } = await openScenario(
    browser,
    base,
    makeState(),
    undefined,
    undefined,
    async (page) => {
      await page.addInitScript(() => localStorage.setItem('option:cardEffects', 'true'))
    },
  )
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  const positions = await copyPositions(page, '.card-offer > .card-copy')
  const names = await page.locator('.card-offer > .card-copy > h3').allTextContents()
  await button(page, 'Next recommendations').click()
  await page.waitForSelector('[data-card-reveal-phase="leaving"]')
  const outgoingPositions = await copyPositions(page, '.batch-old-copy')
  for (let index = 0; index < positions.length; index++) {
    for (const field of ['title', 'reason', 'description'] as const)
      assert(
        Math.abs(positions[index][field] - outgoingPositions[index][field]) < 0.5,
        `outgoing ${field} stays in place in slot ${index}`,
      )
  }
  assert.deepEqual(
    await page.locator('.batch-old-copy h3').allTextContents(),
    names,
    'outgoing names are retained',
  )
  assert(
    await page
      .locator('[data-batch-changing]')
      .evaluateAll((elements) => elements.every((element) => (element as HTMLElement).inert)),
    'new decisions are blocked while old cards are visible',
  )
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.finished-card[data-card-reveal]')]
    return (
      cards.length === 4 &&
      cards[0].getAttribute('data-card-reveal-phase') === 'entering' &&
      cards[3].getAttribute('data-card-reveal-phase') === 'leaving'
    )
  })
  assert.equal(
    await page
      .locator('.batch-old-copy')
      .first()
      .evaluate((element) => Number(getComputedStyle(element).opacity)),
    0,
    'old copy is gone before the first incoming turn',
  )
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  assert.equal(
    await page.locator('.batch-old-copy, [data-batch-changing], .card-reveal-shadow').count(),
    0,
    'all temporary state is removed',
  )
  assert.notDeepEqual(
    await page.locator('.card-offer > .card-copy > h3').allTextContents(),
    names,
    'new names remain after the roll',
  )
  await button(page, 'Next recommendations').click()
  await page.waitForSelector('[data-card-reveal-phase="leaving"]')
  await button(page, 'Display').click()
  await page.getByLabel('Motion and finishes', { exact: true }).uncheck()
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  assert.equal(
    await page.locator('.batch-old-copy, [data-batch-changing]').count(),
    0,
    'preference cancellation restores content and input',
  )
  await page.getByLabel('Motion and finishes', { exact: true }).check()
  await button(page, 'Display').click()
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  await checkCopyLayouts(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await button(page, 'Next recommendations').click()
  assert.equal(
    await page.locator('.card-reveal-canvas, .batch-old-copy').count(),
    0,
    'reduced motion skips outgoing and incoming animation',
  )
  assert.deepEqual(errors, [])
  await context.close()
  console.log('Outgoing/incoming overlap, text fades, interaction gating and cancellation passed.')
})

async function copyPositions(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const top = element.closest('.card-offer')!.getBoundingClientRect().top
      return {
        title: element.querySelector('h3')!.getBoundingClientRect().top - top,
        reason: element.querySelector('.offer-reason')!.getBoundingClientRect().top - top,
        description:
          element.querySelector('p:not(.offer-reason)')!.getBoundingClientRect().top - top,
      }
    }),
  )
}

async function checkCopyLayouts(page: Page) {
  for (const [dark, width] of [
    [true, 1440],
    [false, 390],
    [true, 390],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 })
    await button(page, 'Display').click()
    await page.getByLabel('Dark mode', { exact: true }).setChecked(dark)
    await button(page, 'Display').click()
    const before = await copyPositions(page, '.card-offer > .card-copy')
    await button(page, 'Next recommendations').click()
    await page.waitForSelector('[data-card-reveal-phase="leaving"]')
    const after = await copyPositions(page, '.batch-old-copy')
    assert(before.length > 0 && before.length === after.length)
    for (let index = 0; index < before.length; index++) {
      for (const field of ['title', 'reason', 'description'] as const)
        assert(
          Math.abs(before[index][field] - after[index][field]) < 0.5,
          `${field} stays anchored at width ${width}, dark ${dark}`,
        )
    }
    await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  }
}
