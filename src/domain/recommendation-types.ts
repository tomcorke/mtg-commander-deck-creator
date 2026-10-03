import type { CardFinish } from './card-model.ts'

export type { CardFinish, PrintingLike, ScryfallCard, ScryfallCardFace } from './card-model.ts'

export type TaggedCard = { name: string; typeLine: string; detail: string; tags: string[] }
export type DeferredCard<T> = { card: T; eligibleBatch: number; available?: boolean }
export type EdhrecThemeCount = { count: number; slug: string; value: string }
export type PowerTarget = 'precon' | 'upgraded' | 'high'
export type RecommendationStyle = 'thematic' | 'fun' | 'balanced' | 'competitive'

export function normalizeRecommendationStyle(value: unknown): RecommendationStyle {
  if (value === 'thematic' || value === 'story') return 'thematic'
  if (value === 'fun') return 'fun'
  if (value === 'competitive' || value === 'optimized') return 'competitive'
  return 'balanced'
}
export type CollectionMode = 'none' | 'prefer' | 'only'
export type RecommendationSource = 'edhrec' | 'scryfall'
export type CuratedCollection = { id: string; name: string; setCodes: string[] }
export const curatedCollections: CuratedCollection[] = [
  { id: 'middle-earth', name: 'Middle-earth', setCodes: ['ltr', 'ltc'] },
  { id: 'marvel', name: 'Marvel', setCodes: ['spm'] },
]
export type EdhrecEntry = {
  name: string
  tag: string
  header: string
  /** Percentage of the commander's EDHREC decks that play this card. */
  inclusion?: number
}
export type SeedEvidence = {
  name: string
  seed: string
  page: 'cards' | 'commanders'
  theme: string
  tag: string
  lift?: number
  decks?: number
}
export type RecommendationCard = {
  name: string
  layout: string
  typeLine: string
  colorIdentity?: string[]
  oracleId?: string
  commanderLegality?: string
  manaValueKnown?: boolean
  gameChanger?: boolean
  manaCost: string
  manaValue: number
  detail: string
  producedMana: string[]
  faces: { typeLine: string; manaCost: string; detail?: string }[]
  power?: string
  toughness?: string
  reason: string
  source?: RecommendationSource
  seedEvidence?: SeedEvidence[]
  inclusion?: number
  image: string
  backImage?: string
  set: string
  setName?: string
  collectorNumber: string
  scryfallUri?: string
  printsUri: string
  price?: string
  priceUri?: string
  finish?: CardFinish
  tags: string[]
  collectionMatch?: boolean
}
export type RecommendationOptions = {
  includeCreature: boolean
  excludeGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
  excludeUnreleased: boolean
  powerTarget: PowerTarget
  maxPrice?: number | null
}
export const recommendedScoreThreshold = 45
export const recommendationScoreFactorMaximums = {
  evidence: 20,
  theme: 10,
  subThemes: 8,
  collection: 12,
  deckFit: 10,
  preferences: 10,
  deckNeeds: 30,
  manaFitPenalty: 10,
  popularityPenalty: 15,
} as const
export type RecommendationScoreCard = Pick<RecommendationCard, 'reason' | 'tags'> &
  Partial<
    Pick<RecommendationCard, 'set' | 'collectionMatch' | 'typeLine' | 'manaCost' | 'manaValue'>
  >
export type ManaSupport = {
  landCount: number
  rampCount: number
  landTarget: number
  rampTarget: number
  averageManaValue: number
  producedMana: Record<string, number>
}
export type RecommendationScoreContext = {
  theme: string
  activeSubThemes: string[]
  pickedTags: Set<string>
  preferenceScores: Record<string, number>
  neededRoles: Set<string>
  cardRoles: string[]
  recommendationStyle?: RecommendationStyle
  collectionSets?: string[]
  collectionMode?: CollectionMode
  roleBoosts?: Record<string, number>
  roleSupply?: Record<string, number>
  batchNumber?: number
  manaSupport?: ManaSupport
  maxPrice?: number | null
}
export type RecommendationScoreBreakdown = {
  total: number
  evidence: number
  theme: number
  subThemes: number
  collection: number
  deckFit: number
  preferences: number
  deckNeeds: number
  manaFitPenalty: number
  popularityPenalty: number
}
