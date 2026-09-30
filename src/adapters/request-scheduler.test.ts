import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchScryfallCard, fetchScryfallCardsByIdentifiers } from './scryfall.ts'
import { fetchEdhrecPage } from './edhrec.ts'
import type { ScryfallCard } from '../domain/card-model.ts'
const raw = (name: string): ScryfallCard => ({
  name,
  type_line: 'Creature',
  color_identity: [],
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
})
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('slow Scryfall requests occupy at most two slots; foreground wins the next free slot', async () => {
  const first = Promise.withResolvers<Response>(),
    second = Promise.withResolvers<Response>()
  const calls: string[] = [],
    times: number[] = []
  let active = 0,
    peak = 0
  const fetcher: typeof fetch = async (input, init) => {
    calls.push(String(input))
    times.push(performance.now())
    peak = Math.max(peak, ++active)
    try {
      if (calls.length === 1) return await first.promise
      if (calls.length === 2) return await second.promise
      return init?.body
        ? Response.json({ data: [raw('Background')] })
        : Response.json(raw('Foreground'))
    } finally {
      active--
    }
  }
  const a = fetchScryfallCard('First', fetcher),
    b = fetchScryfallCard('Second', fetcher)
  const background = fetchScryfallCardsByIdentifiers([{ name: 'Background' }], fetcher, undefined, {
    background: true,
  })
  const foreground = fetchScryfallCard('Foreground', fetcher)
  await wait(1100)
  assert.equal(calls.length, 2)
  assert.equal(active, 2)
  first.resolve(Response.json(raw('First')))
  await a
  await foreground
  assert(calls[2].includes('Foreground'))
  second.resolve(Response.json(raw('Second')))
  await Promise.all([b, background])
  assert.equal(peak, 2)
  assert.equal(calls.length, 4)
  for (let index = 1; index < times.length; index++) assert(times[index] - times[index - 1] >= 500)
})

test('Scryfall slots include slowly streamed bodies, not just response headers', async () => {
  const bodies: ReadableStreamDefaultController<Uint8Array>[] = []
  let calls = 0
  const fetcher: typeof fetch = async () => {
    if (++calls > 2) return Response.json(raw('Third'))
    return new Response(
      new ReadableStream<Uint8Array>({
        start: (body) => {
          bodies.push(body)
        },
      }),
    )
  }
  const requests = ['First', 'Second', 'Third'].map((name) => fetchScryfallCard(name, fetcher))
  await wait(1100)
  assert.equal(calls, 2)
  for (const [index, body] of bodies.entries()) {
    body.enqueue(new TextEncoder().encode(JSON.stringify(raw(index ? 'Second' : 'First'))))
    body.close()
  }
  assert.equal((await Promise.all(requests)).length, 3)
  assert.equal(calls, 3)
})

test('EDHREC remains serialized even when a response exceeds the pacing interval', async () => {
  const first = Promise.withResolvers<Response>()
  let active = 0,
    peak = 0,
    calls = 0
  const page = { container: { json_dict: { cardlists: [] } } }
  const fetcher: typeof fetch = async () => {
    peak = Math.max(peak, ++active)
    try {
      return ++calls === 1 ? await first.promise : Response.json(page)
    } finally {
      active--
    }
  }
  const a = fetchEdhrecPage('cards', 'first', fetcher),
    b = fetchEdhrecPage('cards', 'second', fetcher)
  await wait(1100)
  assert.equal(calls, 1)
  first.resolve(Response.json(page))
  await Promise.all([a, b])
  assert.equal(calls, 2)
  assert.equal(peak, 1)
})
