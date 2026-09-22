import assert from 'node:assert/strict'
import test from 'node:test'

import { displayDeckSection } from './useBuilderData.ts'

test('groups planeswalker creatures with planeswalkers', () => {
  for (const typeLine of [
    'Legendary Planeswalker Creature — Test',
    'Legendary Planeswalker — Test',
  ])
    assert.equal(displayDeckSection({ typeLine, faces: [] }), 'Planeswalkers')
  assert.equal(
    displayDeckSection({
      typeLine: 'Creature — Test',
      faces: [{ typeLine: 'Legendary Planeswalker — Test', manaCost: '' }],
    }),
    'Planeswalkers',
  )
})
