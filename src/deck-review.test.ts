import assert from 'node:assert/strict'
import test from 'node:test'
import { deckTagCoverage } from './deck-review.ts'

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
