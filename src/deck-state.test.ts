import assert from 'node:assert/strict'
import test from 'node:test'
import { clearDeckState, deckStateKey, deckStateVersion, loadDeckState, saveDeckState } from './deck-state.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

test('deck state round-trips and clears', () => {
  const storage = memoryStorage()
  saveDeckState({ commander: 'Anikthea', ignored: ['Sol Ring'] }, storage)
  assert.deepEqual(loadDeckState(storage), { commander: 'Anikthea', ignored: ['Sol Ring'] })
  clearDeckState(storage)
  assert.equal(loadDeckState(storage), null)
})

test('invalid and old deck state is ignored', () => {
  assert.equal(loadDeckState(memoryStorage({ [deckStateKey]: 'not json' })), null)
  assert.equal(loadDeckState(memoryStorage({ [deckStateKey]: JSON.stringify({ version: deckStateVersion + 1, state: { commander: 'Old' } }) })), null)
})

test('storage failures do not break deck building', () => {
  const storage = memoryStorage()
  storage.setItem = () => { throw new Error('quota exceeded') }
  storage.removeItem = () => { throw new Error('blocked') }
  assert.doesNotThrow(() => saveDeckState({ commander: 'Anikthea' }, storage))
  assert.doesNotThrow(() => clearDeckState(storage))
})

test('state validator rejects malformed current data', () => {
  const storage = memoryStorage({ [deckStateKey]: JSON.stringify({ version: deckStateVersion, state: { commander: 'Anikthea' } }) })
  assert.equal(loadDeckState(storage, (state): state is { deck: unknown[] } => Boolean(state && typeof state === 'object' && Array.isArray((state as { deck?: unknown }).deck))), null)
})
