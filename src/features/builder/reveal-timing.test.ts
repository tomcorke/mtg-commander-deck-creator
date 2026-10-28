import assert from 'node:assert/strict'
import test from 'node:test'
import { flipDuration, flipStagger, revealFrame } from './reveal-timing.ts'

test('the first incoming turn overlaps the last outgoing turn with four cards', () => {
  const time = flipDuration + 100
  const first = revealFrame(time, true)
  const last = revealFrame(time - 3 * flipStagger, true)
  assert.equal(first.phase, 'entering')
  assert.equal(last.phase, 'leaving')
  assert.equal(last.done, false)
  assert.equal(first.oldOpacity, 0)
  assert.equal(last.newOpacity, 0)
})

test('a rolling slot hides old copy before exposing new copy and completes facing forward', () => {
  assert.equal(revealFrame(0, true).oldOpacity, 1)
  const back = revealFrame(flipDuration, true)
  assert.equal(back.side, 'back')
  assert.equal(back.oldOpacity, 0)
  assert.equal(back.newOpacity, 0)
  const finished = revealFrame(flipDuration * 2, true)
  assert.equal(finished.side, 'new')
  assert.equal(finished.newOpacity, 1)
  assert.equal(finished.angle, -Math.PI * 2)
  assert.equal(finished.done, true)
})

test('initial reveals keep their original timing and begin on a standard back', () => {
  assert.equal(revealFrame(0, false).side, 'back')
  assert.equal(revealFrame(flipDuration, false).done, true)
  assert.equal(revealFrame(flipDuration - 1, false).done, false)
})

test('rotation is reversed while timing and left-to-right staggering stay unchanged', () => {
  assert(revealFrame(flipDuration / 4, true).angle < 0)
  assert(revealFrame(flipDuration * 1.25, true).angle < -Math.PI)
  assert.equal(revealFrame(0, false).angle, -Math.PI)
  assert(revealFrame(flipDuration / 4, false).angle < -Math.PI)
  assert.equal(flipStagger, 180)
  assert.equal(flipDuration, 750)
})

test('initial and rolling incoming reveals turn in the same direction', () => {
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const initial = revealFrame(flipDuration * progress, false)
    const incoming = revealFrame(flipDuration * (1 + progress), true)
    assert.equal(initial.angle, incoming.angle)
  }
})
