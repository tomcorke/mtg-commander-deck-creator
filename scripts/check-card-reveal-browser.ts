import assert from 'node:assert/strict'
import { withBrowser, openScenario, button } from './fixtures/browser-harness.ts'
import { makeState } from './fixtures/b10-browser.ts'

await withBrowser('CARD_REVEAL', 5250, async (browser, base) => {
  const { page, context, errors } = await openScenario(
    browser,
    base,
    makeState(),
    undefined,
    undefined,
    async (page) => {
      await page.addInitScript(() => {
        localStorage.setItem('option:cardEffects', 'true')
        const events: { time: number; state: string | null; background: string }[] = []
        Object.assign(window, { revealEvents: events })
        new MutationObserver((records) => {
          for (const record of records)
            if (record.attributeName === 'data-card-reveal')
              events.push({
                time: performance.now(),
                background: getComputedStyle(record.target as Element).backgroundImage,
                state: (record.target as Element).getAttribute('data-card-reveal'),
              })
        }).observe(document, {
          subtree: true,
          attributes: true,
          attributeFilter: ['data-card-reveal'],
        })
      })
    },
  )
  await page.waitForFunction(() => {
    const events = (
      window as unknown as { revealEvents: { state: string | null; background: string }[] }
    ).revealEvents
    return (
      events.some((event) => event.state === 'flipping') &&
      events.filter((event) => event.state === null).length >= 4
    )
  })
  const events = await page.evaluate(
    () =>
      (
        window as unknown as {
          revealEvents: { time: number; state: string | null; background: string }[]
        }
      ).revealEvents,
  )
  assert(
    events.some(
      (event) => event.state === 'waiting' && event.background.includes('mtg-card-back.png'),
    ),
    'backs remain visible while loading',
  )
  assert(
    events
      .filter((event) => event.state === 'flipping')
      .every((event) => event.background === 'none'),
    'static back is removed behind rotating canvas',
  )
  const start = events.find((event) => event.state === 'flipping')!.time
  const ends = events.filter((event) => event.state === null).map((event) => event.time)
  assert(ends[0] - start >= 700 && ends[0] - start < 1000, 'first flip lasts about 750ms')
  for (let index = 1; index < 4; index++)
    assert(Math.abs(ends[index] - ends[index - 1] - 180) < 100, 'left-to-right 180ms stagger')
  await button(page, 'Display').click()
  const reveal = page.getByLabel('Card reveal animation', { exact: true })
  await reveal.uncheck()
  assert.equal(await page.evaluate(() => localStorage.getItem('option:cardReveals')), 'false')
  await reveal.check()
  await page.waitForSelector('.card-reveal-canvas')
  await page.getByLabel('Motion and finishes', { exact: true }).uncheck()
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  assert(await reveal.isDisabled(), 'motion switch disables reveal control')
  await page.getByLabel('Motion and finishes', { exact: true }).check()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await reveal.uncheck()
  await button(page, 'Display').click()
  assert.equal(await page.locator('.card-reveal-canvas').count(), 0)
  await button(page, 'Display').click()
  await page.getByLabel('Dark mode', { exact: true }).check()
  await button(page, 'Display').click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'narrow layout fits',
  )
  assert.deepEqual(errors, [])
  await context.close()
  console.log(
    'Batch reveal timing, stagger, saved preference, motion cancellation and reduced motion passed.',
  )
})
