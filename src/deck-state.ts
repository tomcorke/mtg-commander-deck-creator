import { z } from 'zod'

export const deckStateKey = 'commander-deck-state'
export const deckStateVersion = 1

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const printingSchema = z.object({ image: z.string(), art: z.string().optional(), set: z.string(), collectorNumber: z.string() })
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
  tags: z.array(z.string()),
  printings: z.array(printingSchema).optional(),
  printing: z.number().int().nonnegative().optional(),
  printingManuallySelected: z.boolean().optional(),
}
const cardSchema = z.object({ ...cardBase, reason: z.string(), printsUri: z.string() })
const deckCardSchema = z.object(cardBase)
const decisionSchema = z.enum(['add', 'later', 'ignore'])

export const persistedDeckStateSchema = z.object({
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
  preferredPrintSet: z.string(),
  deckTargets: z.object({ lands: z.number().nonnegative(), ramp: z.number().nonnegative(), draw: z.number().nonnegative(), removal: z.number().nonnegative(), wipes: z.number().nonnegative() }),
})

export type PersistedDeckState = z.infer<typeof persistedDeckStateSchema>

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
