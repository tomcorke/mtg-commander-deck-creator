import { hasTag } from '../domain/creature-types.ts'
import {
  analyseDeck,
  basicLandNames,
  basicLandPlan,
  landFillReady,
  cardTypes,
  deckGuidance,
  deckSection,
  displayDeckSection,
  isBasicLandName,
  rolesForCard,
  targetKeys,
  targetLabels,
} from '../deck-analysis.ts'
import { rankLandSuggestions } from '../land-suggestions.ts'
import { colourThemes, commanderNames, deckSections } from '../domain/commander-catalog.ts'
import type { Card, DeckCard, ScryfallCard } from '../domain/card-model.ts'
import {
  compareRecommendationScores,
  findSynergyPair,
  manaSupportFromAnalysis,
  recommendationScoreBreakdown,
  sharedThemes,
  supportedThemes,
  themeEvidence,
  themeMatchesSearch,
  type ThemeEvidence,
} from '../recommendations.ts'

import { focusedRecommendations, withinPriceCap } from '../domain/recommendation-tuning.ts'
import { powerLabels, priorityLabels } from '../domain/glossary.ts'
import type { PowerTarget } from '../domain/recommendation-types.ts'
import { setPickerRows } from '../domain/set-picker.ts'
import { buildRecommendationContext } from '../domain/recommendation-context.ts'
import { describeRemainingBudget, remainingDeckBudget } from '../domain/deck-price.ts'
import { activeOwnershipMode, allowedByOwnership, ownedCardReason } from '../domain/owned-cards.ts'
import type { DeckDoctorFinding } from '../deck-doctor.ts'
import { suggestDeckDoctorChanges } from '../deck-doctor-suggestions.ts'
import { deckDataStatus, recommendationDataError } from '../domain/deck-data-status.ts'

export type BuilderDataDeps = Record<string, any>

export { displayDeckSection } from '../deck-analysis.ts'

function buildThemeData(deps: BuilderDataDeps) {
  const { commanderDetails, deck, activeSubThemes, theme, dismissedSubThemes, subThemeSearch } =
    deps
  const primaryTheme = colourThemes[commanderDetails?.colours[0] ?? 'C']
  const secondaryTheme =
    colourThemes[commanderDetails?.colours[1] ?? commanderDetails?.colours[0] ?? 'C']
  const deckCards = deck.slice(commanderNames(deps.commander).length)
  const dismissedThemeCounts = new Map(
    dismissedSubThemes.map((item: string) => {
      const split = item.lastIndexOf(':')
      return split > 0 ? [item.slice(0, split), Number(item.slice(split + 1))] : [item, Infinity]
    }),
  )
  const inferredSubThemes =
    activeSubThemes.length < 2
      ? sharedThemes(deckCards, [theme, ...activeSubThemes])
          .filter(
            (name) =>
              deckCards.filter((card: Card) => hasTag(card, name)).length >
              (dismissedThemeCounts.get(name) ?? -1),
          )
          .slice(0, 1)
      : []
  const inferredThemeOptions: string[] = [
    ...new Set<string>(deckCards.flatMap((card: Card) => card.tags)),
  ].filter((name) => supportedThemes.includes(name))
  const subThemeOptions: string[] = [
    ...new Set([...deps.commanderSubThemes, ...inferredThemeOptions, ...supportedThemes]),
  ]
  const filteredSubThemes = subThemeOptions.filter(
    (name) =>
      themeMatchesSearch(name, subThemeSearch) && name !== theme && !activeSubThemes.includes(name),
  )
  return {
    primaryTheme,
    secondaryTheme,
    deckCards,
    inferredSubThemes,
    inferredThemeOptions,
    subThemeOptions,
    filteredSubThemes,
  }
}

function buildCollectionData(deps: BuilderDataDeps) {
  const {
    collectionBrowserCards,
    collectionBrowserType,
    collectionBrowserMana,
    collectionSearch,
    setOptions,
    showSupplementalSets,
    queue,
    deck,
    sideboard,
  } = deps
  const filteredCollectionCards = collectionBrowserCards.filter((card: ScryfallCard) => {
    const type =
      collectionBrowserType === 'all' ||
      card.type_line.toLowerCase().includes(collectionBrowserType)
    const mana = collectionBrowserMana.trim()
    const value = mana ? Number(mana) : NaN
    return (
      type &&
      (!mana ||
        (Number.isFinite(value) && (value >= 7 ? (card.cmc ?? 0) >= 7 : (card.cmc ?? 0) === value)))
    )
  })
  const setRows = setPickerRows(setOptions, collectionSearch, showSupplementalSets)
  const collectionSetLabel = (code: string) => {
    const set = setOptions.find((item: any) => item.code === code)
    if (set) return set.name
    const card = [...queue, ...deck, ...sideboard, ...collectionBrowserCards].find(
      (item: any) => item.set === code,
    )
    const name = card && ('set_name' in card ? card.set_name : (card as DeckCard).setName)
    return name && name.toLowerCase() !== code ? name : code.toUpperCase()
  }
  return { filteredCollectionCards, setRows, collectionSetLabel }
}

function healthSuggestionCards(deps: BuilderDataDeps, missingHealthRoles: string[]): Card[] {
  const { deck, commanderDetails } = deps
  const healthSuggestions =
    deps.recommendationStyle === 'thematic' && !deps.prioritizeDeckHealth
      ? deps.queue
          .slice(4)
          .filter(
            (card: Card, index: number, cards: Card[]) =>
              !recommendationDataError(
                card,
                deck,
                commanderDetails?.colours ?? [],
                deps.excludeGameChangers,
              ) &&
              rolesForCard(card).some((role) => missingHealthRoles.includes(role)) &&
              cards.findIndex((item) => item.name === card.name) === index,
          )
          .slice(0, 3)
      : []
  return healthSuggestions
}

function buildDeckData(deps: BuilderDataDeps) {
  const { deck, commander, commanderDetails, deckTargets } = deps
  const analysis = analyseDeck(deck)
  const manaSupport = manaSupportFromAnalysis(analysis, deckTargets)
  const missingHealthRoles = targetKeys.filter((key) => analysis.counts[key] < deckTargets[key])
  const guidance = deckGuidance(deck.length, analysis.counts, deckTargets)
  const healthSuggestions = healthSuggestionCards(deps, missingHealthRoles)
  const calculatedLandTarget = deckTargets.lands
  const basicLands = basicLandPlan(
    commanderDetails?.colours ?? [],
    analysis.required,
    analysis.counts.lands,
    calculatedLandTarget,
    deck.length,
    analysis.produced,
  )
  const landGap = basicLands.reduce((sum, land) => sum + land.count, 0)
  const nonbasicLands = rankLandSuggestions(deps.queue, deck, {
    excluded: [...deck, ...deps.sideboard]
      .map((card: Card) => card.name)
      .concat(deps.ignoredCards ?? [], Object.keys(deps.decisions ?? {})),
    identity: commanderDetails?.colours ?? [],
    landTarget: calculatedLandTarget,
    limit: Math.min(6, landGap),
    maxPrice: deps.maxPrice,
    remainingBudget: remainingDeckBudget(deps.deckBudget, deck),
  })
  const showLandFill = landFillReady(deck.length, analysis.counts.lands, calculatedLandTarget)
  const indexedDeck: { card: DeckCard; index: number }[] = deck.map(
    (card: DeckCard, index: number) => ({ card, index }),
  )
  const commanders = indexedDeck.slice(0, commanderNames(commander).length)
  const groupedBasics = [
    ...new Set(
      indexedDeck.filter(({ card }) => isBasicLandName(card.name)).map(({ card }) => card.name),
    ),
  ].map((name: string) => ({
    name,
    cards: indexedDeck.filter(({ card }) => card.name === name),
  }))
  const mainboardDeck = indexedDeck.slice(commanderNames(commander).length)
  const deckGroups = deckSections
    .map((section) => {
      const cards =
        section === 'Commander'
          ? commanders
          : mainboardDeck.filter(
              ({ card }) => displayDeckSection(card) === section && !isBasicLandName(card.name),
            )
      return {
        section,
        cards,
        count:
          cards.length +
          (section === 'Lands'
            ? groupedBasics.reduce((sum, basic) => sum + basic.cards.length, 0)
            : 0),
      }
    })
    .filter(({ section, cards }) => cards.length || (section === 'Lands' && groupedBasics.length))
  const legalBasicNames = commanderDetails?.colours.length
    ? commanderDetails.colours.map(
        (colour: string) => basicLandNames[colour as keyof typeof basicLandNames],
      )
    : ['Wastes']
  const displayedTypeCounts = [
    ['Land', analysis.counts.lands],
    ...cardTypes.map((type) => [type, analysis.typeCounts[type]] as const),
    ['Other', deck.filter((card: Card) => deckSection(card.typeLine) === 'Other').length],
  ] as const
  const maxTypeCount = Math.max(1, ...displayedTypeCounts.map(([, count]) => count))
  return {
    analysis,
    manaSupport,
    missingHealthRoles,
    healthSuggestions,
    guidance,
    calculatedLandTarget,
    basicLands,
    landGap,
    nonbasicLands,
    showLandFill,
    groupedBasics,
    deckGroups,
    legalBasicNames,
    displayedTypeCounts,
    maxTypeCount,
    manaColours: ['W', 'U', 'B', 'R', 'G'] as const,
  }
}

const roleNouns: Record<string, string> = {
  ramp: 'ramp',
  draw: 'card draw',
  removal: 'removal',
  wipes: 'a board wipe',
}

function deckShare(inclusion: number) {
  return inclusion < 1 ? 'under 1%' : `${Math.round(inclusion)}%`
}

function evidenceSentence(card: Card, commander: string) {
  const share = card.inclusion === undefined ? '' : deckShare(card.inclusion)
  if (card.source === 'edhrec') {
    if (card.reason === 'Commander synergy')
      return share
        ? `High synergy with ${commander}; in ${share} of its decks on EDHREC.`
        : `EDHREC rates it a high-synergy card for ${commander}.`
    if (card.reason === 'Interesting new pick')
      return share
        ? `A new card already in ${share} of ${commander} decks on EDHREC.`
        : `A new card ${commander} players have started trying.`
    return share
      ? `In ${share} of ${commander} decks on EDHREC.`
      : `Commonly played in ${commander} decks on EDHREC.`
  }
  const sentences: Record<string, string> = {
    'Interesting new pick': 'A less common card that fits your deck’s themes.',
    'Land or mana': 'A popular land or mana source in your colours.',
    'Popular inclusion': 'A popular Commander card in your colours.',
    'Fills a role gap': 'Scryfall tags it for a role your deck is short on.',
    'Matches commander text': 'Its text matches a mechanic on your commander.',
    'Collection match': 'Comes from a set you chose to build with.',
    [ownedCardReason]: 'A card you own that suits your commander’s colours.',
    'Theme-compatible commander': 'A commander that shares your deck’s theme.',
  }
  return sentences[card.reason] ?? `${card.reason}.`
}

export type Explanation = {
  label: string
  sentence: string
  /** The reason leads with theme fit; other evidence must not replace it. */
  themeFit?: true
  /** Theme first (#560): the card matches no selected theme tag. Never set with `themeFit`. */
  generic?: true
}

const themeList = (themes: string[]) =>
  `${themes.join(' and ')} theme${themes.length > 1 ? 's' : ''}`

function themeMatchSentence({ theme, source, quote }: ThemeEvidence) {
  if (source === 'type') return `Type line matches your ${theme} theme: ${quote}.`
  // Keyword lines such as "Changeling" have no closing punctuation of their own.
  return `Text matches your ${theme} theme: “${quote}”${/[.!?…]$/.test(quote) ? '' : '.'}`
}

/**
 * Theme fit with the words that matched (#501). Matching is a text heuristic, so the copy says the
 * text matches rather than claiming the card is good in the theme.
 */
function themeFitReason(card: Card, themes: string[]): Explanation {
  const [first, ...extras] = themes
  const lead = themeEvidence(card, first)
  // The theme leads even without a quote; an extra theme's quote then follows it.
  const extra = lead ? undefined : extras.map((tag) => themeEvidence(card, tag)).find(Boolean)
  const others = extras.filter((tag) => tag !== extra?.theme)
  const sentence = [
    lead ? themeMatchSentence(lead) : `Fits your ${first} theme.`,
    ...(extra ? [themeMatchSentence(extra)] : []),
    ...(others.length ? [`Also fits your ${themeList(others)}.`] : []),
  ].join(' ')
  return { label: `${themes.join(' + ')} theme`, sentence, themeFit: true }
}

function recommendationExplainer(
  deps: BuilderDataDeps,
  deckData: ReturnType<typeof buildDeckData>,
  pickedTags: Set<string>,
) {
  const { theme, activeSubThemes, collectionMode, collectionSets, preferenceScores, deckTargets } =
    deps
  const commanderName = commanderNames(deps.commander)
    .map((name) => name.split(',')[0])
    .join(' and ')
  // The theme first, then extra themes, as Start and the builder order them.
  const selectedThemes = [...new Set([theme, ...activeSubThemes])].filter(Boolean) as string[]
  // Theme first marks offers that match no selected theme tag (#560); with no theme, every offer would.
  const marksGeneric = deps.recommendationStyle === 'thematic' && selectedThemes.length > 0
  const deckReason = (card: Card): Explanation | null => {
    // Theme fit leads (#501).
    const themes = selectedThemes.filter((tag) => hasTag(card, tag))
    if (themes.length) return themeFitReason(card, themes)
    if (collectionMode !== 'none' && card.collectionMatch)
      return {
        label: 'From your chosen sets',
        sentence: 'Comes from a set you chose to build with.',
      }
    if (collectionMode !== 'none' && collectionSets.includes(card.set))
      return {
        label: 'Printing from your chosen sets',
        sentence: 'This printing comes from a set you chose to build with.',
      }
    const missingRole = rolesForCard(card).find(
      (role) => role !== 'lands' && deckData.analysis.counts[role] < deckTargets[role],
    )
    if (missingRole)
      return {
        label: targetLabels[missingRole],
        sentence: `Adds ${roleNouns[missingRole]} your deck needs (${deckData.analysis.counts[missingRole]} of ${deckTargets[missingRole]} so far).`,
      }
    const preference = card.tags
      .filter((tag: string) => pickedTags.has(tag) && (preferenceScores[tag] ?? 0) > 0)
      .sort((a: string, b: string) => (preferenceScores[b] ?? 0) - (preferenceScores[a] ?? 0))[0]
    if (preference)
      return {
        label: `Matches your ${preference} picks`,
        sentence: `Like the ${preference} cards you have chosen so far.`,
      }
    return null
  }
  const explainCard = (card: Card): Explanation => {
    const reason = deckReason(card)
    if (!reason) return { label: card.reason, sentence: evidenceSentence(card, commanderName) }
    if (card.source !== 'edhrec' || card.inclusion === undefined) return reason
    const share = `${deckShare(card.inclusion)} of ${commanderName} decks on EDHREC.`
    // A quoted theme match ends in a closing quote, so the share follows as its own sentence.
    return {
      ...reason,
      sentence: reason.themeFit
        ? `${reason.sentence} In ${share}`
        : reason.sentence.replace(/\.$/, `, and appears in ${share}`),
    }
  }
  const explainRecommendation = (card: Card): Explanation => {
    const explanation = explainCard(card)
    return marksGeneric && !explanation.themeFit ? { ...explanation, generic: true } : explanation
  }
  return explainRecommendation
}

function buildRecommendationData(
  deps: BuilderDataDeps,
  deckData: ReturnType<typeof buildDeckData>,
) {
  const { queue } = deps
  const rawBatch = focusedRecommendations<Card>(queue, deps.focusedRole, rolesForCard).slice(0, 4)
  const synergyPair = findSynergyPair(
    rawBatch.filter((card: Card) => card.reason !== 'Land or mana'),
  )
  const pairCards = synergyPair?.cards ?? []
  const visibleBatch: Card[] = pairCards.length
    ? [...pairCards, ...rawBatch.filter((card: Card) => !pairCards.includes(card))]
    : rawBatch
  const context = buildRecommendationContext(deps, queue)
  const { pickedTags, neededRoles, roleSupply: recommendationRoleSupply } = context
  const explainRecommendation = recommendationExplainer(deps, deckData, pickedTags)
  const scoreCandidate = (card: Card) =>
    recommendationScoreBreakdown(card, { ...context, cardRoles: rolesForCard(card) })
  const blockedReplacements = new Set([
    ...(deps.ignoredCards ?? []),
    ...deps.sideboard.map((card: DeckCard) => card.name),
    ...Object.keys(deps.decisions ?? {}).filter((name) => deps.decisions[name] === 'ignore'),
  ])
  const scoreReplacements = (pool: Card[], remainingDeck: DeckCard[]) => {
    const replacementContext = buildRecommendationContext(deps, pool, remainingDeck)
    return pool
      .filter(
        (card) =>
          withinPriceCap(card, deps.maxPrice) &&
          !blockedReplacements.has(card.name) &&
          (deps.collectionMode !== 'only' ||
            card.collectionMatch ||
            deps.collectionSets.includes(card.set)) &&
          allowedByOwnership(card, deps.ownedCards, deps.ownershipMode),
      )
      .map((card) => ({
        card,
        score: recommendationScoreBreakdown(card, {
          ...replacementContext,
          cardRoles: rolesForCard(card),
        }),
      }))
  }
  const suggestFindingChanges = (findings: DeckDoctorFinding[], pool: Card[]) =>
    suggestDeckDoctorChanges({
      deck: deps.deck,
      commanderCount: commanderNames(deps.commander).length,
      commanderColours: deps.commanderDetails?.colours ?? [],
      deckTargets: deps.deckTargets,
      theme: deps.theme,
      activeSubThemes: deps.activeSubThemes,
      findings,
      rankedCandidates: scoreReplacements(pool, deps.deck)
        .sort((left, right) => compareRecommendationScores(left.score, right.score))
        .map(({ card, score }) => ({ card, fit: score.total })),
      // Existing deck cards have no comparable provider evidence. Use one neutral reason;
      // do not apply addition preferences (price, sets, ignores) to potential cuts.
      ratedCuts: deps.deck.slice(commanderNames(deps.commander).length).map((card: DeckCard) => ({
        card,
        fit: recommendationScoreBreakdown(
          { ...card, reason: 'Interesting new pick' },
          { ...context, cardRoles: rolesForCard(card) },
        ).total,
      })),
    })
  const scoredBatch = visibleBatch.map((card: Card) => ({ card, score: scoreCandidate(card) }))
  return {
    rawBatch,
    synergyPair,
    pairCards,
    visibleBatch,
    pickedTags,
    explainRecommendation,
    neededRoles,
    recommendationRoleSupply,
    scoreCandidate,
    scoreReplacements,
    suggestFindingChanges,
    scoredBatch,
  }
}

// Before a play style is chosen the defaults are not a choice, so the summary must not read as one.
function playStyleSummary(deps: BuilderDataDeps, settingsSummary: string) {
  if (deps.awaitingPlayStyle) return 'Play style: not chosen yet'
  return deps.playStyleSkippedBatch === deps.batchNumber
    ? `Play style skipped · ${settingsSummary}`
    : settingsSummary
}

function buildSettingsSummary(deps: BuilderDataDeps) {
  const {
    recommendationStyle,
    powerTarget,
    maxPrice,
    includeCreature,
    collectionSets,
    collectionMode,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
  } = deps
  const recommendationStyleLabel =
    priorityLabels[recommendationStyle as keyof typeof priorityLabels]
  const powerTargetLabel = powerLabels[powerTarget as PowerTarget]
  const excludedRecommendations = [
    excludeGameChangers && 'Game Changers',
    excludeTutors && 'tutors',
    excludeExtraTurns && 'extra turns',
    excludeUnreleased && 'unreleased',
  ].filter((value): value is string => Boolean(value))
  const collectionSummary =
    collectionSets.length && collectionMode !== 'none'
      ? `${collectionMode === 'only' ? 'Only' : 'Prefer'} selected sets`
      : 'All sets'
  const ownership = activeOwnershipMode(deps.ownershipMode, deps.ownedCards)
  const settingsSummary = [
    recommendationStyleLabel,
    powerTargetLabel,
    ...(maxPrice == null ? [] : [`≤ $${maxPrice}`]),
    ...(deps.deckBudget == null
      ? []
      : [
          describeRemainingBudget(
            deps.deckBudget,
            remainingDeckBudget(deps.deckBudget, deps.deck) ?? deps.deckBudget,
          ),
        ]),
    includeCreature ? 'Creatures included' : 'Creatures optional',
    collectionSummary,
    ...(ownership === 'ignore' ? [] : [ownership === 'only' ? 'Owned only' : 'Prefer owned']),
    excludedRecommendations.length
      ? `${excludedRecommendations.length} exclusions`
      : 'No exclusions',
  ].join(' · ')
  const recommendationQueryKey = JSON.stringify([
    deps.commander,
    deps.theme,
    deps.activeSubThemes,
    powerTarget,
    maxPrice,
    collectionMode,
    collectionSets,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    deps.ignoredCards,
    ownership,
    deps.ownedRevision,
  ])
  return {
    recommendationSettingsSummary: playStyleSummary(deps, settingsSummary),
    recommendationQueryKey,
  }
}

export function buildBuilderData(deps: BuilderDataDeps) {
  const themeData = buildThemeData(deps)
  const collectionData = buildCollectionData(deps)
  const deckData = buildDeckData(deps)
  return {
    ...themeData,
    ...collectionData,
    ...deckData,
    ...deckDataStatus(
      deps.deck,
      deps.commander,
      deps.queue,
      deps.sideboard,
      deps.deferredCards ?? [],
    ),
    ...buildRecommendationData(deps, deckData),
    ...buildSettingsSummary(deps),
  }
}
