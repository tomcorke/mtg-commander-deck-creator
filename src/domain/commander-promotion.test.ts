import assert from 'node:assert/strict'
import test from 'node:test'

import {
  commanderPromotionInfo,
  commanderPromotionWarning,
  promoteDeckCard,
} from './commander-promotion.ts'

const card = (name: string, colorIdentity: string[], typeLine = 'Legendary Creature') => ({
  name,
  colorIdentity,
  typeLine,
  manaCost: '',
  manaValue: 3,
  detail: '',
  producedMana: [],
  faces: [],
  set: 'set',
  collectorNumber: '1',
  image: '',
  tags: [],
})

test('commander promotion keeps deck colours and explains conflicts', () => {
  const oldCommander = card('Old Commander', ['W', 'U'])
  const blueSpell = card('Blue Spell', ['U'], 'Instant')
  const candidate = card('New Commander', ['G'])
  const info = commanderPromotionInfo(candidate, [oldCommander, blueSpell])

  assert.equal(info?.canPromote, false)
  assert.deepEqual(info?.missingColours, ['W', 'U'])
  assert.match(commanderPromotionWarning(info!), /White and Blue/)
  assert.match(commanderPromotionWarning(info!), /Old Commander and Blue Spell/)
})

test('mana production does not add colours to a card identity', () => {
  const producer = {
    ...card('Mana Producer', [], 'Instant'),
    colorIdentity: undefined,
    producedMana: ['W', 'U', 'B', 'R', 'G'],
    detail:
      'Create a Treasure token. It has “{T}, Sacrifice this token: Add one mana of any color.”',
  }
  const info = commanderPromotionInfo(card('Veyran', ['U', 'R']), [producer])

  assert.equal(info?.canPromote, true)
  assert.deepEqual(info?.missingColours, [])
})

test('commander eligibility follows creature, Vehicle, Spacecraft, and explicit rules', () => {
  const deck = [card('Old Commander', ['W'])]
  assert.equal(
    commanderPromotionInfo(card('Vehicle', ['W'], 'Legendary Artifact — Vehicle'), deck)
      ?.canPromote,
    true,
  )
  assert.equal(
    commanderPromotionInfo(
      { ...card('Spacecraft', ['W'], 'Legendary Spacecraft'), power: '5', toughness: '5' },
      deck,
    )?.canPromote,
    true,
  )
  assert.equal(
    commanderPromotionInfo(card('Unpowered Spacecraft', ['W'], 'Legendary Spacecraft'), deck),
    null,
  )
  assert.equal(
    commanderPromotionInfo(
      {
        ...card('Permitted Walker', ['W'], 'Planeswalker — Test'),
        detail: 'This card can be your commander.',
      },
      deck,
    )?.canPromote,
    true,
  )
  assert.equal(
    commanderPromotionInfo(card('Regular Walker', ['W'], 'Legendary Planeswalker'), deck),
    null,
  )
})

test('promoting a card retains old commander in main deck', () => {
  const oldCommander = card('Old Commander', ['G'])
  const spell = card('Spell', ['G'], 'Sorcery')
  const candidate = card('New Commander', ['G'])
  const result = promoteDeckCard([oldCommander, spell], [], candidate)

  assert.deepEqual(
    result.deck.map(({ name }) => name),
    ['New Commander', 'Old Commander', 'Spell'],
  )
})
