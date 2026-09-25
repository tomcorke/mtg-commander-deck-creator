import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets } from '../deck-analysis.ts'
import { buildBuilderData, displayDeckSection } from './useBuilderData.ts'

test('shows basic-land fill and scores lands when the deck has a land gap', () => {
  const land = {
    name: 'Forest',
    layout: 'normal',
    typeLine: 'Basic Land — Forest',
    manaCost: '',
    manaValue: 0,
    detail: '{T}: Add {G}.',
    producedMana: ['G'],
    faces: [],
    reason: 'Land or mana',
    tags: [],
    set: 'tst',
  }
  const creature = {
    name: 'Expensive Creature',
    layout: 'normal',
    typeLine: 'Creature',
    manaCost: '{5}{G}{G}{G}',
    manaValue: 8,
    detail: '',
    producedMana: [],
    faces: [],
    reason: 'Interesting new pick',
    tags: [],
    set: 'tst',
  }
  const deps = {
    commander: 'Test Commander',
    commanderDetails: { colours: ['G'] },
    deck: [
      {
        name: 'Test Commander',
        layout: 'normal',
        typeLine: 'Legendary Creature',
        manaCost: '{G}',
        manaValue: 1,
        detail: '',
        producedMana: [],
        faces: [],
      },
    ],
    deckTargets: { ...defaultDeckTargets, lands: 32 },
    queue: [land, creature],
    sideboard: [],
    activeSubThemes: [],
    theme: '',
    dismissedSubThemes: [],
    subThemeSearch: '',
    commanderSubThemes: [],
    collectionBrowserCards: [],
    collectionBrowserType: 'all',
    collectionBrowserMana: '',
    collectionSearch: '',
    setOptions: [],
    collectionSets: [],
    collectionMode: 'none',
    preferenceScores: {},
    prioritizeDeckHealth: true,
    recommendationStyle: 'balanced',
    batchNumber: 1,
    powerTarget: 'precon',
    includeCreature: true,
    excludeGameChangers: true,
    excludeTutors: true,
    excludeExtraTurns: true,
    excludeUnreleased: true,
  }
  const data = buildBuilderData(deps)
  const withoutDeckHealth = buildBuilderData({ ...deps, prioritizeDeckHealth: false })

  assert.deepEqual(data.basicLands, [{ name: 'Forest', colour: 'G', count: 32 }])
  assert.ok(data.scoredBatch[0].score.deckNeeds > 0)
  assert.ok(data.scoredBatch[1].score.manaFitPenalty < 0)
  assert.equal(withoutDeckHealth.scoredBatch[0].score.deckNeeds, 0)
  assert.ok(withoutDeckHealth.scoredBatch[1].score.manaFitPenalty < 0)
})

test('groups planeswalker creatures with planeswalkers', () => {
  for (const typeLine of [
    'Legendary Planeswalker Creature — Test',
    'Legendary Planeswalker — Test',
  ])
    assert.equal(displayDeckSection({ typeLine, faces: [] }), 'Planeswalkers')
  assert.equal(
    displayDeckSection({
      typeLine: 'Creature — Test',
      faces: [{ typeLine: 'Legendary Planeswalker — Test', manaCost: '' }],
    }),
    'Planeswalkers',
  )
})
