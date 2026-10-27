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
        allowedSets: [],
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
  assert.equal(built.state.deck.length, 2)
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
