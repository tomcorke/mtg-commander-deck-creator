import { z } from 'zod'
import {
  ProviderRequestError,
  retryTime,
  scheduleRequest,
  setRequestCooldown,
  type RequestPolicy,
} from './request-scheduler.ts'

const pageSchema = z.object({
  tag_counts: z
    .array(z.object({ count: z.number(), slug: z.string(), value: z.string() }))
    .optional(),
  container: z.object({
    json_dict: z.object({
      cardlists: z
        .array(
          z.object({
            header: z.string(),
            tag: z.string(),
            cardviews: z
              .array(
                z.object({
                  name: z.string().min(1).max(300),
                  lift: z.number().optional(),
                  synergy: z.number().optional(),
                  num_decks: z.number().optional(),
                }),
              )
              .max(3000),
          }),
        )
        .max(100),
    }),
  }),
})
export type EdhrecCommanderPage = z.infer<typeof pageSchema>
export type EdhrecCardList = EdhrecCommanderPage['container']['json_dict']['cardlists'][number]
export type EdhrecPageKind = 'cards' | 'commanders'
type PageJob = {
  controller: AbortController
  users: number
  settled: boolean
  promise: Promise<EdhrecCommanderPage>
  expiresAt: number
  policy: RequestPolicy
}
const clients = new WeakMap<typeof fetch, Map<string, PageJob>>()
const cooldowns = new WeakMap<typeof fetch, number>()

function subscribe(job: PageJob, signal?: AbortSignal, background = false) {
  if (!background) job.policy.background = false
  job.users++
  return new Promise<EdhrecCommanderPage>((resolve, reject) => {
    let released = false
    const release = () => {
      if (released) return
      released = true
      signal?.removeEventListener('abort', abort)
      if (--job.users === 0 && !job.settled) job.controller.abort()
    }
    const abort = () => {
      release()
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', abort, { once: true })
    job.promise.then(
      (page) => {
        release()
        resolve(structuredClone(page))
      },
      (error) => {
        release()
        reject(error)
      },
    )
    if (signal?.aborted) abort()
  })
}

export async function fetchEdhrecPage(
  kind: EdhrecPageKind,
  slug: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
  policy: RequestPolicy = {},
): Promise<EdhrecCommanderPage> {
  signal?.throwIfAborted()
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid EDHREC slug')
  let cache = clients.get(fetcher)
  if (!cache) {
    cache = new Map()
    clients.set(fetcher, cache)
  }
  const key = `${kind}:${slug}`
  let job = cache.get(key)
  if (!job || job.controller.signal.aborted || job.expiresAt <= Date.now()) {
    const controller = new AbortController()
    const promise = scheduleRequest(
      fetcher,
      1000,
      async () => {
        const cooldown = cooldowns.get(fetcher) ?? 0
        if (cooldown > Date.now())
          throw new ProviderRequestError('EDHREC cooling down', 429, cooldown)
        policy.onDispatch?.()
        let response: Response
        try {
          response = await fetcher(`https://json.edhrec.com/pages/${kind}/${slug}.json`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          })
        } catch (error) {
          if (controller.signal.aborted) throw error
          throw new ProviderRequestError('EDHREC network unavailable')
        }
        const retryAt =
          response.status === 429 || (response.status >= 500 && response.headers.has('Retry-After'))
            ? retryTime(response).retryAt
            : undefined
        if (retryAt !== undefined) {
          cooldowns.set(fetcher, Math.max(cooldowns.get(fetcher) ?? 0, retryAt))
          setRequestCooldown(fetcher, 1000, cooldowns.get(fetcher)!)
        }
        if (!response.ok) {
          await response.body?.cancel()
          throw new ProviderRequestError('EDHREC unavailable', response.status, retryAt)
        }
        const text = await response.text().catch((error) => {
          if (controller.signal.aborted) throw error
          throw new ProviderRequestError('EDHREC network unavailable')
        })
        return pageSchema.parse(JSON.parse(text))
      },
      controller.signal,
      policy,
      true,
    )
    job = { controller, users: 0, settled: false, promise, expiresAt: Infinity, policy }
    const current = job
    job.promise = promise.then(
      (page) => {
        current.settled = true
        current.expiresAt = Date.now() + 15 * 60_000
        return page
      },
      (error) => {
        current.settled = true
        if (cache.get(key) === current) cache.delete(key)
        throw error
      },
    )
    cache.set(key, job)
    // ponytail: 32 raw page entries per client; use a byte budget if larger pages become common.
    if (cache.size > 32) cache.delete(cache.keys().next().value!)
  }
  return subscribe(job, signal, policy.background)
}

export function fetchEdhrecCommander(slug: string, fetcher: typeof fetch = fetch) {
  return fetchEdhrecPage('commanders', slug, fetcher)
}
