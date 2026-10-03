import { z } from 'zod'

import {
  deckStateKey,
  deckStateVersion,
  loadDeckState,
  loadSavedDecks,
  persistedDeckStateSchema,
  restoredRecommendationDecisions,
  suggestedDeckName,
  type PersistedDeckState,
} from './deck-state.ts'

export const autosavePrefix = 'commander-autosave:'
export const workspaceSessionKey = 'commander-workspace'
export const workspaceRecoveryKey = 'commander-workspace-recovery'
const pendingCopyKey = 'commander-workspace-pending-copy'
const noticeSeenKey = 'commander-workspace-notice-seen'
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
// Store queue field names once, without dropping scoring inputs, art, or selected printings.
const compactQueueSchema = z
  .object({ fields: z.array(z.string()), rows: z.array(z.array(z.unknown())) })
  .refine(({ fields, rows }) => rows.every((row) => row.length === fields.length))
  .transform(({ fields, rows }) =>
    rows.map((row) =>
      Object.fromEntries(
        fields.flatMap((field, index) => (row[index] === null ? [] : [[field, row[index]]])),
      ),
    ),
  )
  .pipe(persistedDeckStateSchema.shape.queue)
const storedAutosaveSchema = autosaveSchema.extend({
  state: persistedDeckStateSchema.extend({
    queue: z.union([persistedDeckStateSchema.shape.queue, compactQueueSchema]),
  }),
})

function serializeDraft(value: AutosavedDraft) {
  const draft = autosaveSchema.parse(value)
  const queue = draft.state.queue
  if (!queue.length) return JSON.stringify(draft)
  const fields = [
    ...new Set(
      queue.flatMap((card) =>
        Object.keys(card).filter((key) => card[key as keyof typeof card] !== undefined),
      ),
    ),
  ] as (keyof (typeof queue)[number])[]
  const rows = queue.map((card) => fields.map((field) => card[field] ?? null))
  return JSON.stringify({ ...draft, state: { ...draft.state, queue: { fields, rows } } })
}

function stateForComparison(state: PersistedDeckState) {
  // Startup defaults and recovered Add choices are not player edits to an older draft.
  return JSON.stringify(
    persistedDeckStateSchema.parse({
      ...state,
      ignoreReasons: state.ignoreReasons ?? {},
      maxPrice: state.maxPrice ?? null,
      decisions: restoredRecommendationDecisions(state),
    }),
  )
}

function isQuotaError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}
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
    const parsed = storedAutosaveSchema.safeParse(JSON.parse(raw ?? 'null'))
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
  private baseline: AutosavedDraft | null = null
  private pendingSave = Promise.resolve()
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
    this.options.storage.setItem(autosavePrefix + draft.id, serializeDraft(draft))
  }
  private async persist(draft: AutosavedDraft) {
    try {
      this.write(draft)
    } catch (error) {
      if (!isQuotaError(error) || !this.options.locks) throw error
      await this.cleanup(this.loadRetention(), draft)
    }
  }
  private remember(id: string, draft: AutosavedDraft | null, pendingCopy = false) {
    // Protect reload recovery during the lock handover, when another tab may prune this key.
    this.options.session.setItem(workspaceRecoveryKey, draft ? serializeDraft(draft) : 'null')
    this.options.session.setItem(workspaceSessionKey, id)
    this.options.session.setItem(pendingCopyKey, pendingCopy ? id : '')
    this.options.session.setItem(noticeSeenKey, draft ? id : '')
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

  private migrate = async () => {
    const { storage } = this.options
    const legacy = loadDeckState(storage)
    if (!legacy) return
    if (!readDraft(storage, 'legacy'))
      await this.persist({
        version: deckStateVersion,
        id: 'legacy',
        name:
          loadSavedDecks(storage).find(({ id }) => id === legacy.savedDeckId)?.name ??
          suggestedDeckName(legacy.commander, legacy.theme, legacy.activeSubThemes),
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

  private async restoreDraft(restored: AutosavedDraft | null, copied: boolean, latest: boolean) {
    const id = this.snapshot.id
    if (copied && restored)
      restored = { ...restored, id, state: { ...restored.state, savedDeckId: '' } }
    let pendingCopy = copied && Boolean(restored)
    try {
      pendingCopy ||= this.options.session.getItem(pendingCopyKey) === id
      // Unedited forks live in session recovery only; reload must not materialize them either.
      if (restored && !pendingCopy && !readDraft(this.options.storage, id))
        await this.persist(restored)
    } catch {
      this.storageError()
    }
    this.baseline = restored
    this.initialState = restored?.state ?? null
    this.initialName = restored?.name ?? ''
    try {
      if (restored && this.options.session.getItem(noticeSeenKey) !== id)
        this.publish({ notice: { draft: restored, copied, latest } })
      this.remember(id, restored, pendingCopy)
    } catch {
      this.sessionError =
        'This tab cannot remember its workspace. Export your deck before reloading.'
      this.publish({ error: this.sessionError })
    }
  }

  async initialize() {
    const { locks, channel } = this.options
    try {
      // Serialize migration so simultaneous startups cannot stamp different migration times.
      if (locks) await locks.request(migrationLock, this.migrate)
      else await this.migrate()
    } catch {
      this.storageError()
    }
    let { inheritedId, restored } = this.readInitialDraft()
    // Resume an inactive source atomically; live sources and duplicate tabs get lazy copies.
    // Without Web Locks always fork and disable pruning: suspended owners cannot prove liveness.
    const sourceId = inheritedId ?? restored?.id
    const sourceRelease = sourceId && locks ? await this.claim(sourceId) : null
    const copied = !sourceRelease
    const id = sourceRelease ? sourceId! : this.uuid()
    this.release = sourceRelease ?? (await this.claim(id)) ?? undefined
    if (!this.release)
      throw new Error('Could not create an isolated deck workspace. Reload to try again.')
    this.publish({ id })
    if (sourceRelease) restored = readDraft(this.options.storage, id) ?? restored
    await this.restoreDraft(restored, copied, !inheritedId)
    await this.refresh()
    if (channel) channel.onmessage = () => void this.refresh()
    this.notify()
    await this.prune()
  }

  private async cleanup(retention: AutosaveRetention, retry?: AutosavedDraft) {
    const { locks, storage } = this.options
    if (!locks || this.closed) return 0
    return locks.request('commander-autosave-cleanup', async () => {
      const tryWrite = () => {
        if (!retry) return false
        if (this.closed) throw new Error('Workspace closed before autosave retry')
        try {
          this.write(retry)
          return true
        } catch (error) {
          if (!isQuotaError(error)) throw error
          return false
        }
      }
      if (tryWrite()) return 0
      const drafts = listAutosaves(storage)
      let removed = 0
      const cutoff = this.now().getTime() - retention.maxAgeDays * 86_400_000
      for (const draft of [...drafts].reverse()) {
        if (this.closed) break
        if (draft.id === this.snapshot.id || draft.id === retry?.id) continue
        if (
          !retry &&
          drafts.length - removed <= retention.maxCount &&
          Date.parse(draft.updatedAt) >= cutoff
        )
          continue
        // Atomic try-lock protects hidden/frozen owners and races with new owners.
        await locks.request(autosavePrefix + draft.id, { ifAvailable: true }, (lock) => {
          if (!lock) return
          const current = readDraft(storage, draft.id)
          if (this.closed || !current || JSON.stringify(current) !== JSON.stringify(draft)) return
          storage.removeItem(autosavePrefix + draft.id)
          removed++
          this.notify()
        })
        // On quota pressure, remove only as many oldest inactive drafts as this write needs.
        if (tryWrite()) return removed
      }
      if (retry) throw new DOMException('Storage full', 'QuotaExceededError')
      return removed
    })
  }
  prune = async () => {
    try {
      return await this.cleanup(this.loadRetention())
    } catch {
      this.storageError()
      return 0
    } finally {
      await this.refresh()
    }
  }
  previewRetention = async (value: AutosaveRetention) => {
    const retention = retentionSchema.parse(value)
    await this.refresh()
    let remaining = this.snapshot.drafts.length
    const cutoff = this.now().getTime() - retention.maxAgeDays * 86_400_000
    return [...this.snapshot.drafts].reverse().filter((draft) => {
      if (draft.id === this.snapshot.id || this.snapshot.activeIds.includes(draft.id)) return false
      if (remaining <= retention.maxCount && Date.parse(draft.updatedAt) >= cutoff) return false
      remaining--
      return true
    }).length
  }
  deleteDraft = async (draft: AutosavedDraft) => {
    const { locks, storage } = this.options
    if (!locks || this.closed || draft.id === this.snapshot.id) return false
    try {
      const deleted = await locks.request(
        autosavePrefix + draft.id,
        { ifAvailable: true },
        (lock) => {
          if (!lock) return false
          const current = readDraft(storage, draft.id)
          if (this.closed || !current || JSON.stringify(current) !== JSON.stringify(draft))
            return false
          storage.removeItem(autosavePrefix + draft.id)
          return true
        },
      )
      if (deleted) this.notify()
      return deleted
    } catch {
      this.storageError()
      return false
    } finally {
      await this.refresh()
    }
  }
  setRetention = async (value: AutosaveRetention) => {
    try {
      this.options.storage.setItem(retentionKey, JSON.stringify(retentionSchema.parse(value)))
      await this.refresh()
      this.notify()
      return await this.prune()
    } catch {
      this.publish({
        error: 'Could not save autosave limits. Use a count from 1–200 and an age from 1–365 days.',
      })
    }
  }

  save = (state: PersistedDeckState, name: string) => {
    if (this.closed || this.snapshot.busy) return this.pendingSave
    const id = this.snapshot.id
    // Serialize quota retries so an older edit cannot overwrite a newer one after awaiting cleanup.
    this.pendingSave = this.pendingSave.then(async () => {
      if (this.closed || id !== this.snapshot.id) return
      try {
        state = persistedDeckStateSchema.parse(state)
        const previous = readDraft(this.options.storage, id) ?? this.baseline
        const draft: AutosavedDraft = {
          version: deckStateVersion,
          id,
          name:
            name.trim() || suggestedDeckName(state.commander, state.theme, state.activeSubThemes),
          updatedAt: this.now().toISOString(),
          state,
        }
        if (
          previous?.name === draft.name &&
          stateForComparison(previous.state) === stateForComparison(state)
        )
          return
        await this.persist(draft)
        this.baseline = draft
        try {
          this.remember(draft.id, draft)
        } catch {
          this.sessionError =
            'This tab cannot remember its workspace. Export your deck before reloading.'
        }
        this.publish({ error: this.sessionError })
        this.notify()
        await this.prune()
      } catch {
        this.storageError()
      }
    })
    return this.pendingSave
  }
  begin = async (draft?: AutosavedDraft) => {
    if (this.closed || this.snapshot.busy) return false
    this.publish({ busy: true })
    await this.pendingSave
    const nextId = this.uuid()
    let nextRelease: (() => void) | null = null
    try {
      nextRelease = await this.claim(nextId)
      if (!nextRelease) throw new Error('Workspace already in use')
      if (draft) {
        draft = { ...draft, id: nextId, state: { ...draft.state, savedDeckId: '' } }
        await this.persist(draft)
      }
      if (this.closed) throw new Error('Workspace closed before switching decks')
      this.remember(nextId, draft ?? null)
      this.baseline = draft ?? null
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
