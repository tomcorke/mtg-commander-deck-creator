import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisCard } from '../../deck-analysis.ts'
import { deckTargetActions, landGuidanceLaterNote } from './deck-target-actions.ts'

const card = (overrides: Partial<AnalysisCard> = {}): AnalysisCard => ({
  name: 'Fixture',
  layout: 'normal',
  typeLine: 'Artifact',
  manaCost: '{2}',
  manaValue: 2,
  detail: '',
  producedMana: [],
  faces: [],
  ...overrides,
})
const commander = card({ typeLine: 'Legendary Creature — Elf', manaValue: 5 })
const land = card({ typeLine: 'Basic Land — Forest', manaCost: '', manaValue: 0 })
const spells = (count: number) => Array.from({ length: count }, () => card())
const actions = (deck: AnalysisCard[], awaitingPlayStyle = false, commanderCount = 1) =>
  deckTargetActions({ awaitingPlayStyle, deck, commanderCount })

test('the play-style step keeps role focus and land guidance hidden', () => {
  assert.deepEqual(actions([commander], true), {
    roleFocus: false,
    landGuidance: false,
    spellCount: 0,
  })
  // Even a deck past the gate waits for the step to close.
  assert.equal(actions([commander, ...spells(12)], true).landGuidance, false)
  assert.equal(landGuidanceLaterNote(0), 'Land guidance starts at 10 spells (0 of 10).')
})

test('Skip or a preset brings role focus back before land guidance', () => {
  assert.deepEqual(actions([commander]), { roleFocus: true, landGuidance: false, spellCount: 0 })
})

test('land guidance waits for 10 nonland, non-commander spells', () => {
  // Lands and the commander never count toward the gate.
  const nine = actions([commander, ...spells(9), ...Array.from({ length: 30 }, () => land)])
  assert.deepEqual(nine, { roleFocus: true, landGuidance: false, spellCount: 9 })
  assert.equal(
    landGuidanceLaterNote(nine.spellCount),
    'Land guidance starts at 10 spells (9 of 10).',
  )
  assert.deepEqual(actions([commander, ...spells(10)]), {
    roleFocus: true,
    landGuidance: true,
    spellCount: 10,
  })
  // Partners: both commanders sit before the main deck.
  assert.equal(actions([commander, commander, ...spells(9)], false, 2).landGuidance, false)
})

test('the gate is live: dropping below 10 spells hides land guidance again', () => {
  const deck = [commander, ...spells(10)]
  assert.equal(actions(deck).landGuidance, true)
  assert.equal(actions(deck.slice(0, -1)).landGuidance, false)
})
