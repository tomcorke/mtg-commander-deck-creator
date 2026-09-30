import { fetchEdhrecPage, type EdhrecCommanderPage } from '../adapters/edhrec.ts'
import { fetchScryfallCardsByIdentifiers } from '../adapters/scryfall.ts'
import { ProviderRequestError, type RequestPolicy } from '../adapters/request-scheduler.ts'
import { persistedDeckStateSchema } from '../deck-state.ts'
import { edhrecSlug, isScryfallCard, toCard, type ScryfallCard } from '../domain/card-model.ts'
import {
  cardNameKey,
  signatureEntries,
  signatureLimits,
  type SignatureResult,
  type SignatureSeed,
} from '../domain/signature-recommendations.ts'
import type { SeedEvidence } from '../domain/recommendation-types.ts'

type RetryState = { failures: number; retryAt: number }
type SeedWork = RetryState & { page?: EdhrecCommanderPage; done: boolean }
type Usage = { attempts: number[]; posts: number[] }
type Budget = Usage & { seeds: Map<string, SeedWork>; hydration: RetryState }
const freshRetry = (): RetryState => ({ failures: 0, retryAt: 0 })
export const signatureWindow = 60 * 60_000
export const signatureBudget = (clock = Date.now, random = Math.random) => ({
  decks: new Map<string, Budget>(),
  attempts: [] as number[],
  posts: [] as number[],
  clock,
  random,
})
export type SignatureBudget = ReturnType<typeof signatureBudget>
// ponytail: tab-local work and rolling budgets; persist checkpoints only if reload recovery becomes necessary.
export const tabSignatureBudget = signatureBudget()
export function resetSignatureContext(deps: Record<string, any>, deckKey?: string) {
  deps.setSignatureEpoch?.((epoch: number) => epoch + 1)
  if (deckKey) deps.setSignatureDeckKey?.(deckKey)
}
export function bindSignatureBudget(from: string, to: string) {
  const budget = tabSignatureBudget.decks.get(from)
  if (budget) tabSignatureBudget.decks.set(to, budget)
}

function deckBudget(budget: SignatureBudget, deckKey: string) {
  let deck = budget.decks.get(deckKey)
  if (!deck) {
    deck = { seeds: new Map(), attempts: [], posts: [], hydration: freshRetry() }
    budget.decks.set(deckKey, deck)
  }
  return deck
}
function seedWork(deck: Budget, seed: SignatureSeed) {
  const key = `${seed.page}:${cardNameKey(seed.card.name)}`
  let work = deck.seeds.get(key)
  if (!work) {
    work = { ...freshRetry(), done: false }
    deck.seeds.set(key, work)
  }
  return work
}

function allowanceAt(deck: Budget, budget: SignatureBudget, kind: keyof Usage) {
  const now = budget.clock()
  deck[kind] = deck[kind].filter((time) => time > now - signatureWindow)
  budget[kind] = budget[kind].filter((time) => time > now - signatureWindow)
  const [perDeck, perTab] =
    kind === 'attempts'
      ? [signatureLimits.seedsPerDeck, signatureLimits.seedsPerTab]
      : [signatureLimits.postsPerDeck, signatureLimits.postsPerTab]
  return Math.max(
    deck[kind].length >= perDeck ? Math.min(...deck[kind]) + signatureWindow : 0,
    budget[kind].length >= perTab ? Math.min(...budget[kind]) + signatureWindow : 0,
  )
}
class BudgetPause extends Error {
  readonly retryAt: number
  constructor(retryAt: number) {
    super('Signature budget exhausted')
    this.retryAt = retryAt
  }
}
function charge(deck: Budget, budget: SignatureBudget, kind: keyof Usage, policy: RequestPolicy) {
  if (!policy.background) return // Shared work promoted to foreground is not an extra background request.
  const retryAt = allowanceAt(deck, budget, kind)
  if (retryAt > budget.clock()) throw new BudgetPause(retryAt)
  const now = budget.clock()
  deck[kind].push(now)
  budget[kind].push(now)
}
function defer(work: RetryState, error: unknown, budget: SignatureBudget) {
  if (error instanceof BudgetPause) {
    work.retryAt = error.retryAt
    return
  }
  if (!(error instanceof ProviderRequestError) || !error.transient) {
    work.retryAt = Infinity
    return
  }
  const delay = Math.min(300_000, 10_000 * 2 ** Math.min(work.failures++, 5))
  work.retryAt = Math.max(
    error.retryAt ?? 0,
    budget.clock() + Math.min(300_000, Math.ceil(delay * (1 + 0.2 * budget.random()))),
  )
}

export function signatureRetryAt(
  deckKey: string,
  seeds: SignatureSeed[],
  budget = tabSignatureBudget,
) {
  const deck = deckBudget(budget, deckKey)
  return Math.min(
    Infinity,
    ...seeds.slice(0, signatureLimits.seedsPerPass).map((seed) => {
      const work = seedWork(deck, seed)
      if (work.done) return Infinity
      return work.page
        ? Math.max(deck.hydration.retryAt, allowanceAt(deck, budget, 'posts'))
        : Math.max(work.retryAt, allowanceAt(deck, budget, 'attempts'))
    }),
  )
}

// One timer for unfinished work; no interval polling while a provider or budget is paused.
export function watchSignatureResults(load: () => Promise<number>, signal: AbortSignal) {
  signal.throwIfAborted()
  let timer: ReturnType<typeof setTimeout>
  const poll = async () => {
    if (signal.aborted) return
    const retryAt = await load().catch(() => Infinity)
    if (!signal.aborted && Number.isFinite(retryAt))
      timer = setTimeout(
        () => {
          void poll()
        },
        Math.min(2_147_483_647, Math.max(2000, retryAt - Date.now())),
      )
  }
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  timer = setTimeout(() => {
    void poll()
  }, 2000)
}

function validCard(raw: ScryfallCard) {
  return (
    isScryfallCard(raw) &&
    persistedDeckStateSchema.shape.queue.element.safeParse(toCard(raw, 'Seed support')).success
  )
}
async function loadSeedEntries(
  seed: SignatureSeed,
  deck: Budget,
  budget: SignatureBudget,
  excluded: Set<string>,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<SeedEvidence[]> {
  signal.throwIfAborted()
  const work = seedWork(deck, seed)
  if (work.done || work.retryAt > budget.clock()) return []
  if (!work.page) {
    const policy: RequestPolicy = {
      background: true,
      onDispatch: () => charge(deck, budget, 'attempts', policy),
    }
    try {
      work.page = await fetchEdhrecPage(
        seed.page,
        edhrecSlug(undefined, seed.card.name),
        fetcher,
        signal,
        policy,
      )
      Object.assign(work, freshRetry())
    } catch (error) {
      if (signal.aborted) throw error
      defer(work, error, budget)
    }
  }
  signal.throwIfAborted()
  if (!work.page) return []
  const entries = signatureEntries(work.page, seed, excluded)
  if (!entries.length) finish(work)
  return entries
}
function finish(work: SeedWork) {
  work.done = true
  delete work.page
}
export function completeSignatureResults(
  deckKey: string,
  results: SignatureResult[],
  budget = tabSignatureBudget,
) {
  const deck = deckBudget(budget, deckKey)
  for (const seed of results[0]?.seeds ?? []) finish(seedWork(deck, seed))
}

export async function loadSignatureResults(
  deckKey: string,
  seeds: SignatureSeed[],
  excluded: Set<string>,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  budget = tabSignatureBudget,
): Promise<SignatureResult[]> {
  const deck = deckBudget(budget, deckKey)
  const evidence: SeedEvidence[] = [],
    used: SignatureSeed[] = []
  for (const seed of seeds.slice(0, signatureLimits.seedsPerPass)) {
    const entries = await loadSeedEntries(seed, deck, budget, excluded, signal, fetcher)
    if (entries.length) {
      evidence.push(...entries)
      used.push(seed)
    }
  }
  const names = [...new Set(evidence.map(({ name }) => name))].slice(
    0,
    signatureLimits.seedsPerPass * signatureLimits.namesPerSeed,
  )
  if (!names.length || deck.hydration.retryAt > budget.clock()) return []
  const policy: RequestPolicy = {
    background: true,
    onDispatch: () => charge(deck, budget, 'posts', policy),
  }
  try {
    const cards = await fetchScryfallCardsByIdentifiers(
      names.map((name) => ({ name })),
      fetcher,
      signal,
      policy,
    )
    signal.throwIfAborted()
    const valid = cards.filter(validCard)
    if (!valid.length) for (const seed of used) finish(seedWork(deck, seed))
    deck.hydration = freshRetry()
    return valid.map((raw) => ({
      raw,
      seeds: used,
      evidence: evidence.filter((entry) => cardNameKey(entry.name) === cardNameKey(raw.name)),
    }))
  } catch (error) {
    if (signal.aborted) throw error
    defer(deck.hydration, error, budget)
    if (deck.hydration.retryAt === Infinity) {
      for (const seed of used) finish(seedWork(deck, seed))
      deck.hydration = freshRetry()
    }
    return []
  }
}
