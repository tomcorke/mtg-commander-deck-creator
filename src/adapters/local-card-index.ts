import type { ScryfallCard, ScryfallSet } from '../domain/card-model.ts'
import { cardNameKey } from '../domain/card-model.ts'
import { creatureTypeForTheme } from '../domain/creature-types.ts'
import { parseLocalCardIndex, type LocalCardIndex } from '../domain/local-card-index.ts'
import { fetchScryfallCreatureTypes, fetchScryfallSets } from './scryfall.ts'

export type LocalCardQuery = {
  colours: string[]
  themes?: string[]
  creatureTypes?: string[]
  roles?: string[]
  features?: string[]
}
export type LocalIndexStatus = {
  state: 'unloaded' | 'fresh' | 'stale' | 'unchecked' | 'unavailable'
  reasons: string[]
  bulkUpdatedAt?: string
}

/** Provider coverage, not release dates alone: preview sets may already be in the bulk data. */
export function localIndexStaleness(
  index: LocalCardIndex,
  sets: ScryfallSet[],
  types: string[],
): string[] {
  const covered = new Map(index.metadata.sets.map((set) => [set.code, set]))
  const reasons: string[] = []
  for (const set of sets) {
    if (set.set_type === 'token' || set.set_type === 'memorabilia') continue
    const previous = covered.get(set.code)
    if (!previous) reasons.push(`New set: ${set.code}`)
    else if (
      (set.card_count !== undefined && set.card_count !== previous.card_count) ||
      set.released_at !== previous.released_at
    )
      reasons.push(`Changed set: ${set.code}`)
  }
  const catalog = new Set(index.metadata.creatureTypes)
  for (const type of types) if (!catalog.has(type)) reasons.push(`New creature type: ${type}`)
  return reasons
}

/** Union selected facets, then apply identity. Stable table order makes local comparisons repeatable. */
export function queryLocalCardIndex(index: LocalCardIndex, query: LocalCardQuery): ScryfallCard[] {
  const ids = new Set<number>()
  const add = (table: Record<string, number[]>, keys: string[] = []) => {
    for (const key of keys) for (const id of table[key] ?? []) ids.add(id)
  }
  add(index.indexes.tags, query.themes)
  add(index.indexes.creatureTypes, [
    ...(query.creatureTypes ?? []),
    ...(query.themes ?? []).flatMap((theme) => creatureTypeForTheme(theme) ?? []),
  ])
  add(index.indexes.roles, query.roles)
  add(index.indexes.features, query.features)
  const colours = new Set(query.colours)
  return [...ids]
    .sort((left, right) => left - right)
    .map((id) => index.cards[id])
    .filter((card) => card.color_identity.every((colour) => colours.has(colour)))
}

/** Live gameplay fields replace snapshots; Oracle identity also handles renamed cards. */
export function mergeLocalAndLiveCards(local: ScryfallCard[], live: ScryfallCard[]) {
  const cards: ScryfallCard[] = []
  const oracles = new Set<string>()
  const names = new Set<string>()
  for (const card of [...live, ...local]) {
    const name = cardNameKey(card.name)
    if ((card.oracle_id && oracles.has(card.oracle_id)) || names.has(name)) continue
    cards.push(card)
    if (card.oracle_id) oracles.add(card.oracle_id)
    names.add(name)
  }
  return cards
}

type LocalSourceOptions = {
  load: () => Promise<unknown>
  inventory: () => Promise<{ sets: ScryfallSet[]; creatureTypes: string[] }>
  log?: (status: LocalIndexStatus) => void
  now?: () => number
}

/** No work at import time. Share one artifact; recheck provider coverage every fifteen minutes. */
export function createLocalCardSource({
  load,
  inventory,
  log = console.info,
  now = Date.now,
}: LocalSourceOptions) {
  let pending: Promise<LocalCardIndex | undefined> | undefined
  let coverage: Promise<void> | undefined
  let checkedAt = -Infinity
  let checked: LocalCardIndex | undefined
  let status: LocalIndexStatus = { state: 'unloaded', reasons: [] }
  const report = (next: LocalIndexStatus) => {
    status = next
    log(next)
  }
  const getIndex = () => {
    pending ??= (async () => {
      let index: LocalCardIndex
      try {
        index = parseLocalCardIndex(await load())
      } catch (error) {
        report({ state: 'unavailable', reasons: [String(error)] })
        return undefined
      }
      return index
    })()
    return pending
  }
  const checkedIndex = async () => {
    const index = await getIndex()
    if (!index) return undefined
    if (now() - checkedAt >= 15 * 60_000) {
      coverage ??= (async () => {
        const bulkUpdatedAt = index.metadata.bulkUpdatedAt
        try {
          const current = await inventory()
          if (!current.sets.length || !current.creatureTypes.length)
            throw new Error('Incomplete local-index coverage check')
          const reasons = localIndexStaleness(index, current.sets, current.creatureTypes)
          report({ state: reasons.length ? 'stale' : 'fresh', reasons, bulkUpdatedAt })
        } catch (error) {
          report({ state: 'unchecked', reasons: [String(error)], bulkUpdatedAt })
        }
        checkedAt = now()
      })().finally(() => {
        coverage = undefined
      })
      await coverage
    }
    checked = index
    return index
  }
  return {
    status: () => structuredClone(status),
    /** Never waits: answers from a checked index, or starts loading and returns undefined. */
    ifReady(query: LocalCardQuery) {
      if (status.state === 'unavailable') return []
      if (checked && now() - checkedAt < 15 * 60_000) return queryLocalCardIndex(checked, query)
      void checkedIndex()
      return undefined
    },
    async query(query: LocalCardQuery) {
      const index = await checkedIndex()
      return index ? queryLocalCardIndex(index, query) : []
    },
    async count(query: LocalCardQuery) {
      const index = await checkedIndex()
      return index ? queryLocalCardIndex(index, query).length : undefined
    },
  }
}

const source = createLocalCardSource({
  async load() {
    const response = await fetch('/local-card-index.json', { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`Local card index unavailable (${response.status})`)
    return response.json()
  },
  async inventory() {
    const [sets, creatureTypes] = await Promise.all([
      fetchScryfallSets(fetch, AbortSignal.timeout(10_000)),
      fetchScryfallCreatureTypes(fetch, AbortSignal.timeout(10_000)),
    ])
    return { sets, creatureTypes }
  },
  log: (status) => console.info('[local-card-index]', status),
})
export const fetchLocalCards = source.query
export const countLocalCards = source.count
export const localCardsIfReady = source.ifReady
export const localCardIndexStatus = source.status
