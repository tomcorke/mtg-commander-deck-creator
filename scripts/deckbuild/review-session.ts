import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { prepareReview, reviewSchema, validateReview } from './completed-review.ts'
import { digest, type Json } from './data.ts'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const docs = join(repo, 'docs/agents/deckbuild')
const text = z.string().min(1)
const configSchema = z.strictObject({
  today: z.iso.date(),
  knowledgeBaseCommit: z.string().regex(/^[a-f0-9]{40}$/),
  sourceVersion: text,
  references: z
    .array(
      z.strictObject({
        kind: z.enum(['rules', 'format-policy']),
        path: text.refine(isAbsolute, 'Use absolute reference paths'),
      }),
    )
    .length(2)
    .refine(
      (refs) => new Set(refs.map((r) => r.kind)).size === 2,
      'Supply rules and format-policy references',
    ),
})
const isolation = 'best-effort' as const
const target = {
  providerInstanceId: 'codex',
  model: 'gpt-6.1-sol',
  options: { reasoningEffort: 'low' },
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const hash = (value: unknown) => digest(value as Json)
const load = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'))
const within = (parent: string, child: string) => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export async function stageReview(input: unknown, configValue: unknown, output: string) {
  const config = configSchema.parse(configValue)
  const prepared = prepareReview(input)
  if (prepared.status !== 'ready') throw new Error(`Deck is ${prepared.status}: ${json(prepared)}`)
  const outputPath = resolve(output)
  // Resolve the existing parent so a symlink cannot put private research in the checkout.
  const parent = await realpath(dirname(outputPath))
  if (within(repo, resolve(parent, relative(dirname(outputPath), outputPath))))
    throw new Error('Keep session output outside the checkout')
  const files: Record<string, string> = {
    'bundle.json': json(prepared),
    'reviewer.md': await readFile(join(docs, 'reviewer.md'), 'utf8'),
    'rubric.md': await readFile(join(docs, 'rubric.md'), 'utf8'),
    'session.md': await readFile(join(docs, 'session.md'), 'utf8'),
    'review.schema.json': json(z.toJSONSchema(reviewSchema)),
  }
  for (const reference of config.references)
    files[`${reference.kind}.md`] = await readFile(reference.path, 'utf8')
  await mkdir(outputPath) // New private directory only: never overwrite another run.
  const stagePath = await mkdtemp(join(tmpdir(), 'deck-review-'))
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(stagePath, name), contents, { flag: 'wx' })
    await chmod(join(stagePath, name), 0o444)
  }
  const task = [
    'Review only the supplied completed deck in a fresh session. Isolation is best-effort, not OS-enforced.',
    `Read only these approved files in ${stagePath}: ${Object.keys(files).join(', ')}.`,
    'Read session.md first, then reviewer.md, rubric.md, the contract, bundle and references.',
    'Do not list or read any other directory, use skills, browse, search, use connectors, inspect threads,',
    'read builder files, recommendation data or other reviews, or launch helpers. No network lookups.',
    `Forbidden directories: every directory outside ${stagePath}, including app and knowledge-base checkouts,`,
    'skill directories, operator records, builder artifacts and other review directories. Do not resolve source pointers.',
    'Return only the JSON envelope specified in session.md. Do not write files or run project commands.',
  ].join('\n')
  const launch = {
    clientRequestId: `deck-review-${hash(task)}`,
    role: 'general',
    mode: 'async',
    isolation: 'shared',
    target,
    task,
  } as const
  const record = {
    version: 1,
    isolation,
    config,
    stagePath,
    bundleHash: prepared.bundleHash,
    hashes: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, hash(value)])),
    launch,
  }
  await writeFile(join(outputPath, 'input.json'), json(input), { flag: 'wx' })
  await writeFile(join(outputPath, 'operator.json'), json(record), { flag: 'wx' })
  return { isolation, operatorPath: join(outputPath, 'operator.json'), launch }
}

const receiptSchema = z.object({
  taskId: text,
  status: z.enum(['completed', 'failed', 'cancelled', 'interrupted']),
  providerInstanceId: z.literal('codex'),
  model: z.literal('gpt-6.1-sol'),
  options: z.array(z.object({ id: text, value: z.union([z.string(), z.boolean()]) })),
  summary: z.string().nullable(),
})
const envelopeSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('completed'),
    review: reviewSchema,
    isolation: z.literal('best-effort'),
    contamination: z.literal('none-observed'),
    ambientContext: z.array(text),
  }),
  z.strictObject({ status: z.literal('contaminated'), detail: text }),
])
const recordSchema = z.object({
  version: z.literal(1),
  isolation: z.literal('best-effort'),
  config: configSchema,
  stagePath: text,
  bundleHash: text,
  hashes: z.record(z.string(), text),
})

export async function finishReview(output: string, receiptValue: unknown) {
  const outputPath = resolve(output)
  const record = recordSchema.parse(await load(join(outputPath, 'operator.json')))
  const receipt = receiptSchema.parse(receiptValue)
  const effort = receipt.options.filter((o) => o.id === 'reasoningEffort')
  if (effort.length !== 1 || effort[0].value !== 'low')
    throw new Error('Receipt must verify reasoningEffort low')
  const actual = (await readdir(record.stagePath)).sort()
  if (json(actual) !== json(Object.keys(record.hashes).sort()))
    throw new Error('Staged file set changed')
  for (const [name, expected] of Object.entries(record.hashes)) {
    if (name !== name.split(/[\\/]/).pop()) throw new Error('Invalid staged filename')
    const path = join(record.stagePath, name)
    if (!(await lstat(path)).isFile() || hash(await readFile(path, 'utf8')) !== expected)
      throw new Error(`Staged file changed: ${name}`)
  }
  const input = await load(join(outputPath, 'input.json'))
  const prepared = prepareReview(input)
  if (prepared.status !== 'ready' || prepared.bundleHash !== record.bundleHash)
    throw new Error('Private deck input changed')
  if (json(prepared) !== (await readFile(join(record.stagePath, 'bundle.json'), 'utf8')))
    throw new Error('Staged bundle differs from private input')
  let result: Record<string, unknown> = {
    isolation,
    receipt,
    bundleHash: record.bundleHash,
    hashes: record.hashes,
    config: record.config,
    status: 'failed',
  }
  if (receipt.status === 'completed') {
    if (!receipt.summary) throw new Error('Completed task has no result')
    const envelope = envelopeSchema.parse(JSON.parse(receipt.summary))
    if (envelope.status === 'contaminated') result = { ...result, ...envelope }
    else {
      const validated = validateReview(input, envelope.review)
      result = {
        ...result,
        status: 'completed',
        contamination: envelope.contamination,
        ambientContext: envelope.ambientContext,
        review: validated.review,
        markdown:
          'Isolation: best-effort; no evaluation contamination reported. Access restrictions were instructions, not enforced.\n' +
          `Ambient context reported: ${envelope.ambientContext.join('; ') || 'none'}.\n\n` +
          validated.markdown,
      }
    }
  }
  // A single exclusive result contains the aligned JSON review and Markdown; no partial outputs.
  await writeFile(join(outputPath, 'result.json'), json(result), { flag: 'wx' })
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, inputPath, configPath, outputPath] = process.argv.slice(2)
    let result: unknown
    if (command === 'stage' && inputPath && configPath && outputPath)
      result = await stageReview(await load(inputPath), await load(configPath), outputPath)
    else if (command === 'finish' && inputPath && configPath && !outputPath)
      result = await finishReview(inputPath, await load(configPath))
    else
      throw new Error(
        'Usage: review-session.ts stage input.json config.json new-output-dir | finish output-dir receipt.json',
      )
    process.stdout.write(json(result))
    if (command === 'finish' && (result as { status: string }).status !== 'completed')
      process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
