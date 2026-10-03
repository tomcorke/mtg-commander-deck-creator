import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets } from '../deck-analysis.ts'
import { buildBuilderData, displayDeckSection } from './useBuilderData.ts'

function builderDeps(queue: unknown[], overrides: Record<string, unknown> = {}) {
  return {
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
    queue,
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
    ...overrides,
  }
}

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
  const deps = builderDeps([land, creature])
  const data = buildBuilderData(deps)
  const withoutDeckHealth = buildBuilderData({ ...deps, prioritizeDeckHealth: false })

  assert.deepEqual(data.basicLands, [{ name: 'Forest', colour: 'G', count: 32 }])
  assert.ok(data.scoredBatch[0].score.deckNeeds > 0)
  assert.ok(data.scoredBatch[1].score.manaFitPenalty < 0)
  assert.deepEqual(data.scoreCandidate(creature), data.scoredBatch[1].score)
  assert.equal(withoutDeckHealth.scoredBatch[0].score.deckNeeds, 0)
  assert.ok(withoutDeckHealth.scoredBatch[1].score.manaFitPenalty < 0)
  assert.deepEqual(
    data.scoreReplacements(deps.queue, deps.deck)[1].score,
    data.scoreCandidate(creature),
  )

  const ramp = { ...creature, name: 'Ramp', manaValue: 1, manaCost: '{G}', producedMana: ['G'] }
  const supportedDeck = [...deps.deck, ramp]
  const supported = buildBuilderData({
    ...deps,
    deck: supportedDeck,
    queue: [ramp],
    deckTargets: { lands: 0, ramp: 1, draw: 0, removal: 0, wipes: 0 },
  })
  assert.equal(supported.scoreCandidate(ramp).deckNeeds, 0)
  assert.ok(supported.scoreReplacements([ramp], deps.deck)[0].score.deckNeeds > 0)
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

test('explains each recommendation in a plain sentence', () => {
  const card = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    layout: 'normal',
    typeLine: 'Creature',
    manaCost: '{2}{G}',
    manaValue: 3,
    detail: '',
    producedMana: [],
    faces: [],
    reason: 'Commander favourite',
    source: 'edhrec',
    tags: [],
    set: 'tst',
    ...extra,
  })
  const popular = card('Popular', { inclusion: 41.4 })
  const rare = card('Rare', { inclusion: 0.4, reason: 'Interesting new pick' })
  const unknown = card('Unknown', { reason: 'Commander synergy' })
  const ramp = card('Ramp', { producedMana: ['G'], manaValue: 1, inclusion: 27 })
  const tokens = card('Tokens', { tags: ['Tokens'], source: 'scryfall' })
  const data = buildBuilderData(
    builderDeps([popular, rare, unknown, ramp], {
      commander: 'Meren of Clan Nel Toth',
      theme: 'Tokens',
    }),
  )
  const explain = (item: unknown) => data.explainRecommendation(item as never)

  assert.deepEqual(explain(popular), {
    label: 'Commander favourite',
    sentence: 'In 41% of Meren of Clan Nel Toth decks on EDHREC.',
  })
  assert.equal(
    explain(rare).sentence,
    'A new card already in under 1% of Meren of Clan Nel Toth decks on EDHREC.',
  )
  assert.equal(
    explain(unknown).sentence,
    'EDHREC rates it a high-synergy card for Meren of Clan Nel Toth.',
  )
  assert.deepEqual(explain(ramp), {
    label: 'Ramp',
    sentence:
      'Adds ramp your deck needs (0 of 10 so far), and appears in 27% of Meren of Clan Nel Toth decks on EDHREC.',
  })
  assert.deepEqual(explain(tokens), { label: 'Tokens theme', sentence: 'Fits your Tokens theme.' })
  assert.equal(
    explain(card('Fallback', { reason: 'Popular inclusion', source: 'scryfall' })).sentence,
    'A popular Commander card in your colours.',
  )
})
