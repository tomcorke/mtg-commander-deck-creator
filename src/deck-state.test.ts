import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearDeckState,
  deckPageTitle,
  deckStateChanged,
  deckStateKey,
  deckStateVersion,
  deleteSavedDeck,
  deckDelta,
  duplicateDeckName,
  loadDeckState,
  loadSavedDecks,
  saveDeckState,
  saveSavedDeck,
  savedDecksKey,
  suggestedDeckName,
  type PersistedDeckState,
} from './deck-state.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

const state: PersistedDeckState = {
  savedDeckId: '',
  commander: 'Anikthea, Hand of Erebos',
  commanderDetails: {
    images: ['image'],
    art: ['art'],
    colours: ['W', 'B', 'G'],
    printings: [[{ image: 'image', set: 'cmm', collectorNumber: '349' }]],
    selections: [0],
  },
  theme: 'Enchantments',
  recommendationStyle: 'balanced',
  collectionSets: [],
  collectionGroups: [],
  collectionMode: 'none',
  prioritizeDeckHealth: true,
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
  deck: [
    {
      name: 'Anikthea, Hand of Erebos',
      layout: 'normal',
      typeLine: 'Legendary Enchantment Creature',
      manaCost: '{2}{W}{B}{G}',
      manaValue: 5,
      detail: 'Menace',
      producedMana: [],
      faces: [],
      set: 'cmm',
      collectorNumber: '349',
      image: 'image',
      tags: ['Enchantments'],
    },
  ],
  sideboard: [],
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

test('preserves finishes for cards and their printing choices', () => {
  const storage = memoryStorage()
  const foilPrinting = {
    image: 'foil-image',
    set: 'cmm',
    collectorNumber: '349',
    price: '1.23',
    finish: 'foil' as const,
  }
  const foilState: PersistedDeckState = {
    ...state,
    commanderDetails: { ...state.commanderDetails, printings: [[foilPrinting]] },
    deck: [
      { ...state.deck[0], image: foilPrinting.image, printings: [foilPrinting], finish: 'foil' },
    ],
  }
  saveDeckState(foilState, storage)
  const loaded = loadDeckState(storage)
  assert.equal(loaded?.commanderDetails.printings[0][0].finish, 'foil')
  assert.equal(loaded?.deck[0].printings?.[0].finish, 'foil')
  assert.equal(loaded?.deck[0].finish, 'foil')
})

test('suggests names and detects duplicates except current deck id', () => {
  assert.equal(
    suggestedDeckName('Anikthea', 'Enchantments', ['Tokens', 'Graveyard']),
    'Anikthea - Enchantments - Tokens - Graveyard',
  )
  const decks = [{ id: 'deck-1', name: 'Anikthea', updatedAt: '', state }]
  assert.equal(duplicateDeckName(decks, ' anikthea '), true)
  assert.equal(duplicateDeckName(decks, 'Anikthea', 'deck-1'), false)
})

test('counts cards added and removed since save', () => {
  const commander = state.deck[0]
  const forest = { ...commander, name: 'Forest' }
  assert.deepEqual(
    deckDelta([commander, forest, forest], [commander, forest, { ...commander, name: 'Sol Ring' }]),
    { added: 1, removed: 1 },
  )
})

test('formats deck page titles and detects unsaved changes', () => {
  assert.equal(
    deckPageTitle(67, state.commander),
    '67/100 Anikthea, Hand of Erebos - Commander Deck Creator',
  )
  assert.equal(
    deckPageTitle(67, 'Enchantress', true),
    '*67/100 Enchantress - Commander Deck Creator',
  )
  assert.equal(deckStateChanged(state, { ...state, savedDeckId: 'deck-1' }), false)
  assert.equal(deckStateChanged(state, { ...state, theme: 'Constellations' }), true)
})

test('saved decks can be created, renamed, updated, and deleted', () => {
  const storage = memoryStorage()
  const saved = saveSavedDeck(
    { id: 'deck-1', name: 'Anikthea', updatedAt: '2026-09-18T18:00:00Z', state },
    storage,
  )
  assert.equal(saved[0].name, 'Anikthea')
  const updated = saveSavedDeck(
    { ...saved[0], name: 'Enchantress', state: { ...state, theme: 'Constellations' } },
    storage,
  )
  assert.equal(updated.length, 1)
  assert.equal(loadSavedDecks(storage)[0].state.theme, 'Constellations')
  assert.equal(loadSavedDecks(storage)[0].id, 'deck-1')
  assert.deepEqual(deleteSavedDeck('deck-1', storage), [])
})

test('invalid saved deck collections are ignored', () => {
  assert.deepEqual(loadSavedDecks(memoryStorage({ [savedDecksKey]: 'not json' })), [])
  assert.deepEqual(
    loadSavedDecks(
      memoryStorage({
        [savedDecksKey]: JSON.stringify({ version: deckStateVersion + 1, decks: [] }),
      }),
    ),
    [],
  )
})

test('legacy autosave gets empty saved-deck id and sideboard', () => {
  const storage = memoryStorage({
    [deckStateKey]: JSON.stringify({
      version: deckStateVersion,
      state: Object.fromEntries(
        Object.entries(state).filter(
          ([key]) =>
            ![
              'savedDeckId',
              'sideboard',
              'recommendationStyle',
              'collectionSets',
              'collectionGroups',
              'collectionMode',
              'prioritizeDeckHealth',
            ].includes(key),
        ),
      ),
    }),
  })
  assert.equal(loadDeckState(storage)?.savedDeckId, '')
  assert.deepEqual(loadDeckState(storage)?.sideboard, [])
  assert.equal(loadDeckState(storage)?.recommendationStyle, 'balanced')
  assert.deepEqual(loadDeckState(storage)?.collectionSets, [])
  assert.deepEqual(loadDeckState(storage)?.collectionGroups, [])
  assert.equal(loadDeckState(storage)?.collectionMode, 'none')
})

test('invalid, old, and malformed deck state is ignored', () => {
  assert.equal(loadDeckState(memoryStorage({ [deckStateKey]: 'not json' })), null)
  assert.equal(
    loadDeckState(
      memoryStorage({ [deckStateKey]: JSON.stringify({ version: deckStateVersion + 1, state }) }),
    ),
    null,
  )
  assert.equal(
    loadDeckState(
      memoryStorage({
        [deckStateKey]: JSON.stringify({
          version: deckStateVersion,
          state: { commander: 'Anikthea' },
        }),
      }),
    ),
    null,
  )
})

test('invalid state is not saved', () => {
  const storage = memoryStorage()
  assert.doesNotThrow(() => saveDeckState({ ...state, deck: [] }, storage))
  assert.equal(loadDeckState(storage), null)
})

test('storage failures do not break deck building', () => {
  const storage = memoryStorage()
  storage.setItem = () => {
    throw new Error('quota exceeded')
  }
  storage.removeItem = () => {
    throw new Error('blocked')
  }
  assert.doesNotThrow(() => saveDeckState(state, storage))
  assert.doesNotThrow(() => clearDeckState(storage))
})
