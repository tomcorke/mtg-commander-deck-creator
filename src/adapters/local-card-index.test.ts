import assert from 'node:assert/strict'
import test from 'node:test'
import type { ScryfallCard } from '../domain/card-model.ts'
import type { LocalCardIndex } from '../domain/local-card-index.ts'
import { hasTag } from '../domain/creature-types.ts'
import { tagsFor } from '../domain/recommendation-themes.ts'
import {
  createLocalCardSource,
  localIndexStaleness,
  mergeLocalAndLiveCards,
  queryLocalCardIndex,
} from './local-card-index.ts'

const card = (name: string, colour: string[]): ScryfallCard => ({
  name,
  oracle_id: name,
  type_line: 'Creature — Cat',
  color_identity: colour,
  cmc: 2,
  game_changer: false,
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: '1',
  prints_search_uri: 'https://api.scryfall.com/cards/search?q=test',
})
const index: LocalCardIndex = {
  metadata: {
    bulkUpdatedAt: '2026-10-24T09:00:00Z',
    newestSet: { code: 'tst', releasedAt: '2026-11-01' },
    sets: [{ code: 'tst', name: 'Preview set', released_at: '2026-11-01', card_count: 100 }],
    creatureTypes: ['Cat', 'Dog'],
  },
  cards: [card('White Cat', ['W']), card('Blue Cat', ['U']), card('Colourless Cat', [])],
  indexes: {
    creatureTypes: { Cat: [0, 1, 2] },
    tags: { Cats: [0, 1], Tokens: [2] },
    roles: { ramp: [2] },
    features: { 'mana:repeatable': [2] },
  },
}

test('local facets union without duplicates, filter identity, count and preserve table order', () => {
  const query = { colours: ['W'], themes: ['Cats'], roles: ['ramp'] }
  assert.deepEqual(
    queryLocalCardIndex(index, query).map(({ name }) => name),
    ['White Cat', 'Colourless Cat'],
  )
  assert.equal(queryLocalCardIndex(index, { colours: [], creatureTypes: ['Cat'] }).length, 1)
  assert.equal(queryLocalCardIndex(index, { colours: [], features: ['mana:repeatable'] }).length, 1)
  assert.deepEqual(queryLocalCardIndex(index, { colours: ['W'], themes: ['Unknown'] }), [])
})

test('coverage detects new sets, preview count drift and new creature types, not covered future sets', () => {
  assert.deepEqual(localIndexStaleness(index, index.metadata.sets, ['Cat', 'Dog']), [])
  assert.deepEqual(
    localIndexStaleness(
      index,
      [
        { ...index.metadata.sets[0], card_count: 101 },
        { code: 'new', name: 'New set', released_at: '2026-12-01' },
        { code: 'tok', name: 'Tokens', set_type: 'token' },
      ],
      ['Cat', 'Dog', 'Newtype'],
    ),
    ['Changed set: tst', 'New set: new', 'New creature type: Newtype'],
  )
})

test('local source is lazy, shares one validated artifact and reports stale data in logs', async () => {
  let loads = 0
  let inventories = 0
  const logs: unknown[] = []
  const source = createLocalCardSource({
    load: async () => {
      loads++
      return structuredClone(index)
    },
    inventory: async () => {
      inventories++
      return { sets: index.metadata.sets, creatureTypes: ['Cat', 'Dog', 'Newtype'] }
    },
    log: (status) => logs.push(status),
  })
  assert.equal(source.status().state, 'unloaded')
  assert.equal(loads, 0)
  const query = { colours: ['W'], creatureTypes: ['Cat'] }
  const [cards, count] = await Promise.all([source.query(query), source.count(query)])
  assert.equal(cards.length, 2)
  assert.equal(count, 2)
  assert.equal(loads, 1)
  assert.equal(inventories, 1)
  assert.equal(source.status().state, 'stale')
  assert.deepEqual(source.status().reasons, ['New creature type: Newtype'])
  assert.equal(logs.length, 1)
})

test('long-lived sessions recheck coverage without reloading the table', async () => {
  let time = 0
  let checks = 0
  let loads = 0
  const source = createLocalCardSource({
    load: async () => {
      loads++
      return index
    },
    inventory: async () => {
      checks++
      return {
        sets: index.metadata.sets,
        creatureTypes: checks > 1 ? ['Cat', 'Dog', 'Newtype'] : ['Cat', 'Dog'],
      }
    },
    log: () => {},
    now: () => time,
  })
  const query = { colours: [], roles: ['ramp'] }
  await source.query(query)
  assert.equal(source.status().state, 'fresh')
  time = 15 * 60_000 - 1
  await source.query(query)
  assert.equal(checks, 1)
  time++
  await Promise.all([source.query(query), source.count(query)])
  assert.equal(checks, 2)
  assert.equal(loads, 1)
  assert.equal(source.status().state, 'stale')
})

test('missing, malformed and failed local assets are nonfatal and never report a false zero count', async () => {
  for (const load of [
    async () => undefined,
    async () => ({ ...index, indexes: { ...index.indexes, roles: { ramp: [99] } } }),
    async () => {
      throw new Error('Offline')
    },
  ]) {
    const source = createLocalCardSource({
      load,
      inventory: async () => {
        throw new Error('Should not check coverage')
      },
      log: () => {},
    })
    assert.deepEqual(await source.query({ colours: [], roles: ['ramp'] }), [])
    assert.equal(await source.count({ colours: [], roles: ['ramp'] }), undefined)
    assert.equal(source.status().state, 'unavailable')
  }
})

test('offline coverage checks retain usable local breadth but report freshness as unchecked', async () => {
  const source = createLocalCardSource({
    load: async () => index,
    inventory: async () => {
      throw new Error('Offline')
    },
    log: () => {},
  })
  assert.equal((await source.query({ colours: [], roles: ['ramp'] })).length, 1)
  assert.equal(source.status().state, 'unchecked')
})

test('live data wins by Oracle ID, including renamed cards, with a name fallback for legacy records', () => {
  const local = index.cards[0]
  const live = { ...local, name: 'Renamed Cat', game_changer: true }
  assert.deepEqual(mergeLocalAndLiveCards([local, index.cards[2]], [live]), [live, index.cards[2]])
  const legacy = { ...local, oracle_id: undefined }
  assert.deepEqual(mergeLocalAndLiveCards([legacy], [local]), [local])
})

test('ifReady never waits: it starts one background load and answers once coverage is checked', async () => {
  let loads = 0
  let release = () => {}
  const loaded = new Promise<void>((resolve) => (release = resolve))
  const source = createLocalCardSource({
    load: async () => {
      loads++
      await loaded
      return index
    },
    inventory: async () => ({ sets: index.metadata.sets, creatureTypes: ['Cat', 'Dog'] }),
    log: () => {},
  })
  const query = { colours: ['W'], creatureTypes: ['Cat'] }
  assert.equal(source.ifReady(query), undefined)
  assert.equal(source.ifReady(query), undefined)
  release()
  await source.query(query)
  assert.equal(loads, 1)
  assert.equal(source.ifReady(query)?.length, 2)
  const missing = createLocalCardSource({
    load: async () => undefined,
    inventory: async () => ({ sets: [], creatureTypes: [] }),
    log: () => {},
  })
  await missing.query(query)
  assert.deepEqual(missing.ifReady(query), [])
})

test('every-type cards join creature-type queries, and hasTag counts them for any type theme', () => {
  const changelings = { ...index, indexes: { ...index.indexes, tags: { Changeling: [2] } } }
  assert.deepEqual(
    queryLocalCardIndex(changelings, { colours: [], themes: ['Dogs'] }).map(({ name }) => name),
    ['Colourless Cat'],
  )
  assert.deepEqual(queryLocalCardIndex(changelings, { colours: [], themes: ['Tokens'] }), [])
  assert.ok(tagsFor('Changeling (This card is every creature type.)', '').includes('Changeling'))
  assert.ok(tagsFor('As this enters, choose a creature type.', '').includes('Changeling'))
  assert.ok(hasTag({ tags: ['Changeling'] }, 'Elves'))
  assert.ok(!hasTag({ tags: ['Changeling'] }, 'Tokens'))
})
