import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  fetchScryfallCollection,
  fetchScryfallPrintings,
  fetchScryfallCollectionCards,
  fetchScryfallSets,
  fetchScryfallSymbology,
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

test('fetches and caches Scryfall mana-symbol SVG URIs', async () => {
  let calls = 0
  const fetcher = async (input: string | URL | Request) => {
    calls++
    assert.equal(String(input), 'https://api.scryfall.com/symbology')
    return response({
      data: [
        {
          symbol: '{W/U/P}',
          english: 'One white or blue Phyrexian mana',
          svg_uri: 'https://svgs.scryfall.io/card-symbols/WUP.svg',
        },
        {
          symbol: '{C/W}',
          english: 'One colourless or white mana',
          svg_uri: 'https://svgs.scryfall.io/card-symbols/CW.svg',
        },
      ],
    })
  }
  const first = await fetchScryfallSymbology(fetcher)
  const second = await fetchScryfallSymbology(fetcher)
  assert.equal(first.get('{W/U/P}')?.svg_uri, 'https://svgs.scryfall.io/card-symbols/WUP.svg')
  assert.equal(second.get('{C/W}')?.svg_uri, 'https://svgs.scryfall.io/card-symbols/CW.svg')
  assert.equal(calls, 1)
})

test('card search treats no matches separately from service failures', async () => {
  assert.deepEqual(await searchScryfallPage('none', async () => response({}, { status: 404 })), {
    data: [],
    total_cards: 0,
    has_more: false,
  })
  await assert.rejects(
    searchScryfallPage('busy', async () => response({}, { status: 503 })),
    /Scryfall unavailable/,
  )
})

test('rate-limit errors explain when to retry across Scryfall endpoints without rapid retries', async (t) => {
  const now = Date.parse('2026-09-29T22:00:00Z')
  t.mock.method(Date, 'now', () => now)
  const endpoints: ((fetcher: typeof fetch) => Promise<unknown>)[] = [
    (fetcher) => fetchScryfallCard('Card', fetcher),
    (fetcher) => fetchScryfallCardsByIdentifiers([{ name: 'Card' }], fetcher),
    (fetcher) =>
      fetchScryfallCollection([{ name: 'Card' }], fetcher, async () =>
        assert.fail('Do not retry 429'),
      ),
    (fetcher) => fetchScryfallPrintings('https://api.scryfall.com/printings', fetcher),
    (fetcher) => fetchScryfallSets(fetcher),
    (fetcher) => searchScryfallPage('busy', fetcher),
    (fetcher) =>
      fetchScryfallCollectionCards(
        [],
        ['set'],
        {
          excludeGameChangers: false,
          excludeTutors: false,
          excludeExtraTurns: false,
          excludeUnreleased: false,
        },
        fetcher,
      ),
  ]
  for (const request of endpoints) {
    let calls = 0
    const fetcher = async () => {
      calls++
      return response({}, { status: 429, headers: { 'Retry-After': '120' } })
    }
    await assert.rejects(request(fetcher), /Scryfall.*rate limit.*2 minutes/i)
    await assert.rejects(searchScryfallPage('another request', fetcher), /2 minutes/)
    assert.equal(calls, 1)
  }
})

test('retry timing handles HTTP dates, server clock skew, expired dates, and missing headers', async (t) => {
  const now = Date.parse('2026-09-29T22:00:00Z')
  t.mock.method(Date, 'now', () => now)
  for (const headers of [
    { 'Retry-After': new Date(now + 120_000).toUTCString() },
    {
      Date: new Date(now - 300_000).toUTCString(),
      'Retry-After': new Date(now - 180_000).toUTCString(),
    },
  ]) {
    await assert.rejects(
      searchScryfallPage('busy', async () => response({}, { status: 429, headers })),
      /2 minutes/,
    )
  }
  await assert.rejects(
    searchScryfallPage('busy', async () =>
      response(
        {},
        { status: 429, headers: { 'Retry-After': new Date(now - 120_000).toUTCString() } },
      ),
    ),
    /Try again now/,
  )
  for (const value of [null, '', 'invalid', '-1', '1.5', '9'.repeat(400)]) {
    const headers = value === null ? {} : { 'Retry-After': value }
    await assert.rejects(
      searchScryfallPage('busy', async () => response({}, { status: 429, headers })),
      /1 minute.*estimate/i,
    )
  }
})

test('cooldown spans endpoints, expires, and does not mask cancellation', async (t) => {
  let now = Date.parse('2026-09-29T22:00:00Z')
  t.mock.method(Date, 'now', () => now)
  let calls = 0
  const fetcher = async () =>
    ++calls === 1
      ? response({}, { status: 429, headers: { 'Retry-After': '30' } })
      : response({ data: [] })
  await assert.rejects(searchScryfallPage('busy', fetcher), /30 seconds/)
  now += 10_000
  await assert.rejects(fetchScryfallCard('Another card', fetcher), /20 seconds/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(searchScryfallPage('cancelled', fetcher, controller.signal), {
    name: 'AbortError',
  })
  assert.equal(calls, 1)
  now += 20_000
  assert.deepEqual(await searchScryfall('ready', fetcher), [])
  assert.equal(calls, 2)
})

test('concurrent rate limits keep the longest cooldown', async (t) => {
  t.mock.method(Date, 'now', () => Date.parse('2026-09-29T22:00:00Z'))
  let calls = 0
  const first = Promise.withResolvers<Response>()
  const fetcher = async () =>
    ++calls === 1 ? first.promise : response({}, { status: 429, headers: { 'Retry-After': '120' } })
  const pending = assert.rejects(searchScryfallPage('first', fetcher), /2 minutes/)
  await assert.rejects(searchScryfallPage('second', fetcher), /2 minutes/)
  first.resolve(response({}, { status: 429, headers: { 'Retry-After': '30' } }))
  await pending
  await assert.rejects(fetchScryfallSets(fetcher), /2 minutes/)
  assert.equal(calls, 2)
})

test('overlapping 5xx Retry-After responses cannot shorten the shared cooldown', async (t) => {
  const now = Date.parse('2026-09-29T22:00:00Z')
  t.mock.method(Date, 'now', () => now)
  let calls = 0
  const first = Promise.withResolvers<Response>()
  const fetcher = async () =>
    ++calls === 1 ? first.promise : response({}, { status: 503, headers: { 'Retry-After': '120' } })
  const later = (error: unknown) => {
    assert.equal((error as { retryAt?: number }).retryAt, now + 120_000)
    return true
  }
  const pending = assert.rejects(searchScryfallPage('first', fetcher), later)
  await assert.rejects(searchScryfallPage('second', fetcher), later)
  first.resolve(response({}, { status: 503, headers: { 'Retry-After': '30' } }))
  await pending
  await assert.rejects(fetchScryfallSets(fetcher), later)
  assert.equal(calls, 2)
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
  assert.ok(!new URL(urls[0]).searchParams.get('q')?.includes('-is:commander'))
})
