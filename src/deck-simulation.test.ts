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
