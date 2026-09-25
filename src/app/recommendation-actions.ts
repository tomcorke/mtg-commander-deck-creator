import { analyseDeck, deckRoleBoosts, rolesForCard, targetKeys } from '../deck-analysis.ts'
import { commanderNames, themeSearchTerms } from '../domain/commander-catalog.ts'
import { commanderPrintingOptions, defaultFinish } from '../domain/printing.ts'
import {
  batchRecommendations,
  buildEdhrecRecommendations,
  commanderThemes,
  manaSupportFromAnalysis,
  parseEdhrecEntries,
  preconFastMana,
  type ScryfallCard,
} from '../recommendations.ts'
import {
  cardTags,
  edhrecSlug,
  scryfallBackImage,
  toCard,
  type Card,
  type CommanderCard,
} from '../domain/card-model.ts'

type StateSetter = (value: any) => void

type StateSetters = {
  [
    key in
      | 'setActiveSavedDeckId'
      | 'setActiveSubThemes'
      | 'setBatchAnnouncement'
      | 'setBatchNumber'
      | 'setCardSearchResults'
      | 'setCardSearchState'
      | 'setCardSearch'
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

export async function edhrecRecommendations(deps: ActionDeps, slug: string) {
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
  const entries = parseEdhrecEntries(lists)
  if (!entries.length) throw new Error('No EDHREC cards')
  const responseCards: ScryfallCard[] = []
  for (let index = 0; index < entries.length; index += 75) {
    responseCards.push(
      ...(await fetchCards(entries.slice(index, index + 75).map(({ name }) => ({ name })))),
    )
  }
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

export function resetRecommendationState(deps: ActionDeps, preserveDeck: boolean) {
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
  navigateView('builder', null, activeModal !== null)
  const cycle = deps.freshRecommendationCycle()
  setDeferredCards(cycle.deferredCards)
  setBatchNumber(cycle.batchNumber)
  setDecisions({})
  setLiked([])
  setBatchAnnouncement('')
  setCommanderSubThemes([])
  if (!preserveDeck) {
    setDeck([])
    setSideboard([])
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
    setPrioritizeDeckHealth(recommendationStyle !== 'story')
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
  const { setCommanderDetails, setDeck, cardText } = deps
  const { commanders, images, art, identityColours, printings } = loaded
  if (images.length)
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
        name: card.name,
        layout: card.layout ?? 'normal',
        typeLine: card.type_line,
        colorIdentity: card.color_identity,
        manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '',
        manaValue: card.cmc ?? 0,
        detail: cardText(card),
        producedMana: card.produced_mana ?? [],
        faces:
          card.card_faces?.map((face) => ({
            typeLine: face.type_line ?? '',
            manaCost: face.mana_cost ?? '',
          })) ?? [],
        power: card.power ?? card.card_faces?.[0]?.power,
        toughness: card.toughness ?? card.card_faces?.[0]?.toughness,
        set: card.set,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        scryfallUri: card.scryfall_uri,
        printsUri: card.prints_search_uri,
        image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '',
        backImage: scryfallBackImage(card),
        price: card.prices?.usd ?? undefined,
        priceUri: card.purchase_uris?.tcgplayer,
        tags: cardTags(card),
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
    offeredCards = await edhrecRecommendations(deps, slug)
    if (offeredCards.length < 4) throw new Error('Too few EDHREC cards')
  } catch {
    offeredCards = await fallbackRecommendations(deps, identityColours)
    setLimitedRecommendations(true)
  }
  try {
    const themeCards = await themeRecommendations(deps, identityColours, [
      theme,
      ...(preserveDeck ? activeSubThemes : []),
    ])
    const names = new Set(themeCards.map((card: Card) => card.name))
    return [...themeCards, ...offeredCards.filter((card: Card) => !names.has(card.name))]
  } catch {
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
    if (activeCollectionMode === 'only') throw error
    return offeredCards
  }
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
) {
  if (!preserveDeck) return offeredCards
  const { ignoredCards, deck, sideboard } = deps
  return offeredCards.filter(
    (card) =>
      !ignoredCards.includes(card.name) &&
      ![...deck, ...sideboard].some((deckCard: Card) => deckCard.name === card.name),
  )
}

function buildInitialRankingContext(
  deps: ActionDeps,
  offeredCards: Card[],
  chosen: string,
  preserveDeck: boolean,
  activeCollectionSets: string[],
  activeCollectionMode: string,
) {
  const {
    deck,
    prioritizeDeckHealth,
    deckTargets,
    activeSubThemes,
    theme,
    preferenceScores,
    recommendationStyle,
  } = deps
  const rankingDeck = preserveDeck ? deck.slice(commanderNames(chosen).length) : []
  const rankingAnalysis = analyseDeck(preserveDeck ? deck : [])
  const rankingRoleBoosts: Record<string, number> = prioritizeDeckHealth
    ? deckRoleBoosts(deck.length, rankingAnalysis.counts, deckTargets)
    : {}
  const rankingRoles = new Set(
    prioritizeDeckHealth
      ? targetKeys.filter((key) => rankingAnalysis.counts[key] < deckTargets[key])
      : [],
  )
  return {
    theme,
    activeSubThemes,
    pickedTags: new Set([
      ...rankingDeck.flatMap((card: Card) => card.tags),
      ...Object.entries(preferenceScores as Record<string, number>)
        .filter(([, score]) => score > 0)
        .map(([tag]) => tag),
    ]),
    preferenceScores,
    neededRoles: rankingRoles,
    cardRoles: [],
    recommendationStyle,
    collectionSets: activeCollectionSets,
    collectionMode: activeCollectionMode,
    roleBoosts: rankingRoleBoosts,
    roleSupply: Object.fromEntries(
      targetKeys.map((role) => [
        role,
        offeredCards.filter((card) => rolesForCard(card).includes(role)).length,
      ]),
    ),
    batchNumber: 1,
    manaSupport: manaSupportFromAnalysis(rankingAnalysis, deckTargets),
  }
}

export function rankInitialRecommendations(
  deps: ActionDeps,
  offeredCards: Card[],
  chosen: string,
  preserveDeck: boolean,
  activeCollectionSets: string[],
  activeCollectionMode: string,
) {
  const { includeCreature, setQueue, setRecommendationState, loadPrintings, preferredPrintSet } =
    deps
  if (offeredCards.length < 4)
    throw new Error(
      activeCollectionMode === 'only'
        ? 'Selected collection has too few legal cards.'
        : 'Too few recommendation cards',
    )
  offeredCards = filterInitialRecommendations(offeredCards, deps, preserveDeck)
  const rankingContext = buildInitialRankingContext(
    deps,
    offeredCards,
    chosen,
    preserveDeck,
    activeCollectionSets,
    activeCollectionMode,
  )
  const ranked = deps.rankRecommendationCards(
    offeredCards,
    rankingContext,
    includeCreature,
    rolesForCard,
  )
  setQueue(ranked)
  setRecommendationState('idle')
  void loadPrintings(
    ranked.slice(0, 8),
    activeCollectionSets[0] || (preserveDeck ? preferredPrintSet : ''),
    activeCollectionSets,
    activeCollectionMode,
  )
  return true
}

export async function start(deps: ActionDeps, name: string, preserveDeck = false) {
  const chosen = name.trim()
  if (!chosen) return false
  const reset = resetRecommendationState(deps, preserveDeck)
  deps.setCommander(chosen)
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
    return rankInitialRecommendations(
      deps,
      offeredCards,
      chosen,
      preserveDeck,
      reset.activeCollectionSets,
      reset.activeCollectionMode,
    )
  } catch (error) {
    deps.setCollectionError(error instanceof Error ? error.message : 'Suggestions unavailable')
    deps.setRecommendationState('error')
    return false
  }
}
