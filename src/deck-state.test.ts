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
import { commanderKey, commanderNames } from './domain/commander-catalog.ts'

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

test('deck state round-trips without card text, which loading refreshes from Scryfall', () => {
  const storage = memoryStorage()
  saveDeckState(state, storage)
  const card = { ...state.deck[0], typeLine: '', manaCost: '', detail: '', tags: [] }
  assert.deepEqual(loadDeckState(storage), { ...state, deck: [card] })
  clearDeckState(storage)
  assert.equal(loadDeckState(storage), null)
})

test('a draft on the play-style step keeps its pending flags across a reload', () => {
  const storage = memoryStorage()
  saveDeckState({ ...state, firstBatchPending: true, playStylePending: true }, storage)
  const loaded = loadDeckState(storage)
  assert.equal(loaded?.firstBatchPending, true)
  assert.equal(loaded?.playStylePending, true)
})

test('saved decks keep only the chosen printing and store card lists as field tables', () => {
  const storage = memoryStorage()
  const printing = (collectorNumber: string) => ({
    image: collectorNumber,
    set: 'cmm',
    collectorNumber,
  })
  const card = {
    ...state.deck[0],
    ...printing('2'),
    printings: [printing('1'), printing('2'), printing('3')],
    printing: 1,
    printingManuallySelected: true,
  }
  const saved = { ...state, deck: [card], sideboard: [{ ...card, name: 'Spare' }] }
  saveSavedDeck(
    { id: 'deck', name: 'Deck', updatedAt: '2026-10-04T12:00:00Z', state: saved },
    storage,
  )
  const raw = JSON.parse(storage.getItem(savedDecksKey)!).decks[0].state
  assert.ok(Array.isArray(raw.deck.rows) && Array.isArray(raw.sideboard.rows))
  const loaded = loadSavedDecks(storage)[0].state
  for (const board of [loaded.deck, loaded.sideboard]) {
    assert.deepEqual(board[0].printings, [printing('2')])
    assert.equal(board[0].printing, 0)
    assert.equal(board[0].printingManuallySelected, true)
  }
  assert.equal(deckStateChanged(loaded, saved), false)
})

test('a load-time card data check does not mark a saved deck changed', () => {
  const checking = (card: PersistedDeckState['deck'][number]) => ({
    ...card,
    dataStatus: 'pending' as const,
  })
  const loading = { ...state, deck: state.deck.map(checking) }
  assert.equal(deckStateChanged(state, loading), false)
  assert.equal(deckStateChanged(loading, state), false)
  assert.equal(deckStateChanged(state, { ...loading, deck: [] }), true)
})

test('defaults filled in after loading an older save do not mark it changed', () => {
  const { localCandidateBuffer: _buffer, ignoreReasons: _reasons, ...older } = state
  const loaded = { ...older, localCandidateBuffer: [], ignoreReasons: {}, maxPrice: null }
  assert.equal(deckStateChanged(older, loaded), false)
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

test('a commander whose name contains " & " saves, reloads and names the deck unsplit', () => {
  const storage = memoryStorage()
  const commander = commanderKey(['Minsc & Boo, Timeless Heroes'])
  saveDeckState({ ...state, commander }, storage)
  const loaded = loadDeckState(storage)!
  assert.deepEqual(commanderNames(loaded.commander), ['Minsc & Boo, Timeless Heroes'])
  assert.equal(
    suggestedDeckName(loaded.commander, 'Hamsters', []),
    'Minsc & Boo, Timeless Heroes - Hamsters',
  )
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
  const { commander, ...rest } = state
  assert.equal(deckStateChanged(state, { ...rest, commander }), false)
  const reordered = state.deck.map((card) => Object.fromEntries(Object.entries(card).reverse()))
  assert.equal(deckStateChanged(state, { ...state, deck: reordered as typeof state.deck }), false)
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

test('legacy recommendation styles migrate to named deck goals', () => {
  for (const [legacy, expected] of [
    ['story', 'thematic'],
    ['balanced', 'balanced'],
    ['optimized', 'competitive'],
  ] as const) {
    const storage = memoryStorage({
      [deckStateKey]: JSON.stringify({
        version: deckStateVersion,
        state: { ...state, recommendationStyle: legacy },
      }),
    })
    assert.equal(loadDeckState(storage)?.recommendationStyle, expected)
  }
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

test('a save from before the theme target is unchanged once loaded with the default (#501)', () => {
  const loaded = { ...state, themeTarget: 25 }
  assert.equal(deckStateChanged(state, loaded), false)
  assert.equal(deckStateChanged(state, { ...loaded, themeTarget: 20 }), true)
})
