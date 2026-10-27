import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { createBuilderState } from '../../src/domain/builder-state.ts'
import { toCard, type ScryfallCard } from '../../src/domain/card-model.ts'
import { settingsSchema } from './builder-contract.ts'
import { recordBuild, replayBuild } from './recommend.ts'
import { recordPreparation, replayPreparation } from './prepare-provider.ts'

const raw: ScryfallCard = {
  name: 'Synthetic Commander',
  type_line: 'Legendary Creature � Test',
  color_identity: ['G'],
  cmc: 2,
  game_changer: false,
  legalities: { commander: 'legal' },
  oracle_text: '',
  set: 'tst',
  collector_number: '1',
  prints_search_uri: '',
}
function recipe() {
  const defaults = createBuilderState('2026-10-27', 'seed')
  return {
    spec: {
      commander: [raw.name],
      bracket: 2,
      pace: 'Synthetic',
      experience: 'Synthetic',
      theme: 'Tokens',
      idea: 'Synthetic provider preparation proof',
      constraints: {
        totalBudget: null,
        perCardCap: null,
        currency: 'USD',
        allowedSets: [] as string[],
        mustInclude: [],
        mustExclude: [],
      },
    },
    seed: 'seed',
    today: '2026-10-27',
    snapshotId: 'synthetic',
    sourceVersion: 'synthetic',
    policyVersion: 'synthetic',
    settings: settingsSchema.parse(
      Object.fromEntries(
        Object.keys(settingsSchema.shape).map((key) => [
          key,
          defaults[key as keyof typeof defaults],
        ]),
      ),
    ),
    pool: Array.from({ length: 8 }, (_, index) =>
      toCard({ ...raw, name: `Candidate ${index}`, type_line: 'Creature' }, 'Synthetic fixture'),
    ),
  }
}
async function directory(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'deckbuild-provider-prepare-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}
const response =
  (data: ScryfallCard[]): typeof fetch =>
  async () =>
    new Response(JSON.stringify({ data }))

test('provider preparation emits executable pins and replays offline through the CLI', async (t) => {
  const root = await directory(t)
  let calls = 0
  const result = await recordPreparation(root, recipe(), async (url, init) => {
    calls++
    assert.equal(String(url), 'https://api.scryfall.com/cards/collection')
    assert.deepEqual(JSON.parse(String(init?.body)), { identifiers: [{ name: raw.name }] })
    return response([raw])(url, init)
  })
  assert.equal(calls, 1)
  assert.equal(result.status, 'ready')
  if (result.status !== 'ready') throw new Error(JSON.stringify(result))
  const forbidden = () => {
    throw new Error('Network forbidden')
  }
  t.mock.method(globalThis, 'fetch', forbidden)
  assert.deepEqual(await replayPreparation(root, result.manifest), result)
  const commands = [
    {
      reason: 'Use provider-initialized build',
      action: { type: 'decide', name: 'Candidate 0', decision: 'add' },
    },
  ]
  const built = await recordBuild(root, result.pins, commands, undefined, forbidden)
  assert.equal(built.status, 'complete')
  assert.equal(built.state.deck.length, 2, JSON.stringify(built))
  assert.deepEqual(await replayBuild(root, built.manifest, commands), built)
  const cli = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      resolve('scripts/deckbuild/prepare-provider.ts'),
      'replay',
      root,
      result.manifest,
    ],
    { encoding: 'utf8', cwd: tmpdir() },
  )
  assert.equal(cli.status, 0, cli.stderr)
  assert.deepEqual(JSON.parse(cli.stdout), result)
})

test('partner response order does not replace spec order; invalid pairing never emits pins', async (t) => {
  const root = await directory(t)
  const left = { ...raw, oracle_text: 'Partner' }
  const right = { ...left, name: 'Synthetic Partner', color_identity: ['U'] }
  const input = recipe()
  input.spec.commander.push(right.name)
  const result = await recordPreparation(root, input, response([right, left]))
  assert.equal(result.status, 'ready', JSON.stringify(result))
  if (result.status !== 'ready') throw new Error('Expected ready')
  assert.deepEqual(
    (result.pins.initialState as { deck: { name: string }[] }).deck.map((card) => card.name),
    input.spec.commander,
  )
  assert.deepEqual(await replayPreparation(root, result.manifest), result)
  const invalid = await recordPreparation(root, input, response([right, raw]))
  assert.equal(invalid.status, 'invalid')
  assert.equal('pins' in invalid, false)
  assert.deepEqual(await replayPreparation(root, invalid.manifest), invalid)
})

test('missing, malformed and transport failures are sealed outcomes; later success is independent', async (t) => {
  const root = await directory(t)
  for (const fetcher of [
    response([]),
    response([{ ...raw, name: 'Other' }]),
    async () => new Response('{}'),
    async () => new Response('{}', { status: 400 }),
    async () => {
      throw new TypeError('offline')
    },
  ]) {
    const result = await recordPreparation(root, recipe(), fetcher)
    assert.equal(result.status, 'failed', JSON.stringify(result))
    assert.equal('pins' in result, false)
    assert.deepEqual(await replayPreparation(root, result.manifest), result)
  }
  const success = await recordPreparation(root, recipe(), response([raw]))
  assert.equal(success.status, 'ready')
  assert.deepEqual(await replayPreparation(root, success.manifest), success)
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${success.manifest}.json`), 'utf8'),
  )
  await rm(join(root, 'responses', `${manifest.entries[0].response}.json`))
  const missing = await replayPreparation(root, success.manifest)
  assert.equal(missing.status, 'incomplete')
  assert.equal('pins' in missing, false)
})

test('invalid recipe, runtime bounds and state injection reject before network; corrupt data rejects', async (t) => {
  const root = await directory(t)
  let calls = 0
  const fetcher: typeof fetch = async () => {
    calls++
    return new Response('{}')
  }
  for (const input of [
    { ...recipe(), runtimeMs: 0 },
    { ...recipe(), runtimeMs: 600001 },
    { ...recipe(), commanders: [] },
    { ...recipe(), settings: {} },
    { ...recipe(), settings: { ...recipe().settings, maxPrice: 1 } },
  ])
    await assert.rejects(recordPreparation(root, input, fetcher))
  assert.equal(calls, 0)
  await assert.rejects(recordPreparation('.', recipe(), fetcher), /outside/)
  const result = await recordPreparation(root, recipe(), response([raw]))
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${result.manifest}.json`), 'utf8'),
  )
  await writeFile(join(root, 'responses', `${manifest.entries[0].response}.json`), '{}')
  await assert.rejects(replayPreparation(root, result.manifest), /Corrupt/)
})

function searchRecipe() {
  const { pool: _, ...input } = recipe()
  return { ...input, poolSearch: { query: 'synthetic', order: 'name' as const, maxPages: 2 } }
}
const searchResponse = (data: ScryfallCard[], has_more = false) =>
  new Response(JSON.stringify({ data, has_more, total_cards: data.length }))

test('search pool pages prepare executable pins with shared filters and offline replay', async (t) => {
  const root = await directory(t)
  const input = searchRecipe()
  input.spec.constraints.allowedSets.push('tst')
  const urls: string[] = []
  const result = await recordPreparation(root, input, async (url) => {
    urls.push(String(url))
    if (urls.length === 1) return response([raw])(url)
    const candidate = {
      ...raw,
      released_at: '2020-01-01',
      name: 'Retrieved candidate',
      type_line: 'Artifact',
    }
    return urls.length === 2
      ? searchResponse(
          [candidate, { ...candidate, name: 'Wrong identity', color_identity: ['U'] }],
          true,
        )
      : searchResponse([
          candidate,
          ...Array.from({ length: 7 }, (_, i) => ({ ...candidate, name: `Extra ${i}` })),
          { ...candidate, name: 'Wrong set', set: 'bad' },
          raw,
        ])
  })
  assert.equal(result.status, 'ready', JSON.stringify(result))
  if (result.status !== 'ready') throw new Error('Expected ready')
  assert.equal(urls.length, 3)
  assert.equal(new URL(urls[2]).searchParams.get('page'), '2')
  assert.deepEqual(
    (result.pins.initialState as { queue: { name: string }[] }).queue.map((c) => c.name).sort(),
    ['Retrieved candidate', ...Array.from({ length: 7 }, (_, i) => `Extra ${i}`)].sort(),
  )
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network forbidden')
  })
  assert.deepEqual(await replayPreparation(root, result.manifest), result)
  const commands = [
    {
      reason: 'Use retrieved pool',
      action: { type: 'decide', name: 'Retrieved candidate', decision: 'add' },
    },
  ]
  const built = await recordBuild(root, result.pins, commands)
  assert.equal(built.state.deck.length, 2, JSON.stringify(built))
  assert.deepEqual(await replayBuild(root, built.manifest, commands), built)
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${result.manifest}.json`), 'utf8'),
  )
  const path = join(root, 'responses', `${manifest.entries[2].response}.json`)
  const original = await readFile(path, 'utf8')
  await writeFile(path, '{}')
  await assert.rejects(replayPreparation(root, result.manifest), /Corrupt/)
  await writeFile(path, original)
  await rm(path)
  assert.equal((await replayPreparation(root, result.manifest)).status, 'incomplete')
})

test('search pool failures, empty results and truncation remain replayable without partial pins', async (t) => {
  const root = await directory(t)
  for (const [fetcher, expected] of [
    [async () => searchResponse([], true), 'limit'],
    [async () => new Response('{}', { status: 400 }), 'failed'],
    [async () => new Response('{}'), 'failed'],
    [
      async () => {
        throw new TypeError('offline')
      },
      'failed',
    ],
    [async () => searchResponse([]), 'ready'],
  ] as const) {
    let calls = 0
    const result = await recordPreparation(root, searchRecipe(), async (url, init) =>
      ++calls === 1 ? response([raw])(url, init) : fetcher(),
    )
    assert.equal(result.status, expected, JSON.stringify(result))
    assert.equal('pins' in result, expected === 'ready')
    assert.deepEqual(await replayPreparation(root, result.manifest), result)
  }
})

test('pool recipe requires exactly one source and bounded search before transport', async (t) => {
  const root = await directory(t)
  const input = searchRecipe()
  for (const invalid of [
    { ...input, pool: [] },
    { ...input, poolSearch: undefined },
    ...[0, 21].map((maxPages) => ({ ...input, poolSearch: { ...input.poolSearch, maxPages } })),
    { ...input, poolSearch: { ...input.poolSearch, query: '' } },
    { ...input, poolSearch: { ...input.poolSearch, order: 'random' } },
  ])
    await assert.rejects(
      recordPreparation(root, invalid, async () => {
        throw new Error('Must not fetch')
      }),
    )
})
