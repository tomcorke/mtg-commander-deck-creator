import assert from 'node:assert/strict'
import test from 'node:test'

import { scryfallBackImage, toDeckCard, type ScryfallCard } from './card-model.ts'

const doubleFacedCard: ScryfallCard = {
  name: 'Front // Back',
  type_line: 'Creature // Creature',
  color_identity: ['G'],
  set: 'set',
  collector_number: '1',
  prints_search_uri: 'https://example.test/prints',
  card_faces: [
    { image_uris: { normal: 'front-image' }, type_line: 'Creature' },
    { image_uris: { normal: 'back-image' }, type_line: 'Creature' },
  ],
}

test('keeps reverse face image and face mana cost when converting a DFC', () => {
  const dfc = {
    ...doubleFacedCard,
    layout: 'transform',
    card_faces: [
      { ...doubleFacedCard.card_faces![0], mana_cost: '{2}{G}' },
      doubleFacedCard.card_faces![1],
    ],
  }
  assert.equal(scryfallBackImage(dfc), 'back-image')
  assert.equal(toDeckCard(dfc).backImage, 'back-image')
  assert.equal(toDeckCard(dfc).manaCost, '{2}{G}')
})

test('does not treat split-card faces as back images', () => {
  const split = { ...doubleFacedCard, layout: 'split' }
  assert.equal(scryfallBackImage(split), undefined)
  assert.equal(toDeckCard(split).backImage, undefined)
})
