import { z } from 'zod'

import {
  deckStateKey,
  deckStateVersion,
  loadDeckState,
  persistedDeckStateSchema,
  suggestedDeckName,
  type PersistedDeckState,
} from './deck-state.ts'

export const autosavePrefix = 'commander-autosave:'
export const workspaceSessionKey = 'commander-workspace'
export const workspaceRecoveryKey = 'commander-workspace-recovery'
export const retentionKey = 'commander-autosave-retention'
const migrationLock = 'commander-autosave-migration'
const retentionSchema = z.object({
  maxCount: z.number().int().min(1).max(200),
  maxAgeDays: z.number().int().min(1).max(365),
})
export type AutosaveRetention = z.infer<typeof retentionSchema>
export const defaultRetention: AutosaveRetention = { maxCount: 10, maxAgeDays: 7 }
const autosaveSchema = z.object({
  version: z.literal(deckStateVersion),
  id: z.string().min(1),
  name: z.string(),
  updatedAt: z.iso.datetime(),
  state: persistedDeckStateSchema,
})
export type AutosavedDraft = z.infer<typeof autosaveSchema>
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>
type Channel = Pick<BroadcastChannel, 'postMessage' | 'close' | 'onmessage'>
type WorkspaceOptions = {
  storage: DraftStorage
  session: SessionStorage
  locks?: Pick<LockManager, 'request' | 'query'>
  channel?: Channel
  uuid?: () => string
  now?: () => Date
}

function parseDraft(raw: string | null, id: string) {
  try {
    const parsed = autosaveSchema.safeParse(JSON.parse(raw ?? 'null'))
    return parsed.success && parsed.data.id === id ? parsed.data : null
  } catch {
    return null
  }
}
const readDraft = (storage: DraftStorage, id: string) =>
  parseDraft(storage.getItem(autosavePrefix + id), id)

export function listAutosaves(storage: DraftStorage): AutosavedDraft[] {
  const drafts: AutosavedDraft[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key?.startsWith(autosavePrefix)) continue
    const draft = readDraft(storage, key.slice(autosavePrefix.length))
    if (draft) drafts.push(draft)
  }
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}

class Workspace {
  private options: WorkspaceOptions
  private listeners = new Set<() => void>()
  private release: (() => void) | undefined
  private closed = false
  private sessionError = ''
  private snapshot = {
    id: '',
    drafts: [] as AutosavedDraft[],
    activeIds: [] as string[],
    retention: defaultRetention,
    notice: null as { draft: AutosavedDraft; copied: boolean; latest: boolean } | null,
    error: '',
    busy: false,
    cleanupAvailable: false,
  }
  initialState: PersistedDeckState | null = null
  initialName = ''

  constructor(options: WorkspaceOptions) {
    this.options = options
    this.snapshot.cleanupAvailable = Boolean(options.locks)
  }

  private uuid = () => this.options.uuid?.() ?? crypto.randomUUID()
  private now = () => this.options.now?.() ?? new Date()
  private publish(patch: Partial<typeof this.snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  private storageError() {
    this.publish({ error: 'Autosave unavailable. Export your deck before closing this tab.' })
  }
  private notify() {
    try {
      this.options.channel?.postMessage('changed')
    } catch {
      /* Notifications are optional; ownership uses locks. */
    }
  }
  private claim(id: string): Promise<(() => void) | null> {
    const { locks } = this.options
    if (!locks) return Promise.resolve(() => undefined)
    return new Promise((resolve, reject) => {
      void locks
        .request(autosavePrefix + id, { ifAvailable: true }, async (lock) => {
          if (!lock) {
            resolve(null)
            return
          }
          await new Promise<void>((unlock) => resolve(unlock))
        })
        .catch(reject)
    })
  }
  private write(draft: AutosavedDraft) {
    this.options.storage.setItem(
      autosavePrefix + draft.id,
      JSON.stringify(autosaveSchema.parse(draft)),
    )
  }
  private remember(id: string, draft: AutosavedDraft | null) {
    // Protect reload recovery during the lock handover, when another tab may prune this key.
    this.options.session.setItem(workspaceRecoveryKey, JSON.stringify(draft))
    this.options.session.setItem(workspaceSessionKey, id)
  }
  private loadRetention() {
    const raw = this.options.storage.getItem(retentionKey)
    try {
      const parsed = retentionSchema.safeParse(JSON.parse(raw ?? 'null'))
      return parsed.success ? parsed.data : defaultRetention
    } catch {
      return defaultRetention
    }
  }

  refresh = async () => {
    if (this.closed) return
    const { locks, storage } = this.options
    try {
      const activeIds = locks
        ? ((await locks.query()).held ?? []).flatMap(({ name }) =>
            name?.startsWith(autosavePrefix) ? [name.slice(autosavePrefix.length)] : [],
          )
        : [this.snapshot.id]
      this.publish({ drafts: listAutosaves(storage), activeIds, retention: this.loadRetention() })
    } catch {
      this.storageError()
    }
  }

  private migrate = () => {
    const { storage } = this.options
    const legacy = loadDeckState(storage)
    if (!legacy) return
    if (!readDraft(storage, 'legacy'))
      this.write({
        version: deckStateVersion,
        id: 'legacy',
        name: suggestedDeckName(legacy.commander, legacy.theme, legacy.activeSubThemes),
        updatedAt: this.now().toISOString(),
        state: legacy,
      })
    // Never discard the shared recovery point until its validated replacement is readable.
    if (readDraft(storage, 'legacy')) storage.removeItem(deckStateKey)
  }
  private readInitialDraft() {
    const { storage, session } = this.options
    let inheritedId: string | null = null
    let restored: AutosavedDraft | null = null
    try {
      inheritedId = session.getItem(workspaceSessionKey)
      restored = inheritedId
        ? (readDraft(storage, inheritedId) ??
          parseDraft(session.getItem(workspaceRecoveryKey), inheritedId))
        : (listAutosaves(storage)[0] ?? null)
      const legacy = loadDeckState(storage)
      if (!inheritedId && !restored && legacy)
        restored = {
          version: deckStateVersion,
          id: 'legacy',
          name: '',
          updatedAt: this.now().toISOString(),
          state: legacy,
        }
    } catch {
      this.storageError()
    }
    return { inheritedId, restored }
  }

  async initialize() {
    const { locks, channel } = this.options
    try {
      // Serialize migration so simultaneous startups cannot stamp different migration times.
      if (locks) await locks.request(migrationLock, this.migrate)
      else this.migrate()
    } catch {
      this.storageError()
    }
    let { inheritedId, restored } = this.readInitialDraft()
    // Without Web Locks always fork, and disable pruning: a suspended tab cannot prove liveness.
    const inheritedRelease = inheritedId && locks ? await this.claim(inheritedId) : null
    const copied = !inheritedRelease
    const id = inheritedRelease ? inheritedId! : this.uuid()
    this.release = inheritedRelease ?? (await this.claim(id)) ?? undefined
    if (!this.release)
      throw new Error('Could not create an isolated deck workspace. Reload to try again.')
    this.publish({ id })
    if (restored) {
      if (copied) restored = { ...restored, id, state: { ...restored.state, savedDeckId: '' } }
      try {
        this.write(restored)
      } catch {
        this.storageError()
      }
      this.initialState = restored.state
      this.initialName = restored.name
      this.publish({ notice: { draft: restored, copied, latest: !inheritedId } })
    }
    try {
      this.remember(id, restored)
    } catch {
      this.sessionError =
        'This tab cannot remember its workspace. Export your deck before reloading.'
      this.publish({ error: this.sessionError })
    }
    await this.refresh()
    if (channel) channel.onmessage = () => void this.refresh()
    this.notify()
    await this.prune()
  }

  prune = async () => {
    const { locks, storage } = this.options
    if (!locks || this.closed) return
    try {
      await locks.request('commander-autosave-cleanup', async () => {
        const retention = this.loadRetention()
        const drafts = listAutosaves(storage)
        let remaining = drafts.length
        const cutoff = this.now().getTime() - retention.maxAgeDays * 86_400_000
        for (const draft of [...drafts].reverse()) {
          if (this.closed) break
          if (draft.id === this.snapshot.id) continue
          if (remaining <= retention.maxCount && Date.parse(draft.updatedAt) >= cutoff) continue
          // Atomic try-lock protects even hidden/frozen owners, not just recent heartbeats.
          await locks.request(autosavePrefix + draft.id, { ifAvailable: true }, (lock) => {
            if (!lock) return
            const current = readDraft(storage, draft.id)
            if (!current || current.updatedAt !== draft.updatedAt) return
            storage.removeItem(autosavePrefix + draft.id)
            remaining--
            this.notify()
          })
        }
      })
    } catch {
      this.storageError()
    } finally {
      await this.refresh()
    }
  }
  setRetention = async (value: AutosaveRetention) => {
    try {
      this.options.storage.setItem(retentionKey, JSON.stringify(retentionSchema.parse(value)))
      await this.refresh()
      this.notify()
      await this.prune()
    } catch {
      this.publish({
        error: 'Could not save autosave limits. Use a count from 1–200 and an age from 1–365 days.',
      })
    }
  }

  save = (state: PersistedDeckState, name: string) => {
    if (this.closed || this.snapshot.busy) return
    try {
      const previous = readDraft(this.options.storage, this.snapshot.id)
      const draft: AutosavedDraft = {
        version: deckStateVersion,
        id: this.snapshot.id,
        name: name.trim() || suggestedDeckName(state.commander, state.theme, state.activeSubThemes),
        updatedAt: this.now().toISOString(),
        state,
      }
      if (previous?.name === draft.name && JSON.stringify(previous.state) === JSON.stringify(state))
        return
      this.write(draft)
      try {
        this.remember(draft.id, draft)
      } catch {
        this.sessionError =
          'This tab cannot remember its workspace. Export your deck before reloading.'
      }
      this.publish({ error: this.sessionError })
      void this.refresh()
      this.notify()
      void this.prune()
    } catch {
      this.storageError()
    }
  }
  begin = async (draft?: AutosavedDraft) => {
    if (this.closed || this.snapshot.busy) return false
    this.publish({ busy: true })
    const nextId = this.uuid()
    let nextRelease: (() => void) | null = null
    try {
      nextRelease = await this.claim(nextId)
      if (!nextRelease) throw new Error('Workspace already in use')
      if (draft) {
        draft = { ...draft, id: nextId, state: { ...draft.state, savedDeckId: '' } }
        this.write(draft)
      }
      this.remember(nextId, draft ?? null)
      this.release?.()
      this.release = nextRelease
      this.publish({ id: nextId, notice: draft ? { draft, copied: true, latest: false } : null })
      this.notify()
      void this.prune()
      return true
    } catch {
      nextRelease?.()
      this.storageError()
      return false
    } finally {
      this.publish({ busy: false })
      void this.refresh()
    }
  }

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  dismissNotice = () => this.publish({ notice: null })
  close = () => {
    if (this.closed) return
    this.closed = true
    this.release?.()
    this.notify()
    this.options.channel?.close()
  }
}

export async function createWorkspace(options: WorkspaceOptions) {
  const workspace = new Workspace(options)
  await workspace.initialize()
  return workspace
}
export type DeckWorkspace = Awaited<ReturnType<typeof createWorkspace>>

export function savedDraftAge(updatedAt: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(updatedAt)) / 60_000))
  if (minutes < 1) return 'just now'
  const [amount, unit] =
    minutes >= 1440
      ? ([Math.floor(minutes / 1440), 'day'] as const)
      : minutes >= 60
        ? ([Math.floor(minutes / 60), 'hour'] as const)
        : ([minutes, 'minute'] as const)
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-amount, unit)
}
