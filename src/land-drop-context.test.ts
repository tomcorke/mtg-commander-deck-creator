import assert from 'node:assert/strict'
import test from 'node:test'
import { landDropProbability, landDropContext, landLikelihood } from './land-drop-context.ts'
import type { AnalysisCard } from './deck-analysis.ts'
const card = (overrides: Partial<AnalysisCard> = {}): AnalysisCard => ({
  name: 'Fixture',
  layout: 'normal',
  typeLine: 'Creature',
  manaCost: '{3}',
  manaValue: 3,
  detail: '',
  producedMana: [],
  faces: [],
  ...overrides,
})
const deck = (size = 99, lands = 40) => [
  card(),
  ...Array.from({ length: size }, (_, i) => card({ typeLine: i < lands ? 'Land' : 'Creature' })),
]
// Independent Pascal-triangle integer oracle, rather than the production multiplicative formula.
const choose = Array.from({ length: 101 }, () => Array<bigint>(101).fill(0n))
for (let n = 0; n <= 100; n++)
  for (let k = 0; k <= n; k++)
    choose[n][k] = k === 0 || k === n ? 1n : choose[n - 1][k - 1] + choose[n - 1][k]
const oracle = (n: number, l: number, t: number) => {
  let sum = 0n
  for (let k = t; k <= 7 + t; k++)
    if (k <= l && 7 + t - k <= n - l) sum += choose[l][k] * choose[n - l][7 + t - k]
  return Number(sum) / Number(choose[n][7 + t])
}
test('exact 99/98 library references for all requested counts and turns', () => {
  const refs = [
    [97.41, 89.46, 75.94, 59.22],
    [97.74, 90.58, 78.05, 62.09],
    [98.7, 94.15, 85.27, 72.63],
    [99.17, 96.03, 89.45, 79.33],
    [97.54, 89.88, 76.72, 60.27],
    [97.85, 90.98, 78.81, 63.14],
    [98.78, 94.45, 85.91, 73.62],
    [99.23, 96.27, 89.99, 80.24],
  ]
  let row = 0
  for (const n of [99, 98])
    for (const l of [35, 36, 40, 43]) {
      for (const t of [1, 2, 3, 4]) {
        assert.equal(landDropProbability(n, l, t), oracle(n, l, t))
        assert.equal(Number((100 * landDropProbability(n, l, t)).toFixed(2)), refs[row][t - 1])
      }
      row++
    }
})
test('turn-five four-land event and one-redraw policy are separate checks', () => {
  let fourInTwelve = 0n
  for (let k = 4; k <= 12; k++) fourInTwelve += choose[40][k] * choose[59][12 - k]
  assert.equal(((100 * Number(fourInTwelve)) / Number(choose[99][12])).toFixed(2), '79.94')
  let keep = 0,
    success = 0
  for (let k = 0; k <= 7; k++) {
    const opening = Number(choose[40][k] * choose[59][7 - k]) / Number(choose[99][7])
    if (k < 2 || k > 5) continue
    keep += opening
    let follow = 0n
    for (let j = Math.max(0, 4 - k); j <= 4; j++)
      follow += choose[40 - k][j] * choose[59 - (7 - k)][4 - j]
    success += (opening * Number(follow)) / Number(choose[92][4])
  }
  assert.equal((100 * (success + (1 - keep) * oracle(99, 40, 4))).toFixed(2), '80.10')
})
test('bands include boundaries without grading a deck', () => {
  assert.deepEqual([0, 0.2, 0.4, 0.6, 0.8, 0.95, 1].map(landLikelihood), [
    'Very unlikely',
    'Unlikely',
    'About even',
    'Likely',
    'Very likely',
    'Almost certain',
    'Almost certain',
  ])
  for (const edge of [0.2, 0.4, 0.6, 0.8, 0.95])
    assert.notEqual(landLikelihood(edge), landLikelihood(edge - 1e-8))
})
test('complete libraries exclude commanders; partial and unresolved cards withhold results', () => {
  const input = deck()
  const before = structuredClone(input)
  assert.equal(landDropContext(input, 1).lands, 40)
  assert.deepEqual(input, before)
  assert.equal(landDropContext(input.slice(0, -1), 1).turns, undefined)
  assert.equal(landDropContext([...input, card()], 1).turns, undefined)
  assert.equal(landDropContext([card({ typeLine: 'Land' }), ...deck(98)], 2).size, 98)
  for (const dataStatus of ['pending', 'unavailable'] as const) {
    const copy = deck()
    copy[1].dataStatus = dataStatus
    assert.equal(landDropContext(copy, 1).turns, undefined)
  }
})
test('curve, commander cost, ramp, burst, fixing, pips, tapped lands and landfall do not alter baseline', () => {
  const expected = landDropContext(deck(), 1).turns
  for (const change of [
    { manaValue: 1 },
    { manaValue: 8 },
    { detail: 'Search your library for a land card and put it onto the battlefield.' },
    { detail: 'Add {G}{G}{G}.' },
    { detail: 'Search your library for a land card and put it into your hand.' },
    { manaCost: '{G}{G}{G}' },
    { detail: 'Landfall — draw a card.' },
  ]) {
    const copy = deck().map((c) => ({ ...c, ...change }))
    assert.deepEqual(landDropContext(copy, 1).turns, expected)
  }
  const tapped = deck()
  tapped[1].detail = 'This land enters tapped.'
  tapped[1].producedMana = ['C']
  assert.deepEqual(landDropContext(tapped, 1).turns, expected)
})
test('MDFCs count once in all-land mode, transforming back lands do not count', () => {
  const input = deck()
  input[41] = card({
    layout: 'modal_dfc',
    typeLine: 'Sorcery // Land',
    faces: [
      { typeLine: 'Sorcery', manaCost: '{3}' },
      { typeLine: 'Land', manaCost: '' },
    ],
  })
  assert.equal(landDropContext(input, 1).lands, 41)
  assert.equal(landDropContext(input, 1).optionalLands, 1)
  input[41].layout = 'transform'
  assert.equal(landDropContext(input, 1).lands, 40)
  input[41].layout = 'modal_dfc'
  input[41].faces = []
  assert.equal(landDropContext(input, 1).turns, undefined)
})
