import { fetchEdhrecPage } from '../adapters/edhrec.ts'
import { fetchScryfallCardsByIdentifiers } from '../adapters/scryfall.ts'
import type { RequestPolicy } from '../adapters/request-scheduler.ts'
import { persistedDeckStateSchema } from '../deck-state.ts'
import { edhrecSlug, isScryfallCard, toCard, type ScryfallCard } from '../domain/card-model.ts'
import {
  cardNameKey,
  signatureEntries,
  type SignatureResult,
  type SignatureSeed,
} from '../domain/signature-recommendations.ts'
import type { SeedEvidence } from '../domain/recommendation-types.ts'

type Budget = { seeds: Set<string>; posts: number }
export const signatureBudget = () => ({ decks: new Map<string, Budget>(), attempts: 0, posts: 0 })
export type SignatureBudget = ReturnType<typeof signatureBudget>
// ponytail: tab-local budgets survive hook remounts; reload starts a new session.
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
    deck = { seeds: new Set(), posts: 0 }
    budget.decks.set(deckKey, deck)
  }
  return deck
}

function validCard(raw: ScryfallCard) {
  return (
    isScryfallCard(raw) &&
    persistedDeckStateSchema.shape.queue.element.safeParse(toCard(raw, 'Seed support')).success
  )
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
  const evidence: SeedEvidence[] = []
  const used: SignatureSeed[] = []
  for (const seed of seeds.slice(0, 2)) {
    signal.throwIfAborted()
    const key = `${seed.page}:${cardNameKey(seed.card.name)}`
    if (deck.seeds.has(key) || deck.seeds.size >= 4 || budget.attempts >= 12) continue
    // Reservations also charge failed/cancelled work; editing cannot reset an allowance.
    deck.seeds.add(key)
    budget.attempts++
    try {
      const page = await fetchEdhrecPage(
        seed.page,
        edhrecSlug(undefined, seed.card.name),
        fetcher,
        signal,
        { background: true },
      )
      signal.throwIfAborted()
      evidence.push(...signatureEntries(page, seed, excluded))
      used.push(seed)
    } catch (error) {
      if (signal.aborted) throw error
    }
  }
  const names = [...new Set(evidence.map(({ name }) => name))].slice(0, 48)
  if (!names.length) return []
  const policy: RequestPolicy = {
    background: true,
    onDispatch: () => {
      if (!policy.background) return // A foreground consumer promoted this shared request.
      if (deck.posts >= 2 || budget.posts >= 6)
        throw new Error('Signature hydration budget exhausted')
      deck.posts++
      budget.posts++
    },
  }
  const cards = await fetchScryfallCardsByIdentifiers(
    names.map((name) => ({ name })),
    fetcher,
    signal,
    policy,
  )
  signal.throwIfAborted()
  return cards.filter(validCard).map((raw) => ({
    raw,
    seeds: used,
    evidence: evidence.filter((entry) => cardNameKey(entry.name) === cardNameKey(raw.name)),
  }))
}
