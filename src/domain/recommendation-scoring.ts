import type { PrintingLike, ScryfallCard } from './card-model.ts'
import { recommendationScoreFactorMaximums } from './recommendation-types.ts'
import type {
  RecommendationScoreBreakdown,
  RecommendationScoreCard,
  RecommendationScoreContext,
} from './recommendation-types.ts'

function evidenceScore(
  card: RecommendationScoreCard,
  style: RecommendationScoreContext['recommendationStyle'],
) {
  const base =
    card.reason === 'Commander synergy'
      ? 20
      : card.reason === 'Commander favourite'
        ? 15
        : card.reason === 'Popular inclusion' || card.reason === 'Land or mana'
          ? 8
          : 12
  if (style === 'story') return Math.round(base * 0.65)
  if (style === 'optimized')
    return Math.min(recommendationScoreFactorMaximums.evidence, Math.round(base * 1.1))
  return base
}

function collectionScore(
  card: RecommendationScoreCard,
  style: RecommendationScoreContext['recommendationStyle'],
  sets: string[],
  mode: RecommendationScoreContext['collectionMode'],
) {
  const matches =
    mode !== 'none' && Boolean(card.collectionMatch || (card.set && sets.includes(card.set)))
  if (!matches) return { value: 0, matches: false }
  const value =
    mode === 'only' || style === 'story'
      ? recommendationScoreFactorMaximums.collection
      : style === 'balanced'
        ? 8
        : 6
  return { value, matches: true }
}

function preferenceScore(
  card: RecommendationScoreCard,
  preferenceScores: Record<string, number>,
  collectionMatch: boolean,
  style: RecommendationScoreContext['recommendationStyle'],
) {
  const base =
    card.tags.reduce((score, tag) => score + (preferenceScores[tag] ?? 0), 0) +
    (collectionMatch ? (preferenceScores.Collection ?? 0) : 0)
  return Math.max(
    -recommendationScoreFactorMaximums.preferences,
    Math.min(recommendationScoreFactorMaximums.preferences, base * (style === 'story' ? 1.2 : 1)),
  )
}

function deckNeedsScore(
  cardRoles: string[],
  neededRoles: Set<string>,
  roleBoosts: Record<string, number>,
  roleSupply: Record<string, number>,
  batchNumber: number,
  style: RecommendationScoreContext['recommendationStyle'],
) {
  const roleAware = Object.values(roleBoosts).some((boost) => boost > 0)
  const urgency = cardRoles.reduce(
    (score, role) =>
      score +
      (roleBoosts[role] ?? 0) * (1 + 4 / Math.max(1, roleSupply[role] ?? 1)) +
      ((roleBoosts[role] ?? 0) > 0 ? Math.min(12, batchNumber - 1) : 0),
    0,
  )
  const ceiling = roleAware
    ? Math.max(
        1,
        ...Object.entries(roleBoosts)
          .filter(([, boost]) => boost > 0)
          .map(
            ([role, boost]) =>
              boost * (1 + 4 / Math.max(1, roleSupply[role] ?? 1)) + Math.min(12, batchNumber - 1),
          ),
      )
    : 1
  const base = roleAware
    ? recommendationScoreFactorMaximums.deckNeeds * Math.min(1, urgency / ceiling) ** 1.23
    : cardRoles.filter((role) => neededRoles.has(role)).length * 10
  const styleMultiplier =
    roleAware && style === 'story' ? 0.35 : roleAware && style === 'optimized' ? 1.25 : 1
  return Math.min(recommendationScoreFactorMaximums.deckNeeds, Math.floor(base * styleMultiplier))
}

export function recommendationScoreBreakdown(
  card: RecommendationScoreCard,
  {
    theme: declaredTheme,
    activeSubThemes,
    pickedTags,
    preferenceScores,
    neededRoles,
    cardRoles,
    recommendationStyle = 'balanced',
    collectionSets = [],
    collectionMode = 'none',
    roleBoosts = {},
    roleSupply = {},
    batchNumber = 1,
  }: RecommendationScoreContext,
): RecommendationScoreBreakdown {
  const collection = collectionScore(card, recommendationStyle, collectionSets, collectionMode)
  const evidence = evidenceScore(card, recommendationStyle)
  const theme =
    declaredTheme && card.tags.includes(declaredTheme) ? recommendationScoreFactorMaximums.theme : 0
  const subThemes = Math.min(
    recommendationScoreFactorMaximums.subThemes,
    card.tags.filter((tag) => activeSubThemes.includes(tag)).length * 4,
  )
  const deckFit = Math.min(
    recommendationScoreFactorMaximums.deckFit,
    card.tags.filter((tag) => pickedTags.has(tag)).length * 5,
  )
  const preferences = preferenceScore(
    card,
    preferenceScores,
    collection.matches,
    recommendationStyle,
  )
  const deckNeeds = deckNeedsScore(
    cardRoles,
    neededRoles,
    roleBoosts,
    roleSupply,
    batchNumber,
    recommendationStyle,
  )
  const popularityPenalty =
    recommendationStyle === 'story' &&
    (card.reason === 'Commander favourite' || card.reason === 'Popular inclusion')
      ? -recommendationScoreFactorMaximums.popularityPenalty
      : 0
  const total = Math.max(
    0,
    evidence +
      theme +
      subThemes +
      collection.value +
      deckFit +
      preferences +
      deckNeeds +
      popularityPenalty,
  )
  return {
    total,
    evidence,
    theme,
    subThemes,
    collection: collection.value,
    deckFit,
    preferences,
    deckNeeds,
    popularityPenalty,
  }
}

export function recommendationScore(
  card: RecommendationScoreCard,
  context: RecommendationScoreContext,
) {
  return recommendationScoreBreakdown(card, context).total
}

export function manualCardError(
  card: Pick<ScryfallCard, 'name' | 'type_line' | 'color_identity'>,
  deckNames: string[],
  commanderColours: string[],
) {
  if (card.color_identity.some((colour) => !commanderColours.includes(colour)))
    return 'Card is outside your commander’s colour identity.'
  if (!card.type_line.includes('Basic Land') && deckNames.includes(card.name))
    return 'Card is already in your deck.'
  return ''
}

export const recommendationReasons: Record<string, string> = {
  highsynergycards: 'Commander synergy',
  topcards: 'Commander favourite',
  newcards: 'Interesting new pick',
  creatures: 'Creature synergy',
  instants: 'Interaction',
  sorceries: 'Sorcery support',
  utilityartifacts: 'Utility artifact',
  utilityenchantments: 'Utility enchantment',
  enchantments: 'Enchantment synergy',
  artifacts: 'Artifact synergy',
  planeswalkers: 'Planeswalker support',
  lands: 'Land or mana',
  utilitylands: 'Land or mana',
  manafixing: 'Land or mana',
}

export const preconFastMana = new Set([
  'Chrome Mox',
  'Grim Monolith',
  'Jeweled Lotus',
  'Lotus Petal',
  'Mana Crypt',
  'Mana Vault',
  'Mox Diamond',
])
export const cardText = (card: ScryfallCard) =>
  card.oracle_text ??
  card.card_faces
    ?.map((face) => face.oracle_text)
    .filter(Boolean)
    .join('\n') ??
  card.type_line
export const formatUsdPrice = (price: string | null | undefined) => (price ? `$${price}` : '')
export const isReleased = (
  card: Pick<ScryfallCard, 'released_at'>,
  today = new Date().toISOString().slice(0, 10),
) => !card.released_at || card.released_at <= today
export const isManaCard = (card: ScryfallCard) =>
  card.type_line.includes('Land') || /add \{/i.test(cardText(card))

export function orderedPrintings<T extends PrintingLike>(original: PrintingLike, printings: T[]) {
  const unique = printings.filter(
    (printing, index, all) =>
      all.findIndex((item) => item.image === printing.image && item.finish === printing.finish) ===
      index,
  )
  const originalIndex = unique.findIndex((printing) => printing.image === original.image)
  return originalIndex < 1
    ? unique
    : [unique[originalIndex], ...unique.slice(0, originalIndex), ...unique.slice(originalIndex + 1)]
}

export function preferredPrintingIndex(
  printings: PrintingLike[],
  preferredSet: string,
  current = 0,
  manuallySelected = false,
) {
  if (manuallySelected) return current
  const preferred = preferredSet
    ? printings.findIndex((printing) => printing.set === preferredSet)
    : -1
  return preferred >= 0 ? preferred : 0
}
