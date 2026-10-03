import assert from 'node:assert/strict'
import test from 'node:test'

import {
  autosavePrefix,
  createWorkspace,
  listAutosaves,
  retentionKey,
  savedDraftAge,
  workspaceRecoveryKey,
  workspaceSessionKey,
} from './autosaves.ts'
import {
  deckStateKey,
  loadSavedDecks,
  persistedDeckStateSchema,
  saveDeckState,
  saveSavedDeck,
  savedDecksKey,
} from './deck-state.ts'
import { toDeckCard } from './domain/card-model.ts'
import { loadSavedDeck, storeDeck } from './app/deck-actions.ts'
import type { ActionDeps } from './app/recommendation-actions.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    get length() {
      return values.size
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

// Models atomic browser locks, including queued migration and held locks in suspended tabs.
function lockManager() {
  const held = new Set<string>()
  const waiting = new Map<string, (() => void)[]>()
  return {
    query: async () => ({ held: [...held].map((name) => ({ name })), pending: [] }),
    request: async (name: string, optionsOrCallback: any, callback?: any) => {
      const options = callback ? optionsOrCallback : {}
      const run = callback ?? optionsOrCallback
      if (held.has(name)) {
        if (options.ifAvailable) return run(null)
        await new Promise<void>((resolve) => {
          waiting.set(name, [...(waiting.get(name) ?? []), resolve])
        })
      }
      held.add(name)
      try {
        return await run({ name })
      } finally {
        const next = waiting.get(name)?.shift()
        if (next) next()
        else held.delete(name)
      }
    },
  } as unknown as Pick<LockManager, 'request' | 'query'>
}

function channels() {
  const peers: any[] = []
  return () => {
    const peer = {
      onmessage: null as BroadcastChannel['onmessage'],
      postMessage: () => {
        for (const other of peers)
          if (other !== peer) queueMicrotask(() => other.onmessage?.({ data: 'changed' }))
      },
      close: () => {
        peers.splice(peers.indexOf(peer), 1)
      },
    }
    peers.push(peer)
    return peer
  }
}

const state = persistedDeckStateSchema.parse({
  commander: 'Test commander',
  commanderDetails: { images: [], art: [], colours: [], printings: [], selections: [] },
  theme: 'Test theme',
  queue: [],
  limitedRecommendations: false,
  decisions: {},
  ignoredCards: [],
  liked: [],
  activeSubThemes: [],
  dismissedSubThemes: [],
  preferenceScores: {},
  commanderSubThemes: [],
  deferredCards: [],
  batchNumber: 1,
  deck: [
    toDeckCard({
      name: 'Test commander',
      type_line: 'Creature',
      color_identity: [],
      set: 'tst',
      collector_number: '1',
    }),
  ],
  preferredPrintSet: '',
  deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
})

function environment() {
  const storage = memoryStorage()
  const locks = lockManager()
  const channel = channels()
  let sequence = 0
  let time = new Date('2026-10-03T12:00:00Z')
  const options = {
    storage,
    locks,
    uuid: () => `workspace-${++sequence}`,
    now: () => time,
  }
  return {
    storage,
    locks,
    options,
    setTime: (value: string) => {
      time = new Date(value)
    },
    tab: (session = memoryStorage()) =>
      createWorkspace({ ...options, session, channel: channel() }),
  }
}

test('go/no-go: concurrent decks, reloads, duplicate tabs and manual saves stay isolated', async () => {
  const env = environment()
  const firstSession = memoryStorage()
  let first = await env.tab(firstSession)
  await first.save({ ...state, savedDeckId: 'manual-1' }, 'First deck')
  saveSavedDeck(
    { id: 'manual-1', name: 'Manual save', updatedAt: env.options.now().toISOString(), state },
    env.storage,
  )
  const manual = env.storage.getItem(savedDecksKey)
  const secondSession = memoryStorage()
  let second = await env.tab(secondSession)
  assert.equal(second.initialState?.commander, state.commander)
  assert.equal(second.initialState?.savedDeckId, '')
  assert.equal(second.getSnapshot().notice?.latest, true)
  assert.notEqual(first.getSnapshot().id, second.getSnapshot().id)
  await second.save(
    { ...state, commander: 'Second commander', deck: [...state.deck, state.deck[0]] },
    'Second deck',
  )
  const firstId = first.getSnapshot().id
  const secondId = second.getSnapshot().id
  assert.equal(
    listAutosaves(env.storage).find(({ id }) => id === firstId)?.state.commander,
    state.commander,
  )
  first.close()
  second.close()
  await Promise.resolve()
  ;[first, second] = await Promise.all([env.tab(firstSession), env.tab(secondSession)])
  assert.equal(first.getSnapshot().id, firstId)
  assert.equal(second.getSnapshot().id, secondId)
  assert.equal(first.initialState?.commander, state.commander)
  assert.equal(second.initialState?.commander, 'Second commander')
  const duplicateSession = memoryStorage({ [workspaceSessionKey]: firstId })
  const duplicate = await env.tab(duplicateSession)
  assert.notEqual(duplicate.getSnapshot().id, firstId)
  assert.equal(duplicate.initialState?.commander, state.commander)
  assert.equal(duplicate.getSnapshot().notice?.copied, true)
  await duplicate.save({ ...state, theme: 'Duplicate edit' }, 'Duplicate')
  assert.equal(
    listAutosaves(env.storage).find(({ id }) => id === firstId)?.state.theme,
    state.theme,
  )
  const original = listAutosaves(env.storage).find(({ id }) => id === firstId)!
  assert.equal(await second.begin(original), true)
  assert.notEqual(second.getSnapshot().id, firstId)
  assert.equal(
    listAutosaves(env.storage).find(({ id }) => id === secondId)?.state.commander,
    'Second commander',
  )
  assert.equal(env.storage.getItem(savedDecksKey), manual)
  first.close()
  second.close()
  duplicate.close()
})

test('simultaneous duplicate startup has one owner and forks the other before any write', async () => {
  const env = environment()
  const sessionA = memoryStorage({ [workspaceSessionKey]: 'inherited' })
  const sessionB = memoryStorage({ [workspaceSessionKey]: 'inherited' })
  const [a, b] = await Promise.all([env.tab(sessionA), env.tab(sessionB)])
  assert.notEqual(a.getSnapshot().id, b.getSnapshot().id)
  await a.save(state, 'A')
  await b.save({ ...state, commander: 'Other' }, 'B')
  assert.equal(listAutosaves(env.storage).length, 2)
  assert.ok(a.getSnapshot().id === 'inherited' || b.getSnapshot().id === 'inherited')
  a.close()
  b.close()
})

test('legacy migration writes a validated recovery point before removing the legacy key', async () => {
  const env = environment()
  saveDeckState(state, env.storage)
  const [a, b] = await Promise.all([env.tab(), env.tab()])
  assert.equal(env.storage.getItem(deckStateKey), null)
  assert.equal(listAutosaves(env.storage).length, 1)
  assert.equal(a.initialState?.commander, state.commander)
  assert.equal(b.initialState?.commander, state.commander)
  a.close()
  b.close()
})

test('failed migration preserves the shared recovery point and reports unavailable autosave', async () => {
  const env = environment()
  saveDeckState(state, env.storage)
  env.storage.setItem = () => {
    throw new Error('quota exceeded')
  }
  const workspace = await env.tab()
  assert.ok(env.storage.getItem(deckStateKey))
  assert.equal(workspace.initialState?.commander, state.commander)
  assert.match(workspace.getSnapshot().error, /Autosave unavailable/)
  workspace.close()
})

test('starting a new deck preserves old recovery; empty workspaces stay empty on reload', async () => {
  const env = environment()
  const session = memoryStorage()
  const workspace = await env.tab(session)
  await workspace.save(state, 'Original')
  const oldId = workspace.getSnapshot().id
  await workspace.begin()
  const newId = workspace.getSnapshot().id
  workspace.close()
  await Promise.resolve()
  const reloaded = await env.tab(session)
  assert.equal(reloaded.getSnapshot().id, newId)
  assert.equal(reloaded.initialState, null)
  assert.ok(listAutosaves(env.storage).find(({ id }) => id === oldId))
  reloaded.close()
})

test('unchanged reload saves do not make the last-edited time look newer', async () => {
  const env = environment()
  const session = memoryStorage()
  const workspace = await env.tab(session)
  await workspace.save(state, 'Original')
  const timestamp = listAutosaves(env.storage)[0].updatedAt
  workspace.close()
  await Promise.resolve()
  env.setTime('2026-10-04T12:00:00Z')
  const reloaded = await env.tab(session)
  await reloaded.save(reloaded.initialState!, 'Original')
  assert.equal(listAutosaves(env.storage)[0].updatedAt, timestamp)
  reloaded.close()
})

test('damaged drafts do not hide valid autosaves', async () => {
  const env = environment()
  const workspace = await env.tab()
  await workspace.save(state, 'Valid')
  env.storage.setItem(autosavePrefix + 'corrupt', 'not json')
  env.storage.setItem(autosavePrefix + 'wrong-version', JSON.stringify({ version: 999 }))
  assert.equal(listAutosaves(env.storage).length, 1)
  workspace.close()
})

function seed(env: ReturnType<typeof environment>, id: string, updatedAt: string) {
  env.storage.setItem(
    autosavePrefix + id,
    JSON.stringify({ version: 1, id, name: id, updatedAt, state }),
  )
}

test('count and age retention protect live and suspended workspaces and manual saves', async () => {
  const env = environment()
  const a = await env.tab()
  await a.save(state, 'A')
  const b = await env.tab()
  await b.save({ ...state, commander: 'Other' }, 'B')
  saveSavedDeck(
    { id: 'manual', name: 'Manual', updatedAt: env.options.now().toISOString(), state },
    env.storage,
  )
  const manual = env.storage.getItem(savedDecksKey)
  // No liveness messages/heartbeats are sent as we advance beyond the configured age.
  env.setTime('2026-10-20T12:00:00Z')
  seed(env, 'expired', '2026-10-01T12:00:00Z')
  seed(env, 'recent', '2026-10-20T11:00:00Z')
  await a.setRetention({ maxCount: 1, maxAgeDays: 7 })
  assert.deepEqual(
    listAutosaves(env.storage)
      .map(({ id }) => id)
      .sort(),
    [a.getSnapshot().id, b.getSnapshot().id].sort(),
  )
  assert.equal(env.storage.getItem(savedDecksKey), manual)
  assert.deepEqual(JSON.parse(env.storage.getItem(retentionKey)!), { maxCount: 1, maxAgeDays: 7 })
  b.close()
  await new Promise((resolve) => setImmediate(resolve))
  await a.prune()
  assert.deepEqual(
    listAutosaves(env.storage).map(({ id }) => id),
    [a.getSnapshot().id],
  )
  a.close()
})

test('age cutoff retains the exact boundary and count cleanup removes the oldest eligible drafts', async () => {
  const env = environment()
  const workspace = await env.tab()
  seed(env, 'boundary', '2026-09-26T12:00:00Z')
  seed(env, 'expired', '2026-09-26T11:59:59Z')
  seed(env, 'newest', '2026-10-03T11:00:00Z')
  await workspace.prune()
  assert.deepEqual(
    listAutosaves(env.storage).map(({ id }) => id),
    ['newest', 'boundary'],
  )
  await workspace.setRetention({ maxCount: 1, maxAgeDays: 7 })
  assert.deepEqual(
    listAutosaves(env.storage).map(({ id }) => id),
    ['newest'],
  )
  await workspace.setRetention({ maxCount: 0, maxAgeDays: -1 })
  assert.deepEqual(workspace.getSnapshot().retention, { maxCount: 1, maxAgeDays: 7 })
  assert.match(workspace.getSnapshot().error, /Could not save autosave limits/)
  workspace.close()
})

test('opening an inactive draft also forks it and leaves its recovery point unchanged', async () => {
  const env = environment()
  const a = await env.tab()
  await a.save(state, 'Original')
  const original = listAutosaves(env.storage)[0]
  a.close()
  await Promise.resolve()
  const b = await env.tab()
  await b.begin(original)
  await b.save({ ...state, theme: 'Changed' }, 'Copy')
  assert.deepEqual(
    listAutosaves(env.storage).find(({ id }) => id === original.id),
    original,
  )
  b.close()
})

test('failed workspace switches keep the previous identity, session and recovery point', async () => {
  const env = environment()
  const session = memoryStorage()
  const workspace = await env.tab(session)
  await workspace.save(state, 'Original')
  const original = listAutosaves(env.storage)[0]
  env.storage.setItem = () => {
    throw new Error('quota exceeded')
  }
  assert.equal(await workspace.begin(original), false)
  assert.equal(workspace.getSnapshot().id, original.id)
  assert.equal(session.getItem(workspaceSessionKey), original.id)
  assert.deepEqual(listAutosaves(env.storage), [original])
  assert.match(workspace.getSnapshot().error, /Autosave unavailable/)
  workspace.close()
})

test('without Web Locks reload always copies, never shares writes, and never prunes', async () => {
  const env = environment()
  const session = memoryStorage()
  const a = await createWorkspace({ ...env.options, locks: undefined, session })
  await a.save(state, 'Original')
  const original = listAutosaves(env.storage)[0]
  const b = await createWorkspace({
    ...env.options,
    locks: undefined,
    session: memoryStorage({ [workspaceSessionKey]: original.id }),
  })
  assert.notEqual(a.getSnapshot().id, b.getSnapshot().id)
  assert.equal(b.initialState?.commander, state.commander)
  assert.equal(b.getSnapshot().cleanupAvailable, false)
  await b.save({ ...b.initialState!, theme: 'Independent edit' }, 'Copy')
  env.setTime('2026-11-03T12:00:00Z')
  await b.setRetention({ maxCount: 1, maxAgeDays: 1 })
  assert.equal(listAutosaves(env.storage).length, 2)
  a.close()
  b.close()
})

test('BroadcastChannel notifications refresh another tab’s picker without replacing its deck', async () => {
  const env = environment()
  const a = await env.tab()
  const b = await env.tab()
  await a.save(state, 'New autosave')
  await new Promise((resolve) => setImmediate(resolve))
  assert.ok(b.getSnapshot().drafts.some(({ name }) => name === 'New autosave'))
  assert.equal(b.initialState, null)
  a.close()
  b.close()
})

test('reload recovers its own session backup if retention prunes during lock handover', async () => {
  const env = environment()
  const session = memoryStorage()
  const a = await env.tab(session)
  await a.save({ ...state, commander: 'Own commander' }, 'Own draft')
  const id = a.getSnapshot().id
  const b = await env.tab()
  await b.save({ ...state, commander: 'Other commander' }, 'Other draft')
  a.close()
  await new Promise((resolve) => setImmediate(resolve))
  await b.setRetention({ maxCount: 1, maxAgeDays: 7 })
  assert.equal(env.storage.getItem(autosavePrefix + id), null)
  assert.ok(session.getItem(workspaceRecoveryKey))
  const reloaded = await env.tab(session)
  assert.equal(reloaded.getSnapshot().id, id)
  assert.equal(reloaded.initialState?.commander, 'Own commander')
  assert.equal(
    listAutosaves(env.storage).find((draft) => draft.id === id)?.state.commander,
    'Own commander',
  )
  assert.equal(
    listAutosaves(env.storage).find((draft) => draft.id === b.getSnapshot().id)?.state.commander,
    'Other commander',
  )
  reloaded.close()
  b.close()
})

test('manual saves and autosaved copies both restore an idle, persistable editing state', () => {
  for (const id of ['manual-save', '']) {
    const deps: Record<string, any> = {
      recommendationState: 'error',
      recommendationOptionsChanged: true,
      collectionError: 'Previous failure',
      navigateView: () => undefined,
    }
    for (const key of [
      ...Object.keys(state),
      'activeSavedDeckId',
      'deckName',
      'collectionPoolSize',
      'deckDoctorHistory',
      'deckDoctorError',
      'recommendationState',
      'recommendationOptionsChanged',
      'collectionError',
    ])
      deps[`set${key[0].toUpperCase() + key.slice(1)}`] = (value: unknown) => {
        deps[key] = value
      }
    loadSavedDeck(deps as ActionDeps, {
      id,
      name: 'Restored',
      updatedAt: '2026-10-03T12:00:00Z',
      state,
    })
    assert.equal(deps.recommendationState, 'idle')
    assert.equal(deps.recommendationOptionsChanged, false)
    assert.equal(deps.collectionError, '')
    assert.equal(deps.activeSavedDeckId, id)
    assert.deepEqual(deps.deck, state.deck)
  }
})

test('damaged retention settings fall back to defaults without hiding recovery points', async () => {
  const env = environment()
  const workspace = await env.tab()
  await workspace.save(state, 'Valid')
  env.storage.setItem(retentionKey, 'not json')
  await workspace.refresh()
  assert.deepEqual(workspace.getSnapshot().retention, { maxCount: 10, maxAgeDays: 7 })
  assert.equal(workspace.getSnapshot().drafts.length, 1)
  workspace.close()
})

test('opening the current draft makes a recoverable copy and applies count retention', async () => {
  const env = environment()
  const workspace = await env.tab()
  await workspace.save(state, 'Original')
  const original = listAutosaves(env.storage)[0]
  await workspace.setRetention({ maxCount: 1, maxAgeDays: 7 })
  assert.equal(await workspace.begin(original), true)
  await workspace.prune()
  assert.notEqual(workspace.getSnapshot().id, original.id)
  assert.equal(workspace.getSnapshot().notice?.copied, true)
  assert.equal(listAutosaves(env.storage).length, 1)
  assert.deepEqual(listAutosaves(env.storage)[0].state, original.state)
  workspace.close()
})

test('fresh and duplicated tabs do not write copies until their first edit, even after reload', async () => {
  const env = environment()
  const original = await env.tab()
  await original.save(state, 'Original')
  const saved = listAutosaves(env.storage)[0]
  const duplicate = await env.tab(memoryStorage({ [workspaceSessionKey]: saved.id }))
  assert.equal(duplicate.getSnapshot().notice?.copied, true)
  await duplicate.save(duplicate.initialState!, duplicate.initialName)
  assert.deepEqual(listAutosaves(env.storage), [saved])
  duplicate.close()
  const session = memoryStorage()
  let copy = await env.tab(session)
  // Startup hooks supply the new tuning defaults even when an older draft omitted them.
  await copy.save({ ...copy.initialState!, ignoreReasons: {}, maxPrice: null }, copy.initialName)
  assert.deepEqual(listAutosaves(env.storage), [saved])
  copy.close()
  await new Promise((resolve) => setImmediate(resolve))
  copy = await env.tab(session)
  await copy.save(copy.initialState!, copy.initialName)
  assert.deepEqual(listAutosaves(env.storage), [saved])
  await copy.save({ ...copy.initialState!, theme: 'First edit' }, copy.initialName)
  assert.equal(listAutosaves(env.storage).length, 2)
  assert.equal(readOwnDraft(env, copy)?.state.theme, 'First edit')
  original.close()
  copy.close()
})

function readOwnDraft(
  env: ReturnType<typeof environment>,
  workspace: Awaited<ReturnType<typeof env.tab>>,
) {
  return listAutosaves(env.storage).find(({ id }) => id === workspace.getSnapshot().id)
}

test('an inactive autosave resumes its manual-save link; a live copy remains unlinked', async () => {
  const env = environment()
  const original = await env.tab()
  await original.save({ ...state, savedDeckId: 'manual' }, 'Named save')
  const liveCopy = await env.tab()
  assert.equal(liveCopy.initialState?.savedDeckId, '')
  liveCopy.close()
  original.close()
  await new Promise((resolve) => setImmediate(resolve))
  const resumed = await env.tab()
  assert.equal(resumed.initialState?.savedDeckId, 'manual')
  assert.equal(resumed.initialName, 'Named save')
  assert.equal(listAutosaves(env.storage).length, 1)
  resumed.close()
})

test('migration retains the manual-save link and name without creating extra drafts', async () => {
  const env = environment()
  const linked = { ...state, savedDeckId: 'manual' }
  saveSavedDeck(
    { id: 'manual', name: 'Named save', updatedAt: env.options.now().toISOString(), state: linked },
    env.storage,
  )
  saveDeckState(linked, env.storage)
  const workspace = await env.tab()
  assert.equal(workspace.initialState?.savedDeckId, 'manual')
  assert.equal(workspace.initialName, 'Named save')
  assert.equal(listAutosaves(env.storage).length, 1)
  workspace.close()
})

test('a taken manual-save name requires explicit overwrite and reuses the existing save id', () => {
  const storage = memoryStorage()
  saveSavedDeck(
    { id: 'manual', name: 'Named save', updatedAt: '2026-10-03T12:00:00Z', state },
    storage,
  )
  const original = storage.getItem(savedDecksKey)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    const deps: Record<string, any> = {
      activeSavedDeckId: '',
      deckName: 'named SAVE',
      savedDecks: loadSavedDecks(storage),
      currentDeckState: { ...state, theme: 'Changed deck' },
      setSavedDecks: (value: unknown) => {
        deps.savedDecks = value
      },
      setActiveSavedDeckId: (value: string) => {
        deps.activeSavedDeckId = value
      },
    }
    storeDeck(deps as ActionDeps)
    assert.equal(storage.getItem(savedDecksKey), original)
    storeDeck(deps as ActionDeps, true)
    assert.equal(loadSavedDecks(storage).length, 1)
    assert.equal(loadSavedDecks(storage)[0].id, 'manual')
    assert.equal(loadSavedDecks(storage)[0].state.theme, 'Changed deck')
    assert.equal(deps.activeSavedDeckId, 'manual')
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('quota failures prune oldest inactive drafts and retry without touching live drafts or manual saves', async () => {
  const env = environment()
  const a = await env.tab()
  await a.save(state, 'A')
  const b = await env.tab()
  await b.save({ ...state, commander: 'Other' }, 'B')
  seed(env, 'oldest', '2026-10-02T12:00:00Z')
  seed(env, 'recent', '2026-10-03T11:00:00Z')
  saveSavedDeck(
    { id: 'manual', name: 'Manual', updatedAt: env.options.now().toISOString(), state },
    env.storage,
  )
  const manual = env.storage.getItem(savedDecksKey)
  const live = readOwnDraft(env, b)
  env.storage.setItem('junk', 'unrelated data')
  const used = () =>
    Array.from(
      { length: env.storage.length },
      (_, index) => env.storage.getItem(env.storage.key(index)!)!.length,
    ).reduce((sum, length) => sum + length, 0)
  const quota = used()
  const setItem = env.storage.setItem
  env.storage.setItem = (key, value) => {
    if (used() - (env.storage.getItem(key)?.length ?? 0) + value.length > quota)
      throw new DOMException('Storage full', 'QuotaExceededError')
    setItem(key, value)
  }
  await a.save({ ...state, theme: 'Latest edit' }, 'A')
  assert.equal(readOwnDraft(env, a)?.state.theme, 'Latest edit')
  assert.equal(a.getSnapshot().error, '')
  assert.equal(env.storage.getItem(autosavePrefix + 'oldest'), null)
  assert.ok(env.storage.getItem(autosavePrefix + 'recent'))
  assert.deepEqual(readOwnDraft(env, b), live)
  assert.equal(env.storage.getItem(savedDecksKey), manual)
  assert.equal(env.storage.getItem('junk'), 'unrelated data')
  a.close()
  b.close()
})

test('autosaves store the recommendation queue compactly and restore every scoring and printing field', async () => {
  const env = environment()
  const workspace = await env.tab()
  const queue = Array.from({ length: 100 }, (_, index) => ({
    ...state.deck[0],
    name: `Candidate ${index}`,
    reason: 'Test reason',
    printsUri: '',
    source: 'edhrec' as const,
    inclusion: index / 100,
    collectionMatch: index % 2 === 0,
    printings:
      index === 0
        ? [{ image: 'chosen', set: 'tst', collectorNumber: '2', finish: 'foil' as const }]
        : undefined,
  }))
  const full = persistedDeckStateSchema.parse({ ...state, queue })
  await workspace.save(full, 'Queue')
  const raw = env.storage.getItem(autosavePrefix + workspace.getSnapshot().id)!
  assert.ok(raw.length < JSON.stringify(listAutosaves(env.storage)[0]).length * 0.8)
  assert.deepEqual(readOwnDraft(env, workspace)?.state, JSON.parse(JSON.stringify(full)))
  workspace.close()
})

test('quota retries serialize rapid edits, and non-quota failures never authorize deletion', async () => {
  const env = environment()
  const workspace = await env.tab()
  await workspace.save(state, 'Original')
  seed(env, 'inactive', '2026-10-02T12:00:00Z')
  const setItem = env.storage.setItem
  env.storage.setItem = (key, value) => {
    if (env.storage.getItem(autosavePrefix + 'inactive'))
      throw new DOMException('Full', 'QuotaExceededError')
    setItem(key, value)
  }
  await Promise.all([
    workspace.save({ ...state, theme: 'First' }, 'Original'),
    workspace.save({ ...state, theme: 'Second' }, 'Original'),
  ])
  assert.equal(readOwnDraft(env, workspace)?.state.theme, 'Second')
  seed(env, 'keep', '2026-10-02T12:00:00Z')
  env.storage.setItem = () => {
    throw new DOMException('Denied', 'SecurityError')
  }
  await workspace.save({ ...state, theme: 'Denied edit' }, 'Original')
  assert.ok(env.storage.getItem(autosavePrefix + 'keep'))
  assert.equal(readOwnDraft(env, workspace)?.state.theme, 'Second')
  assert.match(workspace.getSnapshot().error, /Autosave unavailable/)
  workspace.close()
})

test('individual deletion and retention previews protect current and live drafts', async () => {
  const env = environment()
  const a = await env.tab()
  await a.save(state, 'A')
  const b = await env.tab()
  await b.save({ ...state, commander: 'B' }, 'B')
  seed(env, 'inactive', '2026-10-02T12:00:00Z')
  assert.equal(await a.previewRetention({ maxCount: 1, maxAgeDays: 7 }), 1)
  assert.equal(await a.deleteDraft(readOwnDraft(env, a)!), false)
  assert.equal(await a.deleteDraft(readOwnDraft(env, b)!), false)
  assert.equal(
    await a.deleteDraft(listAutosaves(env.storage).find(({ id }) => id === 'inactive')!),
    true,
  )
  assert.equal(listAutosaves(env.storage).length, 2)
  a.close()
  b.close()
})

test('the restored notice is shown once per tab session, including when not dismissed', async () => {
  const env = environment()
  seed(env, 'restore', env.options.now().toISOString())
  const session = memoryStorage()
  const first = await env.tab(session)
  assert.ok(first.getSnapshot().notice)
  first.close()
  await new Promise((resolve) => setImmediate(resolve))
  const reload = await env.tab(session)
  assert.equal(reload.getSnapshot().notice, null)
  assert.equal(reload.initialState?.commander, state.commander)
  reload.close()
})

test('relative age handles fresh, future, minute, hour and day timestamps', () => {
  const now = Date.parse('2026-10-03T12:00:00Z')
  assert.equal(savedDraftAge('2026-10-03T12:00:00Z', now), 'just now')
  assert.equal(savedDraftAge('2026-10-03T13:00:00Z', now), 'just now')
  assert.equal(
    savedDraftAge('2026-10-03T11:55:00Z', now),
    new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-5, 'minute'),
  )
  assert.equal(
    savedDraftAge('2026-10-03T10:00:00Z', now),
    new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-2, 'hour'),
  )
  assert.equal(
    savedDraftAge('2026-10-01T12:00:00Z', now),
    new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-2, 'day'),
  )
})
