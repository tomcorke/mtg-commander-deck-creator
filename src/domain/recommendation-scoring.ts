import { hasTag } from './creature-types.ts'
import type { PrintingLike, ScryfallCard } from './card-model.ts'
import {
  recommendationScoreFactorMaximums,
  recommendedScoreThreshold,
} from './recommendation-types.ts'
import type {
  ManaSupport,
  RecommendationScoreBreakdown,
  RecommendationScoreCard,
  RecommendationScoreContext,
} from './recommendation-types.ts'

export function manaSupportFromAnalysis(
  analysis: {
    counts: { lands: number; ramp: number }
    averageManaValue: number
    produced: Record<string, number>
  },
  targets: { lands: number; ramp: number },
): ManaSupport {
  return {
    landCount: analysis.counts.lands,
    rampCount: analysis.counts.ramp,
    landTarget: targets.lands,
    rampTarget: targets.ramp,
    averageManaValue: analysis.averageManaValue,
    producedMana: analysis.produced,
  }
}

function evidenceScore(
  card: RecommendationScoreCard,
  style: RecommendationScoreContext['recommendationStyle'],
) {
  if (card.localIndexSnapshot) return 0
  // EDHREC synergy (0.3 = played 30 points more often with this commander) adds up to 4, capped.
  const synergyBonus = Math.min(4, Math.max(0, Math.round((card.synergy ?? 0) * 10)))
  const base = Math.min(
    recommendationScoreFactorMaximums.evidence,
    synergyBonus +
      (card.reason === 'Commander synergy'
        ? 20
        : card.reason === 'Commander favourite'
          ? 15
          : card.reason === 'Popular inclusion' || card.reason === 'Land or mana'
            ? 8
            : 12),
  )
  if (style === 'thematic') return Math.round(base * 0.65)
  if (style === 'fun' && card.reason === 'Interesting new pick')
    return Math.min(recommendationScoreFactorMaximums.evidence, base + 8)
  if (style === 'competitive')
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
    mode === 'only' || style === 'thematic'
      ? recommendationScoreFactorMaximums.collection
      : style === 'fun' || style === 'balanced'
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
    Math.min(
      recommendationScoreFactorMaximums.preferences,
      base * (style === 'thematic' ? 1.2 : style === 'competitive' ? 0.8 : 1),
    ),
  )
}

// ponytail: source-count proxy; consider sampled draws if audits show poor castability rankings.
function manaFitPenalty(card: RecommendationScoreCard, support?: ManaSupport) {
  if (!support || !card.manaCost) return 0
  const totalSources = support.landCount + support.rampCount
  const targetSources = Math.max(1, support.landTarget + support.rampTarget)
  const sourceDeficit = Math.max(0, targetSources - totalSources) / targetSources
  const affordableManaValue = Math.max(4, support.averageManaValue + 1)
  const costPressure = Math.min(1, Math.max(0, ((card.manaValue ?? 0) - affordableManaValue) / 3))
  const sourcePenalty =
    sourceDeficit * costPressure * recommendationScoreFactorMaximums.manaFitPenalty
  const colourPips = [...(card.manaCost ?? '').matchAll(/\{([^}]+)\}/g)]
    .map(([, symbol]) =>
      symbol.split('/').filter((part) => ['W', 'U', 'B', 'R', 'G'].includes(part)),
    )
    .filter((options) => options.length)
  const pips = colourPips.filter((options) => options.length === 1).map(([colour]) => colour)
  const pipsByColour = new Map<string, number>()
  for (const colour of pips) pipsByColour.set(colour, (pipsByColour.get(colour) ?? 0) + 1)
  // A hybrid pip ({W/U}, {2/G}, {G/P}) is missing only when none of its colours has a source.
  const missingHybrid = colourPips.filter(
    (options) =>
      options.length > 1 && options.every((colour) => !(support.producedMana[colour] ?? 0)),
  ).length
  const missingPips =
    missingHybrid +
    [...pipsByColour].reduce(
      (missing, [colour, count]) =>
        missing + Math.max(0, count - (support.producedMana[colour] ?? 0)),
      0,
    )
  const colorPenalty =
    totalSources > 0 && colourPips.length
      ? (missingPips / colourPips.length) * recommendationScoreFactorMaximums.manaFitPenalty
      : 0
  const penalty = Math.min(
    recommendationScoreFactorMaximums.manaFitPenalty,
    Math.round(Math.max(sourcePenalty, colorPenalty)),
  )
  return penalty ? -penalty : 0
}

function deckNeedsScore(
  cardRoles: string[],
  credit: Partial<Record<string, number>>,
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
      (credit[role] ?? 1) *
        ((roleBoosts[role] ?? 0) * (1 + 4 / Math.max(1, roleSupply[role] ?? 1)) +
          ((roleBoosts[role] ?? 0) > 0 ? Math.min(12, batchNumber - 1) : 0)),
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
    : cardRoles
        .filter((role) => neededRoles.has(role))
        .reduce((sum, role) => sum + (credit[role] ?? 1) * 10, 0)
  const styleMultiplier =
    roleAware && style === 'thematic' ? 0.35 : roleAware && style === 'competitive' ? 1.25 : 1
  return Math.min(recommendationScoreFactorMaximums.deckNeeds, Math.floor(base * styleMultiplier))
}

// App heuristic, not a bracket or a predicted win turn. Core keeps the existing role ranking.
// ponytail: mana value is only a pace proxy; blind builds in #98 must calibrate card-specific value.
function powerFitPenalty(
  card: RecommendationScoreCard,
  roles: string[],
  target: RecommendationScoreContext['powerTarget'],
) {
  if (
    !target ||
    target === 'precon' ||
    card.manaValueKnown !== true ||
    !Number.isFinite(card.manaValue) ||
    card.typeLine?.includes('Land') ||
    /\{X\}/i.test(card.manaCost ?? '')
  )
    return 0
  const utility = roles.some((role) => ['ramp', 'draw', 'removal'].includes(role))
  if (!utility && !roles.includes('wipes')) return 0
  const threshold = (target === 'high' ? 2 : 3) + (utility ? 0 : 2)
  const penalty = Math.min(
    target === 'high' ? recommendationScoreFactorMaximums.powerFitPenalty : 4,
    Math.max(0, card.manaValue! - threshold) * (target === 'high' ? 2 : 1),
  )
  return penalty ? -penalty : 0
}

export function recommendationScoreBreakdown(
  card: RecommendationScoreCard,
  {
    theme: declaredTheme,
    activeSubThemes,
    pickedTags,
    tagCounts = {},
    preferenceScores,
    neededRoles,
    cardRoles,
    cardRoleCredit = {},
    recommendationStyle = 'balanced',
    collectionSets = [],
    collectionMode = 'none',
    roleBoosts = {},
    roleSupply = {},
    batchNumber = 1,
    manaSupport,
    powerTarget,
  }: RecommendationScoreContext,
): RecommendationScoreBreakdown {
  const collection = collectionScore(card, recommendationStyle, collectionSets, collectionMode)
  const evidence = evidenceScore(card, recommendationStyle)
  const goalThemeWeight = recommendationStyle === 'competitive' ? 0.5 : 1
  const theme =
    declaredTheme && hasTag(card, declaredTheme)
      ? Math.round(recommendationScoreFactorMaximums.theme * goalThemeWeight)
      : 0
  const subThemes = Math.min(
    recommendationScoreFactorMaximums.subThemes,
    Math.round(activeSubThemes.filter((tag) => hasTag(card, tag)).length * 4 * goalThemeWeight),
  )
  const deckFit = Math.min(
    recommendationScoreFactorMaximums.deckFit,
    Math.round(
      card.tags
        .filter((tag) => pickedTags.has(tag))
        // Full credit while the deck has up to six cards on a tag, then it shrinks: the fifteenth
        // payoff adds less than the second.
        .reduce((sum, tag) => sum + 5 * Math.min(1, 6 / Math.max(1, tagCounts[tag] ?? 0)), 0) *
        goalThemeWeight,
    ),
  )
  const preferences = preferenceScore(
    card,
    preferenceScores,
    collection.matches,
    recommendationStyle,
  )
  const deckNeeds = deckNeedsScore(
    cardRoles,
    cardRoleCredit,
    neededRoles,
    roleBoosts,
    roleSupply,
    batchNumber,
    recommendationStyle,
  )
  const manaFit = manaFitPenalty(card, manaSupport)
  const powerFit = powerFitPenalty(card, cardRoles, powerTarget)
  const popularityPenalty =
    recommendationStyle === 'thematic' &&
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
      manaFit +
      powerFit +
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
    manaFitPenalty: manaFit,
    popularityPenalty,
    powerFitPenalty: powerFit,
  }
}

export function compareRecommendationScores(
  left: RecommendationScoreBreakdown,
  right: RecommendationScoreBreakdown,
) {
  return right.total - left.total || right.deckNeeds - left.deckNeeds
}

export function recommendationScore(
  card: RecommendationScoreCard,
  context: RecommendationScoreContext,
) {
  return recommendationScoreBreakdown(card, context).total
}

export type RecommendationScoreRating = 'top' | 'strong' | 'recommended' | 'possible' | 'low'

export function recommendationScoreRating(score: number): RecommendationScoreRating {
  if (score >= 75) return 'top'
  if (score >= 60) return 'strong'
  if (score >= recommendedScoreThreshold) return 'recommended'
  if (score >= 25) return 'possible'
  return 'low'
}

export const recommendationReasons: Readonly<Record<string, string>> = Object.freeze({
  highliftcards: 'Commander synergy',
  highsynergycards: 'Commander synergy',
  topcards: 'Commander favourite',
  newcards: 'Interesting new pick',
  creatures: 'Creature synergy',
  instants: 'Instant support',
  sorceries: 'Sorcery support',
  utilityartifacts: 'Utility artifact',
  utilityenchantments: 'Utility enchantment',
  enchantments: 'Enchantment synergy',
  artifacts: 'Artifact synergy',
  planeswalkers: 'Planeswalker support',
  lands: 'Land or mana',
  utilitylands: 'Land or mana',
  manafixing: 'Land or mana',
})

export const preconFastMana: ReadonlySet<string> = new Set([
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
