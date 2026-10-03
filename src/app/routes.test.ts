import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseAppRoute,
  routeHash,
  reviewBackModal,
  reviewStepForModal,
  reviewRouteDepth,
  reviewRoutes,
  reviewSteps,
  shouldConfirmReviewNavigation,
} from './routes.ts'

test('routeHash preserves view and modal names', () => {
  assert.equal(routeHash('start', null), '#start')
  assert.equal(routeHash('builder', 'export'), '#build/export')
  assert.equal(routeHash('builder', 'review'), '#build/review')
  assert.equal(routeHash('builder', 'doctor'), '#build/doctor')
  assert.equal(routeHash('builder', 'doctor-history'), '#build/doctor-history')
})

test('review steps have distinct routes and predictable predecessors, including direct links', () => {
  for (const [index, modal] of reviewRoutes.entries()) {
    const parsed = parseAppRoute(routeHash('builder', modal), null)
    assert.equal(parsed?.modal, modal)
    assert.equal(parsed?.entry, false)
    assert.equal(reviewStepForModal(modal), reviewSteps[index])
    assert.equal(reviewBackModal(reviewSteps[index]), index ? reviewRoutes[index - 1] : null)
  }
  assert.equal(reviewStepForModal('doctor'), 'Diagnose')
  assert.equal(reviewStepForModal('doctor-history'), null)
  assert.equal(reviewStepForModal('card'), null)
  assert.equal(reviewStepForModal(null), null)
})

test('pending Diagnose choices block exits, but not review steps or clean routes', () => {
  const diagnose = parseAppRoute('#build/review', null)!
  const builder = parseAppRoute('#build', null)!
  assert.equal(shouldConfirmReviewNavigation(diagnose, builder, true), true)
  assert.equal(shouldConfirmReviewNavigation(diagnose, builder, false), false)
  assert.equal(
    shouldConfirmReviewNavigation(diagnose, parseAppRoute('#build/search', null)!, true),
    true,
  )
  assert.equal(
    shouldConfirmReviewNavigation(diagnose, parseAppRoute('#build/review-changes', null)!, true),
    false,
  )
  assert.equal(
    shouldConfirmReviewNavigation(parseAppRoute('#build/doctor-history', null), builder, true),
    false,
  )
})

test('review history depth exits an app-started workflow without guessing direct-link history', () => {
  const builder = parseAppRoute('#build', null)!
  assert.equal(reviewRouteDepth(builder, 'review', false), 1)
  const diagnose = { ...builder, modal: 'review' as const, entry: true, reviewDepth: 1 }
  assert.equal(reviewRouteDepth(diagnose, 'review-changes', false), 2)
  const confirm = { ...diagnose, modal: 'review-confirm' as const, reviewDepth: 3 }
  assert.equal(reviewRouteDepth(confirm, 'review', true), 3)
  assert.equal(reviewRouteDepth(confirm, null, true), undefined)
  assert.equal(reviewRouteDepth(confirm, 'card', false), undefined)
  assert.equal(
    reviewRouteDepth(parseAppRoute('#build/review-changes', null), 'review-confirm', false),
    undefined,
  )
  assert.equal(parseAppRoute('#build/review-confirm', confirm)?.reviewDepth, 3)
  assert.equal(parseAppRoute('#build/review', confirm)?.reviewDepth, undefined)
  assert.equal(
    parseAppRoute('#build/review-confirm', { ...confirm, reviewDepth: -1 })?.reviewDepth,
    undefined,
  )
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
