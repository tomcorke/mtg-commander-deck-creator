import assert from 'node:assert/strict'
import test from 'node:test'

import {
  activeOwnershipMode,
  allowedByOwnership,
  combineOwnedCards,
  describeOwnedCards,
  filterByOwnership,
  orderByOwnership,
  ownedCardsStorageKey,
  ownedQuantities,
  ownedQuantity,
  parseOwnedCards,
  readCsvRecords,
  readOwnedCardList,
  stillNeededCards,
  stillNeededGroups,
} from './owned-cards.ts'

test('plain text lists accept quantities, printings, finishes and bare names', () => {
  const parsed = parseOwnedCards(
    [
      'Commander',
      '1 Meren of Clan Nel Toth',
      '',
      'Deck',
      '4 Lightning Bolt',
      '2x Sol Ring (C21) 263',
      '1 Arcane Signet [CMM:704] *F*',
      'Forest',
      '// a comment',
      'SIDEBOARD:',
      '1 Sol Ring',
      '0 Mana Crypt',
    ].join('\n'),
  )
  assert.equal(parsed.format, 'text')
  assert.deepEqual(parsed.cards, [
    { name: 'Arcane Signet', quantity: 1 },
    { name: 'Forest', quantity: 1 },
    { name: 'Lightning Bolt', quantity: 4 },
    { name: 'Meren of Clan Nel Toth', quantity: 1 },
    { name: 'Sol Ring', quantity: 3 },
  ])
  assert.deepEqual(parsed.skipped, [{ line: 12, text: '0 Mana Crypt', reason: 'No owned copies' }])
})

test('collection CSVs read the Name and quantity columns from the header', () => {
  // Deckbox-style header: "Tradelist Count" is not the owned count.
  const deckbox = parseOwnedCards(
    '﻿Count,Tradelist Count,Name,Edition\r\n2,1,"Kodama\'s Reach",C21\r\n1,0,"Accursed Witch // Infectious Curse",SOI\r\n',
  )
  assert.equal(deckbox.format, 'csv')
  assert.deepEqual(deckbox.cards, [
    { name: 'Accursed Witch // Infectious Curse', quantity: 1 },
    { name: "Kodama's Reach", quantity: 2 },
  ])
  // ManaBox-style: Name first, Quantity later, quoted commas and doubled quotes.
  const manabox = parseOwnedCards(
    'Name,Set code,Quantity\n"Anikthea, Hand of Erebos",CMM,1\n"Sol Ring",C21,2\n"Sol Ring",CMM,1\n,CMM,1\nBad,CMM,x\n',
  )
  assert.deepEqual(manabox.cards, [
    { name: 'Anikthea, Hand of Erebos', quantity: 1 },
    { name: 'Sol Ring', quantity: 3 },
  ])
  assert.deepEqual(
    manabox.skipped.map(({ line, reason }) => [line, reason]),
    [
      [5, 'No card name'],
      [6, 'No owned copies'],
    ],
  )
  // Without a quantity column every row is one copy.
  assert.deepEqual(parseOwnedCards('Card Name;Set\nSol Ring;C21').cards, [
    { name: 'Sol Ring', quantity: 1 },
  ])
})

test('the CSV reader keeps quoted line breaks inside one record', () => {
  assert.deepEqual(readCsvRecords('a,"b\nc",d\n"e ""q""",f'), [
    { line: 1, cells: ['a', 'b\nc', 'd'] },
    { line: 3, cells: ['e "q"', 'f'] },
  ])
  // An unclosed quote reads as plain text instead of swallowing the rest of the file.
  assert.deepEqual(readCsvRecords('"open,x\ny,z'), [
    { line: 1, cells: ['"open', 'x'] },
    { line: 2, cells: ['y', 'z'] },
  ])
})

test('ownership matches by name across printings and double-faced front names', () => {
  const owned = ownedQuantities({
    cards: [
      { name: 'Sol Ring', quantity: 1 },
      { name: 'Accursed Witch', quantity: 1 },
      { name: 'Forest', quantity: 12 },
    ],
    updatedAt: '2026-11-12',
  })
  assert.equal(ownedQuantity(owned, 'sol ring'), 1)
  assert.equal(ownedQuantity(owned, 'Accursed Witch // Infectious Curse'), 1)
  assert.equal(ownedQuantity(owned, 'Mana Crypt'), 0)
  const cards = [{ name: 'Sol Ring' }, { name: 'Mana Crypt' }]
  assert.deepEqual(filterByOwnership(cards, owned, 'only'), [{ name: 'Sol Ring' }])
  assert.deepEqual(filterByOwnership(cards, owned, 'prefer'), cards)
  assert.deepEqual(filterByOwnership(cards, owned, 'ignore'), cards)
  assert.equal(allowedByOwnership({ name: 'Mana Crypt' }, owned, 'only'), false)
  // Without owned cards, Only cannot apply.
  assert.equal(activeOwnershipMode('only', {}), 'ignore')
  assert.deepEqual(filterByOwnership(cards, {}, 'only'), cards)
})

test('still needed subtracts each owned copy once, in deck order', () => {
  const owned = { forest: 12, 'sol ring': 1 }
  const deck = [
    { name: 'Sol Ring', set: 'c21' },
    { name: 'Sol Ring', set: 'cmm' },
    ...Array.from({ length: 15 }, () => ({ name: 'Forest', set: 'tst' })),
    { name: 'Mana Crypt', set: 'tst' },
  ]
  const needed = stillNeededCards(deck, owned)
  assert.deepEqual(
    needed.map(({ name, set }) => `${name}:${set}`),
    ['Sol Ring:cmm', 'Forest:tst', 'Forest:tst', 'Forest:tst', 'Mana Crypt:tst'],
  )
  // A shared tally lets the commanders use an owned copy before the main deck does.
  const covered = {}
  assert.deepEqual(stillNeededCards([{ name: 'Sol Ring' }], owned, covered), [])
  assert.deepEqual(stillNeededCards([{ name: 'Sol Ring' }], owned, covered), [{ name: 'Sol Ring' }])
  assert.deepEqual(stillNeededCards(deck, undefined), deck)
})

test('still-needed groups count copies per name, in deck order', () => {
  const owned = { forest: 12, 'sol ring': 1 }
  const deck = [
    { name: 'Sol Ring', set: 'c21' },
    { name: 'Forest', set: 'tst' },
    { name: 'Sol Ring', set: 'cmm' },
    ...Array.from({ length: 14 }, () => ({ name: 'Forest', set: 'tst' })),
    { name: 'Mana Crypt', set: 'tst' },
  ]
  assert.deepEqual(
    stillNeededGroups(deck, owned).map(({ card, needed, inDeck }) => [
      card.name,
      card.set,
      needed,
      inDeck,
    ]),
    [
      ['Sol Ring', 'cmm', 1, 2],
      ['Forest', 'tst', 3, 15],
      ['Mana Crypt', 'tst', 1, 1],
    ],
  )
  assert.deepEqual(
    stillNeededGroups(deck, { ...owned, forest: 15, 'mana crypt': 1, 'sol ring': 2 }),
    [],
  )
})

test('stored owned cards read back, and damaged storage reads as none', () => {
  const list = { cards: [{ name: 'Sol Ring', quantity: 2 }], updatedAt: '2026-11-12T10:00:00Z' }
  const storage = (value: string | null) => () => ({
    getItem: (key: string) => (key === ownedCardsStorageKey ? value : null),
  })
  assert.deepEqual(readOwnedCardList(storage(JSON.stringify(list))), list)
  assert.equal(readOwnedCardList(storage('{broken')), null)
  assert.equal(readOwnedCardList(storage(JSON.stringify({ cards: [] }))), null)
  assert.equal(readOwnedCardList(storage(null)), null)
  const unavailable = () => {
    throw new ReferenceError('localStorage is not defined')
  }
  assert.equal(readOwnedCardList(unavailable), null)
  assert.equal(describeOwnedCards(list), '1 card (2 copies)')
})

test('adding a list sums copies with the owned cards', () => {
  assert.deepEqual(
    combineOwnedCards(
      [
        { name: 'Sol Ring', quantity: 1 },
        { name: 'Forest', quantity: 10 },
      ],
      [
        { name: 'sol ring', quantity: 1 },
        { name: 'Arcane Signet', quantity: 1 },
      ],
    ),
    [
      { name: 'Arcane Signet', quantity: 1 },
      { name: 'Forest', quantity: 10 },
      { name: 'Sol Ring', quantity: 2 },
    ],
  )
})

test('ordering by ownership keeps owned cards first, or only them', () => {
  const cards = [{ name: 'A' }, { name: 'Owned B' }, { name: 'C' }, { name: 'Owned D' }]
  const owned = { 'owned b': 1, 'owned d': 1 }
  const names = (list: { name: string }[]) => list.map(({ name }) => name)
  assert.deepEqual(names(orderByOwnership(cards, owned, 'prefer')), [
    'Owned B',
    'Owned D',
    'A',
    'C',
  ])
  assert.deepEqual(names(orderByOwnership(cards, owned, 'only')), ['Owned B', 'Owned D'])
  assert.equal(orderByOwnership(cards, owned, 'ignore'), cards)
  assert.equal(orderByOwnership(cards, {}, 'only'), cards)
})
