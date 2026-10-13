import assert from 'node:assert/strict'
import test from 'node:test'

import type { ScryfallCard } from './card-model.ts'
import { finishLabel, needsPrintingRepair, printingOptions } from './printing.ts'

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

test('names a special foil only on the foil finish', () => {
  const card = {
    set: 'msc',
    set_name: 'Marvel Super Heroes Commander',
    collector_number: '211',
    image_uris: { normal: 'sol.jpg' },
    finishes: ['nonfoil' as const, 'foil' as const],
    promo_types: ['surgefoil', 'universesbeyond'],
    prices: { usd: '1.54', usd_foil: null },
  } as unknown as ScryfallCard
  const options = printingOptions([card])
  assert.deepEqual(
    options.map(({ finish, foilType }) => [finish, foilType]),
    [
      ['nonfoil', undefined],
      ['foil', 'surgefoil'],
    ],
  )
  assert.deepEqual(options.map(finishLabel), [undefined, 'Surge foil'])
  assert.equal(finishLabel({ finish: 'foil' }), 'Foil')
  assert.equal(finishLabel({ finish: 'etched' }), 'Etched')
})
