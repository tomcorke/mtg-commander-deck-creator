import assert from 'node:assert/strict'
import test from 'node:test'
import { toDeckCard, type ScryfallCard } from '../domain/card-model.ts'
import type { SignatureSeed } from '../domain/signature-recommendations.ts'
import { fetchScryfallCard } from '../adapters/scryfall.ts'
import { fetchEdhrecPage } from '../adapters/edhrec.ts'
import {
  loadSignatureResults,
  completeSignatureResults,
  signatureBudget,
  signatureRetryAt,
  signatureWindow,
  watchSignatureResults,
} from './signature-actions.ts'
const raw = (name: string): ScryfallCard => ({
  name,
  type_line: 'Creature',
  oracle_text: 'Put a +1/+1 counter on target creature.',
  color_identity: ['G'],
  legalities: { commander: 'legal' },
  game_changer: false,
  released_at: '2020-01-01',
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
})
const seed: SignatureSeed = {
  card: toDeckCard(raw('Engine')),
  theme: '+1/+1 counters',
  page: 'cards',
}
const page = (names = ['Candidate']) => ({
  container: {
    json_dict: {
      cardlists: [
        {
          tag: 'creatures',
          header: 'Creatures',
          cardviews: names.map((name) => ({ name, lift: 2, num_decks: 200 })),
        },
      ],
    },
  },
})
const signal = () => new AbortController().signal
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

test('network failures back off exponentially, cap at five minutes, and count every retry', async () => {
  let now = Date.now(),
    gets = 0,
    posts = 0
  const budget = signatureBudget(
    () => now,
    () => 0,
  )
  const fetcher: typeof fetch = async (_input, init) => {
    if (!init?.body) {
      if (++gets < 8) throw new TypeError('Network offline')
      return Response.json(page())
    }
    posts++
    return Response.json({ data: [raw('Candidate')] })
  }
  for (const delay of [10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000]) {
    assert.deepEqual(
      await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget),
      [],
    )
    assert.equal(signatureRetryAt('A', [seed], budget), now + delay)
    const count = gets
    await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
    assert.equal(gets, count)
    now += delay
  }
  const results = await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
  assert.equal(results.length, 1)
  assert.equal(budget.attempts.length, 8)
  assert.equal(budget.posts.length, 1)
  // A result discarded by a stale React context can be recovered from warm data before acknowledgement.
  assert.equal(
    (await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)).length,
    1,
  )
  assert.equal(gets, 8)
  assert.equal(posts, 1)
  completeSignatureResults('A', results, budget)
  assert.equal(signatureRetryAt('A', [seed], budget), Infinity)
})

test('hydration retries only the failed step and reapplies current exclusions', async () => {
  let now = Date.now(),
    gets = 0,
    posts = 0
  const requested: string[][] = []
  const budget = signatureBudget(
    () => now,
    () => 0.5,
  )
  const fetcher: typeof fetch = async (_input, init) => {
    if (!init?.body) {
      gets++
      return Response.json(page(['Candidate', 'Now ignored']))
    }
    const names = JSON.parse(String(init.body)).identifiers.map(
      ({ name }: { name: string }) => name,
    ) as string[]
    requested.push(names)
    if (++posts === 1) return Response.json({}, { status: 503 })
    return Response.json({ data: names.map(raw) })
  }
  assert.deepEqual(
    await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget),
    [],
  )
  assert.equal(signatureRetryAt('A', [seed], budget), now + 11_000)
  now += 10_999
  await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
  assert.equal(posts, 1)
  now++
  const results = await loadSignatureResults(
    'A',
    [seed],
    new Set(['now ignored']),
    signal(),
    fetcher,
    budget,
  )
  assert.deepEqual(
    results.map(({ raw }) => raw.name),
    ['Candidate'],
  )
  assert.deepEqual(requested, [['Candidate', 'Now ignored'], ['Candidate']])
  assert.equal(gets, 1)
  assert.equal(posts, 2)
})

test('rate limits and 5xx Retry-After pause both providers without charging blocked calls', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 2_000_000_000_000 })
  for (const provider of ['edhrec', 'scryfall'] as const) {
    for (const status of [429, 503]) {
      let gets = 0,
        posts = 0,
        failed = false
      const budget = signatureBudget(
        () => Date.now(),
        () => 0,
      )
      const fetcher: typeof fetch = async (_input, init) => {
        if (init?.body) posts++
        else gets++
        if (!failed && (provider === 'edhrec' ? !init?.body : init?.body)) {
          failed = true
          return Response.json({}, { status, headers: { 'Retry-After': '90' } })
        }
        return Response.json(init?.body ? { data: [raw('Candidate')] } : page())
      }
      const start = Date.now()
      await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
      assert.equal(signatureRetryAt('A', [seed], budget), start + 90_000)
      const before = gets + posts
      if (provider === 'edhrec') await assert.rejects(fetchEdhrecPage('cards', 'other', fetcher))
      else await assert.rejects(fetchScryfallCard('Other', fetcher))
      assert.equal(gets + posts, before)
      t.mock.timers.tick(89_999)
      await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
      assert.equal(gets + posts, before)
      t.mock.timers.tick(1)
      const results = await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
      assert.equal(results.length, 1)
      assert.equal(budget.attempts.length, provider === 'edhrec' ? 2 : 1)
      assert.equal(budget.posts.length, provider === 'scryfall' ? 2 : 1)
    }
  }
})

test('403, 404, invalid JSON and invalid shapes stop without periodic retries', async () => {
  for (const stage of ['source', 'hydration']) {
    for (const response of [
      () => Response.json({}, { status: 403 }),
      () => Response.json({}, { status: 404 }),
      () => new Response('not JSON'),
      () => Response.json({ unexpected: true }),
      () => Response.json(null),
    ]) {
      let calls = 0,
        now = Date.now()
      const budget = signatureBudget(() => now)
      const fetcher: typeof fetch = async (_input, init) => {
        calls++
        return stage === 'hydration' && !init?.body ? Response.json(page()) : response()
      }
      assert.deepEqual(
        await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget),
        [],
      )
      assert.equal(signatureRetryAt('A', [seed], budget), Infinity)
      const before = calls
      now += 2 * signatureWindow
      await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
      assert.equal(calls, before)
    }
  }
})

test('exhausted retry budgets pause until rolling replenishment rather than abandoning work', async () => {
  let now = Date.now(),
    calls = 0
  const budget = signatureBudget(
    () => now,
    () => 0,
  )
  const fetcher: typeof fetch = async () => {
    calls++
    throw new TypeError('Offline')
  }
  for (let index = 0; index < 8; index++) {
    await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
    if (index < 7) now = signatureRetryAt('A', [seed], budget)
  }
  const boundary = budget.attempts[0] + signatureWindow
  assert.equal(signatureRetryAt('A', [seed], budget), boundary)
  now = boundary - 1
  await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
  assert.equal(calls, 8)
  now = boundary
  await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
  assert.equal(calls, 9)
  assert.equal(budget.attempts.length, 8)
})

test('aborting an in-flight request retains pending work and spent allowance', async () => {
  let calls = 0
  const budget = signatureBudget(),
    controller = new AbortController()
  const fetcher: typeof fetch = async (_input, init) => {
    if (++calls > 1) return Response.json(page([]))
    return new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
    )
  }
  const loading = loadSignatureResults('A', [seed], new Set(), controller.signal, fetcher, budget)
  await tick()
  controller.abort()
  await assert.rejects(loading, { name: 'AbortError' })
  assert.equal(budget.attempts.length, 1)
  assert.equal(signatureRetryAt('A', [seed], budget), 0)
  await loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
  assert.equal(calls, 2)
  assert.equal(budget.attempts.length, 2)
  assert.equal(signatureRetryAt('A', [seed], budget), Infinity)
})

test('foreground promotion of queued hydration does not consume background POST allowance', async () => {
  const first = Promise.withResolvers<Response>(),
    second = Promise.withResolvers<Response>()
  let posts = 0
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('json.edhrec.com')) return Response.json(page())
    if (init?.body) {
      posts++
      return Response.json({ data: [raw('Candidate')] })
    }
    return url.includes('First') ? first.promise : second.promise
  }
  const a = fetchScryfallCard('First', fetcher),
    b = fetchScryfallCard('Second', fetcher)
  const budget = signatureBudget()
  const background = loadSignatureResults('A', [seed], new Set(), signal(), fetcher, budget)
  await tick()
  await tick()
  const foreground = fetchScryfallCard('Candidate', fetcher)
  first.resolve(Response.json(raw('First')))
  second.resolve(Response.json(raw('Second')))
  await Promise.all([a, b, foreground, background])
  assert.equal(posts, 1)
  assert.equal(budget.attempts.length, 1)
  assert.equal(budget.posts.length, 0)
})

test('watcher uses one due-time timer, stops on completion, and aborts a long budget pause', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 2_000_000_000_000 })
  const controller = new AbortController()
  let calls = 0
  watchSignatureResults(async () => {
    calls++
    return Date.now() + signatureWindow
  }, controller.signal)
  t.mock.timers.tick(1999)
  await tick()
  assert.equal(calls, 0)
  t.mock.timers.tick(1)
  await tick()
  assert.equal(calls, 1)
  t.mock.timers.tick(signatureWindow - 1)
  await tick()
  assert.equal(calls, 1)
  t.mock.timers.tick(1)
  await tick()
  assert.equal(calls, 2)
  controller.abort()
  t.mock.timers.tick(10 * signatureWindow)
  await tick()
  assert.equal(calls, 2)
  watchSignatureResults(async () => {
    calls++
    return Infinity
  }, signal())
  t.mock.timers.tick(2000)
  await tick()
  assert.equal(calls, 3)
  t.mock.timers.tick(10 * signatureWindow)
  await tick()
  assert.equal(calls, 3)
})
