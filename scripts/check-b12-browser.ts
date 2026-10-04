import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import { a14BaseState } from './fixtures/a14.ts'
import { autosavePrefix, workspaceSessionKey } from '../src/autosaves.ts'
import {
  deckStateVersion,
  encodeDeckState,
  persistedDeckStateSchema,
  savedDecksKey,
  type PersistedDeckState,
} from '../src/deck-state.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'

// Disposable Chrome contexts only; retain the browser sandbox and hide Windows child processes.
const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

const image = 'https://cards.scryfall.io/normal/front/a/b/abcdef01-2345-6789-abcd-0123456789ab.jpg'
function raw(name: string): ScryfallCard {
  return {
    name,
    oracle_id: name,
    type_line:
      name === 'Commander'
        ? 'Legendary Creature — Human'
        : name === 'Forest'
          ? 'Basic Land — Forest'
          : 'Artifact',
    color_identity: ['G'],
    cmc: name === 'Forest' ? 0 : 2,
    mana_cost: name === 'Forest' ? '' : '{1}{G}',
    oracle_text: '',
    game_changer: name === 'New Game Changer' || name === 'Deferred',
    legalities: { commander: name === 'Changed' ? 'banned' : 'legal' },
    set: 'tst',
    set_name: 'Test set',
    collector_number: name,
    prints_search_uri: `https://api.scryfall.com/cards/search?printing=${encodeURIComponent(name)}`,
    scryfall_uri: 'https://scryfall.com/card/tst/1',
    image_uris: {
      normal: image + '?' + encodeURIComponent(name),
      art_crop: image + '?' + encodeURIComponent(name),
    },
    finishes: ['nonfoil', 'foil'],
  }
}

function snapshot(full = true): PersistedDeckState {
  const chosen = (name: string) => {
    const card = toCard(raw(name), 'Popular inclusion')
    const printing = {
      image: image + '?chosen',
      set: 'chosen',
      setName: 'Chosen set',
      collectorNumber: '42',
      scryfallUri: 'https://scryfall.com/card/chosen/42',
      finish: 'foil' as const,
    }
    return {
      ...card,
      ...printing,
      printings: [printing, { ...printing, image: image + '?alt' }],
      printing: 0,
      printingManuallySelected: true,
    }
  }
  const changed = { ...chosen('Changed'), commanderLegality: 'legal', gameChanger: false }
  const queue = [
    'New Game Changer',
    'Unknown Status',
    'Legal one',
    'Legal two',
    'Queued later',
  ].map((name) => ({ ...chosen(name), gameChanger: false }))
  return persistedDeckStateSchema.parse({
    ...a14BaseState,
    commander: 'Commander',
    commanderDetails: {
      images: [image],
      art: [image],
      colours: ['G'],
      printings: [[chosen('Commander').printings[0]]],
      selections: [0],
    },
    deck: [
      toDeckCard(raw('Commander')),
      ...Array.from({ length: full ? 98 : 1 }, () => toDeckCard(raw('Forest'))),
      ...(full ? [changed] : []),
    ],
    queue,
    liked: ['Legal two'],
    decisions: { 'New Game Changer': 'later' },
    preferenceScores: { Tokens: 3 },
    deferredCards: [{ card: chosen('Deferred'), eligibleBatch: 9, available: false }],
  })
}

async function providers(context: BrowserContext, offline = false) {
  const requests: { identifiers: any[]; time: number }[] = []
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'cards.scryfall.io' || url.hostname === 'svgs.scryfall.io')
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="488" height="680" fill="#425b42"/></svg>',
      })
    if (url.hostname === 'json.edhrec.com')
      return route.fulfill({
        json: {
          container: {
            json_dict: {
              cardlists: [
                {
                  tag: 'topcards',
                  header: 'Top Cards',
                  cardviews: Array.from({ length: 8 }, (_, i) => ({ name: `Fresh ${i}` })),
                },
              ],
            },
          },
        },
      })
    if (url.hostname !== 'api.scryfall.com') return route.continue()
    if (url.pathname === '/cards/collection') {
      const identifiers = route.request().postDataJSON().identifiers
      requests.push({ identifiers, time: Date.now() })
      if (offline) return route.fulfill({ status: 503, json: { error: 'Offline' } })
      const data = identifiers.map((id: any) => raw(id.oracle_id ?? id.name ?? id.collector_number))
      for (const card of data) if (card.name === 'Unknown Status') delete card.game_changer
      return route.fulfill({ json: { data } })
    }
    if (url.pathname === '/sets' || url.pathname === '/symbology')
      return route.fulfill({ json: { data: [] } })
    if (url.pathname === '/cards/named')
      return route.fulfill({ json: raw(url.searchParams.get('exact')!) })
    return route.fulfill({
      json: {
        data: url.searchParams.has('printing') ? [raw(url.searchParams.get('printing')!)] : [],
        has_more: false,
      },
    })
  })
  return requests
}

async function seed(page: Page, state: PersistedDeckState, dark: boolean) {
  const draft = {
    version: deckStateVersion,
    id: 'seed',
    name: 'Original draft',
    updatedAt: new Date().toISOString(),
    state: encodeDeckState(state),
  }
  const manual = {
    id: 'manual',
    name: 'Named legal deck',
    updatedAt: draft.updatedAt,
    state: encodeDeckState(snapshot(false)),
  }
  await page.addInitScript(
    ({ prefix, key, draft, manual, version, dark }) => {
      if (localStorage.getItem(prefix + 'seed')) return
      localStorage.setItem(prefix + 'seed', JSON.stringify(draft))
      localStorage.setItem(key, JSON.stringify({ version, decks: [manual] }))
      localStorage.setItem('option:darkMode', JSON.stringify(dark))
      localStorage.setItem('option:cardEffects', 'false')
    },
    { prefix: autosavePrefix, key: savedDecksKey, draft, manual, version: deckStateVersion, dark },
  )
}

async function current(page: Page) {
  return page.evaluate(
    ({ prefix, key }) => {
      const id = sessionStorage.getItem(key)!
      const stored = JSON.parse(localStorage.getItem(prefix + id)!)
      const queue = stored.state.queue
      if (!Array.isArray(queue))
        stored.state.queue = queue.rows.map((row: unknown[]) =>
          Object.fromEntries(
            queue.fields.flatMap((field: string, index: number) =>
              row[index] === null ? [] : [[field, row[index]]],
            ),
          ),
        )
      return stored
    },
    { prefix: autosavePrefix, key: workspaceSessionKey },
  )
}

async function settled(page: Page) {
  await page.getByRole('alert', { name: 'Current card data' }).waitFor()
  await page.waitForFunction(
    () =>
      !document
        .querySelector('[aria-label="Current card data"]')
        ?.textContent?.includes('Checking current card data.'),
  )
  await page.waitForTimeout(150)
}

async function reviewLayout(page: Page, path: string) {
  assert.equal(await page.getByText('Main deck complete', { exact: true }).count(), 0)
  assert.ok(await page.getByText('Main deck needs validation', { exact: true }).isVisible())
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  const reference = page
    .getByRole('alert', { name: 'Current card data' })
    .getByRole('button', { name: 'Show details for Changed' })
    .first()
  await reference.focus()
  await reference.hover()
  await page.screenshot({ path, fullPage: true })
  await reference.click()
  await page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: 'Changed', exact: true }) })
    .waitFor()
  await page.getByRole('button', { name: 'Close Changed details' }).click()
}

async function loadOtherSnapshots(page: Page, url: string) {
  const manualBefore = await page.evaluate((key) => localStorage.getItem(key), savedDecksKey)
  await page.goto(url + '#build/saved')
  await page.getByRole('button', { name: 'Load', exact: true }).click()
  await settled(page)
  const named = await current(page)
  assert.equal(named.name, 'Named legal deck')
  assert.equal(named.state.deck.length, 2)
  assert.equal(named.state.deck[0].dataStatus, undefined)
  await page.goto(url + '#build/saved')
  const original = page
    .locator('.autosaved-draft-list article')
    .filter({ hasText: 'Original draft' })
    .first()
  await original.getByRole('button', { name: 'Open in this tab' }).click()
  await settled(page)
  const recovered = await current(page)
  assert.notEqual(recovered.id, 'seed')
  assert.equal(recovered.state.deck.length, 100)
  assert.equal(recovered.state.deck.at(-1).commanderLegality, 'banned')
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), savedDecksKey), manualBefore)
}

async function checkBrowser(context: BrowserContext, url: string, mode: string, artifacts: string) {
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await providers(context, mode === 'offline')
  await seed(page, snapshot(), mode !== 'light')
  await page.goto(url)
  await settled(page)
  const stored = await current(page)
  assert.equal(stored.state.deck.length, 100)
  assert.equal(stored.state.deck.at(-1).image, image + '?chosen')
  assert.equal(stored.state.deck.at(-1).finish, 'foil')
  assert.equal(stored.state.decisions['New Game Changer'], 'later')
  assert.deepEqual(stored.state.liked, ['Legal two'])
  assert.equal(stored.state.preferenceScores.Tokens, 3)
  assert.equal(stored.state.deferredCards[0].eligibleBatch, 9)
  assert.equal(stored.state.deferredCards[0].available, false)
  const blocked = page.locator('.card-offer').filter({ hasText: 'New Game Changer' })
  assert.equal(
    await blocked.getByRole('button', { name: 'Sideboard', exact: true }).isDisabled(),
    true,
  )
  await reviewLayout(page, join(artifacts, `b12-${mode}.png`))
  if (mode === 'offline') {
    assert.equal(stored.state.deck[0].dataStatus, 'unavailable')
    await page.reload()
    await settled(page)
    assert.equal((await current(page)).state.deck.length, 100)
  } else {
    assert.equal(
      stored.state.queue.find((card: any) => card.name === 'New Game Changer').gameChanger,
      true,
    )
    assert.equal(
      stored.state.queue.find((card: any) => card.name === 'Unknown Status').gameChanger,
      undefined,
    )
    assert.equal(stored.state.deferredCards[0].card.gameChanger, true)
    const legal = page.locator('.card-offer').filter({ hasText: 'Legal one' })
    await legal.getByRole('button', { name: 'Sideboard', exact: true }).click()
    await page.waitForTimeout(150)
    assert.equal((await current(page)).state.sideboard[0].name, 'Legal one')
    if (mode === 'light') await loadOtherSnapshots(page, url)
  }
  assert.deepEqual(errors, [])
  await page.close()
  console.log(
    `PASS ${mode}: startup, persistent warning, 100-card validation, printing/choices, card preview/details`,
  )
}

const server = await createServer({
  configFile: false,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('b12-check') },
  server: { host: '127.0.0.1', port: Number(process.env.B12_PORT ?? 5272), strictPort: true },
  logLevel: 'error',
})
const artifacts = await mkdtemp(join(tmpdir(), 'mtg-b12-'))
let browser
try {
  await server.listen()
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    chromiumSandbox: true,
    args: ['--enable-automation'],
  })
  const command = await (await browser.newBrowserCDPSession()).send('Browser.getBrowserCommandLine')
  assert.equal(command.arguments.includes('--no-sandbox'), false)
  console.log(
    `Chrome ${browser.version()} sandbox enabled; disposable contexts. Screenshots: ${artifacts}`,
  )
  for (const mode of ['light', 'dark', 'narrow', 'offline']) {
    const context = await browser.newContext({
      viewport: mode === 'narrow' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    })
    try {
      await checkBrowser(context, server.resolvedUrls!.local[0], mode, artifacts)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser?.close()
  await server.close()
  childProcess.spawn = spawn
}
