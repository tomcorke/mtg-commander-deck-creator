import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRequestActivity,
  observeRequestActivity,
  scheduleRequest,
  setRequestCooldown,
} from './request-scheduler.ts'
import { fetchScryfallCard } from './scryfall.ts'
import { fetchEdhrecPage } from './edhrec.ts'
import { watchSignatureResults } from '../app/signature-actions.ts'

const tick = () => new Promise((resolve) => setImmediate(resolve))

test('activity counts shared calls once, tracks body transfer and queued cancellation, and ignores cache hits', async () => {
  const body = Promise.withResolvers<ReadableStreamDefaultController<Uint8Array>>()
  const fetcher: typeof fetch = async () =>
    new Response(new ReadableStream({ start: body.resolve }))
  let notifications = 0
  const unsubscribe = observeRequestActivity(() => notifications++, fetcher)
  const a = fetchScryfallCard('First', fetcher)
  const joined = fetchScryfallCard('First', fetcher)
  await tick()
  assert.deepEqual(getRequestActivity(fetcher).providers[1], {
    name: 'Scryfall',
    active: 1,
    queued: 0,
    cooldownUntil: 0,
  })
  const controller = new AbortController()
  const cancelled = fetchScryfallCard('Cancelled', fetcher, controller.signal)
  const rejected = assert.rejects(cancelled, { name: 'AbortError' })
  await tick()
  assert.equal(getRequestActivity(fetcher).providers[1].queued, 1)
  controller.abort()
  await rejected
  assert.equal(getRequestActivity(fetcher).providers[1].queued, 0)
  assert.equal(getRequestActivity(fetcher).providers[1].active, 1)
  const stream = await body.promise
  stream.enqueue(
    new TextEncoder().encode(
      JSON.stringify({
        name: 'First',
        type_line: 'Creature',
        color_identity: [],
        set: 'tst',
        collector_number: '1',
        prints_search_uri: '',
      }),
    ),
  )
  stream.close()
  await Promise.all([a, joined])
  await tick()
  assert.equal(getRequestActivity(fetcher).providers[1].active, 0)
  const snapshot = getRequestActivity(fetcher),
    updates = notifications
  await fetchScryfallCard('First', fetcher)
  assert.equal(getRequestActivity(fetcher), snapshot)
  assert.equal(notifications, updates)
  unsubscribe()
  setRequestCooldown(fetcher, 500, Date.now() + 60_000)
  assert.equal(notifications, updates)
})

test('provider lanes and fetch clients are isolated; rejected requests release active slots', async () => {
  const fetcher: typeof fetch = async () => Response.json({})
  const other: typeof fetch = async () => Response.json({})
  const held = Promise.withResolvers<void>()
  const scryfall = scheduleRequest(fetcher, 500, () => held.promise)
  const edhrec = scheduleRequest(
    fetcher,
    1000,
    async () => {
      throw new Error('offline')
    },
    undefined,
    {},
    true,
  )
  await assert.rejects(edhrec, /offline/)
  await tick()
  assert.equal(getRequestActivity(fetcher).providers[0].active, 0)
  assert.equal(getRequestActivity(fetcher).providers[1].active, 1)
  assert.equal(getRequestActivity(other).providers[1].active, 0)
  assert.equal(getRequestActivity(fetcher), getRequestActivity(fetcher))
  held.resolve()
  await scryfall
  await tick()
  assert.equal(getRequestActivity(fetcher).providers[1].active, 0)
})

test('both adapters expose cooldowns separately from their queues and preserve the later deadline', async () => {
  const fetcher: typeof fetch = async () =>
    new Response(null, { status: 429, headers: { 'Retry-After': '60' } })
  await assert.rejects(fetchScryfallCard('First', fetcher))
  await assert.rejects(fetchEdhrecPage('cards', 'first', fetcher))
  await tick()
  for (const provider of getRequestActivity(fetcher).providers) {
    assert.equal(provider.active, 0)
    assert.equal(provider.queued, 0)
    assert(provider.cooldownUntil > Date.now())
  }
  const later = getRequestActivity(fetcher).providers[1].cooldownUntil
  setRequestCooldown(fetcher, 500, later - 1000)
  assert.equal(getRequestActivity(fetcher).providers[1].cooldownUntil, later)
})

test('background retry waits are not queued requests; abort removes waits without erasing another watcher', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const fetcher: typeof fetch = async () => Response.json({})
  const a = new AbortController(),
    b = new AbortController()
  watchSignatureResults(async () => 61_000, a.signal, fetcher)
  watchSignatureResults(async () => 91_000, b.signal, fetcher)
  t.mock.timers.tick(2000)
  await tick()
  assert.equal(getRequestActivity(fetcher).backgroundRetryAt, 61_000)
  assert.equal(getRequestActivity(fetcher).providers[0].queued, 0)
  assert.equal(getRequestActivity(fetcher).providers[1].queued, 0)
  a.abort()
  assert.equal(getRequestActivity(fetcher).backgroundRetryAt, 91_000)
  b.abort()
  assert.equal(getRequestActivity(fetcher).backgroundRetryAt, 0)
})
