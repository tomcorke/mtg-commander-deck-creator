import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prepareReview, validateReview } from './completed-review.ts'

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
test('legal deck produces an allowlisted, order-independent bundle', () => {
  const source = input()
  const dirty = {
    ...source,
    round: 'SECRET',
    spec: source.spec,
    cards: source.cards.map((c) => ({
      ...c,
      source: 'SECRET',
      reason: 'SECRET',
      seedEvidence: ['SECRET'],
      legalities: { ...c.legalities, provenance: 'SECRET' },
      card_faces: undefined,
    })),
  }
  const result = prepareReview(dirty)
  assert.equal(result.status, 'ready')
  assert.ok(!JSON.stringify(result).includes('SECRET'))
  assert.deepEqual(result, prepareReview({ ...dirty, cards: dirty.cards.toReversed() }))
})
test('size, colour, banned cards, singleton, commanders and constraints reject', () => {
  const variants = [
    () => {
      const v = input()
      v.cards.pop()
      return v
    },
    () => {
      const v = input()
      v.cards[1].color_identity = ['B']
      return v
    },
    () => {
      const v = input()
      v.cards[1].legalities.commander = 'banned'
      return v
    },
    () => {
      const v = input()
      v.cards[1].type_line = 'Land'
      return v
    },
    () => {
      const v = input()
      v.cards[0].type_line = 'Creature'
      return v
    },
    () => {
      const v = input()
      v.spec.constraints.mustExclude = ['Plains'] as never[]
      return v
    },
  ]
  for (const make of variants) assert.equal(prepareReview(make()).status, 'rejected')
})
test('essential data and constrained prices are unresolved, never ready', () => {
  const source = input()
  const missing = {
    ...source,
    cards: source.cards.map((c) => ({ ...c, color_identity: undefined })),
  }
  assert.equal(prepareReview(missing).status, 'unresolved')
  assert.equal(
    prepareReview({
      ...source,
      spec: { ...source.spec, constraints: { ...source.spec.constraints, totalBudget: 100 } },
    }).status,
    'unresolved',
  )
  assert.throws(() => prepareReview({ ...source, spec: { ...source.spec, bracket: 6 } }))
})
test('partner pair and Oracle copy exceptions use shared validator', () => {
  const source = input()
  source.spec.commander.push('Second commander')
  source.cards[0].oracle_text = 'Partner'
  source.cards[1] = { ...source.cards[0], name: 'Second commander' }
  assert.equal(prepareReview(source).status, 'ready')
  source.cards[1].oracle_text = ''
  assert.equal(prepareReview(source).status, 'rejected')
  const copies = input()
  copies.cards = copies.cards.map((c, i) =>
    i === 0
      ? c
      : {
          ...c,
          name: 'Test copies',
          type_line: 'Creature',
          oracle_text: 'A deck can have any number of cards named Test copies.',
        },
  )
  assert.equal(prepareReview(copies).status, 'ready')
})
test('reviews bind to deck, require complete anchored assessments and produce markdown', () => {
  const source = input(),
    prepared = prepareReview(source)
  assert.equal(prepared.status, 'ready')
  if (prepared.status !== 'ready') return
  const assessment = { score: 3, confidence: 'low', justification: 'Synthetic estimate' }
  const review = {
    version: 1,
    bundleHash: prepared.bundleHash,
    criteria: {
      bracketFit: { ...assessment, fit: 'unresolved' },
      effectiveness: assessment,
      themeFit: assessment,
      ideaFit: assessment,
      fun: assessment,
      synergy: assessment,
    },
    strongest: [{ card: 'Plains', reason: 'Test', sources: ['oracle:Plains'] }],
    weakest: [{ card: 'Plains', reason: 'Test', sources: ['oracle:Plains'] }],
    swaps: [],
    knowledgeGaps: [],
    limitations: ['Desk estimate only'],
  }
  assert.match(validateReview(source, review).markdown, /Desk estimate only/)
  assert.throws(
    () => validateReview(source, { ...review, bundleHash: '0'.repeat(64) }),
    /hash mismatch/,
  )
  assert.throws(
    () =>
      validateReview(source, {
        ...review,
        strongest: [{ ...review.strongest[0], card: 'Absent' }],
      }),
    /absent/,
  )
  assert.throws(() => validateReview(source, { ...review, criteria: {} }))
})
test('selected printing constraints count all copies and keep caps independent', () => {
  const source = input()
  const priced = {
    ...source,
    cards: source.cards.map((c) => ({ ...c, set: 'tst', prices: { usd: '1.00' } })),
  }
  const constrained = (changes: object) => ({
    ...priced,
    spec: { ...source.spec, constraints: { ...source.spec.constraints, ...changes } },
  })
  assert.equal(
    prepareReview(constrained({ totalBudget: 100, perCardCap: 1, allowedSets: ['tst'] })).status,
    'ready',
  )
  assert.equal(prepareReview(constrained({ totalBudget: 99 })).status, 'rejected')
  assert.equal(prepareReview(constrained({ perCardCap: 0.5 })).status, 'rejected')
  assert.equal(prepareReview(constrained({ allowedSets: ['other'] })).status, 'rejected')
  assert.equal(prepareReview(constrained({ mustInclude: ['Absent'] })).status, 'rejected')
})
test('complete face-only Oracle text is accepted and used for copy exceptions', () => {
  const source = input()
  const cards = source.cards.map((card, i) =>
    i === 0
      ? card
      : {
          ...card,
          name: 'Test faces',
          type_line: 'Creature // Creature',
          oracle_text: undefined,
          card_faces: [
            {
              type_line: 'Creature',
              mana_cost: '',
              oracle_text: 'A deck can have any number of cards named Test faces.',
            },
            { type_line: 'Creature', mana_cost: '', oracle_text: '' },
          ],
        },
  )
  assert.equal(prepareReview({ ...source, cards }).status, 'ready')
  assert.equal(
    prepareReview({ ...source, cards: cards.map((c) => ({ ...c, card_faces: undefined })) }).status,
    'unresolved',
  )
})
test('known construction violations survive unrelated missing metadata', () => {
  const source = input()
  const cards = source.cards.map((c, i) => ({
    ...c,
    name: i === 1 ? 'Banned test' : i === 2 ? 'Unknown test' : c.name,
    color_identity: i === 2 ? undefined : c.color_identity,
    legalities: { commander: i === 1 ? 'banned' : 'legal' },
  }))
  const result = prepareReview({ ...source, cards })
  assert.equal(result.status, 'rejected')
  assert.ok(result.errors.some((error) => error.includes('Banned test')))
  assert.ok(result.unresolved.some((error) => error.includes('Unknown test')))
})
