import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchScryfallCollectionCards, fetchScryfallSets } from './scryfall.ts'

const response = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
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
