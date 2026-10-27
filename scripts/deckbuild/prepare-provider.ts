import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { toCard, toDeckCardFromRecommendation } from '../../src/domain/card-model.ts'
import { preparationSchema, prepareBuild } from './prepare.ts'
import { digest, recordStore, replayStore, type Json, type Pins } from './data.ts'
import { liveProvider, lookupStoredCards, type RequestStore } from './provider.ts'
import { checkStoreDirectory, checkVersion } from './recommend.ts'

export const providerPreparationSchema = preparationSchema.omit({ commanders: true }).extend({
  runtimeMs: z.number().int().min(1).max(600000).default(60000),
})
const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json

async function prepare(pins: Pins, request: RequestStore) {
  if (pins.resolvedOptions !== 'provider-preparation-v1')
    throw new Error('Expected a provider preparation manifest')
  const recipe = providerPreparationSchema.parse(pins.initialState)
  for (const key of [
    'spec',
    'seed',
    'today',
    'snapshotId',
    'sourceVersion',
    'policyVersion',
  ] as const)
    if (digest(json(pins[key])) !== digest(json(recipe[key])))
      throw new Error(`Preparation recipe differs from pins: ${key}`)
  const signal = AbortSignal.timeout(recipe.runtimeMs)
  const result = await lookupStoredCards(recipe.spec.commander, pins, request, signal)
  if (signal.aborted) return { status: 'limit' as const, detail: 'runtime' }
  if (result.status === 'incomplete') return result
  const evidence = result.response
  if (evidence.outcome !== 'success') return { status: 'failed' as const, evidence }
  try {
    // Match names, never response positions: missing identifiers can shift provider results.
    const commanders = recipe.spec.commander.map((name) => {
      const matches = evidence.cards?.filter((card) => card.name === name) ?? []
      if (matches.length !== 1) throw new Error(`Expected exactly one provider commander: ${name}`)
      return toDeckCardFromRecommendation(toCard(matches[0], 'Provider commander lookup'))
    })
    const { runtimeMs: _, ...input } = recipe
    return { status: 'ready' as const, pins: prepareBuild({ ...input, commanders }), evidence }
  } catch (error) {
    return { status: 'invalid' as const, detail: String(error), evidence }
  }
}

export async function recordPreparation(
  root: string,
  input: unknown,
  fetcher: typeof fetch = fetch,
) {
  checkStoreDirectory(root)
  const recipe = providerPreparationSchema.parse(input)
  if (recipe.settings.maxPrice !== recipe.spec.constraints.perCardCap)
    throw new Error('Explicit maxPrice must match spec perCardCap')
  const pins: Pins = {
    spec: json(recipe.spec),
    seed: recipe.seed,
    today: recipe.today,
    snapshotId: recipe.snapshotId,
    sourceVersion: recipe.sourceVersion,
    policyVersion: recipe.policyVersion,
    recommenderVersion: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      encoding: 'utf8',
    }).trim(),
    resolvedOptions: 'provider-preparation-v1',
    initialState: json(recipe),
  }
  const store = recordStore(root, pins)
  const provider = liveProvider(fetcher)
  const output = await prepare(pins, async (request, signal) => ({
    status: 'complete',
    outcome: await store.request(request, (descriptor) => provider(descriptor, signal)),
  }))
  return { ...output, manifest: await store.finish() }
}

export async function replayPreparation(root: string, manifest: string) {
  checkStoreDirectory(root)
  const store = await replayStore(root, manifest)
  checkVersion(store.pins)
  const output = await prepare(store.pins, (request) => store.request(request))
  const finished = store.finish()
  return finished.status === 'incomplete'
    ? { status: 'incomplete' as const, detail: finished, manifest }
    : { ...output, manifest }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, root, source] = process.argv.slice(2)
    if (process.argv.length !== 5 || !['record', 'replay'].includes(mode))
      throw new Error(
        'Usage: prepare-provider.ts record <store-dir> <recipe.json> | replay <store-dir> <manifest>',
      )
    const result =
      mode === 'record'
        ? await recordPreparation(root, JSON.parse(await readFile(source, 'utf8')))
        : await replayPreparation(root, source)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.status !== 'ready') process.exitCode = 1
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
