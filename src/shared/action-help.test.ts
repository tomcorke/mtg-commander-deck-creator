import assert from 'node:assert/strict'
import test from 'node:test'

import { placeActionHelp } from './action-help.ts'

const viewport = { width: 1280, height: 800 }
const size = { width: 280, height: 140 }
// A trigger 30px wide and 20px tall whose top edge is at `top`.
const at = (top: number, left = 600) => ({ top, bottom: top + 20, left, right: left + 30 })

test('opens above, centred on the anchor, when there is room', () => {
  assert.deepEqual(placeActionHelp(at(400), size, viewport), {
    top: 400 - 8 - 140,
    left: 615 - 140,
    side: 'above',
  })
})

test('flips below an anchor near the top of the viewport (#580)', () => {
  // The Build a starting deck case: the trigger sits just below the top edge.
  assert.deepEqual(placeActionHelp(at(120), size, viewport, 'above', 'end'), {
    top: 140 + 8,
    left: 630 - 280,
    side: 'below',
  })
})

test('flips above when a below-first tooltip lacks room underneath', () => {
  const placed = placeActionHelp(at(720), size, viewport, 'below', 'start')
  assert.equal(placed.side, 'above')
  assert.equal(placed.top, 720 - 8 - 140)
  assert.equal(placed.left, 600)
})

test('keeps the preferred side when neither fits but it has more room', () => {
  const placed = placeActionHelp(at(110), size, { width: 1280, height: 230 }, 'above')
  assert.equal(placed.side, 'above')
  assert.equal(placed.top, 16)
})

test('clamps horizontally inside the viewport edge', () => {
  assert.equal(placeActionHelp(at(400, 4), size, viewport).left, 16)
  assert.equal(placeActionHelp(at(400, 1260), size, viewport).left, 1280 - 280 - 16)
})

test('opens beside the anchor, then falls back above and end-aligned at narrow widths', () => {
  assert.deepEqual(placeActionHelp(at(400), size, viewport, 'inline-end'), {
    top: 410 - 70,
    left: 638,
    side: 'inline-end',
  })
  const narrow = placeActionHelp(at(400, 300), size, { width: 390, height: 800 }, 'inline-end')
  assert.equal(narrow.side, 'above')
  assert.equal(narrow.left, 330 - 280)
})
