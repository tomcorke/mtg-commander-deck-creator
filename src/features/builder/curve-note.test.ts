import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisCard } from '../../deck-analysis.ts'
import { commanderCurveNote } from './curve-note.ts'

const card = (overrides: Partial<AnalysisCard> = {}): AnalysisCard => ({
  name: 'Fixture',
  layout: 'normal',
  typeLine: 'Legendary Creature — Elf',
  manaCost: '{2}{G}',
  manaValue: 3,
  detail: '',
  producedMana: [],
  faces: [],
  ...overrides,
})

test('names each commander the curve counts, with its mana value', () => {
  assert.equal(commanderCurveNote([card()]), 'Includes your commander (mana value 3).')
  assert.equal(
    commanderCurveNote([card(), card({ manaValue: 4 })]),
    'Includes both commanders (mana values 3 and 4).',
  )
  assert.equal(
    commanderCurveNote([card(), card({ dataStatus: 'pending' })]),
    'Includes one commander (mana value 3).',
  )
})

test('stays silent when the curve counts no commander', () => {
  assert.equal(commanderCurveNote([]), '')
  assert.equal(commanderCurveNote([card({ dataStatus: 'pending' })]), '')
})
