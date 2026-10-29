import { spawn } from 'node:child_process'
import { appendFileSync, constants, createWriteStream, existsSync } from 'node:fs'
import { copyFile, open, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { limitsSchema } from './builder-contract.ts'
import { digest, type Json, type Outcome } from './data.ts'
import { checkStoreDirectory, parseCommands } from './recommend.ts'

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cli = join(checkout, 'scripts/deckbuild/recommend.ts')
const bytes = z
  .number()
  .int()
  .min(1)
  .max(256 * 1024 * 1024)
const attempts = z.number().int().min(0).max(100)
/** Written by the operator before any builder command; extra provenance fields are kept but unused. */
export const assignmentSchema = z.object({
  commands: limitsSchema.shape.commands.min(1),
  batches: limitsSchema.shape.batches,
  subprocessMs: limitsSchema.shape.runtimeMs,
  extensions: attempts,
  providerAttemptsPerExtension: attempts,
  stdoutBytes: bytes,
  stderrBytes: bytes,
  deadline: z.iso.datetime(),
})
type Assignment = z.infer<typeof assignmentSchema>
type State = {
  assignment: string
  extensions: number
  manifest: string
  log: string
  entries: number
}

/** Transport failures, rate limits and server errors are settled provider failures; other HTTP answers are data. */
export function providerBreach(outcomes: Outcome[], cap: number) {
  if (outcomes.length > cap) return `provider attempts ${outcomes.length} exceed ${cap}`
  const index = outcomes.findIndex((outcome) => {
    if (outcome.status === 'failure') return true
    const status = (outcome.value as { status?: unknown } | null)?.status
    return typeof status === 'number' && (status === 429 || status >= 500)
  })
  return index < 0 ? null : `provider failure at new attempt ${index + 1}`
}

/** Rejects fetch calls past the cap before any network I/O; the CLI records them as failure outcomes. */
export const fetchCap = (cap: number) =>
  `data:text/javascript,let n=0,dead=false;const f=globalThis.fetch;globalThis.fetch=async(...a)=>{if(dead||++n>${cap}){dead=true;throw new Error('Supervised fetch cap')}try{const r=await f(...a);if(r.status===429||r.status>=500)dead=true;return r}catch(e){dead=true;throw e}}`

class Breach extends Error {}

async function run(dir: string, a: Assignment, name: string, args: string[], fetches: number) {
  const started = Date.now()
  const remaining = Date.parse(a.deadline) - started
  if (remaining <= 0) throw new Breach(`deadline passed before ${name}`)
  const files = { stdout: join(dir, `${name}.json`), stderr: join(dir, `${name}.stderr`) }
  const out = createWriteStream(files.stdout, { flags: 'wx' })
  const err = createWriteStream(files.stderr, { flags: 'wx' })
  const child = spawn(
    process.execPath,
    ['--import', fetchCap(fetches), '--experimental-strip-types', cli, ...args],
    {
      cwd: checkout,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: Math.min(a.subprocessMs, remaining),
    },
  )
  const counts = { stdout: 0, stderr: 0 }
  let breach = ''
  const streams = [
    ['stdout', out, a.stdoutBytes],
    ['stderr', err, a.stderrBytes],
  ] as const
  for (const [key, stream] of streams)
    stream.on('error', () => {
      breach ||= `${key} write failed`
      child.kill()
    })
  for (const [key, stream, cap] of streams)
    child[key].on('data', (chunk: Buffer) => {
      const before = counts[key]
      counts[key] += chunk.length
      if (before < cap) stream.write(chunk.subarray(0, cap - before))
      if (counts[key] > cap && !breach) {
        breach = `${key} exceeded ${cap} bytes`
        child.kill()
      }
    })
  const exit = await new Promise<{ code: number | null; signal: string | null; error?: string }>(
    (done) => {
      child.on('error', (error) => done({ code: null, signal: null, error: String(error) }))
      child.on('close', (code, signal) => done({ code, signal }))
    },
  )
  await Promise.all(
    [out, err].map(
      (stream) =>
        new Promise<void>((done) => {
          if (stream.destroyed || stream.writableFinished) return done()
          stream.once('error', () => done())
          stream.once('finish', () => done())
          stream.end()
        }),
    ),
  )
  if (!breach && exit.signal) breach = `${name} killed by ${exit.signal} (timeout or external)`
  appendFileSync(
    join(dir, 'ledger.jsonl'),
    `${JSON.stringify({ name, args, fetches, started: new Date(started).toISOString(), ended: new Date().toISOString(), ...exit, ...counts, breach: breach || null })}\n`,
  )
  if (breach) throw new Breach(breach)
  if (exit.code !== 0) throw new Breach(`${name} exited ${exit.code ?? exit.error}`)
  const report = JSON.parse(await readFile(files.stdout, 'utf8'))
  if (report.status !== 'complete') throw new Breach(`${name} status ${report.status}`)
  return report as { manifest: string }
}

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

async function newOutcomes(dir: string, manifest: string, previous: number) {
  const { entries } = (await readJson(join(dir, 'manifests', `${manifest}.json`))) as {
    entries: { response: string }[]
  }
  return Promise.all(
    entries
      .slice(previous)
      .map(({ response }) => readJson(join(dir, 'responses', `${response}.json`))),
  ).then((outcomes) => ({ outcomes: outcomes as Outcome[], entries: entries.length }))
}

/** Files are written exclusively so every submitted command log stays immutable evidence. */
async function launchArgs(dir: string, a: Assignment, prior: State | null, appendPath?: string) {
  if (!prior) {
    const log = 'commands.jsonl'
    const limits = { commands: a.commands, batches: a.batches, runtimeMs: a.subprocessMs }
    await writeFile(join(dir, 'limits.json'), JSON.stringify(limits), { flag: 'wx' })
    const args = ['record', dir, join(dir, 'inputs.json'), join(dir, log), join(dir, 'limits.json')]
    return { name: 'record', log, args, extensions: 0 }
  }
  const extensions = prior.extensions + 1
  if (extensions > a.extensions) throw new Breach(`extension ${extensions} exceeds ${a.extensions}`)
  const log = `commands-${extensions}.jsonl`
  const append = join(dir, `append-${extensions}.jsonl`)
  await copyFile(appendPath!, append, constants.COPYFILE_EXCL)
  const combined = `${(await readFile(join(dir, prior.log), 'utf8')).trimEnd()}
${await readFile(append, 'utf8')}`
  await writeFile(join(dir, log), combined, { flag: 'wx' })
  const args = ['extend', dir, prior.manifest, join(dir, prior.log), append]
  return { name: `extend-${extensions}`, log, args, extensions }
}

/** One supervised step: record (start) or extend, then offline replay equality and provider audit. */
export async function supervisedStep(dir: string, appendPath?: string) {
  checkStoreDirectory(dir)
  const lockPath = join(dir, 'run.lock')
  const lock = await open(lockPath, 'wx')
  try {
    return await lockedStep(dir, appendPath)
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

/** Keeps a refused payload and its diagnostic; the run is not stopped and nothing launches. */
async function rejected(dir: string, text: string, error: unknown) {
  let n = 1
  while (existsSync(join(dir, `rejected-${n}.jsonl`))) n++
  const detail = error instanceof z.ZodError ? z.prettifyError(error) : String(error)
  const message = `Preflight rejected commands (kept as rejected-${n}.jsonl); nothing launched and the run is not stopped. Correct the payload and resubmit. Deck-card payloads (addBasics, addOneBasic, promote) reject recommendation-only fields such as reason; copy the queue card without them.\n${detail}`
  await writeFile(join(dir, `rejected-${n}.jsonl`), text, { flag: 'wx' })
  await writeFile(join(dir, `rejected-${n}.stderr`), `${message}\n`, { flag: 'wx' })
  return new Error(message)
}

async function preflight(dir: string, appendPath?: string) {
  if (existsSync(join(dir, 'stop.json')))
    throw new Error('Run is stopped; start a new run directory')
  const text = await readFile(join(dir, 'assignment.json'), 'utf8')
  const a = assignmentSchema.parse(JSON.parse(text))
  const assignment = digest(text)
  const statePath = join(dir, 'state.json')
  const prior: State | null = existsSync(statePath) ? await readJson(statePath) : null
  if (!appendPath && prior) throw new Error('Run already started')
  if (appendPath && !prior) throw new Error('Run not started')
  if (prior && prior.assignment !== assignment)
    throw new Error('assignment.json changed after start')
  // Pre-launch input mistakes can be corrected; everything inside the try ends the run.
  const commandText = await readFile(appendPath ?? join(dir, 'commands.jsonl'), 'utf8')
  let commands
  try {
    commands = parseCommands(commandText)
  } catch (error) {
    throw await rejected(dir, commandText, error)
  }
  if (appendPath && commands.length === 0) throw new Error('Append requires at least one command')
  if (!prior) await readJson(join(dir, 'inputs.json'))
  return { a, assignment, statePath, prior }
}

async function lockedStep(dir: string, appendPath?: string) {
  const { a, assignment, statePath, prior } = await preflight(dir, appendPath)
  try {
    const { name, log, args, extensions } = await launchArgs(dir, a, prior, appendPath)
    const report = await run(dir, a, name, args, a.providerAttemptsPerExtension)
    const audit = await newOutcomes(dir, report.manifest, prior?.entries ?? 0)
    const failed = providerBreach(audit.outcomes, a.providerAttemptsPerExtension)
    if (failed) throw new Breach(failed)
    const replay = await run(
      dir,
      a,
      `replay-${extensions}`,
      ['replay', dir, report.manifest, join(dir, log)],
      0,
    )
    if (!isDeepStrictEqual(replay, report)) throw new Breach(`replay-${extensions} differs`)
    const state: State = {
      assignment,
      extensions,
      manifest: report.manifest,
      log,
      entries: audit.entries,
    }
    if (existsSync(join(dir, 'stop.json'))) throw new Breach('Run stopped before state commit')
    await writeFile(statePath, JSON.stringify(state))
    return state
  } catch (error) {
    // Any failure after a validated assignment ends the run: no retries, no continuation.
    const detail = error instanceof Error ? error.message : String(error)
    await writeFile(
      join(dir, 'stop.json'),
      JSON.stringify({
        breach: error instanceof Breach,
        detail,
        time: new Date().toISOString(),
      } satisfies Json),
      { flag: 'wx' },
    )
    throw error
  }
}

async function main(args: string[]) {
  const [mode, dir, append] = args
  if (!((mode === 'start' && args.length === 2) || (mode === 'extend' && args.length === 3)))
    throw new Error('Usage: supervise.ts start <run-dir> | extend <run-dir> <append.jsonl>')
  process.stdout.write(`${JSON.stringify(await supervisedStep(dir, append))}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
