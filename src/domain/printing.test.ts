import assert from 'node:assert/strict'
import test from 'node:test'

import { needsPrintingRepair } from './printing.ts'

const splitCard = {
  layout: 'split',
  backImage: undefined,
  setName: 'Set',
  scryfallUri: 'https://scryfall.com/card/test/1',
  printings: [{ finish: 'nonfoil' as const, setName: 'Set', scryfallUri: 'uri' }],
}

test('split, Adventure, and flip cards do not request a missing back image', () => {
  for (const layout of ['split', 'adventure', 'flip'])
    assert.equal(needsPrintingRepair({ ...splitCard, layout }), false, layout)
})

test('double-faced cards still request a missing back image', () => {
  assert.equal(needsPrintingRepair({ ...splitCard, layout: 'transform' }), true)
})
