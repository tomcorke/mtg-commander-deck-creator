import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

const json: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(json),
    z.record(z.string(), json),
  ]),
)
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const requestSchema = z
  .object({
    provider: z.string().min(1),
    endpoint: z.string().min(1),
    method: z.string().min(1),
    query: json,
    body: json,
    ordering: json,
    pagination: json,
    today: z.iso.date(),
    snapshotId: z.string().min(1),
  })
  .strict()
export type Request = z.infer<typeof requestSchema>
const outcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), value: json }).strict(),
  z.object({ status: z.literal('failure'), kind: z.string().min(1), detail: json }).strict(),
])
export type Outcome = z.infer<typeof outcomeSchema>
const pinsSchema = z
  .object({
    spec: json,
    seed: z.string(),
    resolvedOptions: json,
    initialState: json,
    sourceVersion: z.string().min(1),
    policyVersion: z.string().min(1),
    recommenderVersion: z.string().min(1),
    today: z.iso.date(),
    snapshotId: z.string().min(1),
  })
  .strict()
export type Pins = z.infer<typeof pinsSchema>
const manifestSchema = z
  .object({
    version: z.literal(1),
    pins: pinsSchema,
    entries: z.array(z.object({ request: requestSchema, response: hashSchema }).strict()),
  })
  .strict()
export type Manifest = z.infer<typeof manifestSchema>

/** Object key order is irrelevant; array order (including query pairs) is significant. */
export function canonical(value: Json): string {
  json.parse(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  return JSON.stringify(value)
}
export const digest = (value: Json) => createHash('sha256').update(canonical(value)).digest('hex')
export const requestKey = (request: Request) => digest(requestSchema.parse(request))

async function save(root: string, kind: string, value: Json) {
  const hash = digest(value)
  const directory = join(root, kind)
  await mkdir(directory, { recursive: true })
  const path = join(directory, `${hash}.json`)
  const bytes = canonical(value)
  try {
    await writeFile(path, bytes, { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if ((await readFile(path, 'utf8')) !== bytes) throw new Error(`Corrupt ${kind}: ${hash}`)
  }
  return hash
}

async function load(root: string, kind: string, hash: string) {
  hashSchema.parse(hash)
  const value: Json = json.parse(
    JSON.parse(await readFile(join(root, kind, `${hash}.json`), 'utf8')),
  )
  if (digest(value) !== hash) throw new Error(`Corrupt ${kind}: ${hash}`)
  return value
}

export type ReplayResult =
  | { status: 'complete'; outcome: Outcome }
  | { status: 'incomplete'; occurrence: number; reason: string }

/** One serial run. Provider errors must be deliberately converted to failure outcomes by the caller. */
export function recordStore(root: string, input: Pins) {
  const pins = pinsSchema.parse(input)
  const entries: Manifest['entries'] = []
  let sealed = false
  let busy = false
  return {
    async request(input: Request, provider: (request: Request) => Promise<Outcome>) {
      if (sealed || busy) throw new Error('Recorder is sealed or already processing a request')
      const request = requestSchema.parse(input)
      if (request.today !== pins.today || request.snapshotId !== pins.snapshotId)
        throw new Error('Request does not match pinned date and snapshot')
      busy = true
      try {
        const outcome = outcomeSchema.parse(await provider(structuredClone(request)))
        const response = await save(root, 'responses', outcome)
        entries.push({ request, response })
        return outcome
      } finally {
        busy = false
      }
    },
    async finish() {
      if (busy) throw new Error('Request still processing')
      sealed = true
      return save(root, 'manifests', { version: 1, pins, entries })
    },
  }
}

/** No provider argument exists in replay mode. Missing data permanently stops this replay instance. */
export async function replayStore(root: string, manifestHash: string) {
  const manifest = manifestSchema.parse(await load(root, 'manifests', manifestHash))
  let cursor = 0
  let busy = false
  let stopped: ReplayResult | undefined
  return {
    pins: structuredClone(manifest.pins),
    async request(input: Request): Promise<ReplayResult> {
      if (busy) throw new Error('Replay already processing a request')
      if (stopped) return stopped
      const entry = manifest.entries[cursor]
      if (!entry || requestKey(input) !== requestKey(entry.request)) {
        stopped = {
          status: 'incomplete',
          occurrence: cursor,
          reason: 'Request missing or out of order',
        }
        return stopped
      }
      busy = true
      try {
        const outcome = outcomeSchema.parse(await load(root, 'responses', entry.response))
        cursor++
        return { status: 'complete', outcome }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        stopped = { status: 'incomplete', occurrence: cursor, reason: 'Response missing' }
        return stopped
      } finally {
        busy = false
      }
    },
    finish(): ReplayResult {
      if (busy) throw new Error('Replay still processing a request')
      return (
        stopped ??
        (cursor === manifest.entries.length
          ? { status: 'complete', outcome: { status: 'success', value: null } }
          : { status: 'incomplete', occurrence: cursor, reason: 'Unconsumed manifest entries' })
      )
    },
  }
}
