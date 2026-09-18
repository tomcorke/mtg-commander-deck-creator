import assert from 'node:assert/strict'
import test from 'node:test'
import { clearDeckState, deckStateKey, deckStateVersion, loadDeckState, saveDeckState, type PersistedDeckState } from './deck-state.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

const state: PersistedDeckState = {
  commander: 'Anikthea, Hand of Erebos',
  commanderDetails: { images: ['image'], art: ['art'], colours: ['W', 'B', 'G'], printings: [[{ image: 'image', set: 'cmm', collectorNumber: '349' }]], selections: [0] },
  theme: 'Enchantments',
  queue: [],
  limitedRecommendations: false,
  decisions: {},
  ignoredCards: ['Sol Ring'],
  liked: [],
  activeSubThemes: [],
  dismissedSubThemes: [],
  preferenceScores: {},
  commanderSubThemes: [],
  deferredCards: [],
  batchNumber: 1,
  deck: [{ name: 'Anikthea, Hand of Erebos', layout: 'normal', typeLine: 'Legendary Enchantment Creature', manaCost: '{2}{W}{B}{G}', manaValue: 5, detail: 'Menace', producedMana: [], faces: [], set: 'cmm', collectorNumber: '349', image: 'image', tags: ['Enchantments'] }],
  preferredPrintSet: 'cmm',
  deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
}

test('deck state round-trips and clears', () => {
  const storage = memoryStorage()
  saveDeckState(state, storage)
  assert.deepEqual(loadDeckState(storage), state)
  clearDeckState(storage)
  assert.equal(loadDeckState(storage), null)
})

test('invalid, old, and malformed deck state is ignored', () => {
  assert.equal(loadDeckState(memoryStorage({ [deckStateKey]: 'not json' })), null)
  assert.equal(loadDeckState(memoryStorage({ [deckStateKey]: JSON.stringify({ version: deckStateVersion + 1, state }) })), null)
  assert.equal(loadDeckState(memoryStorage({ [deckStateKey]: JSON.stringify({ version: deckStateVersion, state: { commander: 'Anikthea' } }) })), null)
})

test('invalid state is not saved', () => {
  const storage = memoryStorage()
  assert.doesNotThrow(() => saveDeckState({ ...state, deck: [] }, storage))
  assert.equal(loadDeckState(storage), null)
})

test('storage failures do not break deck building', () => {
  const storage = memoryStorage()
  storage.setItem = () => { throw new Error('quota exceeded') }
  storage.removeItem = () => { throw new Error('blocked') }
  assert.doesNotThrow(() => saveDeckState(state, storage))
  assert.doesNotThrow(() => clearDeckState(storage))
})
