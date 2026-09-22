import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAppRoute, routeHash } from './routes.ts'

test('routeHash preserves view and modal names', () => {
  assert.equal(routeHash('start', null), '#start')
  assert.equal(routeHash('builder', 'export'), '#build/export')
})

test('parseAppRoute ignores unknown hashes and validates history state', () => {
  assert.equal(parseAppRoute('#unknown', null), null)
  assert.deepEqual(parseAppRoute('#build/card', null), {
    app: 'commander-deck-creator',
    view: 'builder',
    modal: 'card',
    entry: false,
  })
  assert.deepEqual(
    parseAppRoute('#start', {
      app: 'commander-deck-creator',
      view: 'start',
      modal: null,
      entry: true,
    }),
    {
      app: 'commander-deck-creator',
      view: 'start',
      modal: null,
      entry: true,
    },
  )
})
