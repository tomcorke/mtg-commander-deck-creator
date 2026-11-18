import assert from 'node:assert/strict'
import test from 'node:test'
import { toDeckCard } from '../../domain/card-model.ts'
import { matchesCardFilter } from './deck-review-filter.ts'

test('review type filters ignore Marchesa on the back of Invasion of Fiora', () => {
  const invasion = toDeckCard({
    id: 'invasion-of-fiora',
    name: 'Invasion of Fiora // Marchesa, Resolute Monarch',
    layout: 'transform',
    type_line: 'Battle \u2014 Siege // Legendary Creature \u2014 Human Noble',
    cmc: 6,
    color_identity: ['B'],
    card_faces: [
      { name: 'Invasion of Fiora', type_line: 'Battle \u2014 Siege', mana_cost: '{4}{B}{B}' },
      { name: 'Marchesa, Resolute Monarch', type_line: 'Legendary Creature \u2014 Human Noble' },
    ],
  })
  assert.equal(matchesCardFilter(invasion, 'type:Creature'), false)
  assert.equal(matchesCardFilter(invasion, 'type:Battle'), true)
  assert.equal(matchesCardFilter(invasion, 'type:Land'), false)
})
