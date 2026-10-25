import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseLocalCardIndex, type LocalCardIndex } from './local-card-index.ts'

const valid = (): LocalCardIndex => ({
  metadata: {
    bulkUpdatedAt: '2026-10-25T10:00:00Z',
    newestSet: { code: 'tst', releasedAt: '2026-10-25' },
    sets: [{ code: 'tst', name: 'Test', released_at: '2026-10-25', card_count: 1 }],
    creatureTypes: ['Cat'],
  },
  cards: [
    {
      name: 'Test Cat',
      oracle_id: 'cat',
      type_line: 'Creature — Cat',
      cmc: 1,
      color_identity: ['W'],
      set: 'tst',
      collector_number: '1',
      prints_search_uri: 'https://api.scryfall.com/cards/search?q=test',
      legalities: { commander: 'legal' },
      oracle_text: '',
      layout: 'normal',
      mana_cost: '{W}',
      released_at: '2026-10-25',
    },
  ],
  indexes: { creatureTypes: { Cat: [0] }, tags: { Cats: [0] }, roles: {}, features: {} },
})

test('parses valid local index data', () => {
  assert.deepEqual(parseLocalCardIndex(valid()), valid())
})

test('permits newer unrepresented sets in provider coverage, but validates represented newestSet', () => {
  const index = valid()
  index.metadata.sets.push({
    code: 'future',
    name: 'Future',
    released_at: '2027-01-01',
    card_count: 0,
  })
  assert.doesNotThrow(() => parseLocalCardIndex(index))
  index.metadata.newestSet = { code: 'future', releasedAt: '2027-01-01' }
  assert.throws(() => parseLocalCardIndex(index))
})

test('rejects missing cards, malformed dates, sets and catalog metadata', () => {
  for (const malformed of [
    null,
    {},
    { ...valid(), cards: [] },
    { ...valid(), metadata: { ...valid().metadata, bulkUpdatedAt: 'yesterday' } },
    { ...valid(), metadata: { ...valid().metadata, sets: [] } },
    { ...valid(), metadata: { ...valid().metadata, creatureTypes: [] } },
  ])
    assert.throws(() => parseLocalCardIndex(malformed))
})

test('rejects noninteger, duplicate, unordered and out-of-bounds numeric postings', () => {
  for (const offsets of [[-1], [0.5], [1], [0, 0], [1, 0], ['0']]) {
    const index = valid()
    index.indexes.tags.Cats = offsets as number[]
    assert.throws(() => parseLocalCardIndex(index))
  }
})

test('rejects broken identities, unknown legality, bad gameplay data and duplicate cards', () => {
  for (const patch of [
    { oracle_id: undefined },
    { legalities: {} },
    { cmc: undefined },
    { color_identity: ['X'] },
  ]) {
    const index = valid()
    Object.assign(index.cards[0], patch)
    assert.throws(() => parseLocalCardIndex(index))
  }
  const index = valid()
  index.cards.push(index.cards[0])
  assert.throws(() => parseLocalCardIndex(index))
})

test('rejects inconsistent newest-set and creature-type coverage', () => {
  const wrongSet = valid()
  wrongSet.metadata.newestSet.code = 'missing'
  assert.throws(() => parseLocalCardIndex(wrongSet))
  const duplicateSet = valid()
  duplicateSet.metadata.sets.push(duplicateSet.metadata.sets[0])
  assert.throws(() => parseLocalCardIndex(duplicateSet))
  const duplicateType = valid()
  duplicateType.metadata.creatureTypes.push('Cat')
  assert.throws(() => parseLocalCardIndex(duplicateType))
  const unknownType = valid()
  unknownType.indexes.creatureTypes.Dog = [0]
  assert.throws(() => parseLocalCardIndex(unknownType))
})
