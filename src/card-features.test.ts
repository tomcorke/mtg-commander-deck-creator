import assert from 'node:assert/strict'
import test from 'node:test'
import { cardFeatures, roleCredit, rolesForCard, type AnalysisCard } from './deck-analysis.ts'

const card = (detail: string, typeLine = 'Sorcery'): AnalysisCard => ({
  name: 'Fixture',
  layout: 'normal',
  typeLine,
  detail,
  manaCost: '{2}',
  manaValue: 2,
  producedMana: [],
  faces: [],
})

test('feature boundaries retain positive, negative and ambiguous evidence', () => {
  const cases = [
    ['mana', 'Search your library for a land card, put it onto the battlefield.', 'land-ramp'],
    ['mana', 'Search your library for a land card, put it into your hand.', 'land-to-hand'],
    ['mana', 'Search your library for a land card.', 'unknown'],
    ['mana', 'Draw two cards.', null],
    ['draw', 'Draw two cards.', 'net'],
    ['draw', 'Draw four cards.', 'net'],
    ['draw', 'Cycling {2}', 'cantrip'],
    ['draw', 'Cycling {2}\nDraw four cards.', 'net'],
    ['draw', 'Whenever you activate a cycling ability, create a token.', null],
    ['draw', 'Draw a card.', 'cantrip'],
    ['draw', 'Each opponent may draw a card.', null],
    ['draw', 'Target opponent may draw four cards.', null],
    ['draw', 'Whenever an opponent draws a card, create a Treasure token.', null],
    ['draw', 'Each player draws two cards.', 'net'],
    ['draw', 'Target player draws two cards.', 'unknown'],
    ['draw', 'You can’t draw a card.', 'unknown'],
    ['draw', 'Whenever you draw a card, create a Treasure token.', null],
    ['draw', 'Whenever your draw step begins, create a Treasure token.', null],
    ['draw', 'Draw two cards, then discard two cards.', 'selection'],
    ['interaction', 'Exile target creature an opponent controls.', 'opposing'],
    ['interaction', 'Whenever a creature you control dies, destroy target creature.', 'opposing'],
    ['interaction', 'This spell deals 3 damage to target player.', 'unknown'],
    ['interaction', 'This spell deals 3 damage to target spell’s controller.', 'unknown'],
    ['interaction', 'Exile target creature you control, then return it.', 'self'],
    ['interaction', 'Target permanent phases out.', 'unknown'],
    ['interaction', 'Draw two cards.', null],
    ['wipe', 'Destroy all creatures.', true],
    ['wipe', 'Destroy all creatures you control.', 'unknown'],
    ['wipe', 'Return each creature card from your graveyard to the battlefield.', 'unknown'],
    ['wipe', 'This spell deals X damage to each creature.', true],
    ['wipe', 'Draw two cards.', false],
    ['wipe', 'Destroy each chosen thing.', 'unknown'],
  ] as const
  for (const [feature, detail, expected] of cases) {
    const result = cardFeatures(card(detail))
    assert.equal(result[feature], expected, detail)
    if (expected !== null && expected !== false)
      assert.ok(result.evidence[feature]?.includes(detail), detail)
  }
})

// Provider text checked 2026-10-25: https://api.scryfall.com/cards/named?exact=<card name>.
test('review regressions preserve opposing wipes and keep opponents’ seven cards out of your draw credit', () => {
  const livingDeath = {
    ...card(
      'Each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield.',
    ),
    oracleId: '9e6a3df4-67a3-452e-a6ef-f04dbadb21ef',
  }
  const mutilate = card('All creatures get -1/-1 until end of turn for each Swamp you control.')
  assert.deepEqual(rolesForCard(livingDeath), ['wipes'])
  assert.deepEqual(rolesForCard(mutilate), ['wipes'])
  const wheel = {
    ...card(
      'Any number of target opponents each discard their hands, then draw seven cards.\nDraw a card.',
      'Instant',
    ),
    oracleId: 'a7c6f07c-3cc3-4271-bbc7-9f7d5bbed3e8',
  }
  assert.equal(cardFeatures(wheel).draw, 'cantrip')
  assert.equal(roleCredit(wheel).draw, 0.5)
  assert.equal(cardFeatures(card('Target opponent may draw four cards.')).beneficiary, 'opponents')
})

test('mana costs and repetition distinguish acceleration, fixing and one-shot resources', () => {
  for (const [detail, typeLine, expected] of [
    ['{T}: Add {G}.', 'Creature', 'repeatable'],
    ['{1}, {T}: Add one mana of any color.', 'Artifact', 'fixing'],
    ['Add {R}{R}{R}.', 'Instant', 'burst'],
    ['When Fixture enters, create a Treasure token.', 'Creature', 'burst'],
    ['Whenever you attack, create a Treasure token.', 'Creature', 'repeatable'],
    ['Create a Treasure token.', 'Artifact', 'unknown'],
    ['Destroy target creature.', 'Instant', null],
  ] as const)
    assert.equal(cardFeatures(card(detail, typeLine)).mana, expected, detail)
  const potentialOnly = { ...card(''), producedMana: ['G'] }
  assert.equal(cardFeatures(potentialOnly).mana, 'unknown')
  assert.deepEqual(rolesForCard(potentialOnly), [])
  const features = cardFeatures(card('Discard a card: Draw a card.', 'Creature'))
  assert.deepEqual(features.costs, ['Discard a card'])
  assert.equal(features.draw, 'selection')
  assert.ok(!rolesForCard(card('Discard a card: Draw a card.', 'Creature')).includes('draw'))
})

test('strategy clues distinguish resources, enablers, payoffs and explicit finishers', () => {
  for (const [detail, expected] of [
    ['Create two 1/1 creature tokens.', ['resource']],
    ['Sacrifice a creature: Scry 1.', ['enabler']],
    ['Whenever a creature you control dies, draw a card.', ['resource', 'payoff']],
    ['You win the game.', ['finisher']],
    ['Destroy target creature.', []],
    ['Creatures have an unusual ability.', ['unknown']],
  ] as const)
    assert.deepEqual(cardFeatures(card(detail)).strategy, expected, detail)
  assert.equal(cardFeatures(card('Target player may draw a card.')).beneficiary, 'unknown')
  assert.equal(cardFeatures(card('Each opponent may draw a card.')).beneficiary, 'opponents')
  assert.equal(cardFeatures(card('You draw two cards.')).beneficiary, 'you')
  for (const detail of [
    'Target player draws two cards.',
    'Target permanent phases out.',
    'Destroy each chosen thing.',
  ])
    assert.deepEqual(rolesForCard(card(detail)), [], detail)
})
