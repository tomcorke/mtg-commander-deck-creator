import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fallbackManaSymbolName,
  manaSymbolDetails,
  type ScryfallManaSymbol,
} from './mana-symbols.ts'

const symbology: ReadonlyMap<string, ScryfallManaSymbol> = new Map([
  [
    '{W/U/P}',
    {
      symbol: '{W/U/P}',
      english: 'One white or blue Phyrexian mana',
      svg_uri: 'https://svgs.scryfall.io/card-symbols/WUP.svg',
    },
  ],
  [
    '{C/W}',
    {
      symbol: '{C/W}',
      english: 'One colourless or white mana',
      svg_uri: 'https://svgs.scryfall.io/card-symbols/CW.svg',
    },
  ],
])

test('renders hybrid and three-part mana symbols with Scryfall SVG URIs', () => {
  assert.equal(
    manaSymbolDetails('W/U/P', symbology)?.svg_uri,
    'https://svgs.scryfall.io/card-symbols/WUP.svg',
  )
  assert.equal(
    manaSymbolDetails('C/W', symbology)?.svg_uri,
    'https://svgs.scryfall.io/card-symbols/CW.svg',
  )
})

test('uses current names for generic Phyrexian and pawprint symbols', () => {
  assert.equal(fallbackManaSymbolName('H'), 'generic Phyrexian mana')
  assert.equal(fallbackManaSymbolName('P'), 'pawprint')
})
