export class ProviderRequestError extends Error {
  readonly status?: number
  readonly retryAt?: number
  constructor(message: string, status?: number, retryAt?: number) {
    super(message)
    this.name = 'ProviderRequestError'
    this.status = status
    this.retryAt = retryAt
  }
  get transient() {
    return this.status === undefined || this.status === 429 || this.status >= 500
  }
}

export type RequestPolicy = { background?: boolean; onDispatch?: () => void }
type QueuedRequest = {
  run: () => Promise<void>
  background: boolean
  signal?: AbortSignal
}
type Schedule = {
  queue: QueuedRequest[]
  running: boolean
  lastDispatch: number
  active: number
  cooldownUntil: number
}
export type RequestActivity = {
  providers: readonly { name: string; active: number; queued: number; cooldownUntil: number }[]
  backgroundRetryAt: number
}
const emptyActivity: RequestActivity = {
  providers: [
    { name: 'EDHREC', active: 0, queued: 0, cooldownUntil: 0 },
    { name: 'Scryfall', active: 0, queued: 0, cooldownUntil: 0 },
  ],
  backgroundRetryAt: 0,
}
type ClientSchedule = {
  lanes: Map<number, Schedule>
  listeners: Set<() => void>
  retries: Map<AbortSignal, number>
  snapshot: RequestActivity
}
const schedules = new WeakMap<typeof fetch, ClientSchedule>()

function clientSchedule(client: typeof fetch) {
  let state = schedules.get(client)
  if (!state) {
    state = { lanes: new Map(), listeners: new Set(), retries: new Map(), snapshot: emptyActivity }
    schedules.set(client, state)
  }
  return state
}
function laneFor(state: ClientSchedule, interval: number) {
  let lane = state.lanes.get(interval)
  if (!lane) {
    lane = { queue: [], running: false, lastDispatch: -Infinity, active: 0, cooldownUntil: 0 }
    state.lanes.set(interval, lane)
  }
  return lane
}
function notifyActivity(state: ClientSchedule) {
  state.snapshot = {
    providers: [1000, 500].map((interval, index) => {
      const lane = state.lanes.get(interval)
      return {
        name: emptyActivity.providers[index].name,
        active: lane?.active ?? 0,
        queued: lane?.queue.length ?? 0,
        cooldownUntil: lane?.cooldownUntil ?? 0,
      }
    }),
    backgroundRetryAt: state.retries.size ? Math.min(...state.retries.values()) : 0,
  }
  for (const notify of state.listeners) notify()
}
export function getRequestActivity(client: typeof fetch = fetch) {
  return clientSchedule(client).snapshot
}
export function observeRequestActivity(notify: () => void, client: typeof fetch = fetch) {
  const state = clientSchedule(client)
  state.listeners.add(notify)
  return () => {
    state.listeners.delete(notify)
  }
}
export function setRequestCooldown(client: typeof fetch, interval: number, until: number) {
  const state = clientSchedule(client),
    lane = laneFor(state, interval)
  lane.cooldownUntil = Math.max(lane.cooldownUntil, until)
  notifyActivity(state)
}
export function setBackgroundRetry(
  signal: AbortSignal,
  until: number,
  client: typeof fetch = fetch,
) {
  const state = clientSchedule(client)
  if (!signal.aborted && Number.isFinite(until) && until > Date.now())
    state.retries.set(signal, until)
  else state.retries.delete(signal)
  notifyActivity(state)
}

// ponytail: one scheduling lane per fetch client/provider; use cross-tab coordination if needed.
export function scheduleRequest<T>(
  client: typeof fetch,
  interval: number,
  run: () => Promise<T>,
  signal?: AbortSignal,
  policy: RequestPolicy = {},
  serial = false,
): Promise<T> {
  signal?.throwIfAborted()
  const state = clientSchedule(client),
    lane = laneFor(state, interval)
  return new Promise<T>((resolve, reject) => {
    const entry: QueuedRequest = {
      get background() {
        return Boolean(policy.background)
      },
      signal,
      run: async () => {
        signal?.removeEventListener('abort', abort)
        try {
          signal?.throwIfAborted()
          resolve(await run())
        } catch (error) {
          reject(error)
        }
      },
    }
    const abort = () => {
      lane.queue = lane.queue.filter((queued) => queued !== entry)
      notifyActivity(state)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', abort, { once: true })
    lane.queue.push(entry)
    notifyActivity(state)
    void drain(state, lane, interval, serial)
  })
}

async function drain(state: ClientSchedule, lane: Schedule, interval: number, serial: boolean) {
  if (lane.running) return
  lane.running = true
  try {
    while (lane.queue.length && lane.active < (serial ? 1 : 2)) {
      const delay = Math.max(0, interval - (performance.now() - lane.lastDispatch))
      if (delay) await new Promise((resolve) => setTimeout(resolve, Math.ceil(delay)))
      if (performance.now() - lane.lastDispatch < interval) continue
      const index = lane.queue.findIndex((entry) => !entry.background)
      const entry = lane.queue.splice(index < 0 ? 0 : index, 1)[0]
      if (!entry || entry.signal?.aborted) continue
      lane.active++
      notifyActivity(state)
      const request = entry.run().finally(() => {
        lane.active--
        notifyActivity(state)
        void drain(state, lane, interval, serial)
      })
      lane.lastDispatch = performance.now()
      if (serial) await request
    }
  } finally {
    lane.running = false
  }
}

export function retryTime(response: Response) {
  const value = response.headers.get('Retry-After')?.trim() ?? ''
  const serverDate = Date.parse(response.headers.get('Date') ?? '')
  const reference = Number.isFinite(serverDate) ? serverDate : Date.now()
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : /[a-z]/i.test(value)
      ? (Date.parse(value) - reference) / 1000
      : NaN
  const retryAt = Date.now() + Math.max(0, seconds) * 1000
  const estimated = !Number.isFinite(retryAt) || Number.isNaN(new Date(retryAt).getTime())
  return { retryAt: estimated ? Date.now() + 60_000 : retryAt, estimated }
}
