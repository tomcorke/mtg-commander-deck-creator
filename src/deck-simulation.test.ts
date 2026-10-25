import assert from 'node:assert/strict'
import test from 'node:test'

import { simulateManaAccess } from './deck-simulation.ts'
import type { DeckCard } from './domain/card-model.ts'

const card = (
  name: string,
  typeLine: string,
  producedMana: string[] = [],
  manaCost = '',
  manaValue = 0,
): DeckCard => ({
  name,
  layout: 'normal',
  typeLine,
  manaCost,
  manaValue,
  detail: '',
  producedMana,
  faces: [],
  image: '',
  set: 'tst',
  collectorNumber: '1',
  tags: [],
})

const seededRandom = (initial: number) => {
  let seed = initial >>> 0
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

const sampleDeck = (landCount: number, landColour: string, spell: DeckCard) => [
  card('Commander', 'Legendary Creature', ['G']),
  ...Array.from({ length: landCount }, (_, index) =>
    card(`${landColour} land ${index}`, 'Basic Land', [landColour]),
  ),
  spell,
  ...Array.from({ length: 98 - landCount }, (_, index) => card(`Blank ${index}`, 'Sorcery')),
]

test('draws a fixed-seed spell on turn one in multiplayer', () => {
  const result = simulateManaAccess({
    deck: sampleDeck(35, 'G', card('Zero-cost spell', 'Sorcery', [], '{0}', 0)),
    commanderCount: 1,
    trials: 1,
    random: seededRandom(142),
  })
  const spell = result.spellCastability.find(({ name }) => name === 'Zero-cost spell')!
  assert.equal(spell.drawnByTurn[0], 1)
  assert.equal(spell.whenDrawnByTurn[0], 1)
})

test('estimates land drops and simple spell castability when drawn', () => {
  const result = simulateManaAccess({
    deck: sampleDeck(35, 'G', card('Three-mana spell', 'Sorcery', [], '{2}{G}', 3)),
    commanderCount: 1,
    trials: 5000,
    random: seededRandom(19),
  })

  assert.ok(result.turns[0].landDropRate > 0.9)
  assert.ok(
    result.spellCastability.find(({ name }) => name === 'Three-mana spell')!.whenDrawnByTurn[2] >
      0.5,
  )
})

test('excludes commander sources and rejects unsupported hybrid costs', () => {
  const deck = sampleDeck(35, 'U', card('Red spell', 'Sorcery', [], '{R}', 1))
  deck[0] = card('Commander', 'Legendary Creature', ['R'])
  deck[deck.length - 1] = card('Hybrid spell', 'Sorcery', [], '{G/U}', 1)
  const result = simulateManaAccess({
    deck,
    commanderCount: 1,
    trials: 1000,
    random: seededRandom(7),
  })

  assert.ok(
    result.spellCastability
      .find(({ name }) => name === 'Red spell')!
      .whenDrawnByTurn.every((chance) => chance === 0),
  )
  assert.equal(
    result.spellCastability.some(({ name }) => name === 'Hybrid spell'),
    false,
  )
})

test('a land-light list misses more land drops than a healthy list', () => {
  const spell = card('Three-mana spell', 'Sorcery', [], '{2}{G}', 3)
  const healthy = simulateManaAccess({
    deck: sampleDeck(35, 'G', spell),
    commanderCount: 1,
    trials: 3000,
    random: seededRandom(27),
  })
  const landLight = simulateManaAccess({
    deck: sampleDeck(20, 'G', spell),
    commanderCount: 1,
    trials: 3000,
    random: seededRandom(27),
  })

  assert.ok(healthy.turns[4].landDropRate > landLight.turns[4].landDropRate)
})

test('lands that produce no mana never pay generic costs', () => {
  const deck = [
    card('Commander', 'Legendary Creature', ['G']),
    ...Array.from({ length: 40 }, (_, index) => card(`Barren land ${index}`, 'Land')),
    card('Two-mana spell', 'Sorcery', [], '{2}', 2),
    ...Array.from({ length: 58 }, (_, index) => card(`Blank ${index}`, 'Sorcery')),
  ]
  const result = simulateManaAccess({
    deck,
    commanderCount: 1,
    trials: 200,
    random: seededRandom(7),
  })
  assert.ok(result.turns.at(-1)!.landDropRate > 0)
  const spell = result.spellCastability.find(({ name }) => name === 'Two-mana spell')!
  assert.ok(spell.whenDrawnByTurn.every((rate) => rate === 0))
})

const withDetail = (base: DeckCard, detail: string): DeckCard => ({ ...base, detail })
const castableOnTurn = (deck: DeckCard[], name: string, turn: number) =>
  simulateManaAccess({
    deck,
    commanderCount: 1,
    trials: 1500,
    random: seededRandom(7),
  }).spellCastability.find((spell) => spell.name === name)!.whenDrawnByTurn[turn - 1]

test('lands that enter tapped cannot pay on the turn they are played', () => {
  const oneDrop = card('One-drop', 'Sorcery', [], '{G}', 1)
  const tapped = withDetail(
    card('Tapland', 'Land', ['G']),
    'This land enters tapped.\n{T}: Add {G}.',
  )
  const deck = (land: DeckCard) => [
    card('Commander', 'Legendary Creature'),
    ...Array.from({ length: 40 }, (_, index) => ({ ...land, name: `${land.name} ${index}` })),
    oneDrop,
    ...Array.from({ length: 58 }, (_, index) => card(`Blank ${index}`, 'Sorcery')),
  ]
  assert.equal(castableOnTurn(deck(tapped), 'One-drop', 1), 0)
  assert.ok(castableOnTurn(deck(card('Forest', 'Basic Land — Forest', ['G'])), 'One-drop', 1) > 0.9)
  // A conditional tapped land ("if you control two or more other lands") isn't always tapped.
  const fastland = withDetail(
    card('Fastland', 'Land', ['G']),
    'If you control two or more other lands, this land enters tapped.',
  )
  assert.ok(castableOnTurn(deck(fastland), 'One-drop', 1) > 0.9)
})

test('repeatable ramp cast early makes a later spell castable sooner', () => {
  const fourDrop = card('Four-drop', 'Sorcery', [], '{3}{G}', 4)
  const rock = withDetail(card('Rock', 'Artifact', ['C'], '{1}', 1), '{T}: Add {C}.')
  const deck = (filler: (index: number) => DeckCard) => [
    card('Commander', 'Legendary Creature'),
    ...Array.from({ length: 30 }, (_, index) =>
      card(`Forest ${index}`, 'Basic Land — Forest', ['G']),
    ),
    fourDrop,
    ...Array.from({ length: 68 }, (_, index) => filler(index)),
  ]
  const withRamp = castableOnTurn(
    deck((index) => ({ ...rock, name: `Rock ${index}` })),
    'Four-drop',
    3,
  )
  const without = castableOnTurn(
    deck((index) => card(`Blank ${index}`, 'Sorcery')),
    'Four-drop',
    3,
  )
  assert.equal(without, 0)
  assert.ok(withRamp > 0.5, String(withRamp))
})

test('reports unsupported costs and marks partial decks provisional', () => {
  const result = simulateManaAccess({
    deck: [
      card('Commander', 'Legendary Creature'),
      card('Forest', 'Basic Land — Forest', ['G']),
      card('Hybrid', 'Sorcery', [], '{G/W}', 1),
      card('X spell', 'Sorcery', [], '{X}{G}', 1),
    ],
    commanderCount: 1,
    trials: 1,
  })
  assert.deepEqual(result.unsupported, ['Hybrid', 'X spell'])
  assert.equal(result.provisional, true)
  assert.equal(
    simulateManaAccess({
      deck: sampleDeck(35, 'G', card('S', 'Sorcery', [], '{G}', 1)),
      commanderCount: 1,
      trials: 1,
    }).provisional,
    false,
  )
})

test('a spell/land MDFC is one choice: played as a land, never also sampled as a spell', () => {
  const mdfc: DeckCard = {
    ...card('Spell // Land', 'Sorcery // Land', ['G'], '{2}{G}', 3),
    layout: 'modal_dfc',
    faces: [
      { typeLine: 'Sorcery', manaCost: '{2}{G}' },
      { typeLine: 'Land', manaCost: '' },
    ],
  }
  const result = simulateManaAccess({
    deck: [
      card('Commander', 'Legendary Creature'),
      ...Array.from({ length: 99 }, (_, index) => ({ ...mdfc, name: `MDFC ${index}` })),
    ],
    commanderCount: 1,
    trials: 20,
    random: seededRandom(3),
  })
  assert.deepEqual(result.spellCastability, [])
  assert.equal(result.turns[0].landDropRate, 1)
})
