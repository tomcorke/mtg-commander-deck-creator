import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  fetchScryfallCollection,
  mainDeckCardCount,
  matchImportedCard,
  missingCardNames,
  parseDeckImportSource,
  parseDeckList,
  shouldOpenReviewAfterImport,
} from './deck-import.ts'

test('reads app CSV with a BOM or leading whitespace', () => {
  const csv = 'Quantity,Name,Set,Collector Number,Foil,Board\n1,Sol Ring,CMM,396,,Mainboard'
  for (const prefix of ['', '\n', '\uFEFF', '  \r\n'])
    assert.deepEqual(parseDeckList(prefix + csv), parseDeckList(csv))
})

test('native Moxfield exports retain all cards and allow explicit commander selection', () => {
  for (const format of ['full', 'mtgo', 'plaintext']) {
    const source = readFileSync(
      new URL(`../scripts/fixtures/178-moxfield-${format}.txt`, import.meta.url),
      'utf8',
    )
    const deck = parseDeckImportSource(source, ['Captain Kirk, Boldly Going'])
    assert.equal(mainDeckCardCount(deck), 100)
    assert.equal(deck.cards.length, 91)
    assert.deepEqual(
      deck.cards
        .filter(({ board }) => board === 'commander')
        .map(({ name, quantity }) => [name, quantity]),
      [['Captain Kirk, Boldly Going', 1]],
    )
    assert.equal(deck.cards.find(({ name }) => name === 'Forest')?.quantity, 6)
    assert.equal(deck.cards.find(({ name }) => name === 'Island')?.quantity, 4)
    const commander = deck.cards.find(({ board }) => board === 'commander')!
    assert.equal(commander.set, format === 'full' ? 'trc' : undefined)
    assert.equal(commander.collectorNumber, format === 'full' ? '85' : undefined)
  }
})

test('Moxfield Arena export is a filtered list, not a complete Commander deck', () => {
  const source = readFileSync(
    new URL('../scripts/fixtures/178-moxfield-mtga.txt', import.meta.url),
    'utf8',
  )
  const deck = parseDeckList(source)
  assert.equal(mainDeckCardCount(deck), 67)
  assert.ok(!deck.cards.some(({ name }) => name === 'Captain Kirk, Boldly Going'))
})

test('explicit commander selection preserves quantities, finishes and sideboard', () => {
  const source = '1 First (TST) 1 *F*\n1 Second (TST) 2 *E*\n20 Forest\nSIDEBOARD:\n1 Sol Ring'
  const deck = parseDeckImportSource(source, ['First', 'Second'])
  assert.deepEqual(
    deck.cards.map(({ name, board, finish, quantity }) => [name, board, finish, quantity]),
    [
      ['First', 'commander', 'foil', 1],
      ['Second', 'commander', 'etched', 1],
      ['Forest', 'mainboard', undefined, 20],
      ['Sol Ring', 'sideboard', undefined, 1],
    ],
  )
  assert.throws(() => parseDeckImportSource(source, ['Missing']), /Choose commanders/)
  assert.throws(() => parseDeckImportSource(source, ['Sol Ring']), /Choose commanders/)
  assert.deepEqual(
    parseDeckImportSource('Commander\n1 First\nDeck\n1 Second').cards.map(({ board }) => board),
    ['commander', 'mainboard'],
  )
})

test('retries transient Scryfall collection failures', async () => {
  let attempts = 0
  const fetcher = async () => new Response('', { status: ++attempts < 3 ? 503 : 200 })
  const response = await fetchScryfallCollection(
    [{ name: 'Tireless Provisioner' }],
    fetcher as typeof fetch,
    async () => undefined,
  )
  assert.equal(response.status, 200)
  assert.equal(attempts, 3)
})

test('does not retry invalid Scryfall collection requests', async () => {
  let attempts = 0
  const response = await fetchScryfallCollection([{ name: 'Missing' }], (async () => {
    attempts++
    return new Response('', { status: 400 })
  }) as typeof fetch)
  assert.equal(response.status, 400)
  assert.equal(attempts, 1)
})

test('falls back from missing printing to matching card name', () => {
  const entry = {
    name: 'Tireless Provisioner',
    quantity: 1,
    set: 'bad',
    collectorNumber: '999',
    board: 'mainboard' as const,
  }
  const fallback = { name: 'Tireless Provisioner', set: 'mh2', collector_number: '180' }
  assert.equal(matchImportedCard(entry, [fallback]), fallback)
  assert.equal(matchImportedCard({ ...entry, name: 'Missing' }, [fallback]), undefined)
})

test('matches double-faced and split cards by their front-face name', () => {
  const entry = { name: 'Brightclimb Pathway', quantity: 1, board: 'mainboard' as const }
  const pathway = {
    name: 'Brightclimb Pathway // Grimclimb Pathway',
    set: 'znr',
    collector_number: '259',
  }
  assert.equal(matchImportedCard(entry, [pathway]), pathway)
  const split = { name: 'Fire // Ice', set: 'mh2', collector_number: '290' }
  assert.equal(matchImportedCard({ ...entry, name: 'Fire' }, [split]), split)
  assert.equal(matchImportedCard({ ...entry, name: 'Ice' }, [split]), undefined)
})

test('reports missing name and printing identifiers as card names', () => {
  const cards = parseDeckList('1 Sol Ring\n1 Forest (M3C) 317').cards
  assert.deepEqual(
    missingCardNames([{ name: 'Sol Ring' }, { set: 'm3c', collector_number: '317' }], cards),
    ['Sol Ring', 'Forest'],
  )
})

test('counts commanders and mainboard, but excludes sideboard from completion', () => {
  assert.equal(
    mainDeckCardCount({
      cards: [
        { name: 'Commander', quantity: 1, board: 'commander' },
        { name: 'Mainboard', quantity: 99, board: 'mainboard' },
        { name: 'Sideboard', quantity: 20, board: 'sideboard' },
      ],
    }),
    100,
  )
})

test('rejects deck URLs before import', () => {
  assert.throws(
    () => parseDeckImportSource('https://moxfield.com/decks/example'),
    /URL import is unavailable.*Paste the exported deck list/,
  )
})

test('complete import opens review only when the player opts in', () => {
  const complete = {
    cards: [
      { name: 'Commander', quantity: 1, board: 'commander' as const },
      { name: 'Mainboard', quantity: 99, board: 'mainboard' as const },
      { name: 'Sideboard', quantity: 20, board: 'sideboard' as const },
    ],
  }
  const partial = {
    cards: [
      { name: 'Commander', quantity: 1, board: 'commander' as const },
      { name: 'Mainboard', quantity: 98, board: 'mainboard' as const },
      { name: 'Sideboard', quantity: 1, board: 'sideboard' as const },
    ],
  }

  assert.equal(shouldOpenReviewAfterImport(complete, true), true)
  assert.equal(shouldOpenReviewAfterImport(complete, false), false)
  assert.equal(shouldOpenReviewAfterImport(partial, true), false)
})

test('parses common deck-list syntax, printings, and boards', () => {
  assert.deepEqual(
    parseDeckList(
      `COMMANDER:\n1 Anikthea, Hand of Erebos (CMM) 705\n\nDeck\n2 Forest [M3C: 317]\n1 Sol Ring\nSIDEBOARD:\n1 Doomwake Giant (C15) 21`,
    ).cards,
    [
      {
        name: 'Anikthea, Hand of Erebos',
        quantity: 1,
        set: 'cmm',
        collectorNumber: '705',
        board: 'commander',
      },
      { name: 'Forest', quantity: 2, set: 'm3c', collectorNumber: '317', board: 'mainboard' },
      {
        name: 'Sol Ring',
        quantity: 1,
        set: undefined,
        collectorNumber: undefined,
        board: 'mainboard',
      },
      {
        name: 'Doomwake Giant',
        quantity: 1,
        set: 'c15',
        collectorNumber: '21',
        board: 'sideboard',
      },
    ],
  )
})

test('reads foil and etched markers from text exports', () => {
  const cards = parseDeckList(
    'Commander\n1 Atraxa (SLD) 1 *F*\nDeck\n1 Sol Ring (MSC) 211 *E*\n1 Forest *F*\n1 Island',
  ).cards
  assert.deepEqual(
    cards.map(({ name, finish }) => [name, finish]),
    [
      ['Atraxa', 'foil'],
      ['Sol Ring', 'etched'],
      ['Forest', 'foil'],
      ['Island', undefined],
    ],
  )
})

test('reads the CSV export, including quoted names and finishes', () => {
  const deck = parseDeckList(
    'Quantity,Name,Set,Collector Number,Foil,Board\n' +
      '1,"Atraxa, ""Grand"" Unifier",SLD,1,foil,Commander\n' +
      '1,"Sol Ring",MSC,211,,Mainboard\n' +
      '2,"Forest",M3C,317,etched,Sideboard',
  )
  assert.deepEqual(deck.cards, [
    {
      name: 'Atraxa, "Grand" Unifier',
      quantity: 1,
      set: 'sld',
      collectorNumber: '1',
      board: 'commander',
      finish: 'foil',
    },
    {
      name: 'Sol Ring',
      quantity: 1,
      set: 'msc',
      collectorNumber: '211',
      board: 'mainboard',
    },
    {
      name: 'Forest',
      quantity: 2,
      set: 'm3c',
      collectorNumber: '317',
      board: 'sideboard',
      finish: 'etched',
    },
  ])
})
