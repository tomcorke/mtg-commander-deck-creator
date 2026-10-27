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

test('pool refresh and doctor discovery stop incomplete and never execute later commands', async (t) => {
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
  const timeout = await runCommands(store.pins, commands, () => clock++ * defaultLimits.runtimeMs)
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

const raw = (name: string, text = 'Put a +1/+1 counter on target creature.'): ScryfallCard => ({
  name,
  type_line: 'Artifact',
  oracle_text: text,
  color_identity: [],
  cmc: 2,
  legalities: { commander: 'legal' },
  game_changer: false,
  released_at: '2020-01-01',
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
})

test('retrieved lookup/search cards flow into the shared builder without copied payloads and replay offline', async (t) => {
  const root = await directory(t)
  for (const type of ['lookup', 'search'] as const) {
    const initial = state()
    const commands = [
      command(
        type === 'lookup'
          ? { type, names: ['Found', 'Missing'] }
          : { type, query: 'fixture', order: 'name', page: 1 },
      ),
      command({ type: 'addRetrieved', commandIndex: 0, names: ['Found'] }),
      command({ type: 'view' }),
    ]
    const result = await recordBuild(root, pins(initial), commands, defaultLimits, async () =>
      Response.json({
        data: [raw('Found')],
        not_found: [{ name: 'Missing' }],
        total_cards: 1,
        has_more: false,
      }),
    )
    assert.equal(result.status, 'complete')
    const expected = applyBuilderAction(initial, { type: 'addSearch', cards: [raw('Found')] })
    assert.deepEqual(json(result.state.deck), json(expected.state.deck))
    assert.deepEqual(json(result.state.sideboard), json(expected.state.sideboard))
    assert.equal(result.state.deck[0].name, 'Found')
    const network = t.mock.method(globalThis, 'fetch', () => {
      throw new Error('Network forbidden')
    })
    assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
    assert.equal(network.mock.callCount(), 0)
    network.mock.restore()
  }
})

test('retrieved additions reject missing, future, non-retrieval and failed evidence atomically', async (t) => {
  const root = await directory(t)
  for (const kind of ['missing', 'future', 'view', 'failure']) {
    const commands = [
      command(kind === 'view' ? { type: 'view' } : { type: 'lookup', names: ['Found'] }),
      command({
        type: 'addRetrieved',
        commandIndex: kind === 'future' ? 1 : 0,
        names: kind === 'missing' ? ['Found', 'Absent'] : ['Found'],
      }),
      command({ type: 'view' }),
    ]
    const result = await recordBuild(root, pins(), commands, defaultLimits, async () =>
      kind === 'failure'
        ? new Response('', { status: 503 })
        : Response.json({ data: [raw('Found')] }),
    )
    assert.equal(result.status, 'invalid', kind)
    assert.equal(result.log.length, 2)
    assert.equal(result.state.deck.length, 0)
    assert.equal(result.log[1].before, result.stateHash)
    assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  }
})

test('retrieved additions preserve shared overflow and construction rejection', async (t) => {
  const root = await directory(t)
  for (const full of [false, true]) {
    const initial = state({
      deck: full
        ? Array.from({ length: 100 }, (_, i) => toDeckCardFromRecommendation(card(`Existing ${i}`)))
        : [],
    })
    const found = full ? raw('Found') : { ...raw('Found'), color_identity: ['R'] }
    const commands = [
      command({ type: 'lookup', names: ['Found'] }),
      command({ type: 'addRetrieved', commandIndex: 0, names: ['Found'] }),
    ]
    const result = await recordBuild(root, pins(initial), commands, defaultLimits, async () =>
      Response.json({ data: [found] }),
    )
    const expected = applyBuilderAction(initial, { type: 'addSearch', cards: [found] })
    assert.equal(result.status, expected.error ? 'invalid' : 'complete')
    assert.deepEqual(json(result.state.deck), json(expected.state.deck))
    assert.deepEqual(json(result.state.sideboard), json(expected.state.sideboard))
    assert.equal(result.state.sideboard.length, full ? 1 : 0)
    assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  }
})

test('retrieved additions require bounded distinct exact names and command indices', () => {
  const action = { type: 'addRetrieved', commandIndex: 0, names: ['Found'] }
  for (const patch of [
    { names: [] },
    { names: ['Found', 'Found'] },
    { names: [' '] },
    { names: ['x'.repeat(201)] },
    { names: Array.from({ length: 76 }, (_, i) => `Card ${i}`) },
    { commandIndex: -1 },
    { commandIndex: 0.5 },
    { commandIndex: 10000 },
  ])
    assert.throws(() =>
      parseCommands(JSON.stringify(command({ ...action, ...patch } as Command['action']))),
    )
})

test('lookup records bounded name requests and card evidence without changing state, then replays offline', async (t) => {
  const root = await directory(t)
  const commands = [
    command({ type: 'lookup', names: ['Found', 'Missing'] }),
    command({ type: 'view' }),
  ]
  let requests = 0
  const result = await recordBuild(root, pins(), commands, defaultLimits, async (input, init) => {
    requests++
    assert.equal(String(input), 'https://api.scryfall.com/cards/collection')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      identifiers: [{ name: 'Found' }, { name: 'Missing' }],
    })
    return Response.json({ data: [raw('Found')], not_found: [{ name: 'Missing' }] })
  })
  assert.equal(result.status, 'complete')
  assert.equal(requests, 1)
  assert.deepEqual(result.log[0].result, { outcome: 'partial', cards: [raw('Found')] })
  assert.equal(result.log[0].before, result.log[0].after)
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network forbidden')
  })
  assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  assert.equal(network.mock.callCount(), 0)
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${result.manifest}.json`), 'utf8'),
  )
  await rm(join(root, 'responses', `${manifest.entries[0].response}.json`))
  const missing = await replayBuild(root, result.manifest, commands)
  assert.equal(missing.status, 'incomplete')
  assert.equal(missing.log.length, 1)
  assert.equal(missing.log[0].result, undefined)
})

test('lookup retains empty, invalid and failed outcomes and records a later successful occurrence', async (t) => {
  const root = await directory(t)
  for (const kind of ['empty', 'invalid', 'http', 'network']) {
    let attempts = 0
    const commands = [
      command({ type: 'lookup', names: ['Found'] }),
      command({ type: 'lookup', names: ['Found'] }),
    ]
    const result = await recordBuild(root, pins(), commands, defaultLimits, async () => {
      if (++attempts === 1) {
        if (kind === 'network') throw new TypeError('Synthetic failure')
        if (kind === 'http') return new Response('', { status: 503 })
        return Response.json(kind === 'empty' ? { data: [] } : { invalid: true })
      }
      return Response.json({ data: [raw('Found')] })
    })
    assert.equal(result.status, 'complete')
    assert.equal(attempts, 2)
    assert.equal(
      (result.log[0].result as { outcome: string }).outcome,
      kind === 'empty' ? 'success-empty' : kind === 'invalid' ? 'invalid' : 'transient-failure',
    )
    assert.deepEqual(result.log[1].result, { outcome: 'success', cards: [raw('Found')] })
    assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  }
})

test('lookup rejects empty, duplicate, oversized and excessive names at the command boundary', () => {
  for (const names of [
    [],
    [' '],
    ['A', 'a'],
    ['x'.repeat(201)],
    Array.from({ length: 76 }, (_, i) => `Card ${i}`),
  ]) {
    assert.throws(() =>
      parseCommands(JSON.stringify({ reason: 'test', action: { type: 'lookup', names } })),
    )
  }
  assert.equal(
    parseCommands(
      JSON.stringify(
        command({ type: 'lookup', names: Array.from({ length: 75 }, (_, i) => `Card ${i}`) }),
      ),
    ).length,
    1,
  )
})
const providerState = () =>
  state({
    commanderDetails: { colours: [], images: [], art: [], printings: [], selections: [] },
    deck: [
      { ...toDeckCardFromRecommendation(card('Synthetic Commander')), dataStatus: 'pending' },
      toDeckCardFromRecommendation(toCard(raw('Peer 2'), 'Synthetic')),
      toDeckCardFromRecommendation(
        toCard(
          raw(
            'Engine',
            'If a +1/+1 counter would be put on a creature, put an additional one instead.',
          ),
          'Synthetic',
        ),
      ),
      toDeckCardFromRecommendation(
        toCard(raw('Peer', 'Put a +1/+1 counter on target creature.'), 'Synthetic'),
      ),
    ],
  })
const page = {
  container: {
    json_dict: {
      cardlists: [
        {
          tag: 'creatures',
          header: 'Artifacts',
          cardviews: [{ name: 'New candidate', lift: 2, num_decks: 200 }],
        },
      ],
    },
  },
}

test('nextBatch records hydration, signature pages and lookups, settles the shared boundary, and replays without network', async (t) => {
  const root = await directory(t)
  const urls: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    urls.push(String(input))
    assert.equal(init?.redirect, 'error')
    if (String(input).includes('edhrec')) return Response.json(page)
    const body = JSON.parse(String(init?.body))
    return Response.json({ data: body.identifiers.map((item: { name: string }) => raw(item.name)) })
  }
  const commands = [command({ type: 'nextBatch' }), command({ type: 'view' })]
  const result = await recordBuild(root, pins(providerState()), commands, defaultLimits, fetcher)
  assert.equal(result.status, 'complete', JSON.stringify(result.detail))
  assert.equal(result.state.batchNumber, 2)
  assert.equal(result.state.fetchBoundary, null)
  assert.equal(result.state.pendingFetches.length, 0)
  assert.ok(result.state.queue.some((item) => item.name === 'New candidate'))
  assert.deepEqual(
    result.state.completedFetches.map((work) => work.request.kind),
    ['current-data', 'signature-page', 'signature-cards'],
  )
  assert.equal(urls.length, 3)
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${result.manifest}.json`), 'utf8'),
  )
  assert.equal(manifest.entries.length, 3)
  assert.ok(
    manifest.entries.every(
      (entry: { request: { today: string; snapshotId: string } }) =>
        entry.request.today === '2026-10-27' && entry.request.snapshotId === 'fixture',
    ),
  )
  assert.equal(
    manifest.entries[0].request.body,
    JSON.stringify({ identifiers: [{ name: 'Synthetic Commander' }] }),
  )
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network forbidden')
  })
  assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  assert.equal(network.mock.callCount(), 0)
  await rm(join(root, 'responses', `${manifest.entries[1].response}.json`))
  const missing = await replayBuild(root, result.manifest, commands)
  assert.equal(missing.status, 'incomplete')
  assert.equal(missing.log.length, 1)
  assert.equal(missing.state.batchNumber, 1)
  assert.equal(missing.state.completedFetches.length, 1)
})

test('recorded network/HTTP/invalid/partial outcomes replay and repeated attempts remain separate', async (t) => {
  const root = await directory(t)
  const initial = providerState()
  initial.deck = initial.deck.filter((item) => item.name !== 'Synthetic Commander')
  for (const kind of ['network', 'http', 'invalid', 'partial']) {
    let attempts = 0
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes('edhrec')) {
        attempts++
        if (attempts === 1) {
          if (kind === 'network') throw new TypeError('Synthetic network failure')
          if (kind === 'http') return new Response('', { status: 503 })
          if (kind === 'invalid') return Response.json({ invalid: true })
        }
        return Response.json(
          kind === 'partial'
            ? {
                container: {
                  json_dict: {
                    cardlists: [
                      {
                        tag: 'creatures',
                        header: 'Creatures',
                        cardviews: [
                          { name: 'New candidate', lift: 2, num_decks: 200 },
                          { name: 'Missing', lift: 2, num_decks: 200 },
                        ],
                      },
                    ],
                  },
                },
              }
            : page,
        )
      }
      return Response.json({
        data: kind === 'partial' ? [raw('New candidate')] : [],
        not_found: [{ name: 'New candidate' }],
      })
    }
    const commands = [command({ type: 'nextBatch' }), command({ type: 'nextBatch' })]
    const result = await recordBuild(root, pins(initial), commands, defaultLimits, fetcher)
    assert.equal(result.status, 'complete', kind)
    assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
    const outcomes = result.state.completedFetches.map((work) => work.response?.outcome)
    assert.ok(
      outcomes.includes(
        kind === 'invalid' ? 'invalid' : kind === 'partial' ? 'partial' : 'transient-failure',
      ),
      JSON.stringify(outcomes),
    )
    if (kind === 'network' || kind === 'http') assert.equal(attempts, 2)
  }
})

test('provider work obeys batch/runtime bounds and corrupt stored data is not a provider failure', async (t) => {
  const root = await directory(t)
  const commands = [command({ type: 'nextBatch' }), command({ type: 'view' })]
  let calls = 0
  const fetcher: typeof fetch = async (_input, init) => {
    calls++
    return new Promise((_resolve, reject) =>
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true }),
    )
  }
  const batch = await recordBuild(
    root,
    pins(providerState()),
    commands,
    { ...defaultLimits, batches: 1 },
    fetcher,
  )
  assert.equal(batch.status, 'limit')
  assert.equal(batch.state.batchNumber, 1)
  assert.equal(calls, 0)
  // A real timer keeps the process alive alongside AbortSignal.timeout's unref timer.
  const keepAlive = setInterval(() => {}, 1000)
  t.after(() => clearInterval(keepAlive))
  const runtime = await recordBuild(
    root,
    pins(providerState()),
    commands,
    { ...defaultLimits, runtimeMs: 50 },
    fetcher,
  )
  assert.equal(runtime.status, 'limit')
  assert.equal(runtime.detail, 'runtime')
  assert.equal(runtime.log.length, 1)
  const recorded = await recordBuild(
    root,
    pins(providerState()),
    commands,
    defaultLimits,
    async (input) =>
      String(input).includes('edhrec') ? Response.json(page) : Response.json({ data: [] }),
  )
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${recorded.manifest}.json`), 'utf8'),
  )
  await writeFile(join(root, 'responses', `${manifest.entries[0].response}.json`), '{}')
  await assert.rejects(replayBuild(root, recorded.manifest, commands), /Corrupt/)
})

test('hydration-local timeout is recorded as a replayable provider failure while the run remains active', async (t) => {
  const root = await directory(t)
  const originalTimeout = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', (ms: number) => originalTimeout(ms === 30000 ? 20 : ms))
  const commands = [command({ type: 'nextBatch' }), command({ type: 'view' })]
  const initial = state({
    deck: [{ ...toDeckCardFromRecommendation(card('Pending')), dataStatus: 'pending' }],
  })
  const keepAlive = setInterval(() => {}, 1000)
  t.after(() => clearInterval(keepAlive))
  const fetcher: typeof fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
  const result = await recordBuild(root, pins(initial), commands, defaultLimits, fetcher)
  assert.equal(result.status, 'complete')
  assert.equal(result.state.batchNumber, 2)
  assert.equal(result.state.completedFetches[0].response?.outcome, 'transient-failure')
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${result.manifest}.json`), 'utf8'),
  )
  const response = JSON.parse(
    await readFile(join(root, 'responses', `${manifest.entries[0].response}.json`), 'utf8'),
  )
  assert.equal(response.status, 'failure')
  assert.equal(response.kind, 'cancelled')
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network forbidden')
  })
  assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
})

test('search records one explicit page with pagination evidence and replays offline without state changes', async (t) => {
  const root = await directory(t)
  const commands = [command({ type: 'search', query: 'synthetic query', order: 'name', page: 2 })]
  let requests = 0
  const result = await recordBuild(root, pins(), commands, defaultLimits, async (input) => {
    requests++
    const url = new URL(String(input))
    assert.equal(url.pathname, '/cards/search')
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      q: 'synthetic query',
      unique: 'cards',
      order: 'name',
      page: '2',
    })
    return Response.json({
      data: [raw('Found')],
      total_cards: 300,
      has_more: true,
      next_page: 'https://example.invalid/never-follow',
    })
  })
  assert.equal(result.status, 'complete')
  assert.equal(requests, 1)
  assert.deepEqual(result.log[0].result, {
    outcome: 'success',
    cards: [raw('Found')],
    pagination: { page: 2, totalCards: 300, hasMore: true },
  })
  assert.equal(result.log[0].before, result.log[0].after)
  const network = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Network forbidden')
  })
  assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  assert.equal(network.mock.callCount(), 0)
  const manifest = JSON.parse(
    await readFile(join(root, 'manifests', `${result.manifest}.json`), 'utf8'),
  )
  await rm(join(root, 'responses', `${manifest.entries[0].response}.json`))
  assert.equal((await replayBuild(root, result.manifest, commands)).status, 'incomplete')
})

test('search preserves empty, malformed and failed occurrences before later success', async (t) => {
  const root = await directory(t)
  for (const kind of ['empty', 'invalid', 'http', 'network']) {
    let attempts = 0
    const commands = [
      command({ type: 'search', query: 'fixture', order: 'name', page: 1 }),
      command({ type: 'search', query: 'fixture', order: 'name', page: 1 }),
    ]
    const result = await recordBuild(root, pins(), commands, defaultLimits, async () => {
      if (++attempts === 1) {
        if (kind === 'network') throw new TypeError('Synthetic failure')
        if (kind === 'http') return new Response('', { status: 503 })
        if (kind === 'empty') return new Response('', { status: 404 })
        return Response.json({ data: [{ bad: true }], total_cards: 1, has_more: false })
      }
      return Response.json({ data: [raw('Found')], total_cards: 1, has_more: false })
    })
    assert.equal(result.status, 'complete')
    assert.equal(attempts, 2)
    assert.equal(
      (result.log[0].result as { outcome: string }).outcome,
      kind === 'empty'
        ? 'success-empty'
        : kind === 'invalid' || kind === 'http'
          ? 'invalid'
          : 'transient-failure',
    )
    assert.equal((result.log[1].result as { outcome: string }).outcome, 'success')
    assert.deepEqual(await replayBuild(root, result.manifest, commands), result)
  }
})

test('search requires bounded query, explicit supported ordering and bounded page', () => {
  const action = { type: 'search', query: 'fixture', order: 'name', page: 1 }
  for (const change of [
    { query: ' ' },
    { query: 'x'.repeat(1001) },
    { order: 'random' },
    { page: 0 },
    { page: 101 },
    { page: 1.5 },
    { page: undefined },
    { order: undefined },
  ]) {
    assert.throws(() =>
      parseCommands(JSON.stringify({ reason: 'test', action: { ...action, ...change } })),
    )
  }
})
