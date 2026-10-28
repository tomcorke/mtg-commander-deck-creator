import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { withBrowser, openScenario, button } from './fixtures/browser-harness.ts'
import { makeState } from './fixtures/b10-browser.ts'

await withBrowser('CARD_REVEAL', 5250, async (browser, base) => {
  const { page, context, errors } = await openScenario(
    browser,
    base,
    makeState(),
    undefined,
    undefined,
    instrumentReveal,
  )
  await page.waitForFunction(() => {
    const events = (
      window as unknown as {
        revealEvents: { state: string | null; background: string; shadow: string }[]
      }
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
          revealEvents: { time: number; state: string | null; background: string; shadow: string }[]
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
  const cornerAlphas = await readCornerAlphas(page)
  const visualFailures = []
  if (
    !events.filter((event) => event.state === 'flipping').every((event) => event.shadow === 'none')
  )
    visualFailures.push('Static card shadow remains during flip')
  if (!cornerAlphas.every((pixel) => pixel.corner === 0 && pixel.centre === 255))
    visualFailures.push(`Square WebGL corners: ${JSON.stringify(cornerAlphas)}`)
  assert.deepEqual(visualFailures, [])
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
  await reveal.check()
  await page.waitForSelector('.card-reveal-canvas')
  assert(
    await page
      .locator('[data-card-reveal]')
      .evaluateAll((elements) =>
        elements.every((element) => getComputedStyle(element).boxShadow === 'none'),
      ),
    'dark-mode glow is hidden throughout reveal',
  )
  await button(page, 'Display').click()
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  await checkShadowReturn(page)
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

async function instrumentReveal(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('option:cardEffects', 'true')
    const events: { time: number; state: string | null; background: string; shadow: string }[] = []
    Object.assign(window, { revealEvents: events })
    new MutationObserver((records) => {
      for (const record of records)
        if (record.attributeName === 'data-card-reveal')
          events.push({
            time: performance.now(),
            background: getComputedStyle(record.target as Element).backgroundImage,
            shadow: getComputedStyle(record.target as Element).boxShadow,
            state: (record.target as Element).getAttribute('data-card-reveal'),
          })
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-card-reveal'],
    })
  })
}

async function readCornerAlphas(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/shared/foil/foil-shader.ts'
    const { createFoilRenderer } = (await import(
      modulePath
    )) as typeof import('../src/shared/foil/foil-shader.ts')
    const canvas = Object.assign(document.createElement('canvas'), { width: 400, height: 560 })
    const source = Object.assign(document.createElement('canvas'), { width: 400, height: 560 })
    const context = source.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, 400, 560)
    const image = new Image()
    image.src = source.toDataURL()
    await image.decode()
    const renderer = createFoilRenderer(canvas)!
    renderer.setImage(image)
    const gl = canvas.getContext('webgl')!
    const pixels = []
    for (const angle of [0, 0.65, Math.PI - 0.65, Math.PI]) {
      renderer.render(0, { x: 0.5, y: 0.5 }, 0, angle, 0.8)
      const w = 1 + 0.99 * Math.sin(angle) * 0.22
      const x = Math.floor((1 - (0.99 * Math.cos(angle) * 0.8) / w) * 200)
      const y = Math.floor((1 + (0.99 * 0.8) / w) * 280)
      const corner = new Uint8Array(4)
      const centre = new Uint8Array(4)
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, corner)
      gl.readPixels(200, 280, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, centre)
      pixels.push({ angle, corner: corner[3], centre: centre[3] })
    }
    renderer.dispose()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return pixels
  })
}

async function checkShadowReturn(page: Page) {
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.offered-image > .finished-card')!).boxShadow !==
      'none',
  )
  assert(
    await page
      .locator('.offered-image > .finished-card')
      .first()
      .evaluate((element) => getComputedStyle(element).transitionProperty.includes('box-shadow')),
    'shadow returns through its normal fade transition',
  )
}
