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

test('keeps reverse face image when converting a double-faced card', () => {
  assert.equal(scryfallBackImage(doubleFacedCard), 'back-image')
  assert.equal(toDeckCard(doubleFacedCard).backImage, 'back-image')
})
