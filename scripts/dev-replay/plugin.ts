import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises'
import { unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import { imageCatalog } from './images.ts'
import { createReplayStore, readBounded, ReplayError } from './store.ts'
import { replayTransform } from './transform.ts'

const cacheHome =
  process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
export const replayCacheDirectory = () =>
  resolve(process.env.DEV_REPLAY_CACHE_DIR || join(cacheHome, 'commander-creator', 'dev-replay-v1'))
const routeUrl = (url: string) => `/__dev-provider?url=${encodeURIComponent(url)}`
const policy =
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'"

async function requestBody(request: IncomingMessage) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > 100_000) throw new ReplayError('Request body too large', 413)
  }
  return body
}

async function pinnedIndex(directory: string, root: string, mode: string) {
  const file = join(directory, 'index.json')
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (mode === 'replay') throw new ReplayError('DEV_REPLAY_MISS local index: run dev:record first')
  let index: unknown = null
  for (const source of [
    join(root, 'public/local-card-index.json'),
    join(cacheHome, 'commander-creator/card-index/local-card-index.json'),
  ]) {
    try {
      index = JSON.parse(await readFile(source, 'utf8'))
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  await writeFile(file, JSON.stringify(index))
  return index
}

export function devReplay(mode: 'record' | 'replay'): Plugin {
  let lockFile: string | undefined
  const interrupt = () => {
    if (lockFile) unlinkSync(lockFile)
    process.exit(130)
  }
  return {
    name: 'dev-provider-replay',
    apply: 'serve',
    enforce: 'pre',
    async closeBundle() {
      process.off('SIGINT', interrupt)
      if (lockFile) await unlink(lockFile)
      lockFile = undefined
    },
    transform(code, id) {
      const path = id.replaceAll('\\', '/').split('/src/')[1]
      if (path && /\.[jt]sx?$/.test(path) && !path.endsWith('.test.ts'))
        return replayTransform(code, path)
    },
    async configureServer(server) {
      const directory = replayCacheDirectory()
      await mkdir(directory, { recursive: true })
      if (mode === 'record') {
        const file = join(directory, 'recorder.lock')
        const lock = await open(file, 'wx').catch(() => {
          throw new Error(
            `Recorder already owns ${file}. Verify its process stopped before removing a stale lock.`,
          )
        })
        await lock.writeFile(String(process.pid))
        await lock.close()
        lockFile = file
        process.once('SIGINT', interrupt)
      }
      const catalog = imageCatalog()
      const index = await pinnedIndex(directory, server.config.root, mode)
      catalog.remember(index)
      const store = createReplayStore(join(directory, 'requests'), mode)
      const stats = { placeholders: 0, fixtures: 0, failures: 0 }
      const fixture = await edhrecFixture(server.config.root)
      console.info(`[dev-replay] ${mode} ${directory}; EDHREC synthetic; no card scans`)
      server.middlewares.use(async (request, response, next) => {
        response.setHeader('Content-Security-Policy', policy)
        const incoming = new URL(request.url ?? '/', 'http://localhost')
        if (
          !['/__dev-provider', '/__dev-replay/status', '/local-card-index.json'].includes(
            incoming.pathname,
          )
        )
          return next()
        try {
          if (request.headers['sec-fetch-site'] === 'cross-site')
            throw new ReplayError('Same-origin development requests only', 403)
          const method = request.method ?? 'GET'
          if (!['GET', 'POST'].includes(method)) throw new ReplayError('Unsupported method', 405)
          if (incoming.pathname === '/__dev-replay/status') {
            response.setHeader('Content-Type', 'application/json')
            return response.end(JSON.stringify({ mode, ...store.stats, ...stats }))
          }
          if (incoming.pathname === '/local-card-index.json') {
            response.statusCode = index ? 200 : 404
            response.setHeader('Content-Type', 'application/json')
            return response.end(JSON.stringify(index))
          }
          const url = new URL(incoming.searchParams.get('url') ?? '')
          const result = await providerResponse(url, method, await requestBody(request), {
            catalog,
            store,
            stats,
            fixture,
          })
          response.statusCode = result.status
          response.setHeader('Content-Type', result.headers.get('content-type') ?? 'text/plain')
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('X-Dev-Replay', result.headers.get('x-dev-replay') ?? 'upstream-error')
          for (const header of ['retry-after', 'date']) {
            const value = result.headers.get(header)
            if (value) response.setHeader(header, value)
          }
          response.end(Buffer.from(await result.arrayBuffer()))
        } catch (error) {
          stats.failures++
          console.error('[dev-replay]', String(error))
          response.statusCode = error instanceof ReplayError ? error.status : 502
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: String(error) }))
        }
      })
    },
  }
}

// Vite inlines nested CSS imports before its post transforms, including base.css's font import.
export function devReplayFonts(): Plugin {
  return {
    name: 'dev-replay-fonts',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (id.split('?')[0].endsWith('.css'))
        return code.replace(/https:\/\/fonts\.googleapis\.com\/[^'"\\)\s]+/g, routeUrl)
    },
  }
}

type ProviderContext = {
  catalog: ReturnType<typeof imageCatalog>
  store: ReturnType<typeof createReplayStore>
  stats: { placeholders: number; fixtures: number }
  fixture: object
}
async function providerResponse(url: URL, method: string, body: string, context: ProviderContext) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new ReplayError('Unsupported provider URL', 400)
  if (
    method === 'GET' &&
    (url.hostname === 'cards.scryfall.io' ||
      (url.hostname === 'api.scryfall.com' &&
        url.pathname.startsWith('/cards/') &&
        url.searchParams.get('format') === 'image'))
  ) {
    context.stats.placeholders++
    return new Response(context.catalog.svg(url), {
      headers: { 'Content-Type': 'image/svg+xml', 'X-Dev-Replay': 'placeholder' },
    })
  }
  if (
    method === 'GET' &&
    url.hostname === 'json.edhrec.com' &&
    /^\/pages\/(cards|commanders)\/[a-z0-9-]+\.json$/.test(url.pathname)
  ) {
    context.stats.fixtures++
    return Response.json(context.fixture, { headers: { 'X-Dev-Replay': 'fixture' } })
  }
  const result = await context.store.request(url, method, body)
  const type = result.headers.get('content-type') ?? ''
  if (type.startsWith('application/json')) context.catalog.remember(await result.clone().json())
  if (type.startsWith('text/css')) {
    const css = (await readBounded(result, 1024 * 1024)).toString('utf8')
    return new Response(css.replace(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g, routeUrl), {
      headers: result.headers,
    })
  }
  return result
}

async function edhrecFixture(root: string) {
  const convention = await readFile(join(root, 'docs/agents/design-conventions.md'), 'utf8')
  const names = [
    ...new Set([...convention.matchAll(/^\d+ (.+)$/gm)].map((match) => match[1].trim())),
  ]
  return {
    container: {
      json_dict: {
        cardlists: [
          {
            header: 'Development fixture',
            tag: 'highsynergycards',
            cardviews: names.map((name) => ({ name })),
          },
        ],
      },
    },
  }
}
