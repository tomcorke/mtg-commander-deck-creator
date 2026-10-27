import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  applyBuilderAction,
  createBuilderState,
  type BuilderState,
} from '../../src/domain/builder-state.ts'
import { builderPoolKey } from '../../src/domain/builder-settings.ts'
import {
  toCard,
  toDeckCardFromRecommendation,
  type ScryfallCard,
} from '../../src/domain/card-model.ts'
import { recommend } from '../../src/domain/recommender.ts'
import { defaultLimits, settingsSchema, type Command } from './builder-contract.ts'
import { digest, replayStore, recordStore, type Json, type Pins } from './data.ts'
import { parseCommands, recordBuild, replayBuild, runCommands } from './recommend.ts'

const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const card = (name: string) =>
  toCard(
    {
      name,
      type_line: 'Artifact',
      color_identity: [],
      cmc: 2,
      legalities: { commander: 'legal' },
      oracle_text: '',
      game_changer: false,
      set: 'tst',
      collector_number: name,
      prints_search_uri: '',
    } as ScryfallCard,
    'Synthetic fixture',
  )
const state = (changes: Partial<BuilderState> = {}): BuilderState => {
  const value = {
    ...createBuilderState('2026-10-27', 'fixture-seed'),
    commander: 'Synthetic Commander',
    queue: Array.from({ length: 12 }, (_, index) => card(`Fixture ${index}`)),
    ...changes,
  }
  value.committedPoolKey = builderPoolKey(value)
  return value
}
const pins = (initial = state()): Pins => ({
  spec: { purpose: 'synthetic transport test' },
  seed: initial.signatureDeckKey,
  resolvedOptions: json(
    Object.fromEntries(
      Object.keys(settingsSchema.shape).map((key) => [key, initial[key as keyof BuilderState]]),
    ),
  ),
  initialState: json(initial),
  sourceVersion: 'synthetic',
  policyVersion: 'synthetic',
  recommenderVersion: revision,
  today: initial.today,
  snapshotId: 'fixture',
})
const command = (action: Command['action']): Command => ({
  reason: 'Synthetic verification',
  action,
})
async function directory(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'deckbuild-cli-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('record/replay matches exactly, uses shared scores, keeps offered ranks before decisions and makes no network calls', async (t) => {
  const root = await directory(t)
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network forbidden')
  })
  const initial = state()
  const expected = recommend({
    ...initial,
    pool: initial.queue,
    identity: [],
    prioritizeDeckHealth: true,
  })
  const [first, second] = expected.batch
  const commands = [
    command({ type: 'view' }),
    command({ type: 'decide', name: first.name, decision: 'add' }),
    command({ type: 'decide', name: second.name, decision: 'later' }),
    command({ type: 'explain', name: first.name }),
  ]
  const recorded = await recordBuild(root, pins(initial), commands)
  const replayed = await replayBuild(root, recorded.manifest, structuredClone(commands))
  assert.deepEqual(replayed, recorded)
  assert.equal(recorded.status, 'complete')
  assert.equal(recorded.state.deck[0].name, first.name)
  assert.deepEqual(recorded.log[1].offered, {
    rank: 1,
    score: expected.scores.find((item) => item.name === first.name),
  })
  assert.deepEqual(recorded.log[2].offered, {
    rank: 2,
    score: expected.scores.find((item) => item.name === second.name),
  })
  assert.deepEqual(json(recorded.log[3].result), { status: 'excluded', reason: 'in-deck' })
  assert.equal(network.mock.callCount(), 0)
  assert.equal(recorded.construction, 'not-checked')
})

test('pool refresh, doctor discovery and current-data fetches stop incomplete and never execute later commands', async (t) => {
  const root = await directory(t)
  const cases: { initial: BuilderState; commands: Command[]; kind: string }[] = [
    {
      initial: state(),
      commands: [command({ type: 'theme', theme: 'Tokens' }), command({ type: 'commitSettings' })],
      kind: 'pool',
    },
    {
      initial: state(),
      commands: [command({ type: 'discoverDoctor' })],
      kind: 'doctor-candidates',
    },
    {
      initial: state({
        deck: [{ ...toDeckCardFromRecommendation(card('Pending')), dataStatus: 'pending' }],
      }),
      commands: [command({ type: 'nextBatch' })],
      kind: 'current-data',
    },
  ]
  for (const item of cases) {
    const result = await recordBuild(root, pins(item.initial), [
      ...item.commands,
      command({ type: 'view' }),
    ])
    assert.equal(result.status, 'incomplete')
    assert.equal(result.log.length, item.commands.length)
    const detail = result.detail as { requests: { kind?: string; request?: { kind: string } }[] }
    assert.equal(detail.requests[0].request?.kind ?? detail.requests[0].kind, item.kind)
    assert.deepEqual(
      await replayBuild(root, result.manifest, [...item.commands, command({ type: 'view' })]),
      result,
    )
  }
})

test('Later candidates remain available and return after their shared deferral interval', async (t) => {
  const root = await directory(t)
  const initial = state()
  const offered = recommend({
    ...initial,
    pool: initial.queue,
    identity: [],
    prioritizeDeckHealth: true,
  })
  const later = offered.batch[0].name
  const commands = [
    command({ type: 'decide', name: later, decision: 'later' }),
    ...Array.from({ length: 5 }, () => [
      command({ type: 'nextBatch' }),
      command({ type: 'view' }),
    ]).flat(),
  ]
  const result = await recordBuild(root, pins(initial), commands)
  assert.equal(result.status, 'complete')
  const views = result.log.filter((entry) => (entry.command as Command).action.type === 'view')
  assert.equal(
    (views[0].result as typeof offered).deferredCards.find((entry) => entry.card.name === later)
      ?.available,
    true,
  )
  assert.ok(
    views.some((entry) =>
      (entry.result as typeof offered).batch.some((item) => item.name === later),
    ),
  )
  assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
})

test('steering preserves pending add/ignore feedback until the shared reducer commits its original batch', async (t) => {
  const root = await directory(t)
  for (const decision of ['add', 'ignore'] as const) {
    const initial = state({ queue: state().queue.map((item) => ({ ...item, tags: ['Tokens'] })) })
    const offered = recommend({
      ...initial,
      pool: initial.queue,
      identity: [],
      prioritizeDeckHealth: true,
    })
    const selected = offered.batch[0]
    const targets = { draw: initial.deckTargets.draw + 1 }
    let expected = { ...initial, queue: offered.queue, deferredCards: offered.deferredCards }
    expected = applyBuilderAction(expected, { type: 'decide', card: selected, decision }).state
    expected = applyBuilderAction(expected, { type: 'targets', targets }).state
    expected = applyBuilderAction(expected, { type: 'nextBatch' }).state
    assert.notEqual(expected.preferenceScores.Tokens, 0)
    const commands = [
      command({ type: 'decide', name: selected.name, decision }),
      command({ type: 'targets', targets }),
      command({ type: 'view' }),
      command({ type: 'nextBatch' }),
    ]
    const result = await recordBuild(root, pins(initial), commands)
    assert.equal(result.status, 'complete')
    assert.deepEqual(json((result.log[2].result as typeof offered).batch), json(offered.batch))
    assert.deepEqual(result.state.preferenceScores, expected.preferenceScores)
    assert.deepEqual(result.state.decisions, {})
    assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  }
})

test('command, batch and cooperative runtime limits retain explicit stopped results', async (t) => {
  const root = await directory(t)
  const commands = [command({ type: 'view' }), command({ type: 'view' })]
  const limited = await recordBuild(root, pins(), commands, { ...defaultLimits, commands: 1 })
  assert.equal(limited.status, 'limit')
  assert.equal(limited.detail, 'commands')
  assert.equal(limited.log.length, 1)
  const batch = await recordBuild(root, pins(), [command({ type: 'nextBatch' })], {
    ...defaultLimits,
    batches: 1,
  })
  assert.equal(batch.status, 'limit')
  assert.equal(batch.detail, 'batches')
  assert.equal(batch.state.batchNumber, 1)
  const store = await replayStore(root, limited.manifest)
  let clock = 0
  const timeout = runCommands(store.pins, commands, () => clock++ * defaultLimits.runtimeMs)
  assert.equal(timeout.status, 'limit')
  assert.equal(timeout.detail, 'runtime')
})

test('invalid decisions preserve state and malformed/changed inputs fail rather than guessing defaults', async (t) => {
  const root = await directory(t)
  const invalid = await recordBuild(root, pins(), [
    command({ type: 'decide', name: 'Not offered', decision: 'add' }),
  ])
  assert.equal(invalid.status, 'invalid')
  assert.equal(invalid.state.deck.length, 0)
  const commands = [command({ type: 'view' })]
  const valid = await recordBuild(root, pins(), commands)
  await assert.rejects(
    replayBuild(root, valid.manifest, [command({ type: 'explain', name: 'Different' })]),
    /pinned hash/,
  )
  await assert.rejects(
    recordBuild(root, { ...pins(), recommenderVersion: 'another-version' }, commands),
    /HEAD/,
  )
  await assert.rejects(recordBuild(root, { ...pins(), seed: 'changed' }, commands), /seed/)
  await assert.rejects(
    recordBuild(
      root,
      { ...pins(), resolvedOptions: { ...(pins().resolvedOptions as object), maxPrice: 1 } },
      commands,
    ),
    /settings/,
  )
  const missing = json(state()) as Record<string, Json>
  delete missing.powerTarget
  await assert.rejects(recordBuild(root, { ...pins(), initialState: missing }, commands))
  assert.throws(() => parseCommands('{"reason":"","action":{"type":"view"}}'))
  assert.throws(() => parseCommands('{"reason":"inject","action":{"type":"data","changes":{}}}'))
  await assert.rejects(recordBuild(resolve('.'), pins(), commands), /outside/)
})

test('unconsumed recorded provider data cannot be reported as a complete replay', async (t) => {
  const root = await directory(t)
  const commands = [command({ type: 'view' })]
  const result = await recordBuild(root, pins(), commands)
  const pinned = (await replayStore(root, result.manifest)).pins
  const recorder = recordStore(root, pinned)
  await recorder.request(
    {
      provider: 'synthetic',
      endpoint: 'unused',
      method: 'GET',
      query: null,
      body: null,
      ordering: null,
      pagination: null,
      today: pinned.today,
      snapshotId: pinned.snapshotId,
    },
    async () => ({ status: 'success', value: null }),
  )
  const replayed = await replayBuild(root, await recorder.finish(), commands)
  assert.equal(replayed.status, 'incomplete')
  assert.match(JSON.stringify(replayed.detail), /Unconsumed/)
})

test('CLI emits matching JSON for record/replay and nonzero for incomplete or malformed input', async (t) => {
  const root = await directory(t)
  const input = join(root, 'pins.json')
  const log = join(root, 'commands.jsonl')
  await writeFile(input, JSON.stringify(pins()))
  await writeFile(log, JSON.stringify(command({ type: 'view' })))
  const cli = (...args: string[]) =>
    spawnSync(
      process.execPath,
      ['--experimental-strip-types', resolve('scripts/deckbuild/recommend.ts'), ...args],
      { encoding: 'utf8' },
    )
  const recorded = cli('record', root, input, log)
  assert.equal(recorded.status, 0, recorded.stderr)
  const result = JSON.parse(recorded.stdout)
  const replayed = cli('replay', root, result.manifest, log)
  assert.equal(replayed.status, 0, replayed.stderr)
  assert.deepEqual(JSON.parse(replayed.stdout), result)
  await writeFile(log, JSON.stringify(command({ type: 'discoverDoctor' })))
  const incomplete = cli('record', root, input, log)
  assert.equal(incomplete.status, 1)
  assert.equal(JSON.parse(incomplete.stdout).status, 'incomplete')
  await writeFile(log, '{bad-json')
  const malformed = cli('record', root, input, log)
  assert.equal(malformed.status, 1)
  assert.equal(malformed.stdout, '')
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${result.manifest}.json`), 'utf8'),
  )
  assert.equal(digest(manifest), result.manifest)
})
