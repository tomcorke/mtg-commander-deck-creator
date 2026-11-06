import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { canonical } from '../deckbuild/data.ts'
import { retryTime } from '../../src/adapters/request-scheduler.ts'

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const entrySchema = z.object({
  version: z.literal(1),
  url: z.string(),
  method: z.string(),
  body: z.string(),
  status: z.number().int().min(200).max(599),
  type: z.string(),
  bytes: z.string(),
  digest: z.string(),
  recordedAt: z.string(),
})
export class ReplayError extends Error {
  status: number
  constructor(message: string, status = 412) {
    super(message)
    this.status = status
  }
}

export function approvedRequest(url: URL, method: string, body: string) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
    throw new ReplayError('Unsupported provider URL', 400)
  if (url.hostname === 'api.scryfall.com') return approvedApi(url, method, body)
  if (method === 'GET' && !body) {
    if (
      url.hostname === 'svgs.scryfall.io' &&
      /^\/(card-symbols|sets)\/[a-z0-9_-]+\.svg$/i.test(url.pathname)
    )
      return 'image/svg+xml'
    if (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') return 'text/css'
    if (
      url.hostname === 'fonts.gstatic.com' &&
      /^\/s\/[a-z0-9/_-]+\.(woff2?|ttf)$/i.test(url.pathname)
    )
      return 'font/'
  }
  throw new ReplayError('Unsupported provider endpoint or method', 400)
}

function approvedApi(url: URL, method: string, body: string) {
  if (url.searchParams.has('format') && url.searchParams.get('format') !== 'json')
    throw new ReplayError('Only JSON API responses can be recorded', 400)
  if (method === 'POST' && url.pathname === '/cards/collection') {
    z.object({
      identifiers: z
        .array(
          z
            .object({
              name: z.string().max(300).optional(),
              oracle_id: z.string().max(100).optional(),
              set: z.string().max(20).optional(),
              collector_number: z.string().max(100).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(75),
    })
      .strict()
      .parse(JSON.parse(body))
    return 'application/json'
  }
  if (
    method === 'GET' &&
    (/^\/cards\/(search|named|[a-f0-9-]{36}|[a-z0-9]+\/[a-z0-9-]+)$/i.test(url.pathname) ||
      ['/sets', '/symbology', '/catalog/creature-types'].includes(url.pathname))
  )
    return 'application/json'

  throw new ReplayError('Unsupported API endpoint or method', 400)
}

function liveDownload(stats: { upstream: number }, upstream: typeof fetch) {
  let tail = Promise.resolve(),
    lastDispatch = 0,
    cooldownUntil = 0

  return async function download(url: URL, method: string, body: string, type: string) {
    const previous = tail
    let release!: () => void
    tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      if (cooldownUntil > Date.now()) throw new ReplayError('Provider cooling down', 429)
      await delay(Math.max(0, lastDispatch + 500 - Date.now()))
      lastDispatch = Date.now()
      stats.upstream++
      const response = await upstream(url, {
        method,
        body: body || undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: type === 'font/' ? '*/*' : type,
          ...(body && { 'Content-Type': 'application/json' }),
          'User-Agent':
            'CommanderCreator-DevReplay/1.0 (https://github.com/tomcorke/mtg-commander-deck-creator)',
        },
      })
      if (
        response.status === 429 ||
        (response.status >= 500 && response.headers.has('Retry-After'))
      )
        cooldownUntil = Math.max(Date.now() + 30_000, retryTime(response).retryAt)
      return response
    } finally {
      release()
    }
  }
}

const datedRelease = /date<=\d{4}-\d{2}-\d{2}/g
/** Keys date-bounded searches by `date<=today` so recordings replay after the day changes. */
export function replayKeyUrl(url: URL) {
  const dated = [...url.searchParams].filter(([, value]) => value.match(datedRelease))
  if (!dated.length) return url.href
  const keyed = new URL(url)
  for (const [name, value] of dated)
    keyed.searchParams.set(name, value.replace(datedRelease, 'date<=today'))
  return keyed.href
}

export function createReplayStore(directory: string, mode: 'record' | 'replay', upstream = fetch) {
  const pending = new Map<string, Promise<Response>>()
  const stats = { hits: 0, misses: 0, upstream: 0 }
  const download = liveDownload(stats, upstream)

  async function load(
    url: URL,
    keyUrl: string,
    method: string,
    body: string,
    type: string,
    key: string,
  ) {
    const file = join(directory, `${key}.json`)
    try {
      const entry = entrySchema.parse(JSON.parse(await readFile(file, 'utf8')))
      const bytes = Buffer.from(entry.bytes, 'base64')
      if (
        entry.url !== keyUrl ||
        entry.method !== method ||
        entry.body !== body ||
        hash(bytes) !== entry.digest
      )
        throw new ReplayError(`Corrupt replay entry: ${key}`)
      stats.hits++
      return new Response(bytes, {
        status: entry.status,
        headers: { 'Content-Type': entry.type, 'X-Dev-Replay': 'hit' },
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    stats.misses++
    if (mode === 'replay') throw new ReplayError(`DEV_REPLAY_MISS ${method} ${url.href} ${key}`)
    const response = await download(url, method, body, type)
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok && response.status !== 404) return response
    if (!contentType.startsWith(type))
      throw new ReplayError('Unexpected provider content type', 502)
    const bytes = await readBounded(response, 32 * 1024 * 1024)
    if (type === 'application/json') JSON.parse(bytes.toString('utf8'))
    const entry = {
      version: 1,
      url: keyUrl,
      method,
      body,
      status: response.status,
      type: contentType,
      bytes: bytes.toString('base64'),
      digest: hash(bytes),
      recordedAt: new Date().toISOString(),
    }
    await mkdir(directory, { recursive: true })
    const temporary = `${file}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(entry))
    await rename(temporary, file)
    return new Response(bytes, {
      status: response.status,
      headers: { 'Content-Type': contentType, 'X-Dev-Replay': 'recorded' },
    })
  }

  return {
    stats,
    async request(url: URL, method = 'GET', body = '') {
      const type = approvedRequest(url, method, body)
      const normalized = body ? canonical(JSON.parse(body)) : ''
      const keyUrl = replayKeyUrl(url)
      const key = hash(JSON.stringify([1, method, keyUrl, normalized]))
      let result = pending.get(key)
      if (!result) {
        result = load(url, keyUrl, method, normalized, type, key).finally(() => pending.delete(key))
        pending.set(key, result)
      }
      return (await result).clone()
    },
  }
}

export async function readBounded(response: Response, limit: number) {
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for await (const chunk of response.body ?? []) {
      size += chunk.byteLength
      if (size > limit) throw new ReplayError('Provider response too large', 502)
      chunks.push(chunk)
    }
  } catch (error) {
    await response.body?.cancel().catch(() => undefined)
    throw error
  }
  return Buffer.concat(chunks)
}
