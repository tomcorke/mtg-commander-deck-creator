import type { CardFinish } from './card-model.ts'

export type { CardFinish, PrintingLike, ScryfallCard, ScryfallCardFace } from './card-model.ts'

export type TaggedCard = { name: string; typeLine: string; detail: string; tags: string[] }
export type DeferredCard<T> = { card: T; eligibleBatch: number }
export type EdhrecThemeCount = { count: number; slug: string; value: string }
export type PowerTarget = 'precon' | 'upgraded' | 'high'
export type RecommendationStyle = 'story' | 'balanced' | 'optimized'
export type CollectionMode = 'none' | 'prefer' | 'only'
export type RecommendationSource = 'edhrec' | 'scryfall'
export type CuratedCollection = { id: string; name: string; setCodes: string[] }
export const curatedCollections: CuratedCollection[] = [
  { id: 'middle-earth', name: 'Middle-earth', setCodes: ['ltr', 'ltc'] },
  { id: 'marvel', name: 'Marvel', setCodes: ['spm'] },
]
export type EdhrecEntry = { name: string; tag: string; header: string }
export type RecommendationCard = {
  name: string
  layout: string
  typeLine: string
  manaCost: string
  manaValue: number
  detail: string
  producedMana: string[]
  faces: { typeLine: string; manaCost: string }[]
  power?: string
  toughness?: string
  reason: string
  source?: RecommendationSource
  image: string
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
  popularityPenalty: 15,
} as const
export type RecommendationScoreCard = Pick<RecommendationCard, 'reason' | 'tags'> &
  Partial<Pick<RecommendationCard, 'set' | 'collectionMatch'>>
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
  popularityPenalty: number
}
