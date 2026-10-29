import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isolatedReviewArgs, planRound, reviewBundle, runIsolatedReview } from './run-round.ts'

function input() {
  const card = {
    name: 'Plains',
    type_line: 'Basic Land � Plains',
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
      idea: 'A synthetic test',
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
        ...card,
        name: 'Test commander',
        type_line: 'Legendary Creature � Human',
        oracle_text: 'Vigilance',
      },
      ...Array.from({ length: 99 }, () => ({ ...card })),
    ],
  }
}

test('runner bundle excludes builder files, pool, provenance and run/version IDs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'round-test-'))
  const source = input()
  const secret = 'PRIVATE_BUILDER_POOL_ROUND_VERSION'
  await writeFile(join(root, 'rules.md'), 'Synthetic approved rules reference')
  await writeFile(join(root, 'policy.md'), 'Synthetic approved policy reference')
  await writeFile(join(root, 'builder-feedback.md'), secret)
  const output = join(root, 'bundle')
  try {
    const result = await reviewBundle(
      {
        ...source,
        builder: secret,
        pool: [secret],
        runId: secret,
        versionId: secret,
        cards: source.cards.map((c) => ({ ...c, recommendation: secret, source: secret })),
      },
      { rules: join(root, 'rules.md'), 'format-policy': join(root, 'policy.md') },
      output,
    )
    assert.match(result.bundleHash, /^[a-f0-9]{64}$/)
    assert.deepEqual((await readdir(output)).sort(), [
      'bundle.json',
      'deck.txt',
      'format-policy.md',
      'review.schema.json',
      'reviewer.md',
      'rubric.md',
      'rules.md',
    ])
    for (const name of await readdir(output))
      assert.ok(!(await readFile(join(output, name), 'utf8')).includes(secret))
    await assert.rejects(
      reviewBundle(
        source,
        { rules: join(root, 'rules.md'), 'format-policy': join(root, 'policy.md') },
        output,
      ),
    )
  } finally {
    await chmod(output, 0o755).catch(() => {})
    for (const name of await readdir(output).catch(() => [])) await chmod(join(output, name), 0o644)
    await rm(root, { recursive: true, force: true })
  }
})
test('isolated launcher denies network, writable host mounts, privileges and image pulls', () => {
  const args = isolatedReviewArgs(join(tmpdir(), 'neutral-bundle'), 'sha256:' + 'a'.repeat(64))
  for (const flag of [
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--pull=never',
    '--user=65534:65534',
  ])
    assert.ok(args.includes(flag))
  assert.equal(args.filter((a) => a === '--mount').length, 1)
  assert.match(args[args.indexOf('--mount') + 1], /target=\/review,readonly$/)
  assert.throws(() => isolatedReviewArgs(tmpdir(), 'latest'))
})
test('round plan creates each repeat and pins metadata; rejects mismatches and overwrites', async () => {
  const root = await mkdtemp(join(tmpdir(), 'round-plan-'))
  try {
    const specPath = join(root, 'spec.json'),
      inputsPath = join(root, 'inputs.json')
    await writeFile(specPath, JSON.stringify(input().spec))
    await writeFile(inputsPath, JSON.stringify({ spec: input().spec, seed: 'synthetic' }))
    const refs = { rules: specPath, 'format-policy': specPath }
    const config = {
      specIds: ['synthetic'],
      repeats: 2,
      reviewRepeats: 3,
      model: { builder: { model: 'test' }, reviewer: { model: 'test' } },
      seed: 'synthetic',
      knowledgeBaseCommit: 'b'.repeat(40),
      references: refs,
      assignment: {
        commands: 10,
        batches: 5,
        subprocessMs: 60000,
        extensions: 3,
        providerAttemptsPerExtension: 0,
        stdoutBytes: 1024,
        stderrBytes: 1024,
        deadline: new Date(Date.now() + 60000).toISOString(),
      },
      cases: {
        synthetic: { specPath, inputsPath, manifest: 'a'.repeat(64), split: 'development' },
      },
    }
    const output = join(root, 'round')
    const record = await planRound(config, output)
    assert.equal(record.jobs.length, 2)
    assert.match(record.mainSha, /^[a-f0-9]{40}$/)
    assert.match(record.hashes['builder.md'], /^[a-f0-9]{64}$/)
    assert.equal(record.config.reviewRepeats, 3)
    assert.equal(
      JSON.parse(await readFile(join(output, 'synthetic-2/inputs.json'), 'utf8')).seed,
      'synthetic',
    )
    await assert.rejects(planRound(config, output))
    await assert.rejects(planRound({ ...config, seed: 'different' }, join(root, 'bad')), /mismatch/)
    await assert.rejects(
      planRound({ ...config, specIds: ['synthetic', 'synthetic'] }, join(root, 'duplicate')),
      /Duplicate/,
    )
    await assert.rejects(runIsolatedReview(output, 'sha256:' + 'a'.repeat(64)), /Unexpected bundle/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
