import assert from 'node:assert/strict'
import test from 'node:test'
import {
  balanceThemeCoverage,
  createBuilderState,
  explainCard,
  recommend,
  spreadRoles,
  type BatchPlacementReason,
} from '../recommendations.ts'
import { toCard } from './card-model.ts'

const card = (name: string, type = 'Artifact', reason = 'Commander synergy') =>
  toCard(
    {
      name,
      type_line: type,
      color_identity: [],
      cmc: type === 'Land' ? 0 : 2,
      legalities: { commander: 'legal' },
      game_changer: false,
      set: 'tst',
      collector_number: name,
    },
    reason,
  )

test('recommend and explain scores include real creature, mana and focus placement steps', () => {
  const pool = [
    card('Artifact A'),
    card('Artifact B'),
    card('Creature', 'Creature'),
    card('Mana', 'Land', 'Land or mana'),
  ]
  const input = {
    ...createBuilderState('2026-10-26', 'build'),
    commander: 'Leader',
    identity: [],
    pool,
    prioritizeDeckHealth: true,
  }
  const result = recommend(input)
  assert.ok(
    result.scores
      .find((card) => card.name === 'Creature')
      ?.placementReasons.includes('creature-slot'),
  )
  assert.ok(
    result.scores.find((card) => card.name === 'Mana')?.placementReasons.includes('mana-slot'),
  )
  const explanation = explainCard(input, 'Creature')
  assert.equal(explanation.status, 'ranked')
  if (explanation.status === 'ranked')
    assert.ok(explanation.placementReasons.includes('creature-slot'))
  const focused = recommend({ ...input, focusedRole: 'lands' })
  assert.deepEqual(
    focused.batch.map((card) => card.name),
    ['Mana'],
  )
  assert.ok(focused.scores.find((card) => card.name === 'Mana')?.placementReasons.includes('focus'))
  assert.ok(
    focused.scores
      .filter((card) => card.name !== 'Mana')
      .every((card) => !card.placementReasons.includes('focus')),
  )
})

test('the existing diversity and theme rearrangements report the cards they move', () => {
  const cards = ['A', 'B', 'C', 'D', 'E'].map((name) => card(name))
  const events: [string, BatchPlacementReason][] = []
  const observe = (card: { name: string }, reason: BatchPlacementReason) => {
    events.push([card.name, reason])
  }
  const varied = spreadRoles(
    cards,
    (card) => (card.name === 'E' ? ['ramp'] : ['draw']),
    new Set(),
    [],
    () => true,
    observe,
  )
  assert.equal(varied[1].name, 'E')
  assert.ok(events.some(([name, reason]) => name === 'E' && reason === 'diversity'))
  const themed = balanceThemeCoverage(
    cards.map((card) => ({ ...card, tags: [card.name === 'E' ? 'Sacrifice' : 'Tokens'] })),
    ['Tokens', 'Sacrifice'],
    () => true,
    observe,
  )
  assert.ok(themed.slice(0, 4).some((card) => card.name === 'E'))
  assert.ok(events.some(([name, reason]) => name === 'E' && reason === 'theme-coverage'))
})
