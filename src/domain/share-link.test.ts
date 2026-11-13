import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decodeSharedDeck,
  deckListFile,
  encodeSharedDeck,
  shareLimits,
  shareLinkFor,
  sharePayloadFromHash,
  sharedDeckFromCards,
  SharedDeckError,
} from './share-link.ts'

const card = (
  name: string,
  set = 'cmm',
  collectorNumber = name.length.toString(),
  finish = 'nonfoil',
) => ({ name, set, collectorNumber, finish }) as const

// A 100-card partner deck: two commanders, 63 distinct cards with mixed finishes and 35 basics.
const commanders = [
  card('Thrasios, Triton Hero', 'c16', '46'),
  card('Tymna the Weaver', 'c16', '48', 'foil'),
]
const spells = Array.from({ length: 63 }, (_, index) =>
  card(
    `Spell number ${index} // Back face`,
    'mh3',
    `${index + 1}`,
    index % 9 === 0 ? 'etched' : 'nonfoil',
  ),
)
const basics = [
  ...Array.from({ length: 20 }, () => card('Island', 'unf', '236')),
  ...Array.from({ length: 15 }, () => card('Plains', 'unf', '235', 'foil')),
]
const deck = [...commanders, ...spells, ...basics]
const sideboard = [card('Ætherflux Reservoir', 'kld', '192'), card('Sol Ring', 'ltc', '★1')]

const decode = (payload: string) => decodeSharedDeck(payload)
const rejects = (payload: string, message: RegExp = /damaged or incomplete/) =>
  assert.rejects(decode(payload), (error: unknown) => {
    assert(error instanceof SharedDeckError)
    assert.match(error.message, message)
    return true
  })

async function rawPayload(json: string) {
  const stream = new Blob([new TextEncoder().encode(json)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `1.${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
}

test('a share link round-trips a 100-card deck with printings, finishes and a sideboard', async () => {
  const shared = sharedDeckFromCards(2, deck, sideboard, '  Partners in brine ')
  assert.equal(shared.name, 'Partners in brine')
  assert.deepEqual(shared.cards.slice(0, 2), [
    {
      board: 'commander',
      name: 'Thrasios, Triton Hero',
      quantity: 1,
      set: 'c16',
      collectorNumber: '46',
    },
    {
      board: 'commander',
      name: 'Tymna the Weaver',
      quantity: 1,
      set: 'c16',
      collectorNumber: '48',
      finish: 'foil',
    },
  ])
  assert.deepEqual(
    shared.cards
      .filter(({ name }) => name === 'Island' || name === 'Plains')
      .map(({ quantity }) => quantity),
    [20, 15],
  )
  const payload = await encodeSharedDeck(shared)
  const link = shareLinkFor('https://commander-creator.corke.dev/#build/export', payload)
  assert(link.startsWith('https://commander-creator.corke.dev/#share=1.'))
  assert(link.length < 3000, `a 100-card link stays short enough to paste: ${link.length}`)
  const decoded = await decode(sharePayloadFromHash(new URL(link).hash)!)
  assert.deepEqual(decoded, shared)
  assert.equal(
    decoded.cards
      .filter(({ board }) => board !== 'sideboard')
      .reduce((sum, { quantity }) => sum + quantity, 0),
    100,
  )
})

test('cards without a printing keep their name and finish', async () => {
  const shared = sharedDeckFromCards(
    1,
    [card('Atraxa', '', ''), card('Forest', '', '', 'foil')],
    [],
  )
  assert.deepEqual(shared.cards, [
    { board: 'commander', name: 'Atraxa', quantity: 1 },
    { board: 'mainboard', name: 'Forest', quantity: 1, finish: 'foil' },
  ])
  assert.deepEqual(await decode(await encodeSharedDeck(shared)), shared)
})

test('a long or multi-line saved deck name still makes a valid link', async () => {
  const name = `${'Long name '.repeat(20)}${String.fromCharCode(10)}second line`
  const shared = sharedDeckFromCards(1, deck.slice(1, 3), [], name)
  assert.equal(shared.name, 'Long name '.repeat(10).trim())
  assert.deepEqual(await decode(await encodeSharedDeck(shared)), shared)
  const tabbed = sharedDeckFromCards(
    1,
    deck.slice(1, 3),
    [],
    `Tabs${String.fromCharCode(9)}and${String.fromCharCode(10)}breaks`,
  )
  assert.equal(tabbed.name, 'Tabs and breaks')
})

test('only #share= fragments carry a payload', () => {
  assert.equal(sharePayloadFromHash('#share=1.abc'), '1.abc')
  assert.equal(sharePayloadFromHash('#build/export'), null)
  assert.equal(sharePayloadFromHash(''), null)
})

test('damaged, oversized and unknown payloads are rejected before any card lookup', async () => {
  const valid = await encodeSharedDeck(sharedDeckFromCards(1, deck.slice(1, 3), []))
  await rejects(valid.slice(0, -6))
  await rejects('1.not base64!')
  await rejects('1.')
  await rejects(`2.${valid.slice(2)}`, /newer or unknown version/)
  await rejects('1.' + 'A'.repeat(shareLimits.encodedLength), /more than one deck can/)
  // A small payload that inflates past the byte limit stops while decompressing.
  await rejects(
    await rawPayload(' '.repeat(shareLimits.decodedBytes + 1)),
    /more than one deck can/,
  )
})

test('each field of an untrusted payload is validated', async () => {
  const entry = (...values: unknown[]) => JSON.stringify({ c: [['c', 1, 'Atraxa'], values] })
  for (const json of [
    'null',
    '[]',
    '{"c":[]}',
    'not json',
    JSON.stringify({ c: [['c', 1, 'Atraxa']], extra: true }),
    JSON.stringify({ n: 'x'.repeat(shareLimits.deckNameLength + 1), c: [['c', 1, 'Atraxa']] }),
    entry('x', 1, 'Board'),
    entry('m', 0, 'Zero copies'),
    entry('m', 1.5, 'Fractional'),
    entry('m', shareLimits.quantity + 1, 'Too many'),
    entry('m', 1, ''),
    entry('m', 1, 'Bell\u0007'),
    entry('m', 1, 'x'.repeat(shareLimits.nameLength + 1)),
    entry('m', 1, 'Set only', 'cmm'),
    entry('m', 1, 'Bad set', 'CMM!', '1'),
    entry('m', 1, 'Long number', 'cmm', '1'.repeat(shareLimits.collectorNumberLength + 1)),
    entry('m', 1, 'Bad finish', 'cmm', '1', 'x'),
    entry('m', 1, 'Too long', 'cmm', '1', 'f', 'extra'),
    entry({ toString: 1 }, 1, 'Object board'),
  ])
    await rejects(await rawPayload(json))
  await rejects(
    await rawPayload(JSON.stringify({ c: [['m', 1, 'No commander']] })),
    /no valid commander/,
  )
  await rejects(
    await rawPayload(JSON.stringify({ c: [['c', 3, 'Three commanders']] })),
    /no valid commander/,
  )
  await rejects(
    await rawPayload(
      JSON.stringify({
        c: [
          ['c', 1, 'Atraxa'],
          ['m', 100, 'Forest'],
        ],
      }),
    ),
    /more than one deck can/,
  )
  await rejects(
    await rawPayload(
      JSON.stringify({
        c: [['c', 1, 'Atraxa'], ...Array.from({ length: 300 }, () => ['s', 1, 'Forest'])],
      }),
    ),
  )
})

test('download names come from the deck name and format', () => {
  assert.deepEqual(deckListFile('Meren of Clan Nel Toth', 'moxfield', false), {
    fileName: 'meren-of-clan-nel-toth-moxfield.txt',
    type: 'text/plain',
  })
  assert.deepEqual(deckListFile('Lim-Dûl & Æther!', 'csv', true), {
    fileName: 'lim-dul-ther-still-needed.csv',
    type: 'text/csv',
  })
  assert.equal(deckListFile('../../', 'plain', false).fileName, 'deck-plain.txt')
  assert.equal(deckListFile('a'.repeat(80), 'plain', false).fileName, `${'a'.repeat(60)}-plain.txt`)
})
