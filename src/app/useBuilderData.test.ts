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
    showSupplementalSets: false,
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

test('priority and price summary reflect tuning, and the visible batch filters only the requested role', () => {
  const cards = Array.from({ length: 8 }, (_, i) => ({
    name: `Pick ${i}`,
    layout: 'normal',
    typeLine: 'Artifact',
    manaCost: '{2}',
    manaValue: 2,
    detail: i % 2 ? '{T}: Add {G}.' : '',
    producedMana: [],
    faces: [],
    reason: 'Commander synergy',
    tags: [],
    set: 'tst',
    price: i === 0 ? '10.00' : undefined,
  }))
  const data = buildBuilderData(
    builderDeps(cards, { focusedRole: 'ramp', recommendationStyle: 'competitive', maxPrice: 5 }),
  )
  assert.equal(data.scoredBatch.length, 4)
  assert.deepEqual(
    data.rawBatch.map(({ name }) => name),
    ['Pick 1', 'Pick 3', 'Pick 5', 'Pick 7'],
  )
  assert(data.recommendationSettingsSummary.includes('Deck needs first'))
  assert(data.recommendationSettingsSummary.includes('≤ $5'))
  assert(!data.recommendationSettingsSummary.includes('Health'))
  assert(!data.scoreReplacements(cards, []).some(({ card }) => card.name === 'Pick 0'))
  assert(!buildBuilderData(builderDeps(cards)).recommendationSettingsSummary.includes('≤'))
})

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

test('defers land fill, respects current decisions, and recalculates after a nonbasic add', () => {
  const card = (name: string, typeLine = 'Land') => ({
    name,
    layout: 'normal',
    typeLine,
    manaCost: typeLine === 'Land' ? '' : '{G}',
    manaValue: typeLine === 'Land' ? 0 : 1,
    detail: '',
    producedMana: ['G'],
    faces: [],
    reason: 'Land or mana',
    tags: [],
    set: 'tst',
  })
  const queue = [
    card('In sideboard'),
    card('Ignored'),
    card('Later'),
    card('Pending ignore'),
    card('First land'),
    card('Second land'),
  ]
  const deps = builderDeps(queue, {
    sideboard: [card('In sideboard')],
    ignoredCards: ['Ignored'],
    decisions: { Later: 'later', 'Pending ignore': 'ignore' },
  })
  const early = buildBuilderData(deps)
  assert.equal(early.showLandFill, false)
  assert.equal(early.landGap, 32)
  assert.deepEqual(
    early.nonbasicLands.map(({ name }) => name),
    ['First land', 'Second land'],
  )

  const deck = Array.from({ length: 58 }, (_, index) => card(`Spell ${index}`, 'Creature'))
  const nearComplete = buildBuilderData({ ...deps, deck })
  assert.equal(nearComplete.showLandFill, true)
  assert.deepEqual(nearComplete.basicLands, [{ name: 'Forest', colour: 'G', count: 32 }])

  const updated = buildBuilderData({ ...deps, deck: [...deck, queue[4]] })
  assert.equal(updated.landGap, 31)
  assert.deepEqual(updated.basicLands, [{ name: 'Forest', colour: 'G', count: 31 }])
  assert.deepEqual(
    updated.nonbasicLands.map(({ name }) => name),
    ['Second land'],
  )

  const oneSlot = buildBuilderData({ ...deps, deck: Array(99).fill(deck[0]) })
  assert.equal(oneSlot.landGap, 1)
  assert.equal(oneSlot.nonbasicLands.length, 1)
  const full = buildBuilderData({ ...deps, deck: Array(100).fill(deck[0]) })
  assert.equal(full.landGap, 0)
  assert.deepEqual(full.nonbasicLands, [])
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
