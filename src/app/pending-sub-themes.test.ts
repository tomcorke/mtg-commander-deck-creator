import assert from 'node:assert/strict'
import test from 'node:test'
import { addPendingSubTheme } from './pending-sub-themes.ts'

test('queueing a theme repeatedly keeps each pending theme once', () => {
  const first = addPendingSubTheme([], 'Voltron')
  const repeated = addPendingSubTheme(first, 'Voltron')
  assert.deepEqual(repeated, ['Voltron'])
  assert.deepEqual(addPendingSubTheme(repeated, 'Tokens'), ['Voltron', 'Tokens'])
  assert.deepEqual(addPendingSubTheme(['Voltron', 'Voltron'], 'Tokens'), ['Voltron', 'Tokens'])
  assert.deepEqual(first, ['Voltron'])
})
