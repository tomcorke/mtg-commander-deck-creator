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

test('resource tokens are not token-army enablers', () => {
  const deck = Array(3).fill({
    detail: 'Whenever a creature token you control enters, draw a card.',
  })
  assert.equal(score('Create a Treasure token.', deck, ['Tokens']), 0)
  assert.ok(score('Create two 1/1 white Soldier creature tokens.', deck, ['Tokens']) > 0)
})

test('sacrifice triggers are payoffs without inventing an outlet', () => {
  const reward = 'Whenever you sacrifice a permanent, draw a card.'
  assert.deepEqual(packageCounts([{ detail: reward }], ['Sacrifice']).Sacrifice, {
    enabler: 0,
    payoff: 1,
    protection: 0,
  })
  assert.ok(score(outlet, [{ detail: reward }], ['Sacrifice']) > 0)
  const both = `${outlet}\nWhenever a player sacrifices a creature, draw a card.`
  assert.deepEqual(packageCounts([{ detail: both }], ['Sacrifice']).Sacrifice, {
    enabler: 1,
    payoff: 1,
    protection: 0,
  })
})

test('creature tokens count even when created alongside resource tokens', () => {
  const mixed = 'Create X 1/1 white Halfling creature tokens and X Food tokens.'
  assert.equal(packageCounts([{ detail: mixed }], ['Tokens']).Tokens.enabler, 1)
  for (const resource of ['Treasure', 'Food', 'Clue', 'Blood', 'Gold', 'Map', 'Powerstone']) {
    assert.equal(
      packageCounts([{ detail: `Create a tapped ${resource} token.` }], ['Tokens']).Tokens.enabler,
      0,
    )
  }
})

test('tribal lords do not activate token packages', () => {
  const deck = Array(3).fill({ detail: 'Other Elf creatures you control get +1/+1.' })
  assert.deepEqual(packageCounts(deck), {})
  assert.equal(score('Create two 1/1 white Soldier creature tokens.', deck), 0)
})

test('reminder-only token references are not payoffs for the deck token makers', () => {
  const reminder =
    'When this creature enters, empower Jace 2. (Put two loyalty counters on a Jace token you control. If you do not control one, first create a blue Jace planeswalker token.)'
  const deck = Array(5).fill({ detail: 'Create a 1/1 white Soldier creature token.' })
  assert.equal(score(reminder, deck, ['Tokens']), 0)
  assert.equal(packageCounts([{ detail: reminder }], ['Tokens']).Tokens.payoff, 0)
  assert.equal(score(`${reminder}\nCreature tokens you control get +1/+1.`, deck, ['Tokens']), 8)
})

test('protection scores only once the package has both enablers and payoffs', () => {
  const recursion = 'Return target creature card from your graveyard to the battlefield.'
  assert.equal(score(recursion, [{ detail: payoff }], ['Sacrifice']), 0)
  assert.equal(score(recursion, [{ detail: outlet }, { detail: payoff }], ['Sacrifice']), 4)
})
