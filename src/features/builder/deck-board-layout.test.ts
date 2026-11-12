import assert from 'node:assert/strict'
import test from 'node:test'
import {
  balanceColumns,
  listColumn,
  tileSpans,
  tileTrack,
  trackCapacity,
} from './deck-board-layout.ts'

test('capacity counts whole tracks and gaps, never below one', () => {
  assert.equal(trackCapacity(1229, listColumn), 4)
  assert.equal(trackCapacity(922, listColumn), 3)
  assert.equal(trackCapacity(340, listColumn), 1)
  assert.equal(trackCapacity(0, listColumn), 1)
  assert.equal(trackCapacity(1229, tileTrack), 7)
  assert.equal(trackCapacity(340, tileTrack), 2)
})

test('the issue deck fills every column instead of leaving the second empty', () => {
  // Commander, Planeswalkers, Creatures, Sorceries, Instants, Lands.
  const columns = balanceColumns([1, 1, 6, 2, 2, 3], 4)
  assert.equal(columns.length, 4)
  assert(columns.every((column) => column.length > 0))
  assert.deepEqual(columns.flat(), [0, 1, 2, 3, 4, 5])
})

test('columns never outnumber groups, and keep their order', () => {
  assert.deepEqual(balanceColumns([1], 4), [[0]])
  assert.deepEqual(balanceColumns([], 4), [])
  assert.deepEqual(balanceColumns([3, 3], 1), [[0, 1]])
  assert.deepEqual(
    balanceColumns([1, 1, 30, 8, 6, 8, 9, 6, 2], 4).flat(),
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  )
})

test('balancing minimises the tallest column', () => {
  // Heights with headings: 2.5, 2.5, 31.5, 9.5, 7.5, 9.5, 10.5, 7.5.
  const entries = [1, 1, 30, 8, 6, 8, 9, 6]
  const columns = balanceColumns(entries, 4)
  const heights = columns.map((column) =>
    column.reduce((sum, index) => sum + entries[index] + 1.5, 0),
  )
  // Creatures alone set the floor; everything else fits in the other three columns.
  assert.equal(Math.max(...heights), 31.5)
  assert.deepEqual(columns[1], [2])
})

test('small tile groups share a row; a big group takes the rest of a half-free row', () => {
  // Commander, Planeswalkers and six Creatures fill one 8-track row.
  assert.deepEqual(tileSpans([1, 1, 6, 2, 2, 3], 8), [1, 1, 6, 2, 2, 3])
  // Thirty creatures wrap beside the one-card groups rather than leaving them alone.
  assert.deepEqual(tileSpans([1, 1, 30, 8], 8), [1, 1, 6, 8])
  // With under half a row free, a big group starts the next row.
  assert.deepEqual(tileSpans([6, 9], 8), [6, 5])
  // A group that fits the free tracks always shares the row.
  assert.deepEqual(tileSpans([7, 1], 8), [7, 1])
  assert.deepEqual(tileSpans([1, 1, 6], 2), [1, 1, 2])
})

test('a wrapping tile group takes its narrowest span for the fewest rows', () => {
  // The issue deck at 1366px (7 tracks): six creatures sit 3 + 3, and Sorceries share the row.
  assert.deepEqual(tileSpans([1, 1, 6, 2, 2, 3], 7), [1, 1, 3, 2, 2, 3])
  // Eight artifacts on a fresh 7-track row sit 4 + 4, leaving three tracks for the next group.
  assert.deepEqual(tileSpans([8, 3], 7), [4, 3])
})
