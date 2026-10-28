import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import {
  toCard,
  toDeckCardFromRecommendation,
  type ScryfallCard,
  type DeckCard,
} from '../../src/domain/card-model.ts'
import { prepareCandidates } from '../../src/domain/recommender.ts'
import { cardConstructionError } from '../../src/domain/commander-construction.ts'
import { preparationSchema, prepareBuild } from './prepare.ts'
import { digest, recordStore, replayStore, type Json, type Pins } from './data.ts'
import {
  StoreError,
  liveProvider,
  lookupStoredCards,
  searchStoredCards,
  type RequestStore,
} from './provider.ts'
import { checkStoreDirectory, checkVersion } from './recommend.ts'
import { retrieveStoredPool } from './pool.ts'
import { initialStateSchema } from './builder-contract.ts'

export const providerPreparationSchema = preparationSchema
  .omit({ commanders: true, pool: true })
  .extend({
    pool: preparationSchema.shape.pool.optional(),
    appPool: z.literal(true).optional(),
    poolSearch: z
      .strictObject({
        query: z.string().trim().min(1).max(2000),
        order: z.enum(['name', 'edhrec', 'released']),
        maxPages: z.number().int().min(1).max(38).default(20),
      })
      .optional(),
    runtimeMs: z.number().int().min(1).max(600000).default(60000),
  })
  .refine(
    (recipe) =>
      [recipe.pool, recipe.poolSearch, recipe.appPool].filter((value) => value !== undefined)
        .length === 1,
    { message: 'Supply exactly one of pool, poolSearch or appPool' },
  )
const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json

async function retrievePool(
  search: NonNullable<z.infer<typeof providerPreparationSchema>['poolSearch']>,
  pins: Pins,
  request: RequestStore,
  signal: AbortSignal,
) {
  const poolEvidence = []
  const cards = []
  for (let page = 1; page <= search.maxPages; page++) {
    const found = await searchStoredCards({ ...search, page }, pins, request, signal)
    if (signal.aborted) return { status: 'limit' as const, detail: 'runtime' }
    if (found.status === 'incomplete') return found
    poolEvidence.push(found.response)
    if (!['success', 'success-empty'].includes(found.response.outcome))
      return { status: 'failed' as const, poolEvidence }
    cards.push(...(found.response.cards ?? []))
    if (
      !z.object({ pagination: z.object({ hasMore: z.boolean() }) }).parse(found.response).pagination
        .hasMore
    )
      break
    if (page === search.maxPages)
      return { status: 'limit' as const, detail: 'pool-pages', poolEvidence }
  }
  return { status: 'complete' as const, cards, poolEvidence }
}

function eligiblePool(
  cards: ScryfallCard[],
  commanders: DeckCard[],
  identity: string[],
  allowedSets: string[],
) {
  return cards
    .filter(
      (card) =>
        !cardConstructionError(toCard(card, 'Provider search pool'), commanders, identity) &&
        (!allowedSets.length || allowedSets.includes(card.set)),
    )
    .map((card) => ({ card, reason: 'Provider search pool' }))
}

// Match names, never response positions: missing identifiers can shift provider results.
function resolveCommanders(names: string[], cards: ScryfallCard[]) {
  return names.map((name) => {
    const matches = cards.filter((card) => card.name === name)
    if (matches.length !== 1) throw new Error(`Expected exactly one provider commander: ${name}`)
    return toDeckCardFromRecommendation(toCard(matches[0], 'Provider commander lookup'))
  })
}

function validateRecipePins(pins: Pins, recipe: z.infer<typeof providerPreparationSchema>) {
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
}

async function prepareAppPool(
  preparedPins: Pins,
  pins: Pins,
  request: RequestStore,
  signal: AbortSignal,
) {
  const retrieved = await retrieveStoredPool(
    initialStateSchema.parse(preparedPins.initialState),
    pins,
    request,
    signal,
  )
  return retrieved.status === 'ready'
    ? { status: 'ready' as const, pins: { ...preparedPins, initialState: json(retrieved.state) } }
    : retrieved
}

async function prepare(pins: Pins, request: RequestStore) {
  if (pins.resolvedOptions !== 'provider-preparation-v1')
    throw new Error('Expected a provider preparation manifest')
  const recipe = providerPreparationSchema.parse(pins.initialState)
  validateRecipePins(pins, recipe)
  const signal = AbortSignal.timeout(recipe.runtimeMs)
  const result = await lookupStoredCards(recipe.spec.commander, pins, request, signal)
  if (signal.aborted) return { status: 'limit' as const, detail: 'runtime' }
  if (result.status === 'incomplete') return result
  const evidence = result.response
  if (evidence.outcome !== 'success') return { status: 'failed' as const, evidence }
  try {
    const commanders = resolveCommanders(recipe.spec.commander, evidence.cards ?? [])
    const { runtimeMs: _, poolSearch, appPool, ...input } = recipe
    if (appPool) {
      const preparedPins = prepareBuild({ ...input, commanders, pool: [] })
      return { ...(await prepareAppPool(preparedPins, pins, request, signal)), evidence }
    }
    let pool = recipe.pool ?? []
    const poolEvidence = []
    if (poolSearch) {
      const retrieved = await retrievePool(poolSearch, pins, request, signal)
      if (retrieved.status !== 'complete') return { ...retrieved, evidence }
      const { cards } = retrieved
      poolEvidence.push(...retrieved.poolEvidence)
      const identity = [...new Set(commanders.flatMap((card) => card.colorIdentity ?? []))]
      const eligible = eligiblePool(
        cards,
        commanders,
        identity,
        recipe.spec.constraints.allowedSets,
      )
      const prepared = prepareCandidates(
        { fallback: { main: { cards: eligible }, mana: { cards: [] } } },
        {
          ...recipe.settings,
          identity,
          collectionMode: 'none',
          collectionSets: [],
          seed: recipe.seed,
          today: recipe.today,
        },
      )
      if (prepared.error) throw new Error(prepared.error)
      pool = prepared.pool
    }
    return {
      status: 'ready' as const,
      pins: prepareBuild({ ...input, commanders, pool }),
      evidence,
      ...(poolSearch ? { poolEvidence } : {}),
    }
  } catch (error) {
    if (error instanceof StoreError) throw error
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
