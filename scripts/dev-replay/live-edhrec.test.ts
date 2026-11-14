import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test, { type TestContext } from 'node:test'
import { createServer } from 'vite'
import { liveEdhrecSession } from '../live-edhrec.ts'
import { devReplay, inside } from './plugin.ts'
import { createReplayStore } from './store.ts'

const commander = new URL('https://json.edhrec.com/pages/commanders/synthetic-commander.json')
const syntheticPage = { container: { json_dict: { cardlists: [] } }, synthetic: true }
const realFetch = globalThis.fetch

async function cache(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'dev-replay-edhrec-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

test('the recorder refuses EDHREC unless a live session opts in', async (t) => {
  const directory = await cache(t)
  let calls = 0
  const upstream: typeof fetch = async () => {
    calls++
    return Response.json(syntheticPage)
  }
  await assert.rejects(
    createReplayStore(directory, 'record', upstream).request(commander),
    /Unsupported provider endpoint/,
  )
  assert.throws(
    () => createReplayStore(directory, 'replay', upstream, liveEdhrecSession({ mode: 'test' })),
    /needs a recorder/,
  )
  const edhrec = liveEdhrecSession({ mode: 'test', fetcher: upstream })
  const record = createReplayStore(directory, 'record', upstream, edhrec)
  assert.equal((await record.request(commander)).headers.get('x-dev-replay'), 'recorded')
  assert.equal((await record.request(commander)).headers.get('x-dev-replay'), 'hit')
  await assert.rejects(
    record.request(new URL('https://json.edhrec.com/pages/themes/tokens.json')),
    /Unsupported provider endpoint/,
  )
  assert.equal(calls, 1)
  assert.equal(edhrec.pages, 1)
})

/** Starts the real plugin on a free port with a mocked upstream; returns a same-origin getter. */
async function server(t: TestContext, edhrec: 'synthetic' | 'live', mode: 'record' | 'replay') {
  const directory = await cache(t)
  // Replay needs a pinned index; pin it as unavailable.
  if (mode === 'replay') await writeFile(join(directory, 'index.json'), 'null')
  const previous = process.env.DEV_REPLAY_CACHE_DIR
  process.env.DEV_REPLAY_CACHE_DIR = directory
  t.after(() => {
    if (previous === undefined) delete process.env.DEV_REPLAY_CACHE_DIR
    else process.env.DEV_REPLAY_CACHE_DIR = previous
  })
  const upstream: string[] = []
  const responses: Record<string, number> = {}
  t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
    const url = String(input)
    upstream.push(url)
    return Response.json(syntheticPage, { status: responses[url] ?? 200 })
  })
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [devReplay(mode, { edhrec })],
    server: { host: '127.0.0.1', port: 0 },
  })
  await vite.listen()
  t.after(() => vite.close())
  const base = vite.resolvedUrls!.local[0]
  const get = async (url: URL | string) => {
    const response = await realFetch(
      new URL(`/__dev-provider?url=${encodeURIComponent(String(url))}`, base),
    )
    return { status: response.status, source: response.headers.get('x-dev-replay') }
  }
  const status = async () => (await realFetch(new URL('/__dev-replay/status', base))).json()
  return { get, status, upstream, responses }
}

test('default dev:record serves the synthetic fixture without contacting EDHREC', async (t) => {
  const { get, status, upstream } = await server(t, 'synthetic', 'record')
  assert.deepEqual(await get(commander), { status: 200, source: 'fixture' })
  assert.deepEqual(upstream, [])
  assert.equal((await status()).edhrec, 'synthetic')
})

test('dev:replay stays synthetic even when live is requested', async (t) => {
  const { get, upstream } = await server(t, 'live', 'replay')
  assert.deepEqual(await get(commander), { status: 200, source: 'fixture' })
  assert.deepEqual(upstream, [])
})

test('DEV_REPLAY_EDHREC=live records pages locally and stops on the first 429', async (t) => {
  const { get, status, upstream, responses } = await server(t, 'live', 'record')
  assert.deepEqual(await get(commander), { status: 200, source: 'recorded' })
  assert.deepEqual(await get(commander), { status: 200, source: 'hit' })
  const limited = 'https://json.edhrec.com/pages/cards/limited-card.json'
  responses[limited] = 429
  assert.equal((await get(limited)).status, 502)
  assert.equal((await get('https://json.edhrec.com/pages/cards/after-stop.json')).status, 502)
  assert.deepEqual(upstream, [commander.href, limited])
  const stats = await status()
  assert.equal(stats.edhrec, 'live')
  assert.equal(stats.edhrecPages, 2)
  assert.equal(stats.edhrecStopped, 'http-429')
})

test('live recording refuses a cache inside the checkout', async (t) => {
  const inside = resolve('.dev-replay-live-edhrec-test')
  t.after(() => rm(inside, { recursive: true, force: true }))
  // A rejected createServer leaves its watcher open, so probe in a child process.
  const child = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
      import { createServer } from 'vite'
      import { devReplay } from './scripts/dev-replay/plugin.ts'
      try {
        await createServer({ configFile: false, logLevel: 'silent', plugins: [devReplay('record', { edhrec: 'live' })], server: { middlewareMode: true } })
      } catch (error) {
        console.error(String(error))
        process.exit(3)
      }
      process.exit(0)
    `,
    ],
    { env: { ...process.env, DEV_REPLAY_CACHE_DIR: inside }, windowsHide: true, timeout: 20_000 },
  )
  assert.equal(child.status, 3, child.stderr?.toString())
  assert.match(child.stderr.toString(), /must stay outside the checkout/)
  assert.equal(existsSync(inside), false)
})

test('the checkout check treats dot-prefixed children as inside and siblings as outside', () => {
  const root = resolve('.')
  assert.equal(inside(root, root), true)
  assert.equal(inside(root, join(root, '..cache', 'missing')), true)
  assert.equal(inside(root, join(root, '..', 'sibling-cache')), false)
  assert.equal(inside(root, tmpdir()), false)
})
