import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileLandSelection, resizeBasicCounts } from './land-dialog-state.ts'

test('nonbasic toggles adjust one edited slot without restoring an older split', () => {
  const edited = { Plains: 2, Island: 8 }
  const ticked = resizeBasicCounts(edited, -1)
  assert.deepEqual(ticked, { Plains: 2, Island: 7 })
  const editedAgain = { ...ticked, Plains: 3, Island: 6 }
  assert.deepEqual(resizeBasicCounts(editedAgain, 1), { Plains: 3, Island: 7 })
  assert.deepEqual(edited, { Plains: 2, Island: 8 })
})

test('refresh retains includes and excludes across picks and alternatives', () => {
  assert.deepEqual(
    reconcileLandSelection(['A', 'B', 'C'], ['B', 'C'], ['A', 'B', 'D'], ['A', 'D']),
    ['B', 'D'],
  )
})

test('slot adjustments stop at zero and preserve incomplete edits on refresh', () => {
  assert.deepEqual(resizeBasicCounts({ Plains: 0, Island: 1 }, -3), { Plains: 0, Island: 0 })
  assert.deepEqual(resizeBasicCounts({ Plains: 2, Island: 3 }, 0), { Plains: 2, Island: 3 })
})

test('planner colour deltas reverse tied splits and retain player offsets', () => {
  const original = { Plains: 4, Island: 5 }
  const smaller = { Plains: 4, Island: 4 }
  const ticked = resizeBasicCounts(original, -1, original, smaller)
  assert.deepEqual(ticked, smaller)
  assert.deepEqual(resizeBasicCounts(ticked, 1, smaller, original), original)
  assert.deepEqual(resizeBasicCounts({ Plains: 2, Island: 7 }, -1, original, smaller), {
    Plains: 2,
    Island: 6,
  })
})

test('blank fields remain blank while other counts absorb slot changes', () => {
  const counts = { Plains: NaN, Island: 8 }
  const previous = { Plains: 4, Island: 5 }
  const defaults = { Plains: 3, Island: 5 }
  assert.deepEqual(resizeBasicCounts(counts, -1, previous, defaults), { Plains: NaN, Island: 7 })
  assert.deepEqual(resizeBasicCounts(counts, 1, defaults, previous), { Plains: NaN, Island: 9 })
})

test('refresh applies a colour shift even when the number of slots stays the same', () => {
  assert.deepEqual(
    resizeBasicCounts(
      { Plains: 4, Island: 5 },
      0,
      { Plains: 4, Island: 5 },
      { Plains: 5, Island: 4 },
    ),
    { Plains: 5, Island: 4 },
  )
})
