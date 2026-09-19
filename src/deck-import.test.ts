import assert from 'node:assert/strict'
import test from 'node:test'
import { missingCardNames, parseDeckList } from './deck-import.ts'

test('reports missing name and printing identifiers as card names', () => {
  const cards = parseDeckList('1 Sol Ring\n1 Forest (M3C) 317').cards
  assert.deepEqual(missingCardNames([{ name: 'Sol Ring' }, { set: 'm3c', collector_number: '317' }], cards), ['Sol Ring', 'Forest'])
})

test('parses common deck-list syntax, printings, and boards', () => {
  assert.deepEqual(parseDeckList(`COMMANDER:\n1 Anikthea, Hand of Erebos (CMM) 705\n\nDeck\n2 Forest [M3C: 317]\n1 Sol Ring\nSIDEBOARD:\n1 Doomwake Giant (C15) 21`).cards, [
    { name: 'Anikthea, Hand of Erebos', quantity: 1, set: 'cmm', collectorNumber: '705', board: 'commander' },
    { name: 'Forest', quantity: 2, set: 'm3c', collectorNumber: '317', board: 'mainboard' },
    { name: 'Sol Ring', quantity: 1, set: undefined, collectorNumber: undefined, board: 'mainboard' },
    { name: 'Doomwake Giant', quantity: 1, set: 'c15', collectorNumber: '21', board: 'sideboard' },
  ])
})

