import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets } from './deck-analysis.ts'
import {
  analyzeDeckDoctor,
  applyDeckDoctorSwap,
  applyDeckDoctorSwapPlan,
  deckReviewMode,
  groupDeckCards,
  undoDeckDoctorSwap,
} from './deck-doctor.ts'
import type { Card, DeckCard } from './domain/card-model.ts'

const deckCard = (name: string, overrides: Partial<DeckCard> = {}): DeckCard => ({
  name,
  layout: 'normal',
  typeLine: 'Creature',
  commanderLegality: 'legal',
  colorIdentity: ['G'],
  manaCost: '{1}{G}',
  manaValue: 2,
  detail: '',
  producedMana: [],
  faces: [],
  image: '',
  set: 'tst',
  collectorNumber: '1',
  tags: [],
  ...overrides,
})

const candidate = (name: string, overrides: Partial<Card> = {}): Card => ({
  ...deckCard(name),
  reason: 'Interesting new pick',
  printsUri: '',
  ...overrides,
})

test('reports theme support and flags cards that lack other connections', () => {
  const commander = deckCard('Commander', { tags: ['Tokens'] })
  const tokenCard = deckCard('Token Engine', {
    tags: ['Tokens'],
    detail: 'Create two token creatures.',
  })
  const utilityCard = deckCard('Utility Creature')
  const rampCard = deckCard('Ramp Creature', {
    detail: 'Add {G}.',
    producedMana: ['G'],
  })
  const findings = analyzeDeckDoctor({
    deck: [commander, tokenCard, utilityCard, rampCard],
    sideboard: [deckCard('Sideboard Token', { tags: ['Tokens'] })],
    commanderCount: 1,
    theme: 'Tokens',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
  })

  const support = findings.find(({ kind }) => kind === 'theme-support')
  assert.equal(support?.supportCount, 1)
  assert.deepEqual(support?.cardNames, ['Token Engine'])
  assert.deepEqual(findings.find(({ kind }) => kind === 'weak-connection')?.cardNames, [
    'Utility Creature',
  ])
})

test('only flags cards without selected tags, roles, or known synergy', () => {
  const findings = analyzeDeckDoctor({
    deck: [
      deckCard('Commander', { detail: 'Create a token creature.' }),
      deckCard('Commander Link', { detail: 'Tokens you control get +1/+1.' }),
      deckCard('Token Maker', { detail: 'Create a token creature.' }),
      deckCard('Token Payoff', { detail: 'Tokens you control get +1/+1.' }),
      deckCard('Card Draw', { detail: 'Draw a card.' }),
      deckCard('Unconnected Card'),
    ],
    sideboard: [],
    commanderCount: 1,
    theme: 'Tokens',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
  })

  assert.deepEqual(
    findings.filter(({ kind }) => kind === 'weak-connection').map(({ cardNames }) => cardNames[0]),
    ['Unconnected Card'],
  )
})

test('uses selected sub-themes as separate support signals', () => {
  const findings = analyzeDeckDoctor({
    deck: [
      deckCard('Commander'),
      deckCard('Sub-theme Card', { tags: ['Aristocrats'] }),
      deckCard('Unconnected Card'),
    ],
    sideboard: [],
    commanderCount: 1,
    theme: 'Tokens',
    activeSubThemes: ['Aristocrats'],
    deckTargets: defaultDeckTargets,
  })

  assert.equal(findings.find(({ id }) => id === 'theme-support:Aristocrats')?.supportCount, 1)
  assert.deepEqual(findings.find(({ kind }) => kind === 'weak-connection')?.cardNames, [
    'Unconnected Card',
  ])
})

test('waits for 70 cards before showing role gaps and strengthens guidance at 85', () => {
  const input = {
    deck: Array.from({ length: 69 }, (_, index) => deckCard(`Card ${index}`)),
    sideboard: [],
    commanderCount: 1,
    theme: '',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
  }

  assert.equal(
    analyzeDeckDoctor(input).some(({ kind }) => kind === 'role-gap'),
    false,
  )
  const at70 = analyzeDeckDoctor({ ...input, deck: [...input.deck, deckCard('Card 69')] })
  assert.equal(
    at70.some(({ kind }) => kind === 'role-gap'),
    true,
  )
  const at85 = analyzeDeckDoctor({
    ...input,
    deck: [...input.deck, ...Array.from({ length: 16 }, (_, index) => deckCard(`Extra ${index}`))],
  })
  assert.ok(at85.find(({ kind }) => kind === 'role-gap')?.summary.includes('slots left'))
})

test('groups mana concerns for all affected cards into one finding', () => {
  const findings = analyzeDeckDoctor({
    deck: [
      deckCard('Commander'),
      deckCard('Red Spell', { typeLine: 'Sorcery', manaCost: '{3}{R}{R}', manaValue: 5 }),
      deckCard('Blue Spell', { typeLine: 'Sorcery', manaCost: '{3}{U}{U}', manaValue: 5 }),
    ],
    sideboard: [],
    commanderCount: 1,
    theme: '',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
  })
  const manaFindings = findings.filter(({ kind }) => kind === 'mana-outlier')

  assert.equal(manaFindings.length, 1)
  assert.deepEqual(manaFindings[0].cardNames, ['Red Spell', 'Blue Spell'])
})

test('does not flag a {2/color} hybrid spell as above-curve when deck sources support its coloured option', () => {
  const findings = analyzeDeckDoctor({
    deck: [
      deckCard('Commander', { colorIdentity: ['W'] }),
      deckCard('Spectral Procession', {
        typeLine: 'Sorcery',
        colorIdentity: ['W'],
        manaCost: '{2/W}{2/W}{2/W}',
        manaValue: 6,
        detail: 'Create three 1/1 white Spirit creature tokens with flying.',
      }),
      deckCard('High Cost Spell', {
        typeLine: 'Sorcery',
        colorIdentity: ['W'],
        manaCost: '{5}{W}',
        manaValue: 6,
      }),
      ...Array.from({ length: 20 }, (_, index) =>
        deckCard(`White Creature ${index}`, {
          colorIdentity: ['W'],
          manaCost: '{1}{W}',
        }),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        deckCard(`Plains ${index}`, {
          typeLine: 'Basic Land',
          colorIdentity: ['W'],
          manaCost: '',
          manaValue: 0,
          producedMana: ['W'],
        }),
      ),
    ],
    sideboard: [],
    commanderCount: 1,
    theme: '',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
  })

  assert.deepEqual(findings.find(({ kind }) => kind === 'mana-outlier')?.cardNames, [
    'High Cost Spell',
  ])
})

test('flags coloured spells that require more reported sources than the deck has', () => {
  const findings = analyzeDeckDoctor({
    deck: [
      deckCard('Commander'),
      deckCard('Colour-intensive Spell', {
        typeLine: 'Sorcery',
        manaCost: '{3}{R}{R}',
        manaValue: 5,
      }),
    ],
    sideboard: [],
    commanderCount: 1,
    theme: '',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
  })

  const signal = findings.find(({ kind }) => kind === 'mana-outlier')?.cardSignals?.[0]
  assert.deepEqual(signal?.colourGaps, [{ colour: 'R', required: 2, sources: 0 }])
  assert.match(signal?.summary ?? '', /Colour pips exceed reported mana sources/)
})

test('reports qualified simulation estimates only when the target was drawn often enough', () => {
  const hardSpell = deckCard('Hard Spell', {
    typeLine: 'Sorcery',
    manaCost: '{5}{G}{G}',
    manaValue: 7,
  })
  const simulation = {
    trials: 200,
    turns: [],
    spellCastability: [
      {
        name: hardSpell.name,
        drawnByTurn: Array.from({ length: 10 }, (_, index) => (index < 6 ? 0 : 0.2)),
        whenDrawnByTurn: Array.from({ length: 10 }, (_, index) => (index < 6 ? 0 : 0.4)),
      },
    ],
  }
  const findings = analyzeDeckDoctor({
    deck: [
      deckCard('Commander'),
      deckCard('Forest', { typeLine: 'Basic Land', producedMana: ['G'] }),
      hardSpell,
    ],
    sideboard: [],
    commanderCount: 1,
    theme: '',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
    simulation,
  })

  assert.deepEqual(
    findings.find(({ kind }) => kind === 'mana-outlier')?.cardSignals?.[0].simulation,
    {
      turn: 7,
      drawnChance: 0.2,
      castableChance: 0.4,
    },
  )
})

test('applies a confirmed swap and restores it with an individual undo', () => {
  const commander = deckCard('Commander')
  const cut = deckCard('Cut')
  const replacement = candidate('Replacement', { tags: ['Tokens'] })
  const applied = applyDeckDoctorSwap({
    id: 'swap-1',
    deck: [commander, cut, deckCard('Other')],
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['G'],
    swap: { cutIndex: 1, cutCard: cut, addCard: replacement, reason: 'Theme fit.' },
    moveCutToSideboard: true,
  })

  assert.deepEqual(
    applied.deck.map(({ name }) => name),
    ['Commander', 'Replacement', 'Other'],
  )
  assert.deepEqual(
    applied.sideboard.map(({ name }) => name),
    ['Cut'],
  )
  const undone = undoDeckDoctorSwap({
    deck: applied.deck,
    sideboard: applied.sideboard,
    commanderCount: 1,
    commanderColours: ['G'],
    record: applied.record,
  })
  assert.deepEqual(
    undone.deck.map(({ name }) => name),
    ['Commander', 'Cut', 'Other'],
  )
  assert.deepEqual(undone.sideboard, [])
})

test('applies a balanced multi-card plan atomically with sideboard retention', () => {
  const commander = deckCard('Commander')
  const cutOne = deckCard('Cut One')
  const cutTwo = deckCard('Cut Two')
  const deck = [commander, cutOne, cutTwo]
  const plan = {
    id: 'batch-1',
    deck,
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['G'],
    cuts: [
      { cutIndex: 1, cutCard: cutOne },
      { cutIndex: 2, cutCard: cutTwo },
    ],
    additions: [candidate('Add One'), candidate('Add Two')],
    moveCutToSideboard: true,
  }
  const applied = applyDeckDoctorSwapPlan(plan)

  assert.deepEqual(
    applied.deck.map(({ name }) => name),
    ['Commander', 'Add One', 'Add Two'],
  )
  assert.deepEqual(
    applied.sideboard.map(({ name }) => name),
    ['Cut One', 'Cut Two'],
  )
  assert.deepEqual(
    applied.records.map(({ id }) => id),
    ['batch-1:0', 'batch-1:1'],
  )
  assert.deepEqual(
    deck.map(({ name }) => name),
    ['Commander', 'Cut One', 'Cut Two'],
  )
  assert.throws(() => applyDeckDoctorSwapPlan({ ...plan, cuts: [], additions: [] }), /cut or add/)
  assert.throws(
    () =>
      applyDeckDoctorSwapPlan({
        ...plan,
        additions: [candidate('Legal'), candidate('Illegal', { colorIdentity: ['U'] })],
      }),
    /colour identity/,
  )
  assert.deepEqual(
    deck.map(({ name }) => name),
    ['Commander', 'Cut One', 'Cut Two'],
  )
})

test('undoes independent swaps in any order', () => {
  const commander = deckCard('Commander')
  const cutOne = deckCard('Cut One')
  const cutTwo = deckCard('Cut Two')
  const first = applyDeckDoctorSwap({
    id: 'first',
    deck: [commander, cutOne, cutTwo],
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['G'],
    swap: { cutIndex: 1, cutCard: cutOne, addCard: candidate('Add One'), reason: '' },
    moveCutToSideboard: false,
  })
  const second = applyDeckDoctorSwap({
    id: 'second',
    deck: first.deck,
    sideboard: first.sideboard,
    commanderCount: 1,
    commanderColours: ['G'],
    swap: { cutIndex: 2, cutCard: cutTwo, addCard: candidate('Add Two'), reason: '' },
    moveCutToSideboard: false,
  })
  const undoneFirst = undoDeckDoctorSwap({
    deck: second.deck,
    sideboard: second.sideboard,
    commanderCount: 1,
    commanderColours: ['G'],
    record: first.record,
  })

  assert.deepEqual(
    undoneFirst.deck.map(({ name }) => name),
    ['Commander', 'Cut One', 'Add Two'],
  )
  const undoneSecond = undoDeckDoctorSwap({
    ...undoneFirst,
    commanderCount: 1,
    commanderColours: ['G'],
    record: second.record,
  })
  assert.deepEqual(
    undoneSecond.deck.map(({ name }) => name),
    ['Commander', 'Cut One', 'Cut Two'],
  )
})

test('rejects illegal, stale, or unsafe swaps without overwriting deck edits', () => {
  const commander = deckCard('Commander')
  const cut = deckCard('Cut')
  const base = {
    id: 'swap-2',
    deck: [commander, cut],
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['G'],
    moveCutToSideboard: false,
  }

  assert.throws(
    () =>
      applyDeckDoctorSwap({
        ...base,
        swap: { cutIndex: 0, cutCard: commander, addCard: candidate('Replacement'), reason: '' },
      }),
    /commander/,
  )
  assert.throws(
    () =>
      applyDeckDoctorSwap({
        ...base,
        swap: {
          cutIndex: 1,
          cutCard: cut,
          addCard: candidate('Blue Card', { colorIdentity: ['U'] }),
          reason: '',
        },
      }),
    /colour identity/,
  )
  assert.throws(
    () =>
      applyDeckDoctorSwap({
        ...base,
        deck: [commander, deckCard('Changed')],
        swap: { cutIndex: 1, cutCard: cut, addCard: candidate('Replacement'), reason: '' },
      }),
    /changed/,
  )
})

test('fits the review mode to deck size', () => {
  assert.equal(deckReviewMode(38), 'build')
  assert.equal(deckReviewMode(89), 'build')
  assert.equal(deckReviewMode(90), 'review')
  assert.equal(deckReviewMode(100), 'review')
  assert.equal(deckReviewMode(105), 'trim')
})

test('groups duplicate basics into one entry per name', () => {
  const deck = [
    deckCard('Commander'),
    ...Array.from({ length: 9 }, () => deckCard('Swamp', { typeLine: 'Basic Land' })),
    ...Array.from({ length: 26 }, () => deckCard('Forest', { typeLine: 'Basic Land' })),
  ]
  const groups = groupDeckCards(deck.slice(1).map((card, index) => ({ card, index: index + 1 })))
  assert.deepEqual(
    groups.map(({ card, indexes }) => [card.name, indexes.length]),
    [
      ['Swamp', 9],
      ['Forest', 26],
    ],
  )
  const forestCuts = groups[1].indexes.slice(0, 3)
  const applied = applyDeckDoctorSwapPlan({
    id: 'forests',
    deck,
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['B', 'G'],
    cuts: forestCuts.map((cutIndex) => ({ cutIndex, cutCard: deck[cutIndex] })),
    additions: [],
    moveCutToSideboard: false,
  })
  assert.equal(applied.deck.filter(({ name }) => name === 'Forest').length, 23)
  assert.equal(applied.deck.filter(({ name }) => name === 'Swamp').length, 9)
  assert.equal(applied.records.length, 3)
})

test('applies and undoes unequal plans', () => {
  const commander = deckCard('Commander')
  const deck = [commander, deckCard('Keep'), deckCard('Cut One'), deckCard('Cut Two')]
  const addOnly = applyDeckDoctorSwapPlan({
    id: 'adds',
    deck,
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['G'],
    cuts: [],
    additions: [candidate('Add One'), candidate('Add Two')],
    moveCutToSideboard: false,
  })
  assert.deepEqual(
    addOnly.deck.map(({ name }) => name),
    ['Commander', 'Keep', 'Cut One', 'Cut Two', 'Add One', 'Add Two'],
  )
  assert.equal(addOnly.records.length, 2)
  const undoneAdd = undoDeckDoctorSwap({
    deck: addOnly.deck,
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['G'],
    record: addOnly.records[0],
  })
  assert.deepEqual(
    undoneAdd.deck.map(({ name }) => name),
    ['Commander', 'Keep', 'Cut One', 'Cut Two', 'Add Two'],
  )

  const mixed = applyDeckDoctorSwapPlan({
    id: 'mixed',
    deck,
    sideboard: [],
    commanderCount: 1,
    commanderColours: ['G'],
    cuts: [
      { cutIndex: 2, cutCard: deck[2] },
      { cutIndex: 3, cutCard: deck[3] },
    ],
    additions: [candidate('Swap In')],
    moveCutToSideboard: true,
  })
  assert.deepEqual(
    mixed.deck.map(({ name }) => name),
    ['Commander', 'Keep', 'Swap In'],
  )
  assert.deepEqual(
    mixed.sideboard.map(({ name }) => name),
    ['Cut One', 'Cut Two'],
  )
  const cutOnly = mixed.records.find((record) => !record.addedCard)
  assert.equal(cutOnly?.cutCard?.name, 'Cut Two')
  const restored = undoDeckDoctorSwap({
    deck: mixed.deck,
    sideboard: mixed.sideboard,
    commanderCount: 1,
    commanderColours: ['G'],
    record: cutOnly!,
  })
  assert.deepEqual(
    restored.deck.map(({ name }) => name),
    ['Commander', 'Keep', 'Swap In', 'Cut Two'],
  )
  assert.deepEqual(
    restored.sideboard.map(({ name }) => name),
    ['Cut One'],
  )
})
