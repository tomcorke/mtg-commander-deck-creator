import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fetchScryfallCollectionCards,
  fetchScryfallSets,
  searchScryfall,
  searchScryfallPage,
} from './scryfall.ts'

const response = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

test('card search exposes page counts, sorting, warnings, and the cancellation signal', async () => {
  const controller = new AbortController()
  const result = await searchScryfallPage(
    'legal:commander name:"Sol Ring"',
    async (input, init) => {
      const url = new URL(String(input))
      assert.equal(url.searchParams.get('q'), 'legal:commander name:"Sol Ring"')
      assert.equal(url.searchParams.get('page'), '2')
      assert.equal(url.searchParams.get('order'), 'cmc')
      assert.equal(url.searchParams.get('unique'), 'cards')
      assert.equal(init?.signal, controller.signal)
      return response({
        data: [{ name: 'Sol Ring' }],
        has_more: true,
        total_cards: 200,
        warnings: ['Search warning'],
      })
    },
    controller.signal,
    'cmc',
    2,
  )
  assert.equal(result.total_cards, 200)
  assert.equal(result.has_more, true)
  assert.deepEqual(result.warnings, ['Search warning'])
  assert.deepEqual(
    await searchScryfall('test', async () => response({ data: [{ name: 'Sol Ring' }] })),
    [{ name: 'Sol Ring' }],
  )
})

test('card search treats no matches separately from service failures', async () => {
  assert.deepEqual(await searchScryfallPage('none', async () => response({}, { status: 404 })), {
    data: [],
    total_cards: 0,
    has_more: false,
  })
  await assert.rejects(
    searchScryfallPage('busy', async () => response({}, { status: 429 })),
    /Scryfall unavailable/,
  )
})

test('fetchScryfallSets excludes token and memorabilia sets and keeps release order', async () => {
  const sets = await fetchScryfallSets(async () =>
    response({
      data: [
        { code: 'old', name: 'Old', released_at: '2020-01-01' },
        { code: 'token', name: 'Token', set_type: 'token', released_at: '2025-01-01' },
        { code: 'new', name: 'New', released_at: '2025-01-01' },
        { code: 'memorabilia', name: 'Promo', set_type: 'memorabilia' },
      ],
    }),
  )

  assert.deepEqual(
    sets.map((set) => set.code),
    ['new', 'old'],
  )
})

test('fetchScryfallCollectionCards follows collection search pages', async () => {
  const urls: string[] = []
  const cards = await fetchScryfallCollectionCards(
    ['G'],
    ['set-a'],
    {
      excludeGameChangers: true,
      excludeTutors: true,
      excludeExtraTurns: true,
      excludeUnreleased: true,
    },
    async (input) => {
      urls.push(String(input))
      return urls.length === 1
        ? response({
            data: [
              {
                name: 'First',
                type_line: 'Creature',
                color_identity: ['G'],
                set: 'set-a',
                collector_number: '1',
                prints_search_uri: '',
              },
            ],
            has_more: true,
            next_page: 'https://api.scryfall.com/cards/search?page=2',
          })
        : response({
            data: [
              {
                name: 'Second',
                type_line: 'Creature',
                color_identity: ['G'],
                set: 'set-a',
                collector_number: '2',
                prints_search_uri: '',
              },
            ],
            has_more: false,
          })
    },
  )

  assert.deepEqual(
    cards.map((card) => card.name),
    ['First', 'Second'],
  )
  assert.match(urls[0], /set%3Aset-a/)
  assert.match(urls[0], /date%3C%3Dtoday/)
})
