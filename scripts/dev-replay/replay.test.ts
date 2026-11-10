import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { approvedRequest, createReplayStore } from './store.ts'
import { imageCatalog } from './images.ts'
import { replayTransform } from './transform.ts'

const named = new URL('https://api.scryfall.com/cards/named?exact=Sol+Ring')
test('random commander queries record and replay each distinct re-roll without upstream calls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dev-random-replay-'))
  const first = new URL('https://api.scryfall.com/cards/random?q=is%3Acommander')
  const next = new URL(`${first.href}%20-oracleid%3Aprevious`)
  try {
    const record = createReplayStore(directory, 'record', async (url) =>
      Response.json({ url: String(url) }),
    )
    await record.request(first)
    await record.request(next)
    const replay = createReplayStore(directory, 'replay', async () => {
      throw new Error('Forbidden upstream')
    })
    assert.deepEqual(await (await replay.request(first)).json(), { url: first.href })
    assert.deepEqual(await (await replay.request(next)).json(), { url: next.href })
    assert.equal(replay.stats.upstream, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
test('record persists/coalesces; replay hits, misses, and corruption never dispatch upstream', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dev-replay-'))
  let calls = 0
  const upstream: typeof fetch = async () => {
    calls++
    return Response.json({ name: 'Sol Ring' })
  }
  try {
    const record = createReplayStore(directory, 'record', upstream)
    const results = await Promise.all([record.request(named), record.request(named)])
    assert.deepEqual(await results[0].json(), await results[1].json())
    assert.equal(calls, 1)
    const replay = createReplayStore(directory, 'replay', async () => {
      throw new Error('Forbidden upstream')
    })
    assert.equal((await replay.request(named)).headers.get('x-dev-replay'), 'hit')
    await assert.rejects(
      replay.request(new URL('https://api.scryfall.com/sets')),
      /DEV_REPLAY_MISS/,
    )
    assert.equal(replay.stats.upstream, 0)
    const file = join(directory, (await readdir(directory))[0])
    const entry = JSON.parse(await readFile(file, 'utf8'))
    await writeFile(file, JSON.stringify({ ...entry, bytes: 'e30=' }))
    await assert.rejects(replay.request(named), /Corrupt replay entry/)
    assert.equal(replay.stats.upstream, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('POST keys canonicalize objects and distinguish collection arrays and methods', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dev-replay-'))
  let calls = 0
  const url = new URL('https://api.scryfall.com/cards/collection')
  try {
    const record = createReplayStore(directory, 'record', async () =>
      Response.json({ call: ++calls }),
    )
    await record.request(url, 'POST', '{"identifiers":[{"name":"A","set":"x"}]}')
    await record.request(url, 'POST', '{"identifiers":[{"set":"x","name":"A"}]}')
    await record.request(url, 'POST', '{"identifiers":[{"name":"B"}]}')
    assert.equal(calls, 2)
    const replay = createReplayStore(directory, 'replay')
    await assert.rejects(replay.request(url), /Unsupported/)
    await assert.rejects(
      replay.request(url, 'POST', '{"identifiers":[{"name":"A"},{"name":"B"}]}'),
      /DEV_REPLAY_MISS/,
    )
    assert.equal(replay.stats.upstream, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('record paces misses and never persists provider throttles', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dev-replay-'))
  const times: number[] = []
  try {
    const record = createReplayStore(directory, 'record', async () => {
      times.push(Date.now())
      return times.length === 1
        ? Response.json({})
        : new Response('slow down', { status: 429, headers: { 'Retry-After': '30' } })
    })
    await Promise.all([
      record.request(named),
      record.request(new URL('https://api.scryfall.com/sets')),
    ])
    assert(times[1] - times[0] >= 490)
    await assert.rejects(
      record.request(new URL('https://api.scryfall.com/symbology')),
      /cooling down/,
    )
    assert.equal(times.length, 2)
    assert.equal((await readdir(directory)).filter((file) => file.endsWith('.json')).length, 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('transport rejects non-allowlisted destinations, redirects formats, and invalid POSTs', () => {
  for (const value of [
    'http://api.scryfall.com/sets',
    'https://localhost/sets',
    'https://api.scryfall.com:444/sets',
    'https://user@api.scryfall.com/sets',
    'https://api.scryfall.com/cards/manifest',
    'https://api.scryfall.com/cards/named?format=image',
    'https://cards.scryfall.io/normal/front/a.jpg',
    'https://json.edhrec.com/pages/commanders/meren.json',
  ])
    assert.throws(() => approvedRequest(new URL(value), 'GET', ''))
  assert.throws(() =>
    approvedRequest(
      new URL('https://api.scryfall.com/cards/collection'),
      'POST',
      '{"identifiers":[]}',
    ),
  )
})

test('SVG uses metadata safely and differentiates faces with no embedded scan', () => {
  const catalog = imageCatalog()
  const url = new URL('https://cards.scryfall.io/normal/front/a.jpg')
  catalog.remember({
    name: '<script>x</script>',
    mana_cost: '{2}{G}',
    color_identity: ['G'],
    image_uris: { normal: url.href },
  })
  const svg = catalog.svg(url)
  assert(svg.includes('&#60;script&#62;'))
  assert(svg.includes('{2}{G}'))
  assert(svg.includes('width="488" height="680"'))
  assert(!svg.includes('<script>') && !svg.includes('href='))
  assert.notEqual(svg, catalog.svg(new URL('https://cards.scryfall.io/normal/back/a.jpg')))
})

test('dev transform covers current image, fetch, background and preload boundaries', async () => {
  const root = resolve(import.meta.dirname, '../../src')
  const files = [
    'adapters/scryfall.ts',
    'adapters/edhrec.ts',
    'shared/CardArt.tsx',
    'shared/SmallCardImage.tsx',
    'shared/CardReference.tsx',
    'shared/CardImagePreview.tsx',
    'shared/ManaSymbols.tsx',
    'shared/foil/hover-foil.ts',
    'features/builder/CommanderCardArt.tsx',
    'features/builder/PlayStyleStep.tsx',
    'features/builder/BuilderView.tsx',
    'features/builder/DeckDoctorView.tsx',
    'features/builder/reveal-batch.ts',
    'app/deck-actions.ts',
    'shared/SetPicker.tsx',
    'dev/FoilStage.tsx',
    'dev/FoilSheet.tsx',
    'dev/FoilPreview.tsx',
    'dev/FlipPreview.tsx',
  ]
  for (const file of files) {
    const code = await readFile(join(root, file), 'utf8')
    const transformed = replayTransform(code, file)
    assert(transformed?.includes('resourceUrl'), file)
    assert(!/\bsrc=\{(?!resourceUrl)/.test(transformed!), file)
  }
})

test('dev transform routes global fetch and leaves object methods intact', () => {
  const code = replayTransform('fetch(url); client.fetch(url)', 'example.ts')!
  assert(code.includes('replayFetch(url); client.fetch(url)'))
})

test('recorder releases its lock synchronously on SIGINT', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dev-replay-signal-'))
  try {
    const child = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
      import { createServer } from 'vite'
      import { devReplay } from './scripts/dev-replay/plugin.ts'
      await createServer({ configFile: false, plugins: [devReplay('record')], server: { middlewareMode: true } })
      process.emit('SIGINT')
      process.exit(99)
    `,
      ],
      {
        env: { ...process.env, DEV_REPLAY_CACHE_DIR: directory },
        windowsHide: true,
        timeout: 20_000,
      },
    )
    assert.equal(child.status, 130, child.stderr?.toString())
    await assert.rejects(readFile(join(directory, 'recorder.lock')), { code: 'ENOENT' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('date-bounded searches replay after the day changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dev-replay-'))
  const search = (day: string) =>
    new URL(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`set:abc date<=${day}`)}`)
  try {
    const record = createReplayStore(directory, 'record', async () => Response.json({ total: 4 }))
    await record.request(search('2026-11-05'))
    const replay = createReplayStore(directory, 'replay')
    assert.deepEqual(await (await replay.request(search('2026-11-06'))).json(), { total: 4 })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
