// Runs the import and state drives from the design-review source of truth against real dev modes.
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'vite'
import type { Page } from 'playwright-core'
import { withBrowser } from './fixtures/browser-harness.ts'
import { replayCacheDirectory } from './dev-replay/plugin.ts'

const mode = process.argv[2] ?? 'replay'
assert(mode === 'record' || mode === 'replay', 'Usage: pnpm check:dev-replay [record|replay]')
const convention = await readFile('docs/agents/design-conventions.md', 'utf8')
const snippets = [...convention.matchAll(/```js\n([\s\S]*?)```/g)].map((match) => match[1])
const helpers = snippets.find((code) => code.startsWith('window.dr ='))!
const importDrive = snippets.find((code) => code.startsWith("await dr.click('Import deck')"))!
const lists = [...convention.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1])
const partial = lists.find((list) => list.startsWith('Commander\n'))!
const additions = lists.find((list) => list.startsWith('1 Mortuary Mire'))!
const complete = partial.replace('Sideboard\n', `${additions.trim()}\n\nSideboard\n`)
assert(helpers && importDrive && partial && additions, 'review corpus and drives found')

async function ready(page: Page) {
  await page.waitForFunction(
    () =>
      document.querySelector('.deck-board') ||
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === 'Back to builder',
      ),
  )
  if (!(await page.locator('.deck-board').count()))
    await page.getByRole('button', { name: 'Back to builder', exact: true }).click()
  await page.evaluate(helpers)
  await page.evaluate('dr.builderReady()')
}

async function importDeck(page: Page, list: string, count: number) {
  // Complete imports may enter Deck Doctor, so wait for builder readiness after returning to it.
  const drive = importDrive.replace('await dr.builderReady()', '')
  await page.evaluate(`(async () => { const list = ${JSON.stringify(list)}; ${drive} })()`)
  await page.goto(new URL('#build', page.url()).href)
  await ready(page)
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(`${expected} / 100 cards`),
    count,
  )
}

async function checkTexture(page: Page) {
  const error = await page.evaluate(async () => {
    const url = new URL('/__dev-provider', location.origin)
    url.searchParams.set(
      'url',
      'https://api.scryfall.com/cards/named?exact=Sol%20Ring&format=image&version=normal',
    )
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = url.href
    await image.decode()
    const gl = document.createElement('canvas').getContext('webgl')!
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    return gl.getError()
  })
  assert.equal(error, 0, 'generated API-image placeholder decodes as an untainted WebGL texture')
}

async function drive(page: Page, base: string) {
  page.setDefaultTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text()))
      errors.push(message.text())
  })
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== new URL(base).origin) {
      errors.push(`External browser request: ${route.request().url()}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`${base}#start`)
  await page.evaluate(helpers)
  await page.evaluate("dr.text('commanders shown')")
  assert(await page.locator('.commander-tile').count(), 'start discovery renders')
  console.log('Drive: fresh start discovery rendered')
  await importDeck(page, partial, 84)
  console.log('Drive: full documented partial-deck import and builderReady completed')
  // The documented card-details state, driven without provider mocks.
  await page.evaluate(
    "(async () => { await dr.builderReady(); document.querySelector('.deck-board .deck-card-name').click(); await dr.dialog(); })()",
  )
  await page.keyboard.press('Escape')
  await importDeck(page, complete, 100)
  console.log('Drive: complete-deck import and builderReady completed')
  await checkTexture(page)
  await page.evaluate('document.fonts.ready')
  const images = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.checkVisibility() && (!img.complete || !img.naturalWidth))
      .map((img) => img.src),
  )
  assert.deepEqual(images, [], 'visible images decoded')
  const output = join(replayCacheDirectory(), 'evidence')
  await mkdir(output, { recursive: true })
  for (const [name, dark, width] of [
    ['light', false, 1366],
    ['dark', true, 1366],
    ['narrow', true, 390],
  ] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(
      (value) => localStorage.setItem('option:darkMode', JSON.stringify(value)),
      dark,
    )
    await page.reload()
    await ready(page)
    await page.screenshot({ path: join(output, `${mode}-${name}.png`) })
  }
  assert.deepEqual(errors, [], 'no browser exceptions, CSP escapes, or external requests')
}

const external = process.env.DEV_REPLAY_URL
const server = external
  ? undefined
  : await createServer({
      mode,
      server: { host: '127.0.0.1', port: 5293, strictPort: true },
      clearScreen: false,
    })
try {
  await server?.listen()
  const base = external ?? server!.resolvedUrls!.local[0]
  process.env.DEV_REPLAY_URL = base
  await withBrowser('DEV_REPLAY', 5293, async (browser) => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    try {
      const page = await context.newPage()
      try {
        await drive(page, base)
      } catch (error) {
        console.error(
          'Drive failure:',
          page.url(),
          (await page.locator('body').innerText()).slice(0, 4000),
        )
        throw error
      }
    } finally {
      await context.close()
    }
  })
  const stats = await (await fetch(new URL('/__dev-replay/status', base))).json()
  console.log('Replay proof:', JSON.stringify(stats))
  assert.equal(stats.mode, mode)
  assert.equal(stats.failures, 0)
  assert.equal(stats.placeholders > 0, true)
  assert.equal(stats.fixtures > 0, true)
  if (mode === 'replay') {
    assert.equal(stats.upstream, 0, 'strict replay: zero upstream requests')
    assert.equal(stats.misses, 0, 'full drive was recorded')
  }
} finally {
  if (external) process.env.DEV_REPLAY_URL = external
  else delete process.env.DEV_REPLAY_URL
  await server?.close()
}
