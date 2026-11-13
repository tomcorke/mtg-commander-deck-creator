import assert from 'node:assert/strict'
import test from 'node:test'
import { comboCardImage, findDeckCombos, parseComboIndex, type ComboIndex } from './combo-index.ts'

// Synthetic rows: they test matching rules, not real Spellbook combos.
const index: ComboIndex = parseComboIndex({
  version: 1,
  metadata: {
    exportedAt: '2026-11-13T14:13:00+00:00',
    exportVersion: '7.4.1',
    generatedAt: '2026-11-13T16:00:00.000Z',
  },
  cards: [
    ['Altar', 'oracle-altar', '64513f0a-067d-4b70-bb23-9ebe606bda1a?1783926252'],
    ['Witness', 'oracle-witness', null],
    ['Reanimate All', 'oracle-reanimate', null],
    ['Leader', 'oracle-leader', null],
    ['Engine', 'oracle-engine', null],
    ['Off Colour', 'oracle-red', null],
    ['Front // Back', null, null],
  ],
  results: ['Infinite mana', 'Infinite death triggers', 'Win the game'],
  combos: [
    ['a', [0, 1, 2], [0, 1], 'BG', 50],
    ['b', [0, 1], [1], 'B', 900],
    ['c', [~3, 0], [2], 'B', 10],
    ['d', [0, 4], [0], 'B', 5],
    ['e', [1, 4], [0], 'G', 20],
    ['f', [0, 5], [2], 'BR', 999],
    ['g', [0, 4, 2], [0], 'BG', 1],
    ['h', [6, 0], [], 'C', 3],
  ],
})
const card = (name: string, oracleId?: string) => ({ name, ...(oracleId && { oracleId }) })

test('lists included combos and one-card-away combos grouped by the missing card', () => {
  const result = findDeckCombos(index, {
    commanders: [card('Leader', 'oracle-leader')],
    cards: [card('Altar', 'oracle-altar'), card('Witness', 'oracle-witness')],
    identity: ['B', 'G'],
  })
  // Fewer cards first, then Spellbook popularity.
  assert.deepEqual(
    result.included.map(({ id }) => id),
    ['b', 'c'],
  )
  assert.deepEqual(result.included[1].commanders, [{ name: 'Leader', oracleId: 'oracle-leader' }])
  assert.deepEqual(result.included[0].results, ['Infinite death triggers'])
  assert.deepEqual(
    result.nearMisses.map(({ card, combos }) => [card.name, combos.map(({ id }) => id)]),
    [
      // Engine completes two combos, so it leads.
      ['Engine', ['e', 'd']],
      ['Reanimate All', ['a']],
      ['Front // Back', ['h']],
    ],
  )
  // Off Colour is outside the deck's identity; g misses two cards.
  assert(!result.nearMisses.some(({ card }) => card.name === 'Off Colour'))
})

test('skips combos whose must-be-commander card is not a commander', () => {
  const result = findDeckCombos(index, {
    commanders: [card('Other')],
    cards: [card('Leader', 'oracle-leader'), card('Altar', 'oracle-altar')],
    identity: ['B'],
  })
  assert(!result.included.some(({ id }) => id === 'c'))
  assert(!result.nearMisses.some(({ combos }) => combos.some(({ id }) => id === 'c')))
})

test('matches legacy cards by name, including the front face of a double-faced name', () => {
  const result = findDeckCombos(index, {
    commanders: [],
    cards: [card('altar'), card('Front')],
    identity: [],
  })
  assert.deepEqual(
    result.included.map(({ id }) => id),
    ['h'],
  )
})

test('builds Scryfall image URLs only from stored id keys', () => {
  assert.equal(
    comboCardImage('64513f0a-067d-4b70-bb23-9ebe606bda1a?1783926252'),
    'https://cards.scryfall.io/normal/front/6/4/64513f0a-067d-4b70-bb23-9ebe606bda1a.jpg?1783926252',
  )
  assert.equal(comboCardImage('https://example.com/x.jpg'), undefined)
  assert.equal(comboCardImage(null), undefined)
})

test('rejects malformed artifacts', () => {
  assert.throws(() => parseComboIndex({ ...index, version: 2 }), /version/)
  assert.throws(
    () => parseComboIndex({ ...index, metadata: { ...index.metadata, exportedAt: 'soon' } }),
    /metadata/,
  )
  assert.throws(() => parseComboIndex({ ...index, combos: [['x', [99], [], 'B', 1]] }), /combos/)
  assert.throws(() => parseComboIndex({ ...index, cards: [['', null, null]] }), /cards/)
})
