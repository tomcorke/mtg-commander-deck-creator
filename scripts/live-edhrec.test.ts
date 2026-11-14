import assert from 'node:assert/strict'
import test from 'node:test'
import {
  edhrecSourceSetting,
  formatRunLog,
  isEdhrecPage,
  LiveEdhrecError,
  liveEdhrecPolicy,
  liveEdhrecSession,
  liveEdhrecUserAgent,
} from './live-edhrec.ts'

const page = (slug: string, kind = 'commanders') =>
  new URL(`https://json.edhrec.com/pages/${kind}/${slug}.json`)
const syntheticBody = { container: { json_dict: { cardlists: [] } } }

/** A fake clock: `sleep` advances time instead of waiting. */
function harness(
  respond: (url: URL, call: number) => Response = () => Response.json(syntheticBody),
) {
  let time = Date.parse('2026-11-14T12:00:00Z')
  const calls: { url: URL; at: number; init?: RequestInit }[] = []
  const sleeps: number[] = []
  const session = liveEdhrecSession({
    mode: 'test',
    now: () => time,
    sleep: async (ms) => {
      sleeps.push(ms)
      time += ms
    },
    fetcher: async (input, init) => {
      const url = new URL(String(input))
      calls.push({ url, at: time, init })
      time += 10
      return respond(url, calls.length)
    },
  })
  return { session, calls, sleeps, advance: (ms: number) => (time += ms) }
}

test('only commander and card page GETs are allowed', () => {
  assert.equal(isEdhrecPage(page('atraxa-praetors-voice')), true)
  assert.equal(isEdhrecPage(page('sol-ring', 'cards')), true)
  for (const url of [
    'https://json.edhrec.com/pages/themes/tokens.json',
    'https://json.edhrec.com/pages/commanders.json',
    'https://json.edhrec.com/pages/commanders/a/b.json',
    'https://json.edhrec.com/pages/commanders/Atraxa.json',
    'https://json.edhrec.com/pages/commanders/atraxa.json?x=1',
    'https://json.edhrec.com/pages/commanders/atraxa.json#x',
    'http://json.edhrec.com/pages/commanders/atraxa.json',
    'https://json.edhrec.com:8443/pages/commanders/atraxa.json',
    'https://edhrec.com/pages/commanders/atraxa.json',
    'https://json.edhrec.com/sitemap.xml',
  ])
    assert.equal(isEdhrecPage(new URL(url)), false, url)
  assert.equal(isEdhrecPage(page('atraxa'), 'POST'), false)
})

test('requests are serial, spaced at least one second apart and identify the app', async () => {
  const { session, calls } = harness()
  await Promise.all(['a', 'b', 'c'].map((slug) => session.fetch(page(slug))))
  assert.deepEqual(
    calls.map(({ url }) => url.pathname),
    ['/pages/commanders/a.json', '/pages/commanders/b.json', '/pages/commanders/c.json'],
  )
  for (let i = 1; i < calls.length; i++)
    assert.ok(calls[i].at - calls[i - 1].at >= liveEdhrecPolicy.spacingMs)
  const headers = new Headers(calls[0].init?.headers)
  assert.equal(headers.get('User-Agent'), liveEdhrecUserAgent)
  assert.equal(calls[0].init?.redirect, 'error')
  assert.equal(calls[0].init?.method, 'GET')
})

test('Retry-After on a successful page delays the next request', async () => {
  const { session, calls } = harness((_url, call) =>
    call === 1
      ? Response.json(syntheticBody, { headers: { 'Retry-After': '5' } })
      : Response.json(syntheticBody),
  )
  await session.fetch(page('a'))
  await session.fetch(page('b'))
  const gap = calls[1].at - calls[0].at
  assert.ok(gap >= 5000 && gap < 6000, String(gap))
})

test('Retry-After as an HTTP date is read against the response Date', async () => {
  const { session, calls } = harness((_url, call) =>
    call === 1
      ? Response.json(syntheticBody, {
          headers: {
            Date: 'Sat, 14 Nov 2026 08:00:00 GMT',
            'Retry-After': 'Sat, 14 Nov 2026 08:00:20 GMT',
          },
        })
      : Response.json(syntheticBody),
  )
  await session.fetch(page('a'))
  await session.fetch(page('b'))
  const gap = calls[1].at - calls[0].at
  assert.ok(gap >= 20_000 && gap < 21_000, String(gap))
})

test(`the run stops after ${liveEdhrecPolicy.maxPages} pages`, async () => {
  const { session, calls } = harness()
  for (let i = 0; i < liveEdhrecPolicy.maxPages; i++) await session.fetch(page(`card-${i}`))
  await assert.rejects(session.fetch(page('one-more')), /Live EDHREC stopped \(page-cap\)/)
  await assert.rejects(session.fetch(page('another')), LiveEdhrecError)
  assert.equal(calls.length, liveEdhrecPolicy.maxPages)
  assert.deepEqual(session.finish(), {
    date: '2026-11-14',
    mode: 'test',
    pages: 50,
    stopReason: 'page-cap',
  })
})

for (const status of [403, 429, 500, 502, 503])
  test(`HTTP ${status} stops the run before any further request`, async () => {
    const { session, calls } = harness((_url, call) =>
      call === 2
        ? new Response('stop', { status, headers: { 'Retry-After': '30' } })
        : Response.json(syntheticBody),
    )
    assert.equal((await session.fetch(page('a'))).status, 200)
    await assert.rejects(
      session.fetch(page('b')),
      new RegExp(`Live EDHREC stopped \\(http-${status}\\).*Retry-After 30`),
    )
    await assert.rejects(session.fetch(page('c')), /already stopped/)
    assert.equal(calls.length, 2)
    assert.equal(session.finish('completed').stopReason, `http-${status}`)
  })

test('non-stop statuses such as 404 return to the caller and the run continues', async () => {
  const { session, calls } = harness((_url, call) =>
    call === 1 ? new Response('missing', { status: 404 }) : Response.json(syntheticBody),
  )
  assert.equal((await session.fetch(page('missing'))).status, 404)
  assert.equal((await session.fetch(page('next'))).status, 200)
  assert.equal(calls.length, 2)
  assert.equal(session.finish().stopReason, 'completed')
})

test('refused URLs never reach the network and do not use the page budget', async () => {
  const { session, calls } = harness()
  await assert.rejects(
    session.fetch(new URL('https://json.edhrec.com/pages/themes/tokens.json')),
    /refuses GET/,
  )
  assert.equal(calls.length, 0)
  assert.equal(session.pages, 0)
  assert.equal(session.stopped, undefined)
})

test('run log rows record date, mode, page count and stop reason', () => {
  assert.equal(
    formatRunLog({ date: '2026-11-14', mode: 'dev:record', pages: 12, stopReason: 'http-429' }),
    '| 2026-11-14 | dev:record | 12/50 | http-429 |',
  )
})

test('DEV_REPLAY_EDHREC defaults to synthetic and rejects typos', () => {
  assert.equal(edhrecSourceSetting(undefined), 'synthetic')
  assert.equal(edhrecSourceSetting(''), 'synthetic')
  assert.equal(edhrecSourceSetting('synthetic'), 'synthetic')
  assert.equal(edhrecSourceSetting('live'), 'live')
  assert.throws(() => edhrecSourceSetting('LIVE'), /must be "synthetic" or "live"/)
})
