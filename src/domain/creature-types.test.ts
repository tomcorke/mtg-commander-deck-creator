import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseCuratedTheme } from './creature-types.ts'

test('a curated chip that is already an extra becomes the theme and leaves the extras', () => {
  assert.deepEqual(chooseCuratedTheme('Cats', ['Elves'], 'Elves'), {
    theme: 'Elves',
    extras: ['Cats'],
  })
})

test('pressing the current theme promotes the first extra or leaves the toggle to the caller', () => {
  assert.deepEqual(chooseCuratedTheme('Cats', ['Elves', 'Goblins'], 'Cats'), {
    theme: 'Elves',
    extras: ['Goblins'],
  })
  assert.equal(chooseCuratedTheme('Cats', [], 'Cats'), null)
})
