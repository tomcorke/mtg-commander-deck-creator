import { setTimeout as delay } from 'node:timers/promises'

/** Opt-in live EDHREC policy (#309). See docs/domain/data-sources.md#live-edhrec-recordings. */
export const liveEdhrecPolicy = { maxPages: 50, spacingMs: 1000 } as const
export const liveEdhrecUserAgent =
  'CommanderCreator-LiveEdhrec/1.0 (https://github.com/tomcorke/mtg-commander-deck-creator)'
const policyLink = 'docs/domain/data-sources.md#live-edhrec-recordings'

/** Only `pages/{commanders|cards}/{slug}.json` GETs, with no query, credentials or port. */
export function isEdhrecPage(url: URL, method = 'GET') {
  return (
    method === 'GET' &&
    url.protocol === 'https:' &&
    url.hostname === 'json.edhrec.com' &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash &&
    /^\/pages\/(cards|commanders)\/[a-z0-9-]+\.json$/.test(url.pathname)
  )
}

export class LiveEdhrecError extends Error {}
export const edhrecRefused = (surface: string) =>
  new LiveEdhrecError(
    `Live EDHREC is off: ${surface} refuses EDHREC requests without its opt-in. See ${policyLink}.`,
  )

export type LiveEdhrecRunLog = {
  date: string
  mode: string
  pages: number
  stopReason: string
}
/** One Markdown table row for the run-log table in PRs and evidence docs. */
export const formatRunLog = (log: LiveEdhrecRunLog) =>
  `| ${log.date} | ${log.mode} | ${log.pages}/${liveEdhrecPolicy.maxPages} | ${log.stopReason} |`
export const runLogHeader =
  '| Date (UTC) | Mode | EDHREC pages | Stop reason |\n| --- | --- | --- | --- |'

/** Seconds or an HTTP date (relative to the response's Date); unparseable advice waits a minute. */
function retryAfterMs(value: string, response: Response, now: number) {
  if (/^\d+$/.test(value.trim())) return Number(value) * 1000
  const at = Date.parse(value)
  const server = Date.parse(response.headers.get('Date') ?? '')
  return Number.isFinite(at) ? Math.max(0, at - (Number.isFinite(server) ? server : now)) : 60_000
}

type SessionOptions = {
  /** Names the opt-in surface in the run log, e.g. `dev:record`. */
  mode: string
  fetcher?: typeof fetch
  now?: () => number
  sleep?: (ms: number) => Promise<unknown>
}
export type LiveEdhrecSession = ReturnType<typeof liveEdhrecSession>

/**
 * One run's live EDHREC transport. Requests are serial, spaced at least one second apart, honour
 * Retry-After and stop the run on the page cap or the first 403, 429 or 5xx.
 */
export function liveEdhrecSession({
  mode,
  fetcher = fetch,
  now = Date.now,
  sleep = (ms) => delay(ms),
}: SessionOptions) {
  const date = new Date(now()).toISOString().slice(0, 10)
  let pages = 0
  let lastDispatch = -Infinity
  let cooldownUntil = 0
  let stopReason: string | undefined
  let tail = Promise.resolve()
  const stop = (reason: string, detail: string) => {
    stopReason ??= reason
    return new LiveEdhrecError(`Live EDHREC stopped (${reason}): ${detail}. See ${policyLink}.`)
  }

  async function dispatch(url: URL, init: RequestInit) {
    if (stopReason) throw stop(stopReason, 'this run already stopped')
    if (!isEdhrecPage(url, init.method ?? 'GET'))
      throw new LiveEdhrecError(`Live EDHREC refuses ${init.method ?? 'GET'} ${url.href}`)
    if (pages >= liveEdhrecPolicy.maxPages)
      throw stop('page-cap', `${liveEdhrecPolicy.maxPages} pages already requested this run`)
    const wait = Math.max(lastDispatch + liveEdhrecPolicy.spacingMs, cooldownUntil) - now()
    if (wait > 0) await sleep(wait)
    lastDispatch = now()
    pages++
    const headers = new Headers(init.headers)
    if (!headers.has('User-Agent')) headers.set('User-Agent', liveEdhrecUserAgent)
    const response = await fetcher(url, { ...init, method: 'GET', headers, redirect: 'error' })
    const retryAfter = response.headers.get('Retry-After')
    if (retryAfter)
      cooldownUntil = Math.max(cooldownUntil, now() + retryAfterMs(retryAfter, response, now()))
    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      await response.body?.cancel().catch(() => undefined)
      throw stop(
        `http-${response.status}`,
        `HTTP ${response.status} from ${url.href}${retryAfter ? ` (Retry-After ${retryAfter})` : ''}`,
      )
    }
    return response
  }

  return {
    /** A fetch for EDHREC pages only; any other request or a stopped run throws `LiveEdhrecError`. */
    fetch(input: string | URL, init: RequestInit = {}) {
      const result = tail.then(() => dispatch(new URL(String(input)), init))
      tail = result.then(
        () => {},
        () => {},
      )
      return result
    },
    /** Marks the run finished; the first stop reason wins. */
    finish(reason = 'completed'): LiveEdhrecRunLog {
      stopReason ??= reason
      return { date, mode, pages, stopReason }
    },
    get stopped() {
      return stopReason
    },
    get pages() {
      return pages
    },
  }
}

/** Parses `DEV_REPLAY_EDHREC`; anything but unset, `synthetic` or `live` is a typo, not a default. */
export function edhrecSourceSetting(value: string | undefined) {
  if (!value || value === 'synthetic') return 'synthetic' as const
  if (value === 'live') return 'live' as const
  throw new Error(`DEV_REPLAY_EDHREC must be "synthetic" or "live", not "${value}"`)
}
