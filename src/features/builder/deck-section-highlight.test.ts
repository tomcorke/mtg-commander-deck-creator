import assert from 'node:assert/strict'
import test from 'node:test'
import { openSectionsWithHighlights } from './deck-section-highlight.ts'

test('opens only sections containing matches and leaves other toggles alone', () => {
  const matched = { open: false, querySelector: () => ({}) }
  const unmatched = { open: false, querySelector: () => null }
  openSectionsWithHighlights([matched, unmatched])
  assert.equal(matched.open, true)
  assert.equal(unmatched.open, false)
})
