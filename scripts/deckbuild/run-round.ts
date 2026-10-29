import { execFileSync } from 'node:child_process'
import { chmod, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { prepareReview, reviewSchema, validateReview } from './completed-review.ts'
import { digest } from './fixed-suite.ts'
import { assignmentSchema, supervisedStep } from './supervise.ts'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const docs = join(repo, 'docs/agents/deckbuild')
const text = z.string().min(1)
const sha = z.string().regex(/^[a-f0-9]{40}$/)
export const roundSchema = z.strictObject({
  specIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  repeats: z.number().int().min(1).max(100),
  reviewRepeats: z.number().int().min(1).max(10).default(1),
  model: z.strictObject({
    builder: z.record(z.string(), z.unknown()),
    reviewer: z.record(z.string(), z.unknown()),
  }),
  seed: text,
  knowledgeBaseCommit: sha,
  references: z.strictObject({ rules: text, 'format-policy': text }),
  assignment: assignmentSchema,
  cases: z.record(
    z.string(),
    z.strictObject({
      specPath: text,
      split: z.enum(['development', 'holdout']),
      inputsPath: text,
      manifest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
})
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n'
const load = async (p: string): Promise<unknown> => JSON.parse(await readFile(p, 'utf8'))
async function outsideCheckout(output: string) {
  const parent = await realpath(dirname(resolve(output)))
  const rel = relative(repo, join(parent, resolve(output).split(/[\\/]/).at(-1)!))
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error('Output must be outside checkout')
}

/** Creates an operator queue; fresh agent sessions are deliberately operator-launched. */
export async function planRound(value: unknown, output: string) {
  const config = roundSchema.parse(value)
  if (new Set(config.specIds).size !== config.specIds.length) throw new Error('Duplicate spec IDs')
  await outsideCheckout(output)
  const mainSha = execFileSync('git', ['rev-parse', 'origin/main'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()
  const executingSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()
  const hashes: Record<string, string> = {}
  for (const name of ['builder.md', 'reviewer.md', 'rubric.md'])
    hashes[name] = digest(await readFile(join(docs, name)))
  for (const [name, path] of Object.entries(config.references))
    hashes[name] = digest(await readFile(path))
  const jobs = []
  for (const id of config.specIds) {
    const source = config.cases[id]
    if (!source) throw new Error(`Missing case ${id}`)
    const spec = await readFile(source.specPath, 'utf8')
    const inputs = await readFile(source.inputsPath, 'utf8')
    const pins = JSON.parse(inputs) as { seed?: string; spec?: unknown }
    if (pins.seed !== config.seed || JSON.stringify(pins.spec) !== JSON.stringify(JSON.parse(spec)))
      throw new Error(`Spec/seed mismatch: ${id}`)
    hashes[id] = digest(spec)
    hashes[`${id}:inputs`] = digest(inputs)
    for (let repeat = 1; repeat <= config.repeats; repeat++)
      jobs.push({ id, repeat, ...source, inputs, spec })
  }
  await mkdir(output)
  for (const job of jobs) {
    const dir = join(output, `${job.id}-${job.repeat}`)
    await mkdir(dir)
    await writeFile(join(dir, 'inputs.json'), job.inputs, { flag: 'wx' })
    await writeFile(join(dir, 'assignment.json'), json(config.assignment), { flag: 'wx' })
    await writeFile(join(dir, 'commands.jsonl'), '', { flag: 'wx' })
  }
  const record = {
    version: 1,
    mainSha,
    executingSha,
    hashes,
    config,
    agentLaunch:
      'operator: fresh builder per job; submit commands through supervise.ts start/extend',
    jobs: jobs.map(({ inputs: _inputs, spec: _spec, ...job }) => ({
      ...job,
      directory: join(output, `${job.id}-${job.repeat}`),
      reviews: Array.from({ length: config.reviewRepeats }, (_, index) => ({
        reviewRepeat: index + 1,
        status: 'awaiting-completed-deck',
      })),
    })),
  }
  await writeFile(join(output, 'round.json'), json(record), { flag: 'wx' })
  return record
}

/** Allowlist only: no source directory copying, provenance or operator metadata. */
export async function reviewBundle(
  input: unknown,
  references: { rules: string; 'format-policy': string },
  output: string,
) {
  const prepared = prepareReview(input)
  if (prepared.status !== 'ready') throw new Error(`Deck is ${prepared.status}`)
  await outsideCheckout(output)
  const files: Record<string, string> = {
    'bundle.json': json(prepared),
    'deck.txt': prepared.bundle.deck,
    'review.schema.json': json(z.toJSONSchema(reviewSchema)),
    'reviewer.md': await readFile(join(docs, 'reviewer.md'), 'utf8'),
    'rubric.md': await readFile(join(docs, 'rubric.md'), 'utf8'),
  }
  for (const name of ['rules', 'format-policy'] as const)
    files[`${name}.md`] = await readFile(references[name], 'utf8')
  await mkdir(output)
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(output, name), content, { flag: 'wx' })
    await chmod(join(output, name), 0o444)
  }
  await chmod(output, 0o555)
  return {
    bundleHash: prepared.bundleHash,
    hashes: Object.fromEntries(Object.entries(files).map(([n, v]) => [n, digest(v)])),
  }
}

const bundleFiles = [
  'bundle.json',
  'deck.txt',
  'format-policy.md',
  'review.schema.json',
  'reviewer.md',
  'rubric.md',
  'rules.md',
]
export async function runIsolatedReview(bundle: string, image: string) {
  const names = (await readdir(bundle)).sort()
  if (JSON.stringify(names) !== JSON.stringify(bundleFiles))
    throw new Error('Unexpected bundle files')
  for (const name of names) {
    if (!(await lstat(join(bundle, name))).isFile())
      throw new Error('Bundle files must be regular files')
  }
  const prepared = (await load(join(bundle, 'bundle.json'))) as ReturnType<typeof prepareReview>
  if (prepared.status !== 'ready') throw new Error('Bundle is not ready')
  const input = { spec: prepared.bundle.spec, cards: prepared.bundle.oracle }
  const checked = prepareReview(input)
  if (json(checked) !== json(prepared)) throw new Error('Bundle contains unapproved data')
  const result = execFileSync('docker', isolatedReviewArgs(await realpath(bundle), image), {
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 1024 * 1024,
  })
  return validateReview(input, JSON.parse(result))
}

/** Offline reviewer image must contain its model/runtime. No host credentials or checkout mounts. */
export function isolatedReviewArgs(bundle: string, image: string) {
  if (!/^sha256:[a-f0-9]{64}$/.test(image))
    throw new Error('Pin reviewer image by local image digest')
  if (/[,:]/.test(resolve(bundle).replace(/^[A-Za-z]:/, ''))) throw new Error('Invalid mount path')
  return [
    'run',
    '--rm',
    '--pull=never',
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pids-limit=128',
    '--memory=4g',
    '--cpus=2',
    '--user=65534:65534',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=64m',
    '--mount',
    `type=bind,source=${resolve(bundle)},target=/review,readonly`,
    '--workdir=/review',
    image,
  ]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, input, output, extra] = process.argv.slice(2)
    if (mode === 'plan' && input && output)
      console.log(json(await planRound(await load(input), output)))
    else if (mode === 'bundle' && input && output && extra)
      console.log(
        json(
          await reviewBundle(
            await load(input),
            z.strictObject({ rules: text, 'format-policy': text }).parse(await load(extra)),
            output,
          ),
        ),
      )
    else if (mode === 'start' && input) console.log(json(await supervisedStep(input)))
    else if (mode === 'extend' && input && output)
      console.log(json(await supervisedStep(input, output)))
    else if (mode === 'validate' && input && output)
      console.log(json(validateReview(await load(input), await load(output))))
    else if (mode === 'review' && input && output) {
      // No host-launch fallback when the engine or offline reviewer image is unavailable.
      console.log(json(await runIsolatedReview(input, output)))
    } else
      throw new Error(
        'Usage: run-round.ts plan config.json new-dir | bundle completed-input.json new-dir references.json | review bundle-dir sha256:image',
      )
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}
