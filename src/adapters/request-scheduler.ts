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
type Schedule = { queue: QueuedRequest[]; running: boolean; lastDispatch: number; active: number }
const schedules = new WeakMap<typeof fetch, Map<number, Schedule>>()

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
  let provider = schedules.get(client)
  if (!provider) {
    provider = new Map()
    schedules.set(client, provider)
  }
  let lane = provider.get(interval)
  if (!lane) {
    lane = { queue: [], running: false, lastDispatch: -Infinity, active: 0 }
    provider.set(interval, lane)
  }
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
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', abort, { once: true })
    lane.queue.push(entry)
    void drain(lane, interval, serial)
  })
}

async function drain(lane: Schedule, interval: number, serial: boolean) {
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
      const request = entry.run().finally(() => {
        lane.active--
        void drain(lane, interval, serial)
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
