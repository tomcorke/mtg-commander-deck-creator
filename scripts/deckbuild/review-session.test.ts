import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { finishReview, stageReview } from './review-session.ts'

function input() {
  const base = {
    type_line: 'Basic Land — Plains',
    oracle_text: '',
    cmc: 0,
    color_identity: ['W'],
    legalities: { commander: 'legal' },
  }
  return {
    spec: {
      commander: ['Test commander'],
      bracket: 2,
      pace: 'Slow',
      experience: 'Relaxed',
      theme: 'Tokens',
      idea: 'Synthetic workflow check',
      constraints: {
        totalBudget: null,
        perCardCap: null,
        currency: 'USD',
        allowedSets: [],
        mustInclude: [],
        mustExclude: [],
      },
    },
    cards: [
      {
        ...base,
        name: 'Test commander',
        type_line: 'Legendary Creature — Human',
        oracle_text: 'Vigilance',
      },
      ...Array.from({ length: 99 }, () => ({
        ...base,
        name: 'Plains',
        reason: 'PRIVATE_PROVENANCE',
      })),
    ],
    builderFeedback: 'PRIVATE_PROVENANCE',
  }
}
async function setup(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'review-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'rules.md'), 'Approved synthetic rules reference')
  await writeFile(join(root, 'policy.md'), 'Approved synthetic policy reference')
  const config = {
    today: '2026-10-27',
    knowledgeBaseCommit: 'a'.repeat(40),
    sourceVersion: 'PRIVATE_VERSION',
    references: [
      { kind: 'rules', path: join(root, 'rules.md') },
      { kind: 'format-policy', path: join(root, 'policy.md') },
    ],
  }
  const output = join(root, 'operator')
  const staged = await stageReview(input(), config, output)
  const record = JSON.parse(await readFile(staged.operatorPath, 'utf8'))
  t.after(async () => {
    for (const name of await readdir(record.stagePath))
      await chmod(join(record.stagePath, name), 0o644)
    await rm(record.stagePath, { recursive: true, force: true })
  })
  const assessment = { score: 2, justification: 'Synthetic judgement', confidence: 'low' }
  const comment = {
    card: 'Test commander',
    reason: 'Synthetic',
    sources: ['oracle:Test commander'],
  }
  const review = {
    version: 1,
    bundleHash: record.bundleHash,
    criteria: {
      bracketFit: { ...assessment, fit: 'unresolved' },
      effectiveness: assessment,
      themeFit: assessment,
      ideaFit: assessment,
      fun: assessment,
      synergy: assessment,
    },
    strongest: [comment],
    weakest: [comment],
    swaps: [],
    knowledgeGaps: [],
    limitations: ['Synthetic best-effort isolation desk review'],
  }
  const receipt = {
    taskId: 'task:synthetic',
    status: 'completed',
    providerInstanceId: 'codex',
    model: 'gpt-6.1-sol',
    options: [{ id: 'reasoningEffort', value: 'low' }],
    summary: JSON.stringify({
      status: 'completed',
      isolation: 'best-effort',
      contamination: 'none-observed',
      ambientContext: ['Generic workspace metadata; not used'],
      review,
    }),
  }
  return { root, config, output, staged, record, receipt, review }
}

test('staging projects neutral approved files and explicit fresh-task restrictions; completion binds the receipt', async (t) => {
  const { output, staged, record, receipt, review } = await setup(t)
  assert.deepEqual(staged.launch.target, {
    providerInstanceId: 'codex',
    model: 'gpt-6.1-sol',
    options: { reasoningEffort: 'low' },
  })
  assert.match(staged.launch.task, /Forbidden directories/)
  assert.match(staged.launch.task, /Do not list or read any other directory, use skills/)
  assert.ok(!staged.launch.task.includes('PRIVATE_VERSION'))
  assert.ok(!staged.launch.task.includes('PRIVATE_PROVENANCE'))
  assert.ok(!staged.launch.task.includes(output))
  assert.equal(Object.keys(record.hashes).length, 7)
  for (const name of Object.keys(record.hashes))
    assert.ok(
      !(await readFile(join(record.stagePath, name), 'utf8')).includes('PRIVATE_PROVENANCE'),
    )
  const result = await finishReview(output, receipt)
  assert.equal(result.status, 'completed')
  assert.equal(result.isolation, 'best-effort')
  assert.deepEqual(result.review, review)
  assert.match(String(result.markdown), /Access restrictions were instructions, not enforced/)
  assert.deepEqual(JSON.parse(await readFile(join(output, 'result.json'), 'utf8')), result)
  await assert.rejects(finishReview(output, receipt), /EEXIST/)
})
test('contamination and failed tasks remain explicit non-review outcomes', async (t) => {
  const first = await setup(t)
  const contaminated = await finishReview(first.output, {
    ...first.receipt,
    summary: JSON.stringify({ status: 'contaminated', detail: 'Other review was exposed' }),
  })
  assert.equal(contaminated.status, 'contaminated')
  assert.equal(contaminated.review, undefined)
  const second = await setup(t)
  const failed = await finishReview(second.output, {
    ...second.receipt,
    status: 'failed',
    summary: null,
  })
  assert.equal(failed.status, 'failed')
  assert.equal(failed.review, undefined)
})
test('mismatched model/options, malformed JSON, invalid review and changed files cannot become results', async (t) => {
  const { output, receipt, review, record } = await setup(t)
  await assert.rejects(finishReview(output, { ...receipt, model: 'other' }))
  await assert.rejects(
    finishReview(output, { ...receipt, options: [{ id: 'reasoningEffort', value: 'medium' }] }),
    /low/,
  )
  await assert.rejects(finishReview(output, { ...receipt, summary: 'not JSON' }))
  await assert.rejects(
    finishReview(output, {
      ...receipt,
      summary: JSON.stringify({
        status: 'completed',
        isolation: 'best-effort',
        contamination: 'none-observed',
        ambientContext: [],
        review: { ...review, bundleHash: 'b'.repeat(64) },
      }),
    }),
    /hash mismatch/,
  )
  const path = join(record.stagePath, 'rules.md')
  await chmod(path, 0o644)
  await writeFile(path, 'changed')
  await assert.rejects(finishReview(output, receipt), /Staged file changed/)
  await assert.rejects(readFile(join(output, 'result.json')), /ENOENT/)
})
test('illegal input, duplicate reference roles, existing output and private-input drift reject', async (t) => {
  const { root, config, output, receipt } = await setup(t)
  const invalid = input()
  invalid.cards.pop()
  await assert.rejects(stageReview(invalid, config, join(root, 'invalid')), /rejected/)
  await assert.rejects(
    stageReview(
      input(),
      { ...config, references: [config.references[0], config.references[0]] },
      join(root, 'bad'),
    ),
  )
  await assert.rejects(stageReview(input(), config, output), /EEXIST/)
  const changed = input()
  changed.spec.idea = 'changed'
  await writeFile(join(output, 'input.json'), JSON.stringify(changed))
  await assert.rejects(finishReview(output, receipt), /Private deck input changed/)
})
