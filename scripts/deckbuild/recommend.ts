import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import {
  applyBuilderAction,
  type BuilderAction,
  type BuilderState,
} from '../../src/domain/builder-state.ts'
import { builderPoolKey } from '../../src/domain/builder-settings.ts'
import {
  explainCard,
  mergeRecommendationCandidates,
  recommend,
  recommendationScoringVersion,
  type RecommendState,
} from '../../src/domain/recommender.ts'
import { analyseDeck } from '../../src/deck-analysis.ts'
import { isScryfallCard, type ScryfallCard } from '../../src/domain/card-model.ts'
import {
  commandSchema,
  defaultLimits,
  initialStateSchema,
  limitsSchema,
  settingsSchema,
  type Command,
} from './builder-contract.ts'
import {
  executeStoredFetch,
  lookupStoredCards,
  searchStoredCards,
  liveProvider,
  StoreError,
  type RequestStore,
} from './provider.ts'
import { digest, recordStore, replayStore, type Json, type Pins } from './data.ts'

const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json
const hash = (value: unknown) => digest(json(value))
const cliPinsSchema = z.strictObject({
  version: z.literal(2),
  scoringVersion: z.literal(recommendationScoringVersion),
  commandsHash: z.string().regex(/^[a-f0-9]{64}$/),
  builder: settingsSchema,
  limits: limitsSchema,
})
const feedback = new Set(['decide', 'like', 'ignoreReason', 'chooseZone'])

export function parseCommands(text: string): Command[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => commandSchema.parse(JSON.parse(line)))
}

function recommendationState(state: BuilderState): RecommendState {
  return {
    ...state,
    pool: mergeRecommendationCandidates(
      state.queue,
      state.deferredCards.map(({ card }) => card),
    ),
    identity: state.commanderDetails?.colours ?? [],
    prioritizeDeckHealth: state.recommendationStyle !== 'thematic',
  }
}

function offer(state: BuilderState) {
  const result = recommend(recommendationState(state))
  return {
    state: { ...state, queue: result.queue, deferredCards: result.deferredCards },
    result,
  }
}

function initialState(pins: Pins, builder: unknown): BuilderState {
  const state = initialStateSchema.parse(pins.initialState)
  if (state.today !== pins.today || state.signatureDeckKey !== pins.seed)
    throw new Error('Initial state must match pinned today and seed/signatureDeckKey')
  const settings = Object.fromEntries(
    Object.keys(settingsSchema.shape).map((key) => [key, state[key as keyof typeof state]]),
  )
  if (hash(settingsSchema.parse(settings)) !== hash(builder))
    throw new Error('Resolved builder settings do not match initial state')
  if (state.recommendationOptionsChanged || state.committedPoolKey !== builderPoolKey(state))
    throw new Error('Initial state must be a committed prepared pool')
  if (
    Object.keys(state.decisions).length ||
    Object.keys(state.ignoreReasons).length ||
    state.liked.length
  )
    throw new Error('Initial state must have no uncommitted feedback')
  const names = state.queue.map((card) => card.name.toLowerCase())
  if (new Set(names).size !== names.length) throw new Error('Duplicate initial pool names')
  return state
}

function resolveAction(
  command: Command,
  offered: ReturnType<typeof offer>['result'],
): BuilderAction {
  const action = command.action
  if (
    action.type === 'view' ||
    action.type === 'explain' ||
    action.type === 'lookup' ||
    action.type === 'search' ||
    action.type === 'addRetrieved'
  )
    throw new Error('Expected builder action')
  if (action.type === 'decide' || action.type === 'like' || action.type === 'ignoreReason') {
    const card = offered.batch.find((item) => item.name === action.name)
    if (!card) throw new Error(`Card was not offered in the visible batch: ${action.name}`)
    if (action.type === 'decide') return { type: 'decide', card, decision: action.decision }
  }
  return action
}

type Session = {
  state: BuilderState
  offered: ReturnType<typeof offer>
  log: Record<string, unknown>[]
  lastBatch: number
}
type Stop = { status: 'incomplete' | 'invalid' | 'limit'; detail: unknown }

async function applyCommand(
  session: Session,
  command: Command,
  pins: Pins,
  request: RequestStore | undefined,
  signal: AbortSignal,
): Promise<Stop | null> {
  const { state, offered } = session
  const action = command.action
  const entry: Record<string, unknown> = { command, before: hash(state), offered: null }
  if (action.type === 'decide') {
    const rank = offered.result.batch.findIndex((item) => item.name === action.name) + 1
    entry.offered = {
      rank: rank || null,
      score: offered.result.scores.find((item) => item.name === action.name) ?? null,
    }
  }
  session.log.push(entry)
  try {
    const stopped =
      command.action.type === 'lookup' || command.action.type === 'search'
        ? await executeLookup(command.action, entry, pins, request, signal)
        : await executeCommand(session, command, entry, pins, request, signal)
    entry.after = hash(session.state)
    return stopped
  } catch (error) {
    if (error instanceof StoreError) throw error
    entry.error = String(error)
    return { status: 'invalid', detail: entry.error }
  }
}

async function settleProviderWork(
  session: Session,
  pins: Pins,
  request: RequestStore | undefined,
  signal: AbortSignal,
): Promise<Stop | null> {
  while (request && session.state.pendingFetches.length) {
    if (signal.aborted) return { status: 'limit', detail: 'runtime' }
    const work = session.state.pendingFetches.find((item) => !item.response)!
    const fetched = await executeStoredFetch(work, pins, request, signal)
    if (signal.aborted) return { status: 'limit', detail: 'runtime' }
    if (fetched.status === 'incomplete') return { status: 'incomplete', detail: fetched.detail }
    const settled = applyBuilderAction(session.state, {
      type: 'settleFetch',
      id: work.id,
      response: fetched.response,
    })
    if (settled.error) return { status: 'invalid', detail: settled.error }
    if (settled.state.batchNumber > session.lastBatch) return { status: 'limit', detail: 'batches' }
    session.state = settled.state
  }
  if (session.state.pendingFetches.length || session.state.fetchBoundary)
    return {
      status: 'incomplete',
      detail: { reason: 'Provider wiring unavailable', requests: session.state.pendingFetches },
    }
  return null
}

async function executeLookup(
  action: Extract<Command['action'], { type: 'lookup' | 'search' }>,
  entry: Record<string, unknown>,
  pins: Pins,
  request: RequestStore | undefined,
  signal: AbortSignal,
): Promise<Stop | null> {
  if (!request) return { status: 'incomplete', detail: 'Lookup provider unavailable' }
  const result =
    action.type === 'lookup'
      ? await lookupStoredCards(action.names, pins, request, signal)
      : await searchStoredCards(action, pins, request, signal)
  if (signal.aborted) return { status: 'limit', detail: 'runtime' }
  if (result.status === 'incomplete') return { status: 'incomplete', detail: result.detail }
  entry.result = result.response
  return null
}

function resolveRetrieved(
  session: Session,
  action: Extract<Command['action'], { type: 'addRetrieved' }>,
): BuilderAction {
  // The current entry is already logged; only earlier retrievals can supply cards.
  const source = session.log[action.commandIndex]
  const sourceType = (source?.command as Command | undefined)?.action.type
  const evidence = source?.result as { cards?: ScryfallCard[] } | undefined
  if (
    action.commandIndex >= session.log.length - 1 ||
    (sourceType !== 'lookup' && sourceType !== 'search') ||
    !evidence?.cards
  )
    throw new Error('Expected an earlier lookup/search result with card evidence')
  const cards = action.names.map((name) => {
    const matches = evidence.cards!.filter((card) => card.name === name)
    if (matches.length !== 1 || !isScryfallCard(matches[0]))
      throw new Error(`Expected exactly one retrieved card: ${name}`)
    return matches[0]
  })
  return { type: 'addSearch', cards }
}

async function executeCommand(
  session: Session,
  command: Command,
  entry: Record<string, unknown>,
  pins: Pins,
  request: RequestStore | undefined,
  signal: AbortSignal,
): Promise<Stop | null> {
  const { action } = command
  if (action.type === 'view') {
    entry.result = session.offered.result
    return null
  }
  if (action.type === 'explain') {
    entry.result = explainCard(recommendationState(session.state), action.name)
    return null
  }
  if (action.type === 'nextBatch' && session.state.batchNumber >= session.lastBatch)
    return { status: 'limit', detail: 'batches' }
  const resolved =
    action.type === 'addRetrieved'
      ? resolveRetrieved(session, action)
      : resolveAction(command, session.offered.result)
  const result = applyBuilderAction(session.state, resolved)
  if (result.error) {
    entry.error = result.error
    return { status: 'invalid', detail: result.error }
  }
  if (result.state.batchNumber > session.lastBatch) return { status: 'limit', detail: 'batches' }
  session.state = result.state
  if (result.fetchRequests.some((work) => 'kind' in work))
    return {
      status: 'incomplete',
      detail: { reason: 'Provider wiring unavailable', requests: result.fetchRequests },
    }
  const stopped = await settleProviderWork(session, pins, request, signal)
  if (stopped) return stopped
  const pendingFeedback =
    Object.keys(session.state.decisions).length ||
    session.state.liked.length ||
    Object.keys(session.state.ignoreReasons).length
  if (!feedback.has(action.type) && !pendingFeedback) {
    session.offered = offer(session.state)
    session.state = session.offered.state
    if (session.offered.result.error)
      return { status: 'invalid', detail: session.offered.result.error }
  }
  return null
}

/** Only supported reserved work is executed; unimplemented providers stop explicitly incomplete. */
export async function runCommands(
  pins: Pins,
  commands: Command[],
  now = () => performance.now(),
  request?: RequestStore,
) {
  const config = cliPinsSchema.parse(pins.resolvedOptions)
  if (config.commandsHash !== hash(commands))
    throw new Error('Command log differs from pinned hash')
  const started = now()
  const signal = AbortSignal.timeout(config.limits.runtimeMs)
  const state = initialState(pins, config.builder)
  const offered = offer(state)
  const session: Session = {
    state: offered.state,
    offered,
    log: [],
    lastBatch: state.batchNumber + config.limits.batches - 1,
  }
  const report = (
    status: 'complete' | 'incomplete' | 'invalid' | 'limit',
    detail: unknown = null,
  ) => ({
    version: 1,
    status,
    detail,
    scoringVersion: recommendationScoringVersion,
    recommenderVersion: pins.recommenderVersion,
    pinsHash: hash(pins),
    commandsHash: config.commandsHash,
    log: session.log,
    state: session.state,
    stateHash: hash(session.state),
    view: {
      ...session.offered.result,
      analysis: analyseDeck(session.state.deck),
      roleTargets: session.state.deckTargets,
    },
    construction: 'not-checked',
  })
  if (offered.result.error) return report('invalid', offered.result.error)
  for (const command of commands) {
    if (session.log.length >= config.limits.commands) return report('limit', 'commands')
    if (now() - started >= config.limits.runtimeMs) return report('limit', 'runtime')
    const stopped = await applyCommand(session, command, pins, request, signal)
    if (stopped) return report(stopped.status, stopped.detail)
    if (now() - started >= config.limits.runtimeMs) return report('limit', 'runtime')
  }
  return report('complete')
}

export function checkStoreDirectory(root: string) {
  const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const fromCheckout = relative(realpathSync(checkout), realpathSync(root))
  const outside =
    fromCheckout === '..' || fromCheckout.startsWith(`..${sep}`) || isAbsolute(fromCheckout)
  if (!isAbsolute(root) || !outside)
    throw new Error('Store directory must be absolute and outside the checkout')
}

export function checkVersion(pins: Pins) {
  const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: checkout,
    encoding: 'utf8',
  }).trim()
  if (pins.recommenderVersion !== revision)
    throw new Error('Pinned recommenderVersion must match this checkout HEAD')
}

export async function recordBuild(
  root: string,
  input: Pins,
  inputCommands: unknown[],
  limits: unknown = defaultLimits,
  fetcher: typeof fetch = fetch,
) {
  checkStoreDirectory(root)
  checkVersion(input)
  const commands = inputCommands.map((command) => commandSchema.parse(command))
  const pins: Pins = {
    ...input,
    resolvedOptions: json({
      version: 2,
      scoringVersion: recommendationScoringVersion,
      commandsHash: hash(commands),
      builder: settingsSchema.parse(input.resolvedOptions),
      limits: limitsSchema.parse(limits),
    }),
  }
  initialState(pins, cliPinsSchema.parse(pins.resolvedOptions).builder)
  const store = recordStore(root, pins)
  const provider = liveProvider(fetcher)
  const output = await runCommands(pins, commands, undefined, async (request, signal) => ({
    status: 'complete',
    outcome: await store.request(request, (descriptor) => provider(descriptor, signal)),
  }))
  const manifest = await store.finish()
  return { manifest, ...output }
}

export async function replayBuild(root: string, manifest: string, inputCommands: unknown[]) {
  checkStoreDirectory(root)
  const commands = inputCommands.map((command) => commandSchema.parse(command))
  const store = await replayStore(root, manifest)
  checkVersion(store.pins)
  const output = await runCommands(store.pins, commands, undefined, (request) =>
    store.request(request),
  )
  // Never accept a manifest whose data was not consumed.
  const finished = store.finish()
  if (finished.status === 'incomplete')
    return { ...output, manifest, status: 'incomplete', detail: finished }
  return { manifest, ...output }
}

async function main(args: string[]) {
  const [mode, root, source, log, limits] = args
  if (
    !['record', 'replay'].includes(mode) ||
    args.length < 4 ||
    args.length > 5 ||
    (mode === 'replay' && limits)
  )
    throw new Error(
      'Usage: recommend.ts record <store-dir> <pins.json> <commands.jsonl> [limits.json] | replay <store-dir> <manifest> <commands.jsonl>',
    )
  const commands = parseCommands(await readFile(log, 'utf8'))
  const output =
    mode === 'record'
      ? await recordBuild(
          root,
          JSON.parse(await readFile(source, 'utf8')),
          commands,
          limits ? JSON.parse(await readFile(limits, 'utf8')) : defaultLimits,
        )
      : await replayBuild(root, source, commands)
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  if (output.status !== 'complete') process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
