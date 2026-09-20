import { z } from 'zod'

export const deckStateKey = 'commander-deck-state'
export const savedDecksKey = 'commander-saved-decks'
export const deckStateVersion = 1

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const finishSchema = z.enum(['nonfoil', 'foil', 'etched'])
const printingSchema = z.object({ image: z.string(), art: z.string().optional(), set: z.string(), collectorNumber: z.string(), price: z.string().optional(), finish: finishSchema.optional() })
const cardBase = {
  name: z.string(),
  layout: z.string(),
  typeLine: z.string(),
  manaCost: z.string(),
  manaValue: z.number(),
  detail: z.string(),
  producedMana: z.array(z.string()),
  faces: z.array(z.object({ typeLine: z.string(), manaCost: z.string() })),
  image: z.string(),
  set: z.string(),
  collectorNumber: z.string(),
  price: z.string().optional(),
  tags: z.array(z.string()),
  printings: z.array(printingSchema).optional(),
  printing: z.number().int().nonnegative().optional(),
  printingManuallySelected: z.boolean().optional(),
  finish: finishSchema.optional(),
}
const cardSchema = z.object({ ...cardBase, reason: z.string(), printsUri: z.string() })
const deckCardSchema = z.object(cardBase)
const decisionSchema = z.enum(['add', 'later', 'ignore'])

export const persistedDeckStateSchema = z.object({
  savedDeckId: z.string().default(''),
  commander: z.string().min(1),
  commanderDetails: z.object({
    images: z.array(z.string()),
    art: z.array(z.string()),
    colours: z.array(z.string()),
    printings: z.array(z.array(printingSchema)),
    selections: z.array(z.number().int().nonnegative()),
  }),
  theme: z.string(),
  queue: z.array(cardSchema),
  limitedRecommendations: z.boolean(),
  decisions: z.record(z.string(), decisionSchema),
  ignoredCards: z.array(z.string()),
  liked: z.array(z.string()),
  activeSubThemes: z.array(z.string()),
  dismissedSubThemes: z.array(z.string()),
  preferenceScores: z.record(z.string(), z.number()),
  commanderSubThemes: z.array(z.string()),
  deferredCards: z.array(z.object({ card: cardSchema, eligibleBatch: z.number().int().positive() })),
  batchNumber: z.number().int().positive(),
  deck: z.array(deckCardSchema).min(1).max(100),
  sideboard: z.array(deckCardSchema).default([]),
  preferredPrintSet: z.string(),
  deckTargets: z.object({ lands: z.number().nonnegative(), ramp: z.number().nonnegative(), draw: z.number().nonnegative(), removal: z.number().nonnegative(), wipes: z.number().nonnegative() }),
})

export type PersistedDeckState = z.infer<typeof persistedDeckStateSchema>
export type SavedDeck = { id: string; name: string; updatedAt: string; state: PersistedDeckState }

export const suggestedDeckName = (commander: string, theme: string, subThemes: string[]) => [commander, theme, ...subThemes].filter((name, index, names) => name && names.indexOf(name) === index).join(' - ')
export const duplicateDeckName = (decks: SavedDeck[], name: string, currentId = '') => decks.some((deck) => deck.id !== currentId && deck.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())

export function deckDelta(saved: PersistedDeckState['deck'], current: PersistedDeckState['deck']) {
  const counts = (cards: PersistedDeckState['deck']) => cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.name]: (result[card.name] ?? 0) + 1 }), {})
  const before = counts(saved)
  const after = counts(current)
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names].reduce((delta, name) => ({ added: delta.added + Math.max(0, (after[name] ?? 0) - (before[name] ?? 0)), removed: delta.removed + Math.max(0, (before[name] ?? 0) - (after[name] ?? 0)) }), { added: 0, removed: 0 })
}

const savedDeckSchema = z.object({ id: z.string().min(1), name: z.string().min(1), updatedAt: z.string(), state: persistedDeckStateSchema })

export function loadDeckState(storage: StorageLike = localStorage): PersistedDeckState | null {
  try {
    const parsed = z.object({ version: z.literal(deckStateVersion), state: persistedDeckStateSchema }).safeParse(JSON.parse(storage.getItem(deckStateKey) ?? 'null'))
    return parsed.success ? parsed.data.state : null
  } catch {
    return null
  }
}

export function saveDeckState(state: PersistedDeckState, storage: StorageLike = localStorage) {
  try {
    storage.setItem(deckStateKey, JSON.stringify({ version: deckStateVersion, state: persistedDeckStateSchema.parse(state) }))
  } catch {
    // Keep deck building usable when state or storage is invalid or unavailable.
  }
}

export function clearDeckState(storage: StorageLike = localStorage) {
  try {
    storage.removeItem(deckStateKey)
  } catch {
    // React state still resets when storage is unavailable.
  }
}

export function loadSavedDecks(storage: StorageLike = localStorage): SavedDeck[] {
  try {
    const parsed = z.object({ version: z.literal(deckStateVersion), decks: z.array(savedDeckSchema) }).safeParse(JSON.parse(storage.getItem(savedDecksKey) ?? 'null'))
    return parsed.success ? parsed.data.decks : []
  } catch {
    return []
  }
}

export function saveSavedDeck(deck: SavedDeck, storage: StorageLike = localStorage): SavedDeck[] {
  const decks = loadSavedDecks(storage)
  const next = [savedDeckSchema.parse(deck), ...decks.filter(({ id }) => id !== deck.id)]
  try {
    storage.setItem(savedDecksKey, JSON.stringify({ version: deckStateVersion, decks: next }))
    return next
  } catch {
    return decks
  }
}

export function deleteSavedDeck(id: string, storage: StorageLike = localStorage): SavedDeck[] {
  const next = loadSavedDecks(storage).filter((deck) => deck.id !== id)
  try {
    storage.setItem(savedDecksKey, JSON.stringify({ version: deckStateVersion, decks: next }))
    return next
  } catch {
    return loadSavedDecks(storage)
  }
}
