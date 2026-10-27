import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { compare, evaluate, parseSuite, summarise } from './rank-bench.ts'

const fixturePath = new URL('./rank-bench.fixture.json', import.meta.url)
const fixture = () =>
  parseSuite(JSON.parse(readFileSync(fixturePath, 'utf8').replace(/^\uFEFF/, '')))

test('power target is validated, retained and pinned as an evaluation input', () => {
  const input = fixture()
  input.cases[0].state.powerTarget = 'upgraded'
  const upgraded = evaluate(input, 'upgraded')
  input.cases[0].state.powerTarget = 'high'
  const high = evaluate(input, 'high')
  assert.notEqual(upgraded.cases[0].evaluationHash, high.cases[0].evaluationHash)
  assert.throws(() => compare(upgraded, high))
  assert.equal(parseSuite(input).cases[0].state.powerTarget, 'high')
  assert.throws(() =>
    parseSuite({
      ...input,
      cases: [
        { ...input.cases[0], state: { ...input.cases[0].state, powerTarget: 'official-bracket' } },
      ],
    }),
  )
})

test('synthetic fixture proves independently calculated metrics and deterministic shared API output', () => {
  const input = fixture()
  const before = structuredClone(input)
  const report = evaluate(input, 'baseline-sha')
  assert.deepEqual(input, before)
  assert.deepEqual(evaluate(input, 'baseline-sha'), report)
  assert.deepEqual(report.cases[0].batch, ['Alpha', 'Bravo', 'Charlie', 'Delta'])
  assert.deepEqual(report.cases[0].metrics, {
    retrievalRecall: 2 / 3,
    ndcgAt4: 1,
    precisionAt4: 0.5,
    goodOptionCoverage: 1,
    redundantOffers: 1,
    constraintViolations: 1,
  })
  input.cases[0].state.preferenceScores = { Delta: 10, Charlie: 9, Bravo: 8, Alpha: 7 }
  const changed = evaluate(input, 'challenger-sha')
  const expectedDcg = 1 / Math.log2(3) + 3 / Math.log2(4) + 7 / Math.log2(5)
  const ideal = 7 + 3 / Math.log2(3) + 1 / Math.log2(4)
  assert.ok(Math.abs(changed.cases[0].metrics.ndcgAt4! - expectedDcg / ideal) < 1e-12)
  assert.notEqual(report.suiteHash, changed.suiteHash)
  assert.throws(() => compare(report, changed), /Different evaluation inputs/)
})

test('empty, short and no-relevance batches have explicit denominators and errors', () => {
  const input = fixture()
  input.cases[0].state.pool = input.cases[0].state.pool.slice(0, 3)
  let result = evaluate(input, 'sha').cases[0]
  assert.ok(result.error)
  assert.equal(result.metrics.ndcgAt4, 0)
  assert.equal(result.metrics.precisionAt4, 0)
  assert.equal(result.metrics.goodOptionCoverage, 0)
  input.cases[0].state.pool = []
  result = evaluate(input, 'sha').cases[0]
  assert.equal(result.metrics.ndcgAt4, null)
  assert.equal(result.metrics.retrievalRecall, 0)
  input.cases[0].labels.forEach((label) => {
    label.grade = 0
  })
  assert.equal(evaluate(input, 'sha').cases[0].metrics.retrievalRecall, null)
  const short = fixture()
  short.cases[0].state.ignoredCards = ['Charlie', 'Delta', 'Echo', 'Foxtrot']
  result = evaluate(short, 'sha').cases[0]
  assert.deepEqual(result.batch, ['Alpha', 'Bravo'])
  assert.equal(result.metrics.precisionAt4, 0.5)
})

test('paired comparison permits new pools only with unchanged evaluation inputs and union labels', () => {
  const input = fixture()
  const baseline = evaluate(input, 'baseline-sha')
  input.cases[0].state.pool = input.cases[0].state.pool.filter(({ name }) => name !== 'Alpha')
  const challenger = evaluate(input, 'challenger-sha')
  const result = compare(baseline, challenger)
  assert.equal(result.cases[0].delta.retrievalRecall, -1 / 3)
  assert.equal(result.cases[0].split, 'tuning')
  assert.notEqual(baseline.cases[0].poolHash, challenger.cases[0].poolHash)
  assert.equal(result.cases[0].baseline.metrics.ndcgAt4, 1)
  assert.deepEqual(summarise(baseline).tuning.metrics.goodOptionCoverage, {
    mean: 1,
    definedCases: 1,
  })
  assert.deepEqual(summarise(baseline).holdout.metrics.goodOptionCoverage, {
    mean: null,
    definedCases: 0,
  })
  const unlabelled = structuredClone(challenger)
  unlabelled.cases[0].poolNames.push('Unlabelled')
  assert.throws(() => compare(baseline, unlabelled), /Unlabelled report candidate/)
  const differentLabels = fixture()
  differentLabels.cases[0].labels[0].grade = 0
  assert.throws(
    () => compare(baseline, evaluate(differentLabels, 'sha')),
    /Different evaluation inputs/,
  )
  const missing = structuredClone(challenger)
  missing.cases[0].id = 'other'
  assert.throws(() => compare(baseline, missing), /Different evaluation inputs/)
})

test('invalid and ambiguous inputs fail before ranking', () => {
  const input = fixture()
  input.cases[0].labels.pop()
  input.cases[0].labels.pop()
  assert.throws(() => evaluate(input, 'sha'), /Unlabelled candidate/)
  const duplicate = fixture()
  duplicate.cases[0].labels.push({ ...duplicate.cases[0].labels[0], name: 'ALPHA' })
  assert.throws(() => evaluate(duplicate, 'sha'), /Duplicate labels/)
  const invalid = fixture()
  invalid.cases[0].state.pool[0].manaValue = NaN
  assert.throws(() => evaluate(invalid, 'sha'))
  assert.throws(() => evaluate({ ...fixture(), surprise: true }, 'sha'))
  const unresolved = fixture()
  delete (unresolved.cases[0].state as Partial<(typeof unresolved.cases)[0]['state']>).deckTargets
  assert.throws(() => evaluate(unresolved, 'sha'))
})

test('CLI emits JSON and fails with no partial report on malformed commands', () => {
  const script = new URL('./rank-bench.ts', import.meta.url)
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      fileURLToPath(script),
      'evaluate',
      fileURLToPath(fixturePath),
      'fixture-sha',
    ],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).cases[0].metrics.retrievalRecall, 2 / 3)
  const invalid = spawnSync(
    process.execPath,
    ['--experimental-strip-types', fileURLToPath(script), 'evaluate'],
    { encoding: 'utf8' },
  )
  assert.equal(invalid.status, 1)
  assert.equal(invalid.stdout, '')
  assert.match(invalid.stderr, /Usage:/)
})
