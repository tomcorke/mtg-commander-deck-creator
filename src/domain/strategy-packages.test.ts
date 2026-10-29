import assert from 'node:assert/strict'
import test from 'node:test'

import { recommendationScoreBreakdown } from './recommendation-scoring.ts'
import { packageCounts } from './strategy-packages.ts'

const outlet = 'Sacrifice another creature: Scry 1.'
const payoff = 'Whenever another creature you control dies, each opponent loses 1 life.'
const context = {
  theme: '',
  activeSubThemes: [],
  pickedTags: new Set<string>(),
  preferenceScores: {},
  neededRoles: new Set<string>(),
  cardRoles: [],
}
const score = (detail: string, deck: { detail: string }[], themes: string[] = []) =>
  recommendationScoreBreakdown(
    { reason: 'Commander synergy', tags: [], detail },
    { ...context, packageCounts: packageCounts(deck, themes) },
  ).package

test('a deck with excess payoffs prefers a missing enabler', () => {
  const deck = [{ detail: outlet }, ...Array(5).fill({ detail: payoff })]
  assert.ok(score(outlet, deck) > score(payoff, deck))
  assert.equal(score(payoff, deck), 0)
})

test('a deck with excess enablers prefers a payoff', () => {
  const deck = [...Array(4).fill({ detail: outlet }), { detail: payoff }]
  assert.ok(score(payoff, deck) > score(outlet, deck))
})

test('packages stay inactive until the theme names them or three cards build them', () => {
  assert.equal(score(outlet, [{ detail: payoff }]), 0)
  assert.ok(score(outlet, [{ detail: payoff }], ['Sacrifice']) > 0)
})

test('the commander counts as a package piece', () => {
  const commander = { detail: 'Whenever a creature token you control enters, draw a card.' }
  const counts = packageCounts([commander], ['Tokens'])
  assert.equal(counts.Tokens.payoff, 1)
})
