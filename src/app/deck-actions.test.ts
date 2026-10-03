import assert from 'node:assert/strict'
import test from 'node:test'

import { toDeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { fetchScryfallCard, fetchScryfallPrintings } from '../adapters/scryfall.ts'
import {
  addBasicLands,
  addManualCard,
  addSearchCards,
  hydrateDeckCardDetails,
  selectManualCard,
} from './deck-actions.ts'
import type { ActionDeps } from './recommendation-actions.ts'

const card = (name: string): ScryfallCard => ({
  name,
  type_line: 'Creature',
  cmc: 2,
  legalities: { commander: 'legal' },
  color_identity: ['G'],
  set: 'tst',
  collector_number: '1',
  prints_search_uri: '',
  image_uris: { normal: `https://example.test/${name}.jpg` },
})

function searchDeps() {
  const deps: Record<string, any> = {
    commanderDetails: { colours: ['G'] },
    deck: Array.from({ length: 99 }, (_, index) => toDeckCard(card(`Existing ${index}`))),
    sideboard: [],
    queue: [card('First'), card('Second'), card('Unrelated')],
    skipCompletionReviewDecks: { current: new WeakSet() },
    manualPrintingRequest: { current: null },
    openModal: (_deps: unknown, modal: string) => {
      deps.activeModal = modal
    },
    closeModal: () => assert.fail('Adding must not close search'),
  }
  for (const key of [
    'Deck',
    'Sideboard',
    'Queue',
    'BatchAnnouncement',
    'SelectedCardReference',
    'SelectedDeckCardLocation',
    'SelectedCollectionCard',
    'SelectedGuidanceCard',
    'SelectedManualCard',
    'ManualPrintings',
    'ManualPrinting',
    'ManualPrintingError',
    'BuilderModeReturn',
  ]) {
    const name = key[0].toLowerCase() + key.slice(1)
    deps[`set${key}`] = (value: unknown) => {
      deps[name] = typeof value === 'function' ? value(deps[name]) : value
    }
  }
  return deps as ActionDeps
}

test('search additions keep the workspace open, suppress completion review, and update the queue', () => {
  const deps = searchDeps()
  assert.equal(addSearchCards(deps, [card('First'), card('Second')]), '')
  assert.equal(deps.deck.length, 100)
  assert.deepEqual(
    deps.sideboard.map(({ name }) => name),
    ['Second'],
  )
  assert.deepEqual(
    deps.queue.map(({ name }) => name),
    ['Unrelated'],
  )
  assert.ok(deps.skipCompletionReviewDecks.current.has(deps.deck))
  deps.selectedManualCard = { ...card('Alternate'), set: 'alt', collector_number: '42' }
  assert.equal(addManualCard(deps), '')
  assert.equal(deps.sideboard.at(-1)?.set, 'alt')
  assert.equal(deps.sideboard.at(-1)?.collectorNumber, '42')
  assert.equal(deps.selectedManualCard.name, 'Alternate')
})

test('basic fill adds the reviewed split without replacing existing cards', async (context) => {
  const deps = searchDeps()
  deps.deck = deps.deck.slice(0, 55)
  const existing = [...deps.deck]
  const states: string[] = []
  let closed = false
  deps.setBasicLandState = (state: string) => states.push(state)
  deps.closeModal = () => {
    closed = true
  }
  context.mock.method(globalThis, 'fetch', (input: unknown) => {
    const name = new URL(String(input)).searchParams.get('exact')!
    return Promise.resolve(Response.json({ ...card(name), type_line: 'Basic Land' }))
  })
  await addBasicLands(deps, [
    { name: 'Forest', count: 12 },
    { name: 'Swamp', count: 23 },
  ])
  assert.deepEqual(deps.deck.slice(0, existing.length), existing)
  assert.equal(deps.deck.filter(({ name }) => name === 'Forest').length, 12)
  assert.equal(deps.deck.filter(({ name }) => name === 'Swamp').length, 23)
  assert.deepEqual(states, ['loading', 'idle'])
  assert.equal(closed, true)
})

test('failed basic fill keeps the deck and dialog unchanged', async (context) => {
  const deps = searchDeps()
  const existing = deps.deck
  const states: string[] = []
  deps.setBasicLandState = (state: string) => states.push(state)
  deps.closeModal = () => assert.fail('A failed fill must stay open')
  context.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('', { status: 500 })))
  await addBasicLands(deps, [{ name: 'Unavailable basic', count: 1 }])
  assert.equal(deps.deck, existing)
  assert.deepEqual(states, ['loading', 'error'])
})

test('invalid multi-add changes neither board nor the recommendation queue', () => {
  const deps = searchDeps()
  const before = { deck: deps.deck, sideboard: deps.sideboard, queue: deps.queue }
  assert.match(
    addSearchCards(deps, [card('First'), { ...card('Illegal'), color_identity: ['U'] }]),
    /colour identity/,
  )
  assert.equal(deps.deck, before.deck)
  assert.equal(deps.sideboard, before.sideboard)
  assert.equal(deps.queue, before.queue)
})

test('opening another search detail cancels stale printing results', async (context) => {
  const deps = searchDeps()
  const pending: ((response: Response) => void)[] = []
  const signals: AbortSignal[] = []
  context.mock.method(globalThis, 'fetch', (_input: unknown, init: RequestInit) => {
    signals.push(init.signal as AbortSignal)
    return new Promise<Response>((resolve) => pending.push(resolve))
  })
  const older = selectManualCard(deps, {
    ...card('Older'),
    prints_search_uri: 'https://api.scryfall.com/older',
  })
  const newer = selectManualCard(deps, {
    ...card('Newer'),
    prints_search_uri: 'https://api.scryfall.com/newer',
  })
  assert.ok(signals[0].aborted)
  assert.equal(deps.builderModeReturn, 'search')
  assert.equal(deps.activeModal, 'card')
  await new Promise((resolve) => setTimeout(resolve, 520))
  pending[1](Response.json({ data: [card('Newer'), { ...card('Newer'), set: 'alt' }] }))
  await newer
  pending[0](Response.json({ data: [card('Older')] }))
  await older
  assert.equal(deps.selectedManualCard.name, 'Newer')
  assert.equal(deps.manualPrintings.length, 2)
  assert.ok(deps.manualPrintings.every(({ name }) => name === 'Newer'))
})

test('cached printing metadata enriches details without replacing selected art or foil finish', async (context) => {
  const uri = 'https://api.scryfall.com/selected-printings'
  const chosen = {
    ...card('Selected'),
    set: 'old',
    set_name: 'Old Set',
    prints_search_uri: uri,
    finishes: ['nonfoil', 'foil'] as const,
    scryfall_uri: 'https://scryfall.com/card/old/1',
    prices: { usd: '1', usd_foil: '3' },
  }
  const defaultCard = { ...chosen, set: 'new', image_uris: { normal: 'new-art' } }
  let requests = 0
  context.mock.method(globalThis, 'fetch', (input: unknown) => {
    requests++
    return Promise.resolve(
      Response.json(
        String(input).includes('/named') ? defaultCard : { data: [chosen, defaultCard] },
      ),
    )
  })
  await fetchScryfallCard(chosen.name)
  await fetchScryfallPrintings(uri)
  const deps = searchDeps()
  deps.deck = [
    { ...toDeckCard(chosen), setName: undefined, finish: 'foil', printingManuallySelected: true },
  ]
  deps.sideboard = []
  await hydrateDeckCardDetails(deps, deps.deck[0])
  assert.equal(deps.deck[0].set, 'old')
  assert.equal(deps.deck[0].image, chosen.image_uris.normal)
  assert.equal(deps.deck[0].finish, 'foil')
  assert.equal(deps.deck[0].price, '3')
  assert.equal(deps.deck[0].setName, 'Old Set')
  assert.equal(requests, 2, 'Name and printing-list requests must warm detail hydration')
})
