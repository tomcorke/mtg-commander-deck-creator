// Shared mocked-provider harness for browser checks: synthetic Scryfall/EDHREC responses,
// a seeded workspace, and a disposable sandboxed installed Chrome.
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from 'playwright-core'
import { createServer } from 'vite'
import type { ScryfallCard } from '../../src/domain/card-model.ts'
import type { PersistedDeckState } from '../../src/deck-state.ts'
import type { EdhrecCommanderPage } from '../../src/adapters/edhrec.ts'
import { allRecords, baseCandidates } from './b10-browser.ts'

// Playwright launches installed Chrome through child_process; keep Windows child windows hidden.
const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

export type Provider = {
  records: ScryfallCard[]
  queries: string[]
  holdEdhrec?: Promise<void>
  failNamed?: boolean
  /** Answers `/local-card-index.json`; the default is a 404 so fixture pools stay synthetic. */
  localIndex?: (route: Route) => Promise<void>
}
export type Scenario = { page: Page; context: BrowserContext; errors: string[]; provider: Provider }
const imageBody =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="224"><rect width="160" height="224" fill="#777"/></svg>'
export const button = (scope: Page | Locator, name: string) =>
  scope.getByRole('button', { name, exact: true })
export const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name, exact: true })
const recordFor = (provider: Provider, name: string) =>
  [...provider.records, ...allRecords].find(
    (record) => record.name.toLowerCase() === name.toLowerCase(),
  )
const list = (data: ScryfallCard[]) => ({
  object: 'list',
  data,
  has_more: false,
  total_cards: data.length,
})

function searchRecords(query: string, provider: Provider) {
  if (query.startsWith('oracleid:'))
    return [...provider.records, ...allRecords]
      .filter((record) => record.oracle_id === query.slice('oracleid:'.length))
      .slice(0, 1)
  const sets = [...query.matchAll(/set:(\w+)/g)].map((match) => match[1])
  return provider.records.filter((record) => {
    const text = record.oracle_text ?? ''
    return (
      record.legalities?.commander === 'legal' &&
      record.color_identity.every((colour) => colour === 'G') &&
      (!sets.length || sets.includes(record.set)) &&
      (!query.includes('-is:gamechanger') || !record.game_changer) &&
      (!query.includes('-otag:tutor') || !/search your library/i.test(text)) &&
      (!query.includes('-otag:extra-turn') || !/extra turn/i.test(text)) &&
      (!query.includes('date<=today') || (record.released_at ?? '') <= '2026-10-03') &&
      (!query.includes('o:token') || /token/i.test(text))
    )
  })
}

async function mockScryfall(route: Route, provider: Provider) {
  const url = new URL(route.request().url())
  if (url.pathname === '/sets')
    return route.fulfill({
      json: {
        data: [
          {
            code: 'tst',
            name: 'B10 Fixture Alpha',
            set_type: 'expansion',
            released_at: '2020-01-01',
          },
          {
            code: 'oth',
            name: 'B10 Fixture Beta',
            set_type: 'expansion',
            released_at: '2019-01-01',
          },
        ],
      },
    })
  if (url.pathname === '/catalog/creature-types')
    return route.fulfill({ json: { data: ['Saproling'], total_values: 1 } })
  if (url.pathname === '/symbology')
    return route.fulfill({
      json: {
        data: ['1', '2', '3', '4', '5', '6', '7', 'G'].map((symbol) => ({
          symbol: `{${symbol}}`,
          english: `Fixture mana ${symbol}`,
          svg_uri: `https://svgs.scryfall.io/card-symbols/${symbol}.svg`,
        })),
      },
    })
  if (url.pathname === '/cards/named') {
    if (provider.failNamed)
      return route.fulfill({ status: 503, json: { object: 'error', details: 'Fixture failure' } })
    const record = recordFor(provider, url.searchParams.get('exact') ?? '')
    if (!record)
      return route.fulfill({
        status: 404,
        json: {
          object: 'error',
          code: 'not_found',
          status: 404,
          details: 'No record in the synthetic fixture.',
        },
      })
    return route.fulfill({ json: record })
  }
  if (url.pathname === '/cards/collection') {
    const identifiers = route.request().postDataJSON().identifiers as {
      name?: string
      oracle_id?: string
      set?: string
      collector_number?: string
    }[]
    const data = identifiers.map((identifier) =>
      identifier.name
        ? recordFor(provider, identifier.name)
        : [...provider.records, ...allRecords].find((record) =>
            identifier.oracle_id
              ? record.oracle_id === identifier.oracle_id
              : record.set === identifier.set &&
                record.collector_number === identifier.collector_number,
          ),
    )
    // Unmodelled basics requested by the manual chooser remain explicit provider misses.
    return route.fulfill({
      json: {
        ...list(data.filter((record): record is ScryfallCard => Boolean(record))),
        not_found: identifiers.filter((_, index) => !data[index]),
      },
    })
  }
  assert.equal(url.pathname, '/cards/search', `known Scryfall endpoint: ${url}`)
  const query = url.searchParams.get('q') ?? ''
  provider.queries.push(query)
  return route.fulfill({ json: list(searchRecords(query, provider)) })
}

async function mockRequest(route: Route, scenario: Scenario, base: string) {
  const url = new URL(route.request().url())
  // Synthetic provider gates must not mix their fixture pools with a locally generated real corpus.
  if (url.origin === new URL(base).origin && url.pathname === '/local-card-index.json')
    return scenario.provider.localIndex
      ? scenario.provider.localIndex(route)
      : route.fulfill({ status: 404, body: 'No local index in this fixture' })
  if (url.origin === new URL(base).origin) return route.continue()
  if (url.hostname === 'cards.scryfall.io' || url.hostname === 'svgs.scryfall.io')
    return route.fulfill({ contentType: 'image/svg+xml', body: imageBody })
  if (url.hostname === 'api.scryfall.com') return mockScryfall(route, scenario.provider)
  if (url.hostname === 'json.edhrec.com') {
    await scenario.provider.holdEdhrec
    const data: EdhrecCommanderPage = {
      container: {
        json_dict: {
          cardlists: [
            {
              header: 'High Synergy Cards',
              tag: 'highsynergycards',
              cardviews: scenario.provider.records.map(({ name }) => ({ name })),
            },
          ],
        },
      },
    }
    return route.fulfill({ json: data })
  }
  assert(
    ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname),
    `no unmocked external request: ${url}`,
  )
  return route.fulfill({ status: 204, body: '' })
}

export async function openScenario(
  browser: Browser,
  base: string,
  state: PersistedDeckState,
  records = baseCandidates,
  localIndex?: Provider['localIndex'],
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const scenario: Scenario = {
    page,
    context,
    errors: [],
    provider: { records, queries: [], localIndex },
  }
  page.on('pageerror', (error) => scenario.errors.push(error.message))
  // Record, never answer native dialogs. An unexpected dialog blocks the action and fails the gate.
  page.on('dialog', (dialog) =>
    scenario.errors.push(`Unexpected native ${dialog.type()}: ${dialog.message()}`),
  )
  await context.route('**/*', async (route) => {
    try {
      await mockRequest(route, scenario, base)
    } catch (error) {
      scenario.errors.push(
        `Mock contract: ${error instanceof Error ? error.message : String(error)}`,
      )
      await route.fulfill({ status: 503, body: 'Mock contract failure' }).catch(() => undefined)
    }
  })
  await page.addInitScript((saved) => {
    localStorage.clear()
    localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state: saved }))
    const options = {
      darkMode: false,
      commanderStyling: false,
      cardEffects: false,
      powerTarget: 'high',
      includeCreature: false,
      excludeGameChangers: false,
      excludeTutors: false,
      excludeExtraTurns: false,
      excludeUnreleased: false,
    }
    for (const [key, value] of Object.entries(options))
      localStorage.setItem(`option:${key}`, JSON.stringify(value))
  }, state)
  await page.goto(`${base}#build`)
  await button(page, 'Deck review').waitFor()
  await page.locator('[aria-label="Current card data"][role="status"]').waitFor({ state: 'hidden' })
  return scenario
}

/** Starts Vite (unless `${env}_URL` is set) and sandboxed headless Chrome, then runs `run`. */
export async function withBrowser(
  env: string,
  defaultPort: number,
  run: (browser: Browser, base: string) => Promise<void>,
) {
  const url = process.env[`${env}_URL`]
  const server = url
    ? undefined
    : await createServer({
        server: {
          host: '127.0.0.1',
          port: Number(process.env[`${env}_PORT`] ?? defaultPort),
          strictPort: true,
        },
        clearScreen: false,
      })
  let browser: Browser | undefined
  try {
    await server?.listen()
    const base = url ?? server!.resolvedUrls!.local[0]
    browser = await chromium.launch({
      executablePath:
        process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
      chromiumSandbox: true,
      args: ['--enable-automation'],
    })
    const { arguments: args } = await (
      await browser.newBrowserCDPSession()
    ).send('Browser.getBrowserCommandLine')
    assert(!args.includes('--no-sandbox'), 'Chrome sandbox enabled')
    console.log(
      `Chrome ${browser.version()}: headless, sandbox enabled; no screenshots or native-dialog answers`,
    )
    await run(browser, base)
  } finally {
    await browser?.close()
    await server?.close()
    childProcess.spawn = spawn
  }
}
