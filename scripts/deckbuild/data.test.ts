import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recordStore, replayStore, requestKey, type Pins, type Request } from './data.ts'

const pins: Pins = {
  spec: { commander: 'fixture' },
  seed: 'seed',
  resolvedOptions: {},
  initialState: {},
  sourceVersion: 'sha',
  policyVersion: 'policy-sha',
  recommenderVersion: '2',
  today: '2026-10-27',
  snapshotId: 'fixture',
}
const request: Request = {
  provider: 'fixture',
  endpoint: '/cards',
  method: 'GET',
  query: { q: 'test' },
  body: null,
  ordering: null,
  pagination: null,
  today: pins.today,
  snapshotId: pins.snapshotId,
}

test('request keys cover every transport field and ignore object key order', () => {
  assert.equal(requestKey(request), requestKey({ ...request, query: { q: 'test' } }))
  for (const field of ['provider', 'endpoint', 'method', 'snapshotId'] as const)
    assert.notEqual(requestKey(request), requestKey({ ...request, [field]: 'different' }))
  for (const field of ['query', 'body', 'ordering', 'pagination'] as const)
    assert.notEqual(requestKey(request), requestKey({ ...request, [field]: { changed: true } }))
  assert.notEqual(requestKey(request), requestKey({ ...request, today: '2026-10-28' }))
  assert.equal(
    requestKey({ ...request, body: { a: 1, b: 2 } }),
    requestKey({ ...request, body: { b: 2, a: 1 } }),
  )
  assert.throws(() => requestKey({ ...request, body: undefined } as unknown as Request))
})

test('records failure then success separately and replays pinned inputs without a provider', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deckbuild-'))
  try {
    const recorder = recordStore(root, pins)
    const failure = { status: 'failure' as const, kind: 'transient', detail: { code: 503 } }
    const success = { status: 'success' as const, value: { cards: ['A'] } }
    await recorder.request(request, async () => failure)
    await recorder.request(request, async () => success)
    const hash = await recorder.finish()
    assert.equal(hash, await recorder.finish())
    await assert.rejects(
      recorder.request(request, async () => success),
      /sealed/,
    )
    const replay = await replayStore(root, hash)
    assert.deepEqual(replay.pins, pins)
    const first = replay.request(request)
    await assert.rejects(replay.request(request), /processing/)
    assert.throws(() => replay.finish(), /processing/)
    assert.deepEqual(await first, { status: 'complete', outcome: failure })
    assert.equal(replay.finish().status, 'incomplete')
    assert.deepEqual(await replay.request(request), { status: 'complete', outcome: success })
    assert.equal(replay.finish().status, 'complete')
    assert.equal((await replay.request(request)).status, 'incomplete')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('missing responses stop replay even when restored; corruption is an error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deckbuild-'))
  try {
    const recorder = recordStore(root, pins)
    await recorder.request(request, async () => ({ status: 'success', value: [] }))
    const hash = await recorder.finish()
    const manifest = JSON.parse(await readFile(join(root, 'manifests', `${hash}.json`), 'utf8'))
    const path = join(root, 'responses', `${manifest.entries[0].response}.json`)
    const bytes = await readFile(path, 'utf8')
    await rm(path)
    const replay = await replayStore(root, hash)
    const missing = await replay.request(request)
    assert.equal(missing.status, 'incomplete')
    await writeFile(path, bytes)
    assert.deepEqual(await replay.request(request), missing)
    const fresh = await replayStore(root, hash)
    assert.equal((await fresh.request({ ...request, endpoint: '/other' })).status, 'incomplete')
    assert.equal((await fresh.request(request)).status, 'incomplete')
    await writeFile(path, '{"status":"success","value":[1]}')
    await assert.rejects((await replayStore(root, hash)).request(request), /Corrupt/)
    await assert.rejects(replayStore(root, '../escape'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects date drift, overlapping requests, and unrecorded provider errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deckbuild-'))
  try {
    const recorder = recordStore(root, pins)
    await assert.rejects(
      recorder.request({ ...request, today: '2026-10-28' }, async () => ({
        status: 'success',
        value: null,
      })),
      /pinned/,
    )
    await assert.rejects(
      recorder.request(request, async () => {
        throw new Error('transport')
      }),
      /transport/,
    )
    let release!: () => void
    const pending = recorder.request(request, async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return { status: 'success', value: null }
    })
    await assert.rejects(recorder.finish(), /processing/)
    await assert.rejects(
      recorder.request(request, async () => ({ status: 'success', value: null })),
      /processing/,
    )
    release()
    await pending
    const replay = await replayStore(root, await recorder.finish())
    assert.equal((await replay.request(request)).status, 'complete')
    assert.equal(replay.finish().status, 'complete')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
