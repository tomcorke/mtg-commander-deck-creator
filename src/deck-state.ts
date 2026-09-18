export const deckStateKey = 'commander-deck-state'
export const deckStateVersion = 1

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function loadDeckState<T>(storage: StorageLike = localStorage, valid: (state: unknown) => state is T = (state): state is T => typeof state === 'object' && state !== null): T | null {
  try {
    const raw = storage.getItem(deckStateKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: unknown; state?: unknown }
    return parsed?.version === deckStateVersion && valid(parsed.state) ? parsed.state : null
  } catch {
    return null
  }
}

export function saveDeckState<T>(state: T, storage: StorageLike = localStorage) {
  try {
    storage.setItem(deckStateKey, JSON.stringify({ version: deckStateVersion, state }))
  } catch {
    // Keep deck building usable when storage is unavailable or full.
  }
}

export function clearDeckState(storage: StorageLike = localStorage) {
  try {
    storage.removeItem(deckStateKey)
  } catch {
    // React state still resets when storage is unavailable.
  }
}
