import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import { a14BaseState } from './fixtures/a14.ts'
import { autosavePrefix } from '../src/autosaves.ts'
import {
  deckStateVersion,
  persistedDeckStateSchema,
  savedDecksKey,
  type PersistedDeckState,
} from '../src/deck-state.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../src/domain/card-model.ts'

// B18 acceptance: localStorage migration, IndexedDB capacity, cross-tab sync, failed-write warning.
const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

const image = 'https://cards.scryfall.io/normal/front/a/b/abcdef01-2345-6789-abcd-0123456789ab.jpg'
const raw = (name: string): ScryfallCard => ({
  name,
  oracle_id: `oracle-${name}`,
  type_line: name.startsWith('Land') ? 'Basic Land — Forest' : 'Artifact',
  color_identity: ['G'],
  cmc: 2,
  mana_cost: '{1}{G}',
  oracle_text: 'Whenever another permanent enters, put a +1/+1 counter on target creature. '.repeat(
    3,
  ),
  legalities: { commander: 'legal' },
  set: 'tst',
  set_name: 'Test set',
  collector_number: name,
  prints_search_uri: `https://api.scryfall.com/cards/search?q=${encodeURIComponent(name)}`,
  scryfall_uri: `https://scryfall.com/card/tst/${encodeURIComponent(name)}`,
  image_uris: { normal: `${image}?${encodeURIComponent(name)}` },
  finishes: ['nonfoil', 'foil'],
})

// A complete 100-card deck whose cards carry alternate printings, as added cards do in practice.
function completeDeck(seed: number, printings: number): PersistedDeckState {
  const printing = (name: string, index: number) => ({
    image: `${image}?${encodeURIComponent(name)}-${index}`,
    set: `s${index}`,
    setName: `Printing set ${index}`,
    collectorNumber: String(index),
    scryfallUri: `https://scryfall.com/card/s${index}/${index}/${encodeURIComponent(name)}`,
    price: '1.25',
    priceUri: `https://www.tcgplayer.com/product/${seed}${index}?partner=Scryfall`,
    finish: index % 2 ? ('foil' as const) : ('nonfoil' as const),
  })
  const card = (name: string) => {
    const options = Array.from({ length: printings }, (_, index) => printing(name, index))
    return { ...toDeckCard(raw(name)), ...options[1], printings: options, printing: 1 }
  }
  const names = Array.from({ length: 99 }, (_, index) =>
    index < 35 ? `Land ${seed}-${index}` : `Card ${seed}-${index}`,
  )
  return persistedDeckStateSchema.parse({
    ...a14BaseState,
    commander: `Commander ${seed}`,
    theme: `Theme ${seed}`,
    deck: [card(`Commander ${seed}`), ...names.map(card)],
    queue: Array.from({ length: 40 }, (_, index) => toCard(raw(`Queued ${seed}-${index}`), 'Pick')),
    decisions: { [`Queued ${seed}-0`]: 'later', [`Queued ${seed}-1`]: 'ignore' },
  })
}

async function stubProviders(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname.endsWith('scryfall.io'))
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"/>',
      })
    if (url.hostname === 'json.edhrec.com') return route.fulfill({ status: 404, json: {} })
    if (url.hostname !== 'api.scryfall.com') return route.continue()
    if (url.pathname === '/cards/collection') {
      const ids = route.request().postDataJSON().identifiers
      const data = ids.map((id: { oracle_id?: string; name?: string }) =>
        raw(id.oracle_id?.replace(/^oracle-/, '') ?? id.name!),
      )
      return route.fulfill({ json: { data } })
    }
    return route.fulfill({ json: { data: [], has_more: false } })
  })
}

// The Vite dev server hands the page the same module instances the app uses.
declare global {
  interface Window {
    b18: () => Promise<[any, any, any]>
  }
}
const exposeAppModules = () => {
  const load = (path: string) => import(/* @vite-ignore */ path)
  window.b18 = () =>
    Promise.all([
      load('/src/deck-state.ts'),
      load('/src/autosaves.ts'),
      load('/src/app-storage.ts'),
    ])
}

// Every saved deck and autosave must load with the same cards, printings, finishes and decisions.
// Open tabs refresh card data in their own drafts, so those compare by card identity only.
async function storedMatches(page: Page, expected: Record<string, PersistedDeckState>) {
  return page.evaluate(
    async ({ expected, prefix }) => {
      const [deckState, autosaves, storage] = await window.b18()
      const loaded = [
        ...deckState.loadSavedDecks().map((deck: any) => [deck.id, deck.state]),
        ...autosaves
          .listAutosaves(storage.appStorage())
          .map((draft: any) => [draft.id, draft.state]),
      ]
      const byId = Object.fromEntries(loaded)
      const identity = (state: PersistedDeckState) =>
        JSON.stringify([
          state.deck.map((card) => [card.name, card.set, card.collectorNumber, card.finish]),
          state.decisions,
        ])
      const open = (await navigator.locks.query()).held!.map(({ name }) =>
        name!.slice(prefix.length),
      )
      return Object.entries(expected).filter(([id, state]) =>
        !byId[id]
          ? true
          : open.includes(id)
            ? identity(state) !== identity(byId[id])
            : deckState.deckStateChanged(state, byId[id]),
      )
    },
    { expected, prefix: autosavePrefix },
  )
}

function legacySeed() {
  // About 4.9M characters in the pre-B18 format, the browser's localStorage limit.
  const decks: Record<string, PersistedDeckState> = {}
  const seed: Record<string, string> = { 'option:darkMode': 'true', theme: 'dark' }
  const updatedAt = new Date().toISOString()
  const total = () => Object.values(seed).reduce((sum, value) => sum + value.length, 0)
  const saved: object[] = []
  for (let index = 0; total() < 4_600_000; index++) {
    const state = completeDeck(index, 6)
    if (index % 3 === 2) {
      const id = `draft-${index}`
      decks[id] = state
      const draft = { version: deckStateVersion, id, name: `Draft ${index}`, updatedAt, state }
      seed[autosavePrefix + id] = JSON.stringify(draft)
    } else {
      decks[`deck-${index}`] = state
      saved.push({ id: `deck-${index}`, name: `Deck ${index}`, updatedAt, state })
      seed[savedDecksKey] = JSON.stringify({ version: deckStateVersion, decks: saved })
    }
  }
  seed['commander-autosave-retention'] = JSON.stringify({ maxCount: 50, maxAgeDays: 30 })
  console.log(
    `Seeding ${Object.keys(decks).length} decks/drafts, ${total().toLocaleString()} characters`,
  )
  return { decks, seed }
}

// 4. A failed IndexedDB write shows the existing autosave warning.
async function checkFailedWrite(page: Page) {
  await page.evaluate(
    async (state) => {
      const put = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
        const request = put.apply(this, args)
        this.transaction.abort()
        return request
      }
      const [deckState] = await window.b18()
      deckState.saveSavedDeck({
        id: 'fails',
        name: 'Fails',
        updatedAt: new Date().toISOString(),
        state,
      })
    },
    completeDeck(902, 2),
  )
  await page.getByText('Autosave unavailable').first().waitFor()
  console.log('PASS failed write: "Autosave unavailable" warning shown')
}

async function check(context: BrowserContext, url: string) {
  const { decks, seed } = legacySeed()
  await stubProviders(context)
  await context.addInitScript(exposeAppModules)
  await context.addInitScript((seed) => {
    if (localStorage.getItem('b18-seeded')) return
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value)
    localStorage.setItem('b18-seeded', '1')
  }, seed)
  const errors: string[] = []
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url)
  await page.waitForFunction(() => document.querySelector('#root')?.childElementCount)

  // 1. Migration without loss; preferences stay in localStorage.
  assert.deepEqual(await storedMatches(page, decks), [])
  const legacyKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('commander-')),
  )
  assert.deepEqual(legacyKeys, [])
  assert.equal(await page.evaluate(() => localStorage.getItem('option:darkMode')), 'true')
  console.log('PASS migration: every saved deck and autosave reopens unchanged')

  // 2. Twenty complete decks and ten autosaves with full printing lists fit without quota errors.
  const bulk = Object.fromEntries(
    Array.from({ length: 30 }, (_, index) => [`bulk-${index}`, completeDeck(100 + index, 40)]),
  )
  await page.evaluate(
    async ({ bulk, prefix, version }) => {
      const [deckState, , storage] = await window.b18()
      Object.entries(bulk).forEach(([id, state], index) => {
        const updatedAt = new Date().toISOString()
        if (index < 20) deckState.saveSavedDeck({ id, name: `Bulk ${index}`, updatedAt, state })
        else
          storage.appStorage().setItem(
            prefix + id,
            JSON.stringify({
              version,
              id,
              name: id,
              updatedAt,
              state: deckState.encodeDeckState(state),
            }),
          )
      })
    },
    { bulk, prefix: autosavePrefix, version: deckStateVersion },
  )
  // A fresh tab reads IndexedDB itself, so this proves the writes are durable.
  const reader = await context.newPage()
  await reader.goto(url)
  await reader.waitForFunction(() => document.querySelector('#root')?.childElementCount)
  assert.deepEqual(await storedMatches(reader, { ...decks, ...bulk }), [])
  assert.equal(await page.getByText('Autosave unavailable').count(), 0)
  console.log('PASS capacity: 20 complete decks and 10 autosaves saved without quota errors')

  // 3. Each open tab sees the other's saves and autosaves.
  await page.evaluate(
    async (state) => {
      const [deckState] = await window.b18()
      deckState.saveSavedDeck({
        id: 'from-tab-one',
        name: 'From tab one',
        updatedAt: new Date().toISOString(),
        state,
      })
    },
    completeDeck(900, 2),
  )
  await reader.waitForFunction(async () => {
    const [deckState] = await window.b18()
    return deckState.loadSavedDecks().some((deck: { id: string }) => deck.id === 'from-tab-one')
  })
  await reader.evaluate(
    async ({ state, prefix, version }) => {
      const [deckState, , storage] = await window.b18()
      const id = 'from-tab-two'
      const draft = {
        version,
        id,
        name: id,
        updatedAt: new Date().toISOString(),
        state: deckState.encodeDeckState(state),
      }
      storage.appStorage().setItem(prefix + id, JSON.stringify(draft))
    },
    { state: completeDeck(901, 2), prefix: autosavePrefix, version: deckStateVersion },
  )
  await page.waitForFunction(async (key) => {
    const [, , storage] = await window.b18()
    return storage.appStorage().getItem(key) !== null
  }, autosavePrefix + 'from-tab-two')
  console.log('PASS two tabs: saves and autosaves appear in the other tab')

  await checkFailedWrite(page)
  assert.deepEqual(errors, [])
}

const server = await createServer({
  configFile: false,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('b18-check') },
  server: { host: '127.0.0.1', port: Number(process.env.B18_PORT ?? 5278), strictPort: true },
  logLevel: 'error',
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    await check(context, server.resolvedUrls!.local[0])
  } finally {
    await context.close()
  }
} finally {
  await browser?.close()
  await server.close()
  childProcess.spawn = spawn
}
