import assert from 'node:assert/strict'
import { withBrowser, openScenario } from './fixtures/browser-harness.ts'
import { makeState } from './fixtures/b10-browser.ts'

await withBrowser('BATCH_BUSY', 5254, async (browser, base) => {
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
  await page.reload()
  await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let mode: 'hold' | 'pass' | 'fail' = 'hold'
  await context.route('https://cards.scryfall.io/**', async (route) => {
    if (decodeURIComponent(route.request().url()).includes('B10 Spare')) {
      if (mode === 'hold') await held
      if (mode === 'fail') {
        await route.abort()
        return
      }
    }
    await route.fallback()
  })
  try {
    const next = page.locator('.batch-controls .nav-forward')
    await next.click()
    await page.waitForSelector('[data-card-reveal="waiting"]')
    assert(await next.isDisabled(), 'Next is disabled while the next images are held after refresh')
    assert.equal(await next.getAttribute('aria-busy'), 'true')
    assert.match(await next.innerText(), /Preparing recommendations/)
    const batch = await page.locator('.recommendation-setup .section-title > span').innerText()
    await next.evaluate((element) => (element as HTMLButtonElement).click())
    assert.equal(
      await page.locator('.recommendation-setup .section-title > span').innerText(),
      batch,
      'repeat clicks do not advance another batch',
    )
    mode = 'pass'
    release()
    await page.waitForSelector('[data-card-reveal-phase="leaving"]')
    assert(await next.isDisabled(), 'Next stays disabled through the rolling reveal')
    assert.match(await next.innerText(), /Revealing recommendations/)
    await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
    await next.waitFor({ state: 'visible' })
    await page.waitForFunction(
      () => !(document.querySelector('.batch-controls .nav-forward') as HTMLButtonElement).disabled,
    )
    assert.match(await next.innerText(), /Next recommendations/)
    mode = 'fail'
    await next.click()
    await page.waitForSelector('[data-card-reveal]', { state: 'detached' })
    await page.waitForFunction(
      () => !(document.querySelector('.batch-controls .nav-forward') as HTMLButtonElement).disabled,
    )
    assert.equal(
      await next.getAttribute('aria-busy'),
      'false',
      'image failure clears the busy state',
    )
    assert.deepEqual(errors, [])
    console.log(
      'Cold reload, delayed images, busy labels, repeat-click prevention and failure recovery passed.',
    )
  } finally {
    release()
    await context.close()
  }
})
