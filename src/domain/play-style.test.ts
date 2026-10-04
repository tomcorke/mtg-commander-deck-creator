import assert from 'node:assert/strict'
import test from 'node:test'
import { matchingPlayStyle, playStyleSettings, type PlayStyleSettings } from './play-style.ts'

test('presets map current preferences without mutating them or claiming a bracket', () => {
  const current: PlayStyleSettings = {
    powerTarget: 'precon',
    recommendationStyle: 'fun',
    excludeGameChangers: true,
    excludeTutors: false,
    excludeExtraTurns: true,
  }
  const original = structuredClone(current)
  assert.deepEqual(playStyleSettings(current, 'casual'), {
    powerTarget: 'precon',
    recommendationStyle: 'thematic',
    excludeGameChangers: true,
    excludeTutors: true,
    excludeExtraTurns: true,
  })
  assert.deepEqual(playStyleSettings(current, 'upgraded'), {
    ...current,
    powerTarget: 'upgraded',
    recommendationStyle: 'balanced',
    excludeGameChangers: false,
  })
  assert.deepEqual(playStyleSettings(current, 'high'), {
    powerTarget: 'high',
    recommendationStyle: 'competitive',
    excludeGameChangers: false,
    excludeTutors: false,
    excludeExtraTurns: false,
  })
  assert.deepEqual(current, original)
  assert.equal(matchingPlayStyle(current), undefined)
  for (const style of ['casual', 'upgraded', 'high'] as const)
    assert.equal(matchingPlayStyle(playStyleSettings(current, style)), style)
  assert.equal(
    matchingPlayStyle({ ...playStyleSettings(current, 'casual'), excludeTutors: false }),
    undefined,
  )
})
