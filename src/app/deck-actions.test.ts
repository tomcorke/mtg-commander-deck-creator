import assert from 'node:assert/strict'
import test from 'node:test'

import { toDeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { addManualCard, addSearchCards, selectManualCard } from './deck-actions.ts'
import type { ActionDeps } from './recommendation-actions.ts'

const card = (name: string): ScryfallCard => ({
  name,
  type_line: 'Creature',
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
  pending[1](Response.json({ data: [card('Newer'), { ...card('Newer'), set: 'alt' }] }))
  await newer
  pending[0](Response.json({ data: [card('Older')] }))
  await older
  assert.equal(deps.selectedManualCard.name, 'Newer')
  assert.equal(deps.manualPrintings.length, 2)
  assert.ok(deps.manualPrintings.every(({ name }) => name === 'Newer'))
})
