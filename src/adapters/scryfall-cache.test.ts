import assert from 'node:assert/strict'
import test from 'node:test'
import type { ScryfallCard } from '../domain/card-model.ts'
import {
  clearScryfallCache,
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  fetchScryfallPrintings,
  resolveScryfallIdentifiers,
  scryfallCacheLifetime,
  searchScryfall,
  type ScryfallIdentifier,
} from './scryfall.ts'

const card = (name: string, set = 'new'): ScryfallCard => ({
  name,
  set,
  collector_number: name,
  type_line: 'Artifact',
  color_identity: [],
  legalities: { commander: 'legal' },
  prints_search_uri: `https://api.scryfall.com/prints/${name}`,
  finishes: ['nonfoil', 'foil'],
})
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

test('front-face and combined names share hydration keys in both directions', async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => {
    calls++
    return response({ data: [card('Accursed Witch')] })
  }
  assert.equal(
    (
      await fetchScryfallCardsByIdentifiers(
        [{ name: 'Accursed Witch // Infectious Curse' }],
        fetcher,
      )
    )[0]?.name,
    'Accursed Witch',
  )
  assert.equal((await fetchScryfallCard('Accursed Witch', fetcher)).name, 'Accursed Witch')
  assert.equal(
    (await fetchScryfallCard('Accursed Witch / Infectious Curse', fetcher)).name,
    'Accursed Witch',
  )
  assert.equal(calls, 1)
})

test('overlapping bulk and named lookups fetch each missing record once and isolate returned data', async () => {
  const first = Promise.withResolvers<Response>()
  const batches: ScryfallIdentifier[][] = []
  const fetcher: typeof fetch = async (_, init) => {
    const { identifiers } = JSON.parse(String(init?.body))
    batches.push(identifiers)
    return batches.length === 1
      ? first.promise
      : response({ data: identifiers.map(({ name }: ScryfallIdentifier) => card(name!)) })
  }
  const a = fetchScryfallCardsByIdentifiers([{ name: 'A' }, { name: 'B' }], fetcher)
  await tick()
  const b = fetchScryfallCardsByIdentifiers([{ name: 'b' }, { name: 'C' }], fetcher)
  const named = fetchScryfallCard('B', fetcher)
  await new Promise((resolve) => setTimeout(resolve, 520))
  assert.deepEqual(batches, [[{ name: 'A' }, { name: 'B' }], [{ name: 'C' }]])
  first.resolve(response({ data: [card('B'), card('A')] }))
  assert.deepEqual(
    (await a).map(({ name }) => name),
    ['A', 'B'],
  )
  assert.deepEqual(
    (await b).map(({ name }) => name),
    ['B', 'C'],
  )
  const altered = await named
  altered.color_identity.push('U')
  altered.legalities!.commander = 'banned'
  const warm = await fetchScryfallCardsByIdentifiers([{ name: ' B ' }, { name: 'C' }], fetcher)
  assert.deepEqual(warm[0].color_identity, [])
  assert.equal(warm[0].legalities?.commander, 'legal')
  assert.equal(batches.length, 2)
})

test('bulk lookups share an already-running named request and batch at most 75 records', async () => {
  const namedResponse = Promise.withResolvers<Response>()
  const batches: ScryfallIdentifier[][] = []
  const fetcher: typeof fetch = async (_, init) => {
    if (!init?.body) return namedResponse.promise
    const { identifiers } = JSON.parse(String(init.body))
    batches.push(identifiers)
    assert.ok(identifiers.length <= 75)
    return response({ data: identifiers.map(({ name }: ScryfallIdentifier) => card(name!)) })
  }
  const named = fetchScryfallCard('A', fetcher)
  const identifiers = ['A', ...Array.from({ length: 80 }, (_, index) => `Card ${index}`)]
  const bulk = fetchScryfallCardsByIdentifiers(
    identifiers.map((name) => ({ name })),
    fetcher,
  )
  namedResponse.resolve(response(card('A')))
  assert.equal((await named).name, 'A')
  assert.equal((await bulk).length, 81)
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [75, 5],
  )
  assert.ok(batches.flat().every(({ name }) => name !== 'A'))
})

test('printing lists paginate, stay distinct from name defaults, and warm exact-printing lookups', async () => {
  const urls: string[] = []
  const uri = card('A').prints_search_uri
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/named')) return response(card('A'))
    return url === uri
      ? response({ data: [card('A', 'old')], has_more: true, next_page: `${uri}?page=2` })
      : response({ data: [card('A')] })
  }
  const [first, second] = await Promise.all([
    fetchScryfallPrintings(uri, fetcher),
    fetchScryfallPrintings(uri, fetcher),
  ])
  assert.deepEqual(
    first.map(({ set }) => set),
    ['old', 'new'],
  )
  first[0].finishes!.pop()
  assert.deepEqual(second[0].finishes, ['nonfoil', 'foil'])
  const exact = await fetchScryfallCardsByIdentifiers(
    [{ set: 'OLD', collector_number: 'A' }],
    fetcher,
  )
  assert.equal(exact[0].set, 'old')
  assert.equal(urls.length, 2)
  assert.equal((await fetchScryfallCard('A', fetcher)).set, 'new')
  assert.equal(urls.length, 3, 'Printing-specific records must not fill name-only cache entries')
  assert.deepEqual((await fetchScryfallPrintings(uri, fetcher))[0].finishes, ['nonfoil', 'foil'])
  assert.equal(urls.length, 3)
})

test('name and printing records expire, explicit refresh fetches again, and clients stay isolated', async (t) => {
  let now = 1_000_000
  t.mock.method(Date, 'now', () => now)
  let calls = 0
  const fetcher: typeof fetch = async (input) => {
    calls++
    const current = { ...card('A'), oracle_text: `Revision ${calls}` }
    return response(String(input).includes('/named') ? current : { data: [current] })
  }
  const uri = card('A').prints_search_uri
  await fetchScryfallCard('A', fetcher)
  await fetchScryfallPrintings(uri, fetcher)
  now += scryfallCacheLifetime - 1
  await fetchScryfallCard('A', fetcher)
  await fetchScryfallPrintings(uri, fetcher)
  assert.equal(calls, 2)
  now++
  assert.equal((await fetchScryfallCard('A', fetcher)).oracle_text, 'Revision 3')
  await fetchScryfallPrintings(uri, fetcher)
  assert.equal(calls, 4)
  clearScryfallCache(fetcher)
  await fetchScryfallCard('A', fetcher)
  await fetchScryfallPrintings(uri, fetcher)
  assert.equal(calls, 6)
  const other: typeof fetch = async () => response(card('A', 'other'))
  assert.equal((await fetchScryfallCard('A', other)).set, 'other')
})

test('refresh during a request does not let the old response overwrite fresh records', async () => {
  const old = Promise.withResolvers<Response>()
  let calls = 0
  const fetcher: typeof fetch = async () =>
    ++calls === 1 ? old.promise : response(card('A', 'fresh'))
  const pending = fetchScryfallCard('A', fetcher)
  clearScryfallCache(fetcher)
  assert.equal((await fetchScryfallCard('A', fetcher)).set, 'fresh')
  old.resolve(response(card('A', 'old')))
  assert.equal((await pending).set, 'old', 'Existing consumers finish with their original result')
  assert.equal((await fetchScryfallCard('A', fetcher)).set, 'fresh')
  assert.equal(calls, 2)
})

test('cancelling one consumer does not abort another consumer of the same bulk record', async () => {
  const result = Promise.withResolvers<Response>()
  let sharedSignal: AbortSignal | null | undefined
  let calls = 0
  const fetcher: typeof fetch = async (_, init) => {
    calls++
    sharedSignal = init?.signal
    return result.promise
  }
  const controller = new AbortController()
  const bulk = fetchScryfallCardsByIdentifiers([{ name: 'A' }], fetcher, controller.signal)
  const remaining = fetchScryfallCard('A', fetcher)
  await tick()
  controller.abort()
  await assert.rejects(bulk, { name: 'AbortError' })
  assert.equal(sharedSignal?.aborted, false)
  result.resolve(response({ data: [card('A')] }))
  assert.equal((await remaining).name, 'A')
  assert.equal((await fetchScryfallCard('A', fetcher)).name, 'A')
  assert.equal(calls, 1)
  await assert.rejects(fetchScryfallCard('A', fetcher, controller.signal), { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('cancelling all consumers aborts shared work and allows immediate retry without stale caching', async () => {
  const old = Promise.withResolvers<Response>()
  const signals: (AbortSignal | null | undefined)[] = []
  const fetcher: typeof fetch = async (_, init) => {
    signals.push(init?.signal)
    return signals.length === 1 ? old.promise : response(card('A', 'fresh'))
  }
  const first = new AbortController()
  const second = new AbortController()
  const a = fetchScryfallCard('A', fetcher, first.signal)
  const b = fetchScryfallCard('A', fetcher, second.signal)
  first.abort()
  second.abort()
  await Promise.all([
    assert.rejects(a, { name: 'AbortError' }),
    assert.rejects(b, { name: 'AbortError' }),
  ])
  assert.equal(signals[0]?.aborted, true)
  assert.equal((await fetchScryfallCard('A', fetcher)).set, 'fresh')
  old.resolve(response(card('A', 'old')))
  await tick()
  assert.equal((await fetchScryfallCard('A', fetcher)).set, 'fresh')
  assert.equal(signals.length, 2)
})

test('printing cancellation is independent, and a cancelled list can be fetched again', async () => {
  const old = Promise.withResolvers<Response>()
  let calls = 0
  const fetcher: typeof fetch = async () =>
    ++calls === 1 ? old.promise : response({ data: [card('A')] })
  const first = new AbortController()
  const uri = card('A').prints_search_uri
  const a = fetchScryfallPrintings(uri, fetcher, first.signal)
  const b = fetchScryfallPrintings(uri, fetcher)
  first.abort()
  await assert.rejects(a, { name: 'AbortError' })
  old.resolve(response({ data: [card('A')] }))
  assert.equal((await b).length, 1)
  clearScryfallCache(fetcher)
  const second = new AbortController()
  second.abort()
  await assert.rejects(fetchScryfallPrintings(uri, fetcher, second.signal), { name: 'AbortError' })
  assert.equal((await fetchScryfallPrintings(uri, fetcher)).length, 1)
  assert.equal(calls, 2)
})

test('missing and failed records are never cached, but successful siblings are reused', async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => {
    calls++
    if (calls === 1) return response({ data: [card('A')], not_found: [{ name: 'B' }] })
    if (calls === 2) return response({}, 400)
    return response({ data: [card('B')] })
  }
  assert.deepEqual(await resolveScryfallIdentifiers([{ name: 'A' }, { name: 'B' }], fetcher), {
    data: [card('A')],
    not_found: [{ name: 'B' }],
  })
  await assert.rejects(
    fetchScryfallCardsByIdentifiers([{ name: 'B' }], fetcher),
    /Scryfall unavailable/,
  )
  assert.deepEqual(
    (await fetchScryfallCardsByIdentifiers([{ name: 'A' }, { name: 'B' }], fetcher)).map(
      ({ name }) => name,
    ),
    ['A', 'B'],
  )
  assert.equal(calls, 3)
  let namedCalls = 0
  const namedFetcher: typeof fetch = async () => response(card('C'), ++namedCalls === 1 ? 404 : 200)
  await assert.rejects(fetchScryfallCard('C', namedFetcher), /card unavailable/)
  assert.equal((await fetchScryfallCard('C', namedFetcher)).name, 'C')
  assert.equal(namedCalls, 2)
})

test('failed or partial printing lists are not cached and cache clearing retains 429 cooldown', async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => {
    calls++
    if (calls === 1) return response({ data: [card('A')], has_more: true, next_page: 'next' })
    if (calls === 2) return response({}, 503)
    return response({ data: [card('A')] })
  }
  const uri = card('A').prints_search_uri
  assert.deepEqual(await fetchScryfallPrintings(uri, fetcher), [])
  assert.equal((await fetchScryfallPrintings(uri, fetcher)).length, 1)
  assert.equal(calls, 3)
  let limitedCalls = 0
  const limited: typeof fetch = async () => {
    limitedCalls++
    return new Response('', { status: 429, headers: { 'Retry-After': '120' } })
  }
  await assert.rejects(fetchScryfallCard('A', limited), /rate limit/)
  clearScryfallCache(limited)
  await assert.rejects(fetchScryfallPrintings(uri, limited), /rate limit/)
  assert.equal(limitedCalls, 1)
  const cached = await fetchScryfallCard('A', async () => response(card('A')))
  assert.equal(cached.name, 'A')
})

test('name-only cache never replaces an explicitly selected printing', async () => {
  const requests: unknown[] = []
  const fetcher: typeof fetch = async (_, init) => {
    requests.push(init?.body)
    return init?.body ? response({ data: [card('A', 'old')] }) : response(card('A'))
  }
  assert.equal((await fetchScryfallCard('A', fetcher)).set, 'new')
  const exact = [{ set: 'old', collector_number: 'A' }]
  assert.equal((await fetchScryfallCardsByIdentifiers(exact, fetcher))[0].set, 'old')
  assert.equal((await fetchScryfallCardsByIdentifiers(exact, fetcher))[0].set, 'old')
  assert.equal((await fetchScryfallCard('A', fetcher)).set, 'new')
  assert.equal(requests.length, 2)
  assert.deepEqual(await fetchScryfallCardsByIdentifiers([], fetcher), [])
})

test('search records warm exact-printing lookups without caching query eligibility', async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => {
    calls++
    return response({ data: [card('A', 'old')] })
  }
  const found = await searchScryfall('set:old legal:commander', fetcher)
  found[0].legalities!.commander = 'banned'
  const exact = await fetchScryfallCardsByIdentifiers(
    [{ set: 'old', collector_number: 'A' }],
    fetcher,
  )
  assert.equal(exact[0].legalities?.commander, 'legal')
  assert.equal(calls, 1)
  await searchScryfall('set:old -is:gamechanger', fetcher)
  assert.equal(calls, 2, 'Changed eligibility must still run the current search query')
})

test('an old search cannot repopulate a cleared cache, and warm lookups still honor cancellation', async () => {
  const old = Promise.withResolvers<Response>()
  let calls = 0
  const fetcher: typeof fetch = async () => (++calls === 1 ? old.promise : response(card('A')))
  const search = searchScryfall('old query', fetcher)
  clearScryfallCache(fetcher)
  await fetchScryfallCard('A', fetcher)
  old.resolve(response({ data: [{ ...card('A'), oracle_text: 'old' }] }))
  await search
  const exact = await fetchScryfallCardsByIdentifiers(
    [{ set: 'new', collector_number: 'A' }],
    fetcher,
  )
  assert.equal(exact[0].oracle_text, undefined)
  assert.equal(calls, 2)
  const controller = new AbortController()
  const warm = fetchScryfallCard('A', fetcher, controller.signal)
  controller.abort()
  await assert.rejects(warm, { name: 'AbortError' })
})
