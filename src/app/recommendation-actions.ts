import { rolesForCard } from '../deck-analysis.ts'
import { ScryfallRateLimitError } from '../adapters/scryfall.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import { resetSignatureContext } from './signature-actions.ts'
import { commanderNames, themeSearchTerms } from '../domain/commander-catalog.ts'
import { commanderPrintingOptions, defaultFinish } from '../domain/printing.ts'
import {
  batchRecommendations,
  buildEdhrecRecommendations,
  commanderThemes,
  parseEdhrecEntries,
  preconFastMana,
  releaseDeferred,
  type CollectionMode,
  type DeferredCard,
  type ScryfallCard,
} from '../recommendations.ts'
import {
  toDeckCard,
  edhrecSlug,
  scryfallBackImage,
  toCard,
  type Card,
  type CommanderCard,
} from '../domain/card-model.ts'

import {
  cardConstructionError,
  commanderConstructionError,
} from '../domain/commander-construction.ts'

type StateSetter = (value: any) => void

/** Queue progress carried across a settings change that re-fetches the candidate pool. */
export type RecommendationProgress = {
  deferredCards: DeferredCard<Card>[]
  batchNumber: number
  preferenceScores: Record<string, number>
}

/** Settings that decide which cards are fetched; other settings only re-rank the pool. */
export function recommendationPoolKey(deps: Record<string, any>) {
  const { collectionMode = 'none', collectionSets = [] } = deps
  return JSON.stringify([
    deps.commander,
    deps.powerTarget,
    deps.excludeGameChangers,
    deps.excludeTutors,
    deps.excludeExtraTurns,
    deps.excludeUnreleased,
    deps.theme,
    [...(deps.activeSubThemes ?? [])].sort(),
    collectionMode,
    [...collectionSets].sort(),
  ])
}

type StateSetters = {
  [
    key in
      | 'setActiveSavedDeckId'
      | 'setActiveSubThemes'
      | 'setBatchAnnouncement'
      | 'setBatchNumber'
      | 'setCollectionError'
      | 'setCollectionGroups'
      | 'setCollectionMode'
      | 'setCollectionPoolSize'
      | 'setCollectionSearch'
      | 'setCollectionSets'
      | 'setCollectionState'
      | 'setCommanderDetails'
      | 'setCommanderSubThemes'
      | 'setCommander'
      | 'setDecisions'
      | 'setDeckName'
      | 'setDeck'
      | 'setDeferredCards'
      | 'setDismissedSubThemes'
      | 'setIgnoredCards'
      | 'setImportError'
      | 'setImportSource'
      | 'setImportState'
      | 'setLiked'
      | 'setLimitedRecommendations'
      | 'setManualPrintings'
      | 'setManualPrinting'
      | 'setPendingCardRemoval'
      | 'setPendingRemoval'
      | 'setPreferenceScores'
      | 'setPreferredPrintSet'
      | 'setPrioritizeDeckHealth'
      | 'setQueue'
      | 'setRecommendationLoadingStep'
      | 'setRecommendationLoadingTitle'
      | 'setRecommendationOptionsChanged'
      | 'setRecommendationState'
      | 'setRecommendationStyle'
      | 'setSavedDecks'
      | 'setSelectedCollectionCard'
      | 'setSelectedDeckCardLocation'
      | 'setSelectedGuidanceCard'
      | 'setSelectedCardReference'
      | 'setSelectedManualCard'
      | 'setSideboard'
      | 'setSubThemeSearch'
      | 'setTheme'
      | 'setLoadingArt'
      | 'setCopied'
      | 'setBasicLandState'
      | 'setDeckTargets'
      | 'setShowCollectionBrowser'
      | 'setShowBuilder'
      | 'setPowerTarget'
      | 'setCollectionBrowserCards'
      | 'setCollectionBrowserError'
      | 'setCollectionBrowserState'
  ]: StateSetter
}

export type ActionDeps = Record<string, any> & StateSetters

export async function fallbackRecommendations(deps: ActionDeps, identityColours: string[]) {
  const {
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    powerTarget,
    includeCreature,
    searchCards,
  } = deps
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeTutors && '-otag:tutor',
    excludeExtraTurns && '-otag:extra-turn',
    excludeUnreleased && 'date<=today',
  ]
    .filter(Boolean)
    .join(' ')
  const baseQuery = `id<=${identity} legal:commander -is:commander ${bracketFilters}`
  const [mainCards, manaCards] = await Promise.all([
    searchCards(`${baseQuery} -t:land -o:"add {"`, undefined, 'edhrec'),
    searchCards(`${baseQuery} (t:land or o:"add {")`, undefined, 'edhrec'),
  ])
  const allowed = (cards: ScryfallCard[]) =>
    cards.filter((card) => powerTarget !== 'precon' || !preconFastMana.has(card.name))
  const main = allowed(mainCards).sort(() => Math.random() - 0.5)
  const mana = allowed(manaCards).sort(() => Math.random() - 0.5)
  return batchRecommendations(
    [
      ...main.map((card) => toCard(card, 'Popular inclusion')),
      ...mana.map((card) => toCard(card, 'Land or mana')),
    ],
    includeCreature,
  )
}

export async function fetchRecommendationCollectionCards(
  deps: ActionDeps,
  identityColours: string[],
  selectedSets: string[],
) {
  const {
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    powerTarget,
    fetchCollection,
  } = deps
  const cards = await fetchCollection(identityColours, selectedSets, {
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
  })
  return cards.filter(
    (card: ScryfallCard) => powerTarget !== 'precon' || !preconFastMana.has(card.name),
  )
}

export async function collectionRecommendations(
  deps: ActionDeps,
  identityColours: string[],
  selectedSets: string[],
) {
  const { setCollectionState, setCollectionError, setCollectionPoolSize } = deps
  if (!selectedSets.length) return []
  setCollectionState('loading')
  setCollectionError('')
  try {
    const unique = await fetchRecommendationCollectionCards(deps, identityColours, selectedSets)
    setCollectionPoolSize(unique.length)
    setCollectionState('idle')
    return unique.map((card: ScryfallCard) => ({
      ...toCard(card, 'Collection match', `collection ${selectedSets.join(' ')}`),
      collectionMatch: true,
    }))
  } catch (error) {
    setCollectionState('error')
    setCollectionError(error instanceof Error ? error.message : 'Collection unavailable')
    throw error
  }
}

export async function themeRecommendations(
  deps: ActionDeps,
  identityColours: string[],
  themes: string[],
) {
  const {
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    powerTarget,
    searchCards,
  } = deps
  const terms = [...new Set(themes.map((name) => themeSearchTerms[name]).filter(Boolean))]
  if (!terms.length) return []
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeTutors && '-otag:tutor',
    excludeExtraTurns && '-otag:extra-turn',
    excludeUnreleased && 'date<=today',
  ]
    .filter(Boolean)
    .join(' ')
  const query = `id<=${identity} legal:commander -is:commander (${terms.join(' or ')}) ${bracketFilters}`
  const cards = await searchCards(query, undefined, 'random')
  return cards
    .filter((card: ScryfallCard) => powerTarget !== 'precon' || !preconFastMana.has(card.name))
    .map((card: ScryfallCard) => toCard(card, 'Interesting new pick', `theme ${themes.join(' ')}`))
}

export async function edhrecRecommendations(
  deps: ActionDeps,
  slug: string,
  excludedNames: string[] = [],
) {
  const {
    fetchEdhrec,
    setCommanderSubThemes,
    includeCreature,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    powerTarget,
    fetchCards,
  } = deps
  const result = await fetchEdhrec(slug)
  setCommanderSubThemes(commanderThemes(result.tag_counts ?? []))
  const lists = result.container?.json_dict?.cardlists ?? []
  const allEntries = parseEdhrecEntries(lists)
  if (!allEntries.length) throw new Error('No EDHREC cards')
  const excluded = new Set(excludedNames.map((name) => name.toLowerCase()))
  const entries = allEntries.filter(({ name }) => !excluded.has(name.toLowerCase()))
  const responseCards: ScryfallCard[] = await fetchCards(entries.map(({ name }) => ({ name })))
  return buildEdhrecRecommendations(entries, responseCards, {
    includeCreature,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    powerTarget,
  })
}

export async function loadCommanderCards(deps: ActionDeps, chosen: string) {
  const { fetchCard, fetchPrintings } = deps
  const commanders = await Promise.all(
    commanderNames(chosen).map((name) => fetchCard(name) as Promise<CommanderCard>),
  )
  const error = commanderConstructionError(commanders.map(toDeckCard))
  if (error) throw new Error(error)
  const images = commanders.flatMap(
    (card) => card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? [],
  )
  const art = commanders.flatMap(
    (card) => card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? [],
  )
  const identityColours = [...new Set(commanders.flatMap((card) => card.color_identity))]
  const printings = await Promise.all(
    commanders.map(async (card) => {
      const finish = defaultFinish(card.finishes)
      const primary = {
        image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '',
        backImage: scryfallBackImage(card),
        art: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop,
        set: card.set,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        scryfallUri: card.scryfall_uri,
        price:
          (finish === 'etched'
            ? card.prices?.usd_etched
            : finish === 'foil'
              ? card.prices?.usd_foil
              : card.prices?.usd) ?? undefined,
        priceUri: card.purchase_uris?.tcgplayer,
        finish,
      }
      const alternatives = commanderPrintingOptions(await fetchPrintings(card.prints_search_uri))
      return [
        primary,
        ...alternatives.filter(
          (printing) => printing.image !== primary.image || printing.finish !== primary.finish,
        ),
      ]
    }),
  )
  return { commanders, images, art, identityColours, printings }
}

export function resetRecommendationState(
  deps: ActionDeps,
  preserveDeck: boolean,
  progress?: RecommendationProgress,
) {
  resetSignatureContext(deps, preserveDeck ? undefined : crypto.randomUUID())
  const {
    navigateView,
    activeModal,
    setDeferredCards,
    setBatchNumber,
    setDecisions,
    setLiked,
    setBatchAnnouncement,
    setCommanderSubThemes,
    setDeck,
    setSideboard,
    setIgnoredCards,
    setActiveSubThemes,
    setDismissedSubThemes,
    setPreferenceScores,
    setCollectionSets,
    setCollectionGroups,
    setCollectionMode,
    setCollectionSearch,
    setCollectionPoolSize,
    setShowCollectionBrowser,
    recommendationStyle,
    setPrioritizeDeckHealth,
    setCommanderDetails,
    setQueue,
    setLimitedRecommendations,
    setCollectionState,
    setCollectionError,
    setPreferredPrintSet,
    setRecommendationLoadingStep,
    setRecommendationLoadingTitle,
    setRecommendationState,
    collectionSets,
    collectionMode,
  } = deps
  const activeCollectionSets = preserveDeck ? collectionSets : []
  const activeCollectionMode = preserveDeck ? collectionMode : 'none'
  // A settings refresh keeps the current builder workflow and its pending choices open.
  if (!progress) navigateView('builder', null, activeModal !== null)
  const cycle = progress ?? deps.freshRecommendationCycle()
  setDeferredCards(cycle.deferredCards)
  setBatchNumber(cycle.batchNumber)
  setDecisions({})
  setLiked((current: string[]) => (progress ? current : []))
  setBatchAnnouncement('')
  setCommanderSubThemes([])
  if (!preserveDeck) {
    setDeck([])
    setSideboard([])
    deps.setDeckDoctorHistory([])
    deps.setDeckDoctorError('')
    setIgnoredCards([])
    setActiveSubThemes([])
    setDismissedSubThemes([])
    setPreferenceScores({})
    setCollectionSets([])
    setCollectionGroups([])
    setCollectionMode('none')
    setCollectionSearch('')
    setCollectionPoolSize(null)
    setShowCollectionBrowser(false)
    setPrioritizeDeckHealth(recommendationStyle !== 'thematic')
  }
  setCommanderDetails(null)
  setQueue([])
  setLimitedRecommendations(false)
  setCollectionState('idle')
  setCollectionError('')
  if (!preserveDeck) setPreferredPrintSet('')
  setRecommendationLoadingStep('commander')
  setRecommendationLoadingTitle(
    preserveDeck ? 'Updating recommendations' : 'Building your first batch',
  )
  setRecommendationState('loading')
  return { activeCollectionSets, activeCollectionMode }
}

export function addCommanderCards(deps: ActionDeps, loaded: any, preserveDeck: boolean) {
  const { setCommanderDetails, setDeck } = deps
  const { commanders, images, art, identityColours, printings } = loaded
  if (
    preserveDeck &&
    deps.commanderDetails &&
    commanders.every((card: CommanderCard, index: number) => deps.deck[index]?.name === card.name)
  )
    setCommanderDetails(deps.commanderDetails)
  else if (images.length)
    setCommanderDetails({
      images,
      art,
      colours: identityColours,
      printings,
      selections: commanders.map(() => 0),
    })
  if (!preserveDeck) {
    setDeck(
      commanders.map((card: CommanderCard, index: number) => ({
        ...toDeckCard(card),
        printings: printings[index],
        printing: 0,
        finish: printings[index][0].finish,
      })),
    )
  }
}

async function coreRecommendations(
  deps: ActionDeps,
  commanders: CommanderCard[],
  identityColours: string[],
  preserveDeck: boolean,
) {
  const { setLimitedRecommendations, theme, activeSubThemes } = deps
  let offeredCards: Card[]
  try {
    const slug = commanders
      .map((commander) => edhrecSlug(commander.related_uris?.edhrec, commander.name))
      .join('-')
    const excludedNames = [
      ...commanders.map(({ name }) => name),
      ...(preserveDeck
        ? [...deps.deck, ...deps.sideboard]
            .map(({ name }: Card) => name)
            .concat(deps.ignoredCards ?? [])
        : []),
    ]
    offeredCards = await edhrecRecommendations(deps, slug, excludedNames)
    offeredCards = offeredCards.filter((card) => !cardConstructionError(card, [], identityColours))
    if (offeredCards.length < 4) throw new Error('Too few EDHREC cards')
  } catch (error) {
    if (error instanceof ScryfallRateLimitError) throw error
    offeredCards = await fallbackRecommendations(deps, identityColours)
    setLimitedRecommendations(true)
  }
  try {
    const themeCards = await themeRecommendations(deps, identityColours, [
      theme,
      ...(preserveDeck ? activeSubThemes : []),
    ])
    const names = new Set(offeredCards.map((card: Card) => card.name))
    return [...offeredCards, ...themeCards.filter((card: Card) => !names.has(card.name))]
  } catch (error) {
    if (error instanceof ScryfallRateLimitError) throw error
    return offeredCards
  }
}

async function addCollectionRecommendations(
  deps: ActionDeps,
  offeredCards: Card[],
  identityColours: string[],
  activeCollectionSets: string[],
  activeCollectionMode: string,
) {
  if (activeCollectionMode === 'only' && !activeCollectionSets.length) return []
  if (activeCollectionMode === 'none' || !activeCollectionSets.length) return offeredCards
  try {
    const collectionCards = await collectionRecommendations(
      deps,
      identityColours,
      activeCollectionSets,
    )
    if (activeCollectionMode === 'only') return collectionCards
    const collectionNames = new Set(collectionCards.map((card: Card) => card.name))
    return [
      ...collectionCards,
      ...offeredCards.filter((card: Card) => !collectionNames.has(card.name)),
    ]
  } catch (error) {
    if (error instanceof ScryfallRateLimitError || activeCollectionMode === 'only') throw error
    return offeredCards
  }
}

export async function fetchDeckDoctorCandidates(deps: ActionDeps) {
  const { commander, commanderDetails, collectionSets, collectionMode, fetchCard } = deps
  if (!commanderDetails) return []
  const commanders = await Promise.all(
    commanderNames(commander).map((name) => fetchCard(name) as Promise<CommanderCard>),
  )
  const identityColours = commanderDetails.colours
  const offered =
    collectionMode === 'only'
      ? []
      : await coreRecommendations(deps, commanders, identityColours, true)
  const candidates: Card[] = await addCollectionRecommendations(
    deps,
    offered,
    identityColours,
    collectionSets,
    collectionMode,
  )
  const existingNames = new Set([
    ...[...deps.deck, ...deps.sideboard, ...commanders].map(({ name }: { name: string }) => name),
    ...(deps.ignoredCards ?? []),
  ])
  return candidates
    .filter((card) => !existingNames.has(card.name))
    .filter((card) => !cardConstructionError(card, deps.deck, identityColours))
}

export async function fetchDeckDoctorCommanders(deps: ActionDeps): Promise<Card[]> {
  const currentNames = commanderNames(deps.commander)
  if (currentNames.length !== 1) return []
  const themes = [...new Set([deps.theme, ...deps.activeSubThemes].filter(Boolean))]
  const terms = [...new Set(themes.map((name) => themeSearchTerms[name]).filter(Boolean))]
  if (!terms.length) return []

  const requiredColours = new Set(
    [...deps.deck.slice(currentNames.length), ...deps.sideboard].flatMap(
      (card: any) => card.colorIdentity ?? [],
    ),
  )
  const exclusions = [
    deps.excludeGameChangers && '-is:gamechanger',
    deps.excludeTutors && '-otag:tutor',
    deps.excludeExtraTurns && '-otag:extra-turn',
    deps.excludeUnreleased && 'date<=today',
  ]
    .filter(Boolean)
    .join(' ')
  const results = await deps.searchCards(
    `is:commander legal:commander (${terms.join(' or ')}) ${exclusions}`,
    undefined,
    'edhrec',
  )
  const seen = new Set(currentNames)
  return results
    .filter((card: ScryfallCard) => {
      if (
        seen.has(card.name) ||
        ![...requiredColours].every((colour) => card.color_identity.includes(colour))
      )
        return false
      seen.add(card.name)
      return true
    })
    .slice(0, 3)
    .map((card: ScryfallCard) =>
      toCard(card, 'Theme-compatible commander', `theme ${themes.join(' ')}`),
    )
}

async function collectOfferedCards(
  deps: ActionDeps,
  loaded: any,
  preserveDeck: boolean,
  activeCollectionSets: string[],
  activeCollectionMode: string,
) {
  const { commanders, identityColours } = loaded
  const { setRecommendationLoadingStep, setLimitedRecommendations } = deps
  setRecommendationLoadingStep('recommendations')
  if (activeCollectionMode === 'only' && !activeCollectionSets.length)
    throw new Error('Select at least one collection for Only collection mode.')
  if (activeCollectionMode === 'only') setLimitedRecommendations(true)
  const offeredCards =
    activeCollectionMode === 'only'
      ? []
      : await coreRecommendations(deps, commanders, identityColours, preserveDeck)
  return addCollectionRecommendations(
    deps,
    offeredCards,
    identityColours,
    activeCollectionSets,
    activeCollectionMode,
  )
}

function filterInitialRecommendations(
  offeredCards: Card[],
  deps: ActionDeps,
  preserveDeck: boolean,
  progress?: RecommendationProgress,
) {
  if (!preserveDeck) return offeredCards
  const { ignoredCards, deck, sideboard } = deps
  const deferred = new Set(progress?.deferredCards.map(({ card }) => card.name))
  return offeredCards.filter(
    (card) =>
      !ignoredCards.includes(card.name) &&
      !deferred.has(card.name) &&
      ![...deck, ...sideboard].some((deckCard: Card) => deckCard.name === card.name),
  )
}

function buildInitialRankingContext(
  deps: ActionDeps,
  offeredCards: Card[],
  chosen: string,
  preserveDeck: boolean,
  activeCollectionSets: string[],
  activeCollectionMode: CollectionMode,
  progress?: RecommendationProgress,
) {
  return buildRecommendationContext(
    {
      ...deps,
      commander: chosen,
      activeSubThemes: preserveDeck ? deps.activeSubThemes : [],
      preferenceScores: progress?.preferenceScores ?? (preserveDeck ? deps.preferenceScores : {}),
      prioritizeDeckHealth: preserveDeck
        ? deps.prioritizeDeckHealth
        : deps.recommendationStyle !== 'thematic',
      collectionSets: activeCollectionSets,
      collectionMode: activeCollectionMode,
      batchNumber: progress?.batchNumber ?? 1,
    },
    offeredCards,
    preserveDeck ? deps.deck : [],
  )
}

export function rankInitialRecommendations(
  deps: ActionDeps,
  offeredCards: Card[],
  chosen: string,
  preserveDeck: boolean,
  activeCollectionSets: string[],
  activeCollectionMode: CollectionMode,
  progress?: RecommendationProgress,
) {
  const { includeCreature, setQueue, setRecommendationState, loadPrintings, preferredPrintSet } =
    deps
  offeredCards = offeredCards.filter(
    (card) => !cardConstructionError(card, [], deps.commanderDetails?.colours ?? []),
  )
  if (offeredCards.length < 4)
    throw new Error(
      activeCollectionMode === 'only'
        ? 'Your chosen sets have too few legal cards.'
        : 'Too few recommendation cards',
    )
  if (progress) {
    const offered = new Map(offeredCards.map((card) => [card.name, card]))
    // Keep off-pool deferrals so restoring settings also restores their original waiting period.
    const deferred = progress.deferredCards.map((entry) => ({
      ...entry,
      card: offered.get(entry.card.name) ?? entry.card,
      available: offered.has(entry.card.name),
    }))
    progress = {
      ...progress,
      deferredCards: releaseDeferred(deferred, progress.batchNumber).waiting,
    }
    deps.setDeferredCards(progress.deferredCards)
  }
  offeredCards = filterInitialRecommendations(offeredCards, deps, preserveDeck, progress)
  const rankingContext = buildInitialRankingContext(
    deps,
    offeredCards,
    chosen,
    preserveDeck,
    activeCollectionSets,
    activeCollectionMode,
    progress,
  )
  const ranked = deps.rankRecommendationCards(
    offeredCards,
    rankingContext,
    includeCreature,
    rolesForCard,
  )
  setQueue(ranked)
  if (progress)
    deps.setBatchAnnouncement(`Recommendations updated for batch ${progress.batchNumber}.`)
  setRecommendationState('idle')
  void loadPrintings(
    ranked.slice(0, 8),
    activeCollectionSets[0] || (preserveDeck ? preferredPrintSet : ''),
    activeCollectionSets,
    activeCollectionMode,
  )
  return true
}

export async function start(
  deps: ActionDeps,
  name: string,
  preserveDeck = false,
  progress?: RecommendationProgress,
) {
  const chosen = name.trim()
  if (!chosen) return false
  if (preserveDeck)
    progress ??= {
      deferredCards: deps.deferredCards ?? [],
      batchNumber: deps.batchNumber ?? 1,
      preferenceScores: deps.preferenceScores ?? {},
    }
  const reset = resetRecommendationState(deps, preserveDeck, progress)
  deps.setCommander(chosen)
  const poolKey = recommendationPoolKey({
    ...deps,
    commander: chosen,
    activeSubThemes: preserveDeck ? deps.activeSubThemes : [],
    collectionSets: reset.activeCollectionSets,
    collectionMode: reset.activeCollectionMode,
  })
  try {
    const loaded = await loadCommanderCards(deps, chosen)
    addCommanderCards(deps, loaded, preserveDeck)
    const offeredCards = await collectOfferedCards(
      deps,
      loaded,
      preserveDeck,
      reset.activeCollectionSets,
      reset.activeCollectionMode,
    )
    rankInitialRecommendations(
      deps,
      offeredCards,
      chosen,
      preserveDeck,
      reset.activeCollectionSets,
      reset.activeCollectionMode,
      progress,
    )
    if (deps.recommendationPoolKey) deps.recommendationPoolKey.current = poolKey
    deps.setRecommendationOptionsChanged?.(false)
    return true
  } catch (error) {
    deps.setCollectionError(error instanceof Error ? error.message : 'Suggestions unavailable')
    deps.setRecommendationState('error')
    return false
  }
}
