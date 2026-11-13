import assert from 'node:assert/strict'
import test from 'node:test'
import { deckRiskIndicators, deckTagCoverage, winConditionCards } from './deck-review.ts'

test('reports selected tags and detected supported mechanics', () => {
  const cards = [
    { name: 'Token maker', tags: ['Tokens', 'Flying', 'Flying'] },
    { name: 'Flyer', tags: ['Flying', 'Creatures'] },
  ]

  assert.deepEqual(deckTagCoverage(cards, ['Tokens', 'Graveyard']), [
    { tag: 'Tokens', cards: [cards[0]] },
    { tag: 'Graveyard', cards: [] },
    { tag: 'Flying', cards },
  ])
})

test('flags mass land denial and extra turns from names and printed text', () => {
  const cards = [
    { name: 'Blood Moon', detail: 'Nonbasic lands are Mountains.' },
    { name: 'Jokulhaups', detail: 'Destroy all artifacts, creatures, and lands.' },
    { name: 'Ravages of War', detail: 'Destroy all lands.' },
    { name: 'Time Warp', detail: 'Target player takes an extra turn after this one.' },
    {
      name: 'Stranglehold',
      detail: 'If an opponent would begin an extra turn, that player skips that turn instead.',
    },
    { name: 'Grizzly Bears', detail: '' },
  ]
  const [mld, turns] = deckRiskIndicators(cards)
  assert.deepEqual(
    mld.cards.map((card) => card.name),
    ['Blood Moon', 'Jokulhaups', 'Ravages of War'],
  )
  assert.deepEqual(
    turns.cards.map((card) => card.name),
    ['Time Warp'],
  )
})

test('selected creature-type themes count changelings, as offers do (#501)', () => {
  const cards = [
    { name: 'Cat', tags: ['Cats'], typeLine: 'Creature — Cat' },
    { name: 'Shapeshifter', tags: ['Changeling'], typeLine: 'Creature — Shapeshifter' },
    { name: 'Mutavault', tags: ['Changeling'], typeLine: 'Land' },
  ]
  assert.deepEqual(
    deckTagCoverage(cards, ['Cats'])[0].cards.map(({ name }) => name),
    ['Cat', 'Shapeshifter'],
  )
})

test('finds win-the-game cards from printed text', () => {
  const card = (name: string, detail: string) => ({
    name,
    layout: 'normal',
    typeLine: 'Enchantment',
    manaCost: '{3}',
    manaValue: 3,
    detail,
    producedMana: [],
    faces: [],
  })
  const cards = [
    card(
      'Alt win',
      'At the beginning of your upkeep, if you control 20 creatures, you win the game.',
    ),
    card('Lose', 'Each opponent loses the game.'),
    card('Drain', 'Each opponent loses 1 life.'),
  ]
  assert.deepEqual(
    winConditionCards(cards).map(({ name }) => name),
    ['Alt win', 'Lose'],
  )
})
