import {
  analyseDeck,
  basicLandNames,
  basicLandPlan,
  cardTypes,
  deckGuidance,
  deckRoleBoosts,
  deckSection,
  isBasicLandName,
  rolesForCard,
  targetKeys,
  targetLabels,
} from '../deck-analysis.ts'
import { colourThemes, commanderNames, deckColumnSections } from '../domain/commander-catalog.ts'
import type { Card, DeckCard, ScryfallCard } from '../domain/card-model.ts'
import {
  findSynergyPair,
  manaSupportFromAnalysis,
  recommendationScoreBreakdown,
  recommendedScoreThreshold,
  sharedThemes,
  supportedThemes,
  themeMatchesSearch,
} from '../recommendations.ts'

export type BuilderDataDeps = Record<string, any>

const planeswalkerType = /\bPlaneswalker\b/
const otherPermanentTypes = /\b(?:Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/
const otherNonPermanentTypes = /\b(?:Instant|Sorcery)\b/

export function displayDeckSection(card: Pick<DeckCard, 'typeLine' | 'faces'>) {
  const typeLines = [card.typeLine, ...card.faces.map((face) => face.typeLine)].join(' ')
  if (planeswalkerType.test(typeLines)) return 'Planeswalkers'
  const section = deckSection(card.typeLine)
  if (section !== 'Other') return section
  if (otherPermanentTypes.test(typeLines)) return 'Other Permanents'
  if (otherNonPermanentTypes.test(typeLines)) return 'Other Non-permanents'
  return 'Other'
}

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
              deckCards.filter((card: Card) => card.tags.includes(name)).length >
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
    collectionSets,
    queue,
    deck,
    sideboard,
  } = deps
  const filteredCollectionCards = collectionBrowserCards
    .filter((card: ScryfallCard) => {
      const type =
        collectionBrowserType === 'all' ||
        card.type_line.toLowerCase().includes(collectionBrowserType)
      const mana = collectionBrowserMana.trim()
      const value = mana ? Number(mana) : NaN
      return (
        type &&
        (!mana ||
          (Number.isFinite(value) &&
            (value >= 7 ? (card.cmc ?? 0) >= 7 : (card.cmc ?? 0) === value)))
      )
    })
    .slice(0, 60)
  const filteredSetOptions = setOptions.filter((set: any) => {
    const query = collectionSearch.trim().toLowerCase()
    return (
      query.length >= 2 &&
      `${set.name} ${set.code}`.toLowerCase().includes(query) &&
      !collectionSets.includes(set.code)
    )
  })
  const collectionSetLabel = (code: string) => {
    const set = setOptions.find((item: any) => item.code === code)
    if (set) return `${set.name} (${code.toUpperCase()})`
    const card = [...queue, ...deck, ...sideboard, ...collectionBrowserCards].find(
      (item: any) => item.set === code,
    )
    const name = card && ('set_name' in card ? card.set_name : (card as DeckCard).setName)
    return name && name.toLowerCase() !== code
      ? `${name} (${code.toUpperCase()})`
      : code.toUpperCase()
  }
  return { filteredCollectionCards, filteredSetOptions, collectionSetLabel }
}

function buildDeckData(deps: BuilderDataDeps) {
  const { deck, commander, commanderDetails, deckTargets } = deps
  const analysis = analyseDeck(deck)
  const manaSupport = manaSupportFromAnalysis(analysis, deckTargets)
  const missingHealthRoles = targetKeys.filter((key) => analysis.counts[key] < deckTargets[key])
  const guidance = deckGuidance(deck.length, analysis.counts, deckTargets)
  const healthSuggestions =
    deps.recommendationStyle === 'story' && !deps.prioritizeDeckHealth
      ? deps.queue
          .slice(4)
          .filter(
            (card: Card, index: number, cards: Card[]) =>
              rolesForCard(card).some((role) => missingHealthRoles.includes(role)) &&
              cards.findIndex((item) => item.name === card.name) === index,
          )
          .slice(0, 3)
      : []
  const calculatedLandTarget = deckTargets.lands
  const basicLands = basicLandPlan(
    commanderDetails?.colours ?? [],
    analysis.required,
    analysis.counts.lands,
    calculatedLandTarget,
    deck.length,
  )
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
  const groupedDeckColumns = deckColumnSections.map((sections) =>
    sections
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
      .filter(
        ({ section, cards }) => cards.length || (section === 'Lands' && groupedBasics.length),
      ),
  )
  const legalBasicNames = commanderDetails?.colours.length
    ? commanderDetails.colours.map(
        (colour: string) => basicLandNames[colour as keyof typeof basicLandNames],
      )
    : ['Wastes']
  const maxCurveCount = Math.max(
    1,
    ...analysis.curve.map((point) => point.permanents + point.nonPermanents),
  )
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
    groupedBasics,
    groupedDeckColumns,
    legalBasicNames,
    maxCurveCount,
    displayedTypeCounts,
    maxTypeCount,
    manaColours: ['W', 'U', 'B', 'R', 'G'] as const,
  }
}

function buildRecommendationData(
  deps: BuilderDataDeps,
  deckData: ReturnType<typeof buildDeckData>,
) {
  const {
    queue,
    theme,
    activeSubThemes,
    collectionMode,
    collectionSets,
    preferenceScores,
    prioritizeDeckHealth,
    deckTargets,
    recommendationStyle,
    batchNumber,
    commander,
    deck,
  } = deps
  const rawBatch: Card[] = queue.slice(0, 4)
  const synergyPair = findSynergyPair(
    rawBatch.filter((card: Card) => card.reason !== 'Land or mana'),
  )
  const pairCards = synergyPair?.cards ?? []
  const visibleBatch: Card[] = pairCards.length
    ? [...pairCards, ...rawBatch.filter((card: Card) => !pairCards.includes(card))]
    : rawBatch
  const pickedTags = new Set([
    ...deck.slice(commanderNames(commander).length).flatMap((card: Card) => card.tags),
    ...Object.entries(preferenceScores as Record<string, number>)
      .filter(([, score]) => score > 0)
      .map(([tag]) => tag),
  ])
  const cardReason = (card: Card) => {
    const subThemes = activeSubThemes.filter((tag: string) => card.tags.includes(tag))
    if (subThemes.length) return `${subThemes.join(' + ')} sub-theme`
    if (theme && card.tags.includes(theme)) return `${theme} theme`
    if (collectionMode !== 'none' && card.collectionMatch) return 'Selected collection card'
    if (collectionMode !== 'none' && collectionSets.includes(card.set))
      return 'Selected collection printing'
    const missingRole = rolesForCard(card).find(
      (role) => role !== 'lands' && deckData.analysis.counts[role] < deckTargets[role],
    )
    if (missingRole) return targetLabels[missingRole]
    const preference = card.tags
      .filter((tag: string) => pickedTags.has(tag) && (preferenceScores[tag] ?? 0) > 0)
      .sort((a: string, b: string) => (preferenceScores[b] ?? 0) - (preferenceScores[a] ?? 0))[0]
    return preference ? `Matches your ${preference} picks` : card.reason
  }
  const recommendationRoleBoosts: Record<string, number> = prioritizeDeckHealth
    ? deckRoleBoosts(deck.length, deckData.analysis.counts, deckTargets)
    : {}
  const neededRoles = new Set(
    prioritizeDeckHealth
      ? targetKeys.filter((key) => deckData.analysis.counts[key] < deckTargets[key])
      : [],
  )
  const recommendationRoleSupply = Object.fromEntries(
    targetKeys.map((role) => [
      role,
      queue.filter((card: Card) => rolesForCard(card).includes(role)).length,
    ]),
  )
  const scoredBatch = visibleBatch.map((card: Card) => ({
    card,
    score: recommendationScoreBreakdown(card, {
      theme,
      activeSubThemes,
      pickedTags,
      preferenceScores,
      neededRoles,
      cardRoles: rolesForCard(card),
      recommendationStyle,
      collectionSets,
      collectionMode,
      roleBoosts: recommendationRoleBoosts,
      roleSupply: recommendationRoleSupply,
      batchNumber,
      manaSupport: deckData.manaSupport,
    }),
  }))
  const recommendedCard = scoredBatch.reduce(
    (best, item) =>
      item.score.total > best.score ? { card: item.card, score: item.score.total } : best,
    { card: null as Card | null, score: recommendedScoreThreshold - 1 },
  )
  return {
    rawBatch,
    synergyPair,
    pairCards,
    visibleBatch,
    pickedTags,
    cardReason,
    neededRoles,
    recommendationRoleSupply,
    scoredBatch,
    recommendedCard,
  }
}

function buildSettingsSummary(deps: BuilderDataDeps) {
  const {
    recommendationStyle,
    powerTarget,
    prioritizeDeckHealth,
    includeCreature,
    collectionSets,
    collectionMode,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
  } = deps
  const recommendationStyleLabel = (
    { story: 'Story', optimized: 'Optimized', balanced: 'Balanced' } as Record<string, string>
  )[recommendationStyle]
  const powerTargetLabel = (
    { precon: 'Core', upgraded: 'Upgraded', high: 'High power' } as Record<string, string>
  )[powerTarget]
  const excludedRecommendations = [
    excludeGameChangers && 'Game Changers',
    excludeTutors && 'tutors',
    excludeExtraTurns && 'extra turns',
    excludeUnreleased && 'unreleased',
  ].filter((value): value is string => Boolean(value))
  const collectionSummary =
    collectionSets.length && collectionMode !== 'none'
      ? `${collectionMode === 'only' ? 'Only' : 'Prefer'} ${collectionSets.length} set${collectionSets.length === 1 ? '' : 's'}`
      : 'Collection off'
  const recommendationSettingsSummary = [
    recommendationStyleLabel,
    powerTargetLabel,
    prioritizeDeckHealth ? 'Health prioritized' : 'Health optional',
    includeCreature ? 'Creatures included' : 'Creatures optional',
    collectionSummary,
    excludedRecommendations.length
      ? `${excludedRecommendations.length} exclusions`
      : 'No exclusions',
  ].join(' · ')
  return { recommendationSettingsSummary }
}

export function buildBuilderData(deps: BuilderDataDeps) {
  const themeData = buildThemeData(deps)
  const collectionData = buildCollectionData(deps)
  const deckData = buildDeckData(deps)
  return {
    ...themeData,
    ...collectionData,
    ...deckData,
    ...buildRecommendationData(deps, deckData),
    ...buildSettingsSummary(deps),
  }
}
