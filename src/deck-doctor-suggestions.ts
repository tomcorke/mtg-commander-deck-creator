import {
  analyseDeck,
  curveBucket,
  requiredPipsForCard,
  rolesForCard,
  targetKeys,
  targetLabels,
  type DeckTargets,
  type TargetKey,
} from './deck-analysis.ts'
import type { Card, DeckCard } from './domain/card-model.ts'
import { cardConstructionError } from './domain/commander-construction.ts'
import { recommendedScoreThreshold } from './domain/recommendation-types.ts'
import { findSynergyPair } from './domain/recommendation-themes.ts'
import { deckReviewMode, type DeckDoctorFinding } from './deck-doctor.ts'

export type DoctorSuggestion = {
  cut?: { cutIndex: number; cutCard: DeckCard }
  addCard: Card
  impact: string
}

type RatedCard<T> = { card: T; fit: number }
type SuggestionInput = {
  deck: DeckCard[]
  commanderCount: number
  commanderColours: string[]
  deckTargets: DeckTargets
  theme: string
  activeSubThemes: string[]
  findings: DeckDoctorFinding[]
  /** Current, preference-filtered replacement pool, in shared-score order. */
  rankedCandidates: RatedCard<Card>[]
  ratedCuts: RatedCard<DeckCard>[]
}
type SuggestionContext = SuggestionInput &
  ReturnType<typeof analyseDeck> & {
    flagged: Set<string>
    cutFits: Map<DeckCard, number>
    lowFitCeiling: number
  }
type FindingContext = SuggestionContext & {
  finding: DeckDoctorFinding
  role: TargetKey | null
  tag: string
}
type CandidatePair = Omit<DoctorSuggestion, 'impact'> & { priority: number }
const colours = ['W', 'U', 'B', 'R', 'G'] as const
const bucketLabel = (bucket: number | null) =>
  bucket === null ? 'land' : bucket === 7 ? '7+' : String(bucket)

function suggestionImpact(pair: CandidatePair, context: FindingContext) {
  const { counts, deck, commanderCount, tag } = context
  const cut = pair.cut?.cutCard
  const cutRoles = cut ? rolesForCard(cut) : []
  const addRoles = rolesForCard(pair.addCard)
  const changes = targetKeys.flatMap((role) => {
    const next = counts[role] - Number(cutRoles.includes(role)) + Number(addRoles.includes(role))
    return next === counts[role] ? [] : [`${targetLabels[role]} ${counts[role]} → ${next}`]
  })
  if (tag) {
    const before = deck.slice(commanderCount).filter((card) => card.tags.includes(tag)).length
    changes.push(`${tag} support ${before} → ${before + 1}`)
  }
  const beforeBucket = cut ? curveBucket(cut) : null
  const afterBucket = curveBucket(pair.addCard)
  if (cut && beforeBucket !== afterBucket)
    changes.push(`Mana value: ${bucketLabel(beforeBucket)} → ${bucketLabel(afterBucket)}`)
  else if (!cut) changes.push(`Curve: +1 at ${bucketLabel(afterBucket)}`)
  return changes.length ? changes.join(' · ') : 'Roles and curve bucket unchanged'
}

function eligibleCut(card: DeckCard, index: number, context: FindingContext) {
  const {
    commanderCount,
    flagged,
    cutFits,
    lowFitCeiling,
    role,
    tag,
    counts,
    deckTargets,
    finding,
  } = context
  const roles = rolesForCard(card)
  const findingFlags = finding.kind === 'weak-connection' || finding.kind === 'mana-outlier'
  return (
    index >= commanderCount &&
    (flagged.has(card.name) || (cutFits.get(card) ?? Infinity) <= lowFitCeiling) &&
    !(role && roles.includes(role)) &&
    !(tag && card.tags.includes(tag)) &&
    !(roles.includes('lands') && counts.lands <= deckTargets.lands) &&
    !roles.some((key) => counts[key] <= 1 && counts[key] <= deckTargets[key]) &&
    (!findingFlags || finding.cardNames.includes(card.name))
  )
}

function connects(card: Card, context: FindingContext, cut?: DeckCard) {
  return (
    [context.theme, ...context.activeSubThemes].some((tag) => tag && card.tags.includes(tag)) ||
    rolesForCard(card).some((role) => context.counts[role] < context.deckTargets[role]) ||
    context.deck.some((other) => other !== cut && findSynergyPair([card, other]))
  )
}

function demandGap(card: DeckCard, context: SuggestionContext) {
  return colours.reduce(
    (sum, colour) =>
      sum + Math.max(0, requiredPipsForCard(card, colour) - context.produced[colour]),
    0,
  )
}

function addressesFinding(card: Card, context: FindingContext) {
  const { role, tag, finding } = context
  return (
    (!role || (targetKeys.includes(role) && rolesForCard(card).includes(role))) &&
    (!tag || card.tags.includes(tag)) &&
    (finding.kind !== 'weak-connection' || connects(card, context))
  )
}

function safePair(cut: DeckCard, addition: Card, context: FindingContext) {
  const { counts, deckTargets, finding, averageManaValue } = context
  const addRoles = rolesForCard(addition)
  const cutGap = demandGap(cut, context)
  const addGap = demandGap(addition, context)
  const improvesMana =
    !addRoles.includes('lands') &&
    addition.manaValue <= cut.manaValue &&
    (addGap < cutGap || addition.manaValue < cut.manaValue)
  return (
    !rolesForCard(cut).some((key) => counts[key] <= deckTargets[key] && !addRoles.includes(key)) &&
    (finding.kind !== 'weak-connection' || connects(addition, context, cut)) &&
    addGap <= cutGap &&
    !(
      addition.manaValue >= 6 &&
      addition.manaValue >= averageManaValue + 2 &&
      addition.manaValue > cut.manaValue
    ) &&
    (finding.kind !== 'mana-outlier' || improvesMana)
  )
}

function pairPriority(cut: DeckCard, addition: Card, fit: number, context: SuggestionContext) {
  const curveDistance = Math.abs((curveBucket(cut) ?? 0) - (curveBucket(addition) ?? 0))
  const pipDistance = colours.reduce(
    (sum, colour) =>
      sum + Math.abs(requiredPipsForCard(cut, colour) - requiredPipsForCard(addition, colour)),
    0,
  )
  return (
    fit -
    (context.cutFits.get(cut) ?? 0) +
    Number(context.flagged.has(cut.name)) * 20 -
    curveDistance * 4 -
    pipDistance * 2
  )
}

function suggestionsForFinding(finding: DeckDoctorFinding, input: SuggestionContext) {
  const context: FindingContext = {
    ...input,
    finding,
    role: finding.kind === 'role-gap' ? (finding.id.split(':')[1] as TargetKey) : null,
    tag: finding.kind === 'theme-support' ? finding.id.slice('theme-support:'.length) : '',
  }
  const cuts = input.deck.flatMap((cutCard, cutIndex) =>
    eligibleCut(cutCard, cutIndex, context) ? [{ cutIndex, cutCard }] : [],
  )
  const pairs: CandidatePair[] = []
  for (const { card: addCard, fit } of input.rankedCandidates) {
    // Validate against the full deck, conservatively avoiding same-card printing swaps.
    if (
      !addressesFinding(addCard, context) ||
      cardConstructionError(addCard, input.deck, input.commanderColours)
    )
      continue
    if (deckReviewMode(input.deck.length) === 'build') {
      if (finding.kind !== 'mana-outlier') pairs.push({ addCard, priority: fit })
      continue
    }
    for (const cut of cuts) {
      if (safePair(cut.cutCard, addCard, context))
        pairs.push({ cut, addCard, priority: pairPriority(cut.cutCard, addCard, fit, context) })
    }
  }
  return bestSuggestions(pairs, context)
}

function bestSuggestions(pairs: CandidatePair[], context: FindingContext) {
  const suggestions: DoctorSuggestion[] = []
  const usedCuts = new Set<number>()
  const usedAdditions = new Set<string>()
  for (const pair of pairs.sort((left, right) => right.priority - left.priority)) {
    if (usedAdditions.has(pair.addCard.name) || (pair.cut && usedCuts.has(pair.cut.cutIndex)))
      continue
    suggestions.push({
      cut: pair.cut,
      addCard: pair.addCard,
      impact: suggestionImpact(pair, context),
    })
    usedAdditions.add(pair.addCard.name)
    if (pair.cut) usedCuts.add(pair.cut.cutIndex)
    if (suggestions.length === 3) break
  }
  return suggestions
}

/** Heuristic pairing, not proof of card quality or a construction requirement. */
export function suggestDeckDoctorChanges(
  input: SuggestionInput,
): Record<string, DoctorSuggestion[]> {
  const lowestFits = [...input.ratedCuts].sort((left, right) => left.fit - right.fit)
  const context: SuggestionContext = {
    ...input,
    ...analyseDeck(input.deck),
    flagged: new Set(
      input.findings
        .filter(({ kind }) => kind === 'weak-connection' || kind === 'mana-outlier')
        .flatMap(({ cardNames }) => cardNames),
    ),
    cutFits: new Map(input.ratedCuts.map(({ card, fit }) => [card, fit])),
    lowFitCeiling: Math.min(
      recommendedScoreThreshold - 1,
      lowestFits[Math.max(0, Math.ceil(lowestFits.length / 4) - 1)]?.fit ?? -1,
    ),
  }
  // Pairing rule: cut flagged or bottom-quartile, below-recommended-fit main-deck cards;
  // never cut commanders, the finding's role/tag, scarce lands, or the last scarce role.
  // Add from the preference-filtered, shared-ranked pool only when it addresses the finding.
  // Prefer nearby curve buckets and coloured-pip requirements; below 90, add without cuts.
  return Object.fromEntries(
    input.findings.map((finding) => [finding.id, suggestionsForFinding(finding, context)]),
  )
}

export type DoctorDraft = { cutIndexes: number[]; additionNames: string[] }

/** Keep existing manual pairs together even when the draft has unpaired cuts or additions. */
export function addDoctorSuggestionToPlan(
  draft: DoctorDraft,
  suggestion: DoctorSuggestion,
): DoctorDraft {
  if (
    draft.additionNames.includes(suggestion.addCard.name) ||
    (suggestion.cut && draft.cutIndexes.includes(suggestion.cut.cutIndex))
  )
    return draft
  const cutIndexes = [...draft.cutIndexes]
  const additionNames = [...draft.additionNames]
  const position = suggestion.cut
    ? Math.min(cutIndexes.length, additionNames.length)
    : additionNames.length
  if (suggestion.cut) cutIndexes.splice(position, 0, suggestion.cut.cutIndex)
  additionNames.splice(position, 0, suggestion.addCard.name)
  return { cutIndexes, additionNames }
}

export function doctorSuggestionIsInPlan(draft: DoctorDraft, suggestion: DoctorSuggestion) {
  const position = draft.additionNames.indexOf(suggestion.addCard.name)
  return (
    position >= 0 &&
    (suggestion.cut
      ? draft.cutIndexes[position] === suggestion.cut.cutIndex
      : position >= draft.cutIndexes.length)
  )
}

/** Remove only the displayed pair, never another choice sharing its cut or addition. */
export function toggleDoctorSuggestionInPlan(
  draft: DoctorDraft,
  suggestion: DoctorSuggestion,
): DoctorDraft {
  if (!doctorSuggestionIsInPlan(draft, suggestion))
    return addDoctorSuggestionToPlan(draft, suggestion)
  const position = draft.additionNames.indexOf(suggestion.addCard.name)
  return {
    cutIndexes: draft.cutIndexes.filter((_, index) => !suggestion.cut || index !== position),
    additionNames: draft.additionNames.filter((_, index) => index !== position),
  }
}
