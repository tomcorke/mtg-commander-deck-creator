import assert from 'node:assert/strict'
import test from 'node:test'

import { toDeckCard, type ScryfallCard } from './card-model.ts'
import {
  addCardSearchCards,
  buildCardSearchQuery,
  cardSearchManaOptions,
  defaultCardSearchFilters,
  type CardSearchFilters,
} from './card-search.ts'

const query = (filters: Partial<CardSearchFilters> = {}, colours = ['G', 'U']) =>
  buildCardSearchQuery({ ...defaultCardSearchFilters, ...filters }, colours, true)
const card = (name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  type_line: 'Creature',
  cmc: 2,
  legalities: { commander: 'legal' },
  color_identity: ['G'],
  mana_cost: '{1}{G}',
  set: 'tst',
  collector_number: '1',
  prints_search_uri: '',
  ...overrides,
})

test('supports filter-only searches and default Commander legality and identity', () => {
  assert.equal(query(), 'legal:commander id<=gu date<=today')
  assert.equal(query({}, []), 'legal:commander id<=c date<=today')
  assert.equal(query({ filterIdentity: false }), 'legal:commander date<=today')
  assert.equal(
    buildCardSearchQuery(defaultCardSearchFilters, ['G'], false),
    'legal:commander id<=g',
  )
  assert.deepEqual(
    cardSearchManaOptions(['G'])
      .slice(0, 2)
      .map(({ label }) => label),
    ['G', 'Colourless cards'],
  )
})

test('combines inclusive mana bounds, required costs, and excluded abilities', () => {
  const result = query({
    minimumManaValue: '0',
    maximumManaValue: '4',
    matches: {
      G: 'need',
      U: 'exclude',
      'X costs': 'need',
      Trample: 'need',
      Lifelink: 'exclude',
      '+1/+1 counters': 'need',
      'Counter spells': 'exclude',
      Sacrifice: 'need',
      'ETB triggers': 'need',
    },
  })
  assert.ok(result.includes('mv>=0 mv<=4'))
  assert.ok(result.includes('mana:/\\{[^}]*G[^}]*\\}/'))
  assert.ok(result.includes('-(mana:/\\{[^}]*U[^}]*\\}/)'))
  assert.ok(result.includes('mana:{X}'))
  assert.ok(
    result.includes('kw:trample -(kw:lifelink)') || result.includes('-(kw:lifelink) kw:trample'),
  )
  assert.ok(result.includes('o:"+1/+1 counter" -(otag:counterspell) o:sacrifice'))
  assert.ok(result.includes('o:/(when|whenever)[^.]* enters/'))
})

test('mana colour terms match hybrid and Phyrexian symbols, not only single-colour pips', () => {
  const white = cardSearchManaOptions(['W']).find(({ label }) => label === 'W')!.query
  const pattern = new RegExp(white.slice('mana:/'.length, -1))
  assert.ok(pattern.test('{2/W}{2/W}{2/W}'))
  assert.ok(pattern.test('{W/P}'))
  assert.ok(pattern.test('{G/W}'))
  assert.ok(pattern.test('{W}'))
  assert.ok(!pattern.test('{2}{G}'))
  const hybrid = cardSearchManaOptions([]).find(({ label }) => label === 'Hybrid costs')!.query
  const hybridPattern = new RegExp(hybrid.slice('mana:/'.length, -1))
  assert.ok(hybridPattern.test('{2/W}'))
  assert.ok(hybridPattern.test('{G/U}'))
  assert.ok(hybridPattern.test('{G/U/P}'))
  assert.ok(!hybridPattern.test('{W/P}'))
  assert.ok(
    query({ matches: { 'Colourless cards': 'need', 'Colourless payment': 'exclude' } }).includes(
      'c:c -(mana:{C})',
    ),
  )
  assert.ok(!query({ matches: { R: 'need' } }, ['G']).includes('R'))
})

test('names and rules-text phrases remain literal, and exclusions negate whole criteria', () => {
  assert.equal(query({ name: 'Sol Ring' }), 'legal:commander id<=gu date<=today name:"Sol Ring"')
  assert.ok(
    query({
      name: 'Goblin',
      nameMatch: 'exclude',
      minimumManaValue: '2',
      maximumManaValue: '4',
      manaValueMatch: 'exclude',
    }).includes('-(name:"Goblin") -(mv>=2 mv<=4)'),
  )
  assert.ok(
    query({
      name: 'A "quoted" name \\',
      rulesNeed: 'draw a card, +1/+1 counter',
      rulesExclude: 'discard, sacrifice',
    }).includes(
      'name:"A \\"quoted\\" name \\\\" o:"draw a card" o:"+1/+1 counter" -(o:"discard") -(o:"sacrifice")',
    ),
  )
  assert.ok(
    !query({
      name: 'Ignored',
      nameMatch: 'any',
      minimumManaValue: '1',
      manaValueMatch: 'any',
    }).includes('Ignored'),
  )
  assert.ok(!query({ minimumManaValue: '1', manaValueMatch: 'any' }).includes('mv>='))
})

test('rejects invalid bounds and oversized queries before sending a request', () => {
  for (const minimumManaValue of ['-1', 'NaN', 'Infinity'])
    assert.throws(() => query({ minimumManaValue }), /non-negative/)
  assert.throws(() => query({ minimumManaValue: '4', maximumManaValue: '2' }), /must not exceed/)
  assert.throws(() => query({ rulesNeed: 'x'.repeat(1000) }), /Too many search terms/)
})

test('multi-add fills the main deck then sideboard, preserving chosen printing and finish', () => {
  const deck = Array.from({ length: 99 }, (_, index) => toDeckCard(card(`Existing ${index}`)))
  const sideboard = [toDeckCard(card('Sideboard card'))]
  const result = addCardSearchCards(
    [
      card('First', { set: 'alt', collector_number: '42', finishes: ['foil'] }),
      card('Second'),
      card('Third'),
    ],
    deck,
    sideboard,
    ['G'],
  )
  assert.equal(deck.length, 99)
  assert.equal(sideboard.length, 1)
  assert.equal(result.deck.length, 100)
  assert.deepEqual(
    result.sideboard.map(({ name }) => name),
    ['Sideboard card', 'Second', 'Third'],
  )
  assert.deepEqual([result.mainCount, result.sideboardCount], [1, 2])
  assert.equal(result.deck.at(-1)?.set, 'alt')
  assert.equal(result.deck.at(-1)?.collectorNumber, '42')
  assert.equal(result.deck.at(-1)?.finish, 'foil')
})

test('rejects duplicates, off-identity and banned cards atomically but allows basic copies', () => {
  const deck = [toDeckCard(card('Existing'))]
  const sideboard = [toDeckCard(card('Sideboard card'))]
  for (const rejected of [
    card('Existing'),
    card('Blue', { color_identity: ['U'] }),
    card('Banned', { legalities: { commander: 'banned' } }),
  ])
    assert.throws(() => addCardSearchCards([card('Valid'), rejected], deck, sideboard, ['G']))
  assert.throws(
    () => addCardSearchCards([card('Same'), card('Same')], deck, sideboard, ['G']),
    /already in/,
  )
  assert.equal(deck.length, 1)
  assert.equal(sideboard.length, 1)
  assert.equal(addCardSearchCards([card('Sideboard card')], deck, sideboard, ['G']).deck.length, 2)
  const basic = card('Forest', { type_line: 'Basic Land — Forest' })
  assert.equal(addCardSearchCards([basic, basic], deck, sideboard, ['G']).deck.length, 3)
})
