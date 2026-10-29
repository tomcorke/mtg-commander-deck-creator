import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarise } from './summarise.ts'
const assessment = (score: number) => ({ score, justification: 'Synthetic', confidence: 'low' })
function entry(split: string, score: number, repeat = 1) {
  return {
    specId: split + '-test',
    split,
    repeat,
    reviewRepeat: 1,
    builderFeedback: 'Tool friction',
    review: {
      version: 1,
      bundleHash: 'a'.repeat(64),
      criteria: {
        bracketFit: { ...assessment(score), fit: 'appropriate' },
        effectiveness: assessment(score),
        themeFit: assessment(score),
        ideaFit: assessment(score),
        fun: assessment(score),
        synergy: assessment(score),
      },
      strongest: [{ card: 'Test', reason: 'Evidence', sources: ['oracle:Test'] }],
      weakest: [{ card: 'Test', reason: 'Evidence', sources: ['oracle:Test'] }],
      swaps: [],
      knowledgeGaps: [],
      limitations: ['Synthetic only'],
    },
  }
}
test('summary retains individual scores/spread, separates holdouts and preserves feedback and ranking', () => {
  const result = summarise({
    entries: [entry('development', 1), entry('development', 4, 2), entry('holdout', 5)],
    rankBench: { ndcg4: 0.8 },
  })
  assert.equal(result.development.scores.fun.spread, 3)
  assert.deepEqual(
    result.development.scores.fun.values.map((v) => v.value),
    [1, 4],
  )
  assert.deepEqual(
    result.holdout.scores.fun.values.map((v) => v.value),
    [5],
  )
  assert.equal(result.development.feedback.builder.length, 2)
  assert.deepEqual(result.rankBench, { ndcg4: 0.8 })
  assert.match(result.intervals, /paired commander/)
  assert.equal(summarise({ entries: [] }).development.scores.fun.spread, null)
  assert.throws(() => summarise({ entries: [entry('development', 6)] }))
})

test('summary rejects duplicated reviews and mixed split declarations', () => {
  const item = entry('development', 3)
  assert.throws(() => summarise({ entries: [item, item] }), /Duplicate/)
  assert.throws(
    () => summarise({ entries: [item, { ...item, repeat: 2, split: 'holdout' }] }),
    /both splits/,
  )
})
