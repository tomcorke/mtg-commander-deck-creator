// Deck data lives in IndexedDB (no 5MB localStorage cap). An in-memory mirror keeps the
// synchronous Storage interface that deck-state.ts and autosaves.ts are written against.
export type AppStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key'> & {
  readonly length: number
  /** Another tab changed a key. */
  onChange(listener: () => void): () => void
  /** A write that already updated the mirror failed to reach disk. */
  onError(listener: () => void): () => void
}

const appKeyPrefix = 'commander-'
const dbName = 'commander-deck-creator'
const storeName = 'storage'

let current: AppStorage | undefined
/** Storage for deck data; localStorage until startup opens IndexedDB. */
export const appStorage = (): AppStorage => current ?? wrapLocalStorage(localStorage)

const listen = (listeners: Set<() => void>, listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
const request = <T>(value: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result)
    value.onerror = () => reject(value.error)
  })
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error ?? new DOMException('Aborted', 'AbortError'))
  })

function wrapLocalStorage(storage: Storage): AppStorage {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
    key: (index) => storage.key(index),
    get length() {
      return storage.length
    },
    onChange: (listener) => {
      window.addEventListener('storage', listener)
      return () => window.removeEventListener('storage', listener)
    },
    onError: () => () => undefined,
  }
}

// Copy legacy keys IndexedDB lacks, verify the copy, then free localStorage.
async function migrate(db: IDBDatabase, legacy: Storage) {
  const entries = Array.from({ length: legacy.length }, (_, index) => legacy.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(appKeyPrefix)))
    .map((key) => [key, legacy.getItem(key)!] as const)
  if (!entries.length) return
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  for (const [key, value] of entries) {
    const found = store.getKey(key)
    found.onsuccess = () => found.result === undefined && store.put(value, key)
  }
  await done(tx)
  const check = db.transaction(storeName).objectStore(storeName)
  const copies = await Promise.all(entries.map(([key]) => request(check.get(key))))
  // A key IndexedDB already held with other data stays in localStorage rather than being lost.
  entries.forEach(([key, value], index) => copies[index] === value && legacy.removeItem(key))
}

export async function openAppStorage(legacy: Storage) {
  const changeListeners = new Set<() => void>()
  const errorListeners = new Set<() => void>()
  let db: IDBDatabase
  try {
    const open = indexedDB.open(dbName, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(storeName)
    db = await request(open)
    await migrate(db, legacy)
  } catch {
    // Without IndexedDB (or before migration finishes) the localStorage data stays authoritative.
    return (current = wrapLocalStorage(legacy))
  }
  const store = db.transaction(storeName).objectStore(storeName)
  const [keys, values] = await Promise.all([
    request(store.getAllKeys()),
    request(store.getAll() as IDBRequest<string[]>),
  ])
  const data = new Map(keys.map((key, index) => [String(key), values[index]]))
  const channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('commander-storage')
  if (channel)
    channel.onmessage = ({ data: { key, value } }: MessageEvent) => {
      if (value === null) data.delete(key)
      else data.set(key, value)
      changeListeners.forEach((listener) => listener())
    }
  const write = (key: string, value: string | null) => {
    const tx = db.transaction(storeName, 'readwrite')
    if (value === null) tx.objectStore(storeName).delete(key)
    else tx.objectStore(storeName).put(value, key)
    if (value === null) data.delete(key)
    else data.set(key, value)
    // Peers update their mirrors only once the value is durable.
    done(tx).then(
      () => channel?.postMessage({ key, value }),
      () => errorListeners.forEach((listener) => listener()),
    )
  }
  void navigator.storage?.persist?.().catch(() => undefined)
  return (current = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => write(key, String(value)),
    removeItem: (key) => write(key, null),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
    onChange: (listener) => listen(changeListeners, listener),
    onError: (listener) => listen(errorListeners, listener),
  })
}
