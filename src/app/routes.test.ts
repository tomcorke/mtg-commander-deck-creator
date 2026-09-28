import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAppRoute, routeHash } from './routes.ts'

test('routeHash preserves view and modal names', () => {
  assert.equal(routeHash('start', null), '#start')
  assert.equal(routeHash('builder', 'export'), '#build/export')
  assert.equal(routeHash('builder', 'review'), '#build/review')
  assert.equal(routeHash('builder', 'doctor'), '#build/doctor')
  assert.equal(routeHash('builder', 'doctor-history'), '#build/doctor-history')
})

test('parseAppRoute ignores unknown hashes and validates history state', () => {
  assert.equal(parseAppRoute('#unknown', null), null)
  assert.deepEqual(parseAppRoute('#build/card', null), {
    app: 'commander-deck-creator',
    view: 'builder',
    modal: 'card',
    entry: false,
  })
  assert.equal(parseAppRoute('#build/review', null)?.modal, 'review')
  assert.equal(parseAppRoute('#build/doctor', null)?.modal, 'doctor')
  assert.equal(parseAppRoute('#build/doctor-history', null)?.modal, 'doctor-history')
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
