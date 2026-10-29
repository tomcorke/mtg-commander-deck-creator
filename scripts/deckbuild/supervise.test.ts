import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createBuilderState, type BuilderState } from '../../src/domain/builder-state.ts'
import { builderPoolKey } from '../../src/domain/builder-settings.ts'
import { toCard, type ScryfallCard } from '../../src/domain/card-model.ts'
import { settingsSchema } from './builder-contract.ts'
import { fetchCap, providerBreach } from './supervise.ts'

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const initial = (): BuilderState => {
  const value = {
    ...createBuilderState('2026-10-27', 'fixture-seed'),
    commander: 'Synthetic Commander',
    queue: Array.from({ length: 12 }, (_, index) =>
      toCard(
        {
          name: `Fixture ${index}`,
          type_line: 'Artifact',
          color_identity: [],
          cmc: 2,
          legalities: { commander: 'legal' },
          oracle_text: '',
          game_changer: false,
          set: 'tst',
          collector_number: `${index}`,
          prints_search_uri: '',
        } as ScryfallCard,
        'Synthetic fixture',
      ),
    ),
  }
  value.committedPoolKey = builderPoolKey(value)
  return value
}
const line = (action: unknown) => `${JSON.stringify({ reason: 'Synthetic', action })}\n`
const assignment = {
  commands: 10,
  batches: 5,
  subprocessMs: 60000,
  extensions: 3,
  providerAttemptsPerExtension: 0,
  stdoutBytes: 4 * 1024 * 1024,
  stderrBytes: 64 * 1024,
  deadline: new Date(Date.now() + 10 * 60000).toISOString(),
}

async function run(t: test.TestContext, overrides: Partial<typeof assignment> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'deckbuild-supervise-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const state = initial()
  const builder = Object.fromEntries(
    Object.keys(settingsSchema.shape).map((key) => [key, state[key as keyof BuilderState]]),
  )
  await writeFile(
    join(dir, 'inputs.json'),
    JSON.stringify({
      spec: { purpose: 'synthetic supervisor test' },
      seed: state.signatureDeckKey,
      resolvedOptions: builder,
      initialState: state,
      sourceVersion: 'synthetic',
      policyVersion: 'synthetic',
      recommenderVersion: revision,
      today: state.today,
      snapshotId: 'fixture',
    }),
  )
  await writeFile(join(dir, 'commands.jsonl'), line({ type: 'view' }))
  await writeFile(join(dir, 'assignment.json'), JSON.stringify({ ...assignment, ...overrides }))
  const cli = (...args: string[]) =>
    spawnSync(
      process.execPath,
      ['--experimental-strip-types', resolve('scripts/deckbuild/supervise.ts'), ...args],
      { encoding: 'utf8' },
    )
  const append = async (name: string, text: string) => {
    await writeFile(join(dir, name), text)
    return cli('extend', dir, join(dir, name))
  }
  const ledger = async () =>
    existsSync(join(dir, 'ledger.jsonl'))
      ? (await readFile(join(dir, 'ledger.jsonl'), 'utf8'))
          .trim()
          .split('\n')
          .map((x) => JSON.parse(x))
      : []
  return { dir, cli, append, ledger }
}

test('supervised steps replay exactly, then stop on the first provider attempt and refuse to continue', async (t) => {
  const { dir, cli, append, ledger } = await run(t)
  const started = cli('start', dir)
  assert.equal(started.status, 0, started.stderr)
  const record = JSON.parse(await readFile(join(dir, 'record.json'), 'utf8'))
  const first = record.view.batch[0].name
  const extended = await append('a.jsonl', line({ type: 'decide', name: first, decision: 'add' }))
  assert.equal(extended.status, 0, extended.stderr)
  assert.equal(JSON.parse(extended.stdout).extensions, 1)
  assert.deepEqual(
    (await ledger()).map((entry) => [entry.name, entry.code, entry.breach]),
    [
      ['record', 0, null],
      ['replay-0', 0, null],
      ['extend-1', 0, null],
      ['replay-1', 0, null],
    ],
  )

  // A lookup needs the provider; the zero-attempt cap blocks fetch before I/O and the run stops.
  const blocked = await append('b.jsonl', line({ type: 'lookup', names: ['Fixture 1'] }))
  assert.equal(blocked.status, 1)
  const stop = JSON.parse(await readFile(join(dir, 'stop.json'), 'utf8'))
  assert.equal(stop.breach, true)
  assert.match(stop.detail, /provider attempts 1 exceed 0/)
  assert.equal((await ledger()).length, 5, 'no replay after a provider breach')
  const { manifest } = JSON.parse(await readFile(join(dir, 'extend-2.json'), 'utf8'))
  const { entries } = JSON.parse(await readFile(join(dir, 'manifests', `${manifest}.json`), 'utf8'))
  const outcome = JSON.parse(
    await readFile(join(dir, 'responses', `${entries[0].response}.json`), 'utf8'),
  )
  assert.equal(outcome.status, 'failure', 'the capped fetch never reached the network')

  const refused = await append('c.jsonl', line({ type: 'view' }))
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /stopped/)
  assert.equal((await ledger()).length, 5, 'a stopped run launches nothing')
})

test('output cap kills the subprocess, keeps only capped bytes and stops the run', async (t) => {
  const { dir, cli, ledger } = await run(t, { stdoutBytes: 100 })
  assert.equal(cli('start', dir).status, 1)
  assert.ok((await stat(join(dir, 'record.json'))).size <= 100)
  assert.match((await ledger())[0].breach, /stdout exceeded 100 bytes/)
  assert.ok(existsSync(join(dir, 'stop.json')))
})

test('extension and deadline bounds stop before launching a builder command', async (t) => {
  const bounded = await run(t, { extensions: 0 })
  assert.equal(bounded.cli('start', bounded.dir).status, 0)
  const over = await bounded.append('a.jsonl', line({ type: 'view' }))
  assert.equal(over.status, 1)
  assert.match(over.stderr, /extension 1 exceeds 0/)
  assert.equal((await bounded.ledger()).length, 2)

  const late = await run(t, { deadline: new Date(Date.now() - 1000).toISOString() })
  assert.equal(late.cli('start', late.dir).status, 1)
  assert.deepEqual(await late.ledger(), [])
  assert.ok(existsSync(join(late.dir, 'stop.json')))
})

test('invalid assignments and malformed appends are refused without stopping or launching', async (t) => {
  const { dir, cli, append, ledger } = await run(t, { deadline: 'tomorrow' })
  assert.equal(cli('start', dir).status, 1)
  assert.equal(existsSync(join(dir, 'stop.json')), false)
  await writeFile(join(dir, 'assignment.json'), JSON.stringify(assignment))
  assert.equal(cli('start', dir).status, 0)
  const malformed = await append('a.jsonl', '{bad')
  assert.equal(malformed.status, 1)
  assert.equal(existsSync(join(dir, 'stop.json')), false)
  await writeFile(join(dir, 'assignment.json'), JSON.stringify({ ...assignment, extensions: 9 }))
  const loosened = await append('b.jsonl', line({ type: 'view' }))
  assert.match(loosened.stderr, /assignment.json changed/)
  assert.equal((await ledger()).length, 2)
})

test('settled provider failures include transport, rate-limit and server outcomes only', () => {
  const http = (status: number) => ({ status: 'success' as const, value: { status } })
  assert.equal(providerBreach([http(200), http(404)], 2), null)
  assert.match(providerBreach([http(200)], 0)!, /exceed 0/)
  assert.match(providerBreach([http(200), http(429)], 2)!, /attempt 2/)
  assert.match(providerBreach([http(503)], 1)!, /attempt 1/)
  assert.match(
    providerBreach([{ status: 'failure', kind: 'network', detail: null }], 1)!,
    /failure/,
  )
})

test('fetch guard latches after rejection or server failure without later network calls', async () => {
  for (const status of [429, 503, 'throw']) {
    let calls = 0
    const context = {
      fetch: async () => {
        calls++
        if (status === 'throw') throw new Error('synthetic failure')
        return { status }
      },
    }
    runInNewContext(fetchCap(5).slice('data:text/javascript,'.length), context)
    await context.fetch().catch(() => undefined)
    await assert.rejects(context.fetch(), /Supervised fetch cap/)
    assert.equal(calls, 1)
  }
})

test('existing run lock refuses a step without stopping or launching', async (t) => {
  const { dir, cli, ledger } = await run(t)
  await writeFile(join(dir, 'run.lock'), '')
  assert.equal(cli('start', dir).status, 1)
  assert.deepEqual(await ledger(), [])
  assert.equal(existsSync(join(dir, 'stop.json')), false)
})

test('output open failure stops the run and records the failure', async (t) => {
  const { dir, cli, ledger } = await run(t)
  await writeFile(join(dir, 'record.json'), 'preserved')
  assert.equal(cli('start', dir).status, 1)
  assert.ok(existsSync(join(dir, 'stop.json')))
  assert.match((await ledger())[0].breach, /stdout write failed/)
  assert.equal(await readFile(join(dir, 'record.json'), 'utf8'), 'preserved')
})
