import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { createBuilderState } from '../../src/domain/builder-state.ts'
import { builderPoolKey } from '../../src/domain/builder-settings.ts'
import {
  toCard,
  toDeckCardFromRecommendation,
  type ScryfallCard,
} from '../../src/domain/card-model.ts'
import { settingsSchema } from './builder-contract.ts'
import { prepareBuild } from './prepare.ts'
import { recordBuild, replayBuild } from './recommend.ts'

function recipe() {
  const card = toCard(
    {
      name: 'Synthetic Commander',
      type_line: 'Legendary Creature — Test',
      color_identity: ['G'],
      cmc: 2,
      game_changer: false,
      legalities: { commander: 'legal' },
      oracle_text: '',
      set: 'tst',
      collector_number: '1',
      prints_search_uri: '',
    } as ScryfallCard,
    'Synthetic fixture',
  )
  const defaults = createBuilderState('2026-10-27', 'seed')
  return {
    spec: {
      commander: [card.name],
      bracket: 2,
      pace: 'Synthetic',
      experience: 'Synthetic',
      theme: 'Tokens',
      idea: 'Synthetic preparation proof',
      constraints: {
        totalBudget: 100,
        perCardCap: null,
        currency: 'USD',
        allowedSets: ['tst'],
        mustInclude: ['Future selection'],
        mustExclude: ['Excluded'],
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
    commanders: [toDeckCardFromRecommendation(card)],
    pool: Array.from({ length: 8 }, (_, index) => ({
      ...card,
      name: index ? 'Candidate ' + index : 'Candidate',
      typeLine: 'Creature',
    })),
  }
}

test('prepared recipe produces committed pins, runs and replays without network or hand-authored reducer state', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'deckbuild-prepare-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const input = recipe()
  const pins = prepareBuild(input)
  assert.deepEqual(pins, prepareBuild(input))
  assert.deepEqual(pins.spec, input.spec)
  const state = pins.initialState as ReturnType<typeof createBuilderState>
  assert.equal(state.committedPoolKey, builderPoolKey(state))
  assert.equal(state.theme, input.spec.theme)
  assert.equal(state.collectionMode, 'only')
  assert.deepEqual(state.commanderDetails?.colours, ['G'])
  assert.deepEqual(
    state.deck.map((card) => card.name),
    input.spec.commander,
  )
  const commands = [
    { reason: 'Inspect prepared state', action: { type: 'view' } },
    {
      reason: 'Select supplied candidate',
      action: { type: 'decide', name: 'Candidate', decision: 'add' },
    },
  ]
  const fetcher = () => {
    throw new Error('Network forbidden')
  }
  const recorded = await recordBuild(root, pins, commands, undefined, fetcher)
  assert.equal(recorded.status, 'complete', JSON.stringify(recorded.detail))
  t.mock.method(globalThis, 'fetch', fetcher)
  assert.deepEqual(await replayBuild(root, recorded.manifest, commands), recorded)
  const path = join(root, 'recipe.json')
  await writeFile(path, JSON.stringify(input))
  const cli = spawnSync(
    process.execPath,
    ['--experimental-strip-types', resolve('scripts/deckbuild/prepare.ts'), path],
    { encoding: 'utf8', cwd: tmpdir() },
  )
  assert.equal(cli.status, 0, cli.stderr)
  assert.deepEqual(JSON.parse(cli.stdout), pins)
  await writeFile(path, '{}')
  const rejected = spawnSync(
    process.execPath,
    ['--experimental-strip-types', resolve('scripts/deckbuild/prepare.ts'), path],
    { encoding: 'utf8' },
  )
  assert.equal(rejected.status, 1)
  assert.equal(rejected.stdout, '')
})

test('preparation supports shared partner validation and combined identity', () => {
  const input = recipe()
  const left = { ...input.commanders[0], detail: 'Partner' }
  const right = { ...left, name: 'Synthetic Partner', colorIdentity: ['U'] }
  const pins = prepareBuild({
    ...input,
    spec: { ...input.spec, commander: [left.name, right.name] },
    commanders: [left, right],
  })
  const state = pins.initialState as ReturnType<typeof createBuilderState>
  assert.equal(state.commander, `${left.name} & ${right.name}`)
  assert.deepEqual(state.commanderDetails?.colours, ['G', 'U'])
  assert.throws(
    () =>
      prepareBuild({
        ...input,
        spec: { ...input.spec, commander: [left.name, right.name] },
        commanders: [left, { ...right, detail: '' }],
      }),
    /partner/i,
  )
})

test('preparation rejects invalid commanders, contradictory cap, duplicate pool, missing settings and state injection', () => {
  const input = recipe()
  assert.throws(
    () => prepareBuild({ ...input, commanders: [{ ...input.commanders[0], name: 'Other' }] }),
    /match spec/,
  )
  assert.throws(
    () =>
      prepareBuild({ ...input, commanders: [{ ...input.commanders[0], typeLine: 'Artifact' }] }),
    /commander/,
  )
  assert.throws(
    () => prepareBuild({ ...input, settings: { ...input.settings, maxPrice: 1 } }),
    /perCardCap/,
  )
  assert.throws(
    () =>
      prepareBuild({ ...input, pool: [...input.pool, { ...input.pool[0], name: 'CANDIDATE' }] }),
    /Duplicate/,
  )
  assert.throws(() => prepareBuild({ ...input, settings: {} }))
  assert.throws(() => prepareBuild({ ...input, initialState: {} }))
  const none = prepareBuild({
    ...input,
    spec: { ...input.spec, constraints: { ...input.spec.constraints, allowedSets: [] } },
  })
  assert.equal((none.initialState as ReturnType<typeof createBuilderState>).collectionMode, 'none')
})
