import { focusedRecommendations, withinPriceCap } from '../domain/recommendation-tuning.ts'
import { analyseDeck, defaultDeckTargets, rolesForCard, type TargetKey } from '../deck-analysis.ts'
import { ScryfallRateLimitError } from '../adapters/scryfall.ts'
import {
  mergeLocalAndLiveCards,
  type LocalCardQuery,
  type LocalIndexStatus,
} from '../adapters/local-card-index.ts'
import { deckJob } from './deck-job.ts'
import { currentCardData } from '../domain/current-card-data.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import { resetSignatureContext } from './signature-actions.ts'
import { commanderNames, themeSearchTerm } from '../domain/commander-catalog.ts'
import { defaultFinish, printingOptions } from '../domain/printing.ts'
import {
  batchRecommendations,
  buildEdhrecRecommendations,
  commanderThemes,
  excludedByOptions,
  parseEdhrecEntries,
  releaseDeferred,
  type CollectionMode,
  type DeferredCard,
  type ScryfallCard,
} from '../recommendations.ts'
import {
  toDeckCard,
  type DeckCard,
  edhrecSlug,
  scryfallImage,
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
    deps.maxPrice ?? null,
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
      | 'setImportFoundCount'
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
  const { excludeGameChangers, excludeUnreleased, includeCreature } = deps
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeUnreleased && 'date<=today',
  ]
    .filter(Boolean)
    .join(' ')
  const baseQuery = `id<=${identity} legal:commander ${bracketFilters}`
  const [mainCards, manaCards] = await Promise.all([
    localAndLiveCandidates(
      deps,
      {
        colours: identityColours,
        themes: [deps.theme, ...(deps.activeSubThemes ?? [])].filter(Boolean),
        roles: ['draw', 'removal', 'wipes'],
      },
      `${baseQuery} -t:land -o:"add {"`,
      'Popular inclusion',
    ),
    localAndLiveCandidates(
      deps,
      { colours: identityColours, roles: ['lands', 'ramp'] },
      `${baseQuery} (t:land or o:"add {")`,
      'Land or mana',
    ),
  ])
  return batchRecommendations(
    mergeRecommendationCandidates(
      mainCards.sort(() => Math.random() - 0.5),
      manaCards.sort(() => Math.random() - 0.5),
    ),
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
    (card: ScryfallCard) =>
      !excludedByOptions(card, {
        excludeGameChangers,
        excludeTutors,
        excludeExtraTurns,
        excludeUnreleased,
        powerTarget,
      }),
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
      ...toCard(card, 'Collection match'),
      collectionMatch: true,
    }))
  } catch (error) {
    setCollectionState('error')
    setCollectionError(error instanceof Error ? error.message : 'Collection unavailable')
    throw error
  }
}

/** Local queries the first batch skipped because the optional index was not ready yet. */
export type PendingLocalQuery = { query: LocalCardQuery; liveQuery: string; reason: string }

/** Stale or unchecked snapshots add one release-ordered live page so new cards stay visible. */
async function recentLiveCards(deps: ActionDeps, liveQuery: string): Promise<ScryfallCard[]> {
  const status: LocalIndexStatus | undefined = deps.localCardIndexStatus?.()
  if (
    !liveQuery ||
    !status?.bulkUpdatedAt ||
    (status.state !== 'stale' && status.state !== 'unchecked')
  )
    return []
  try {
    // shortcut: one release-ordered page; paginate when stale-index recall needs more (#149).
    return await deps.searchCards(
      `${liveQuery} date>=${status.bulkUpdatedAt.slice(0, 10)}`,
      undefined,
      'released',
    )
  } catch (error) {
    if (error instanceof ScryfallRateLimitError) throw error
    return []
  }
}

function toLocalAndLiveCards(
  deps: ActionDeps,
  localCards: ScryfallCard[],
  liveCards: ScryfallCard[],
  reason: string,
) {
  const current = new Set(liveCards)
  return mergeLocalAndLiveCards(localCards, liveCards)
    .filter(
      (card) =>
        !excludedByOptions(card, {
          excludeGameChangers: deps.excludeGameChangers,
          excludeTutors: deps.excludeTutors,
          excludeExtraTurns: deps.excludeExtraTurns,
          excludeUnreleased: deps.excludeUnreleased,
          powerTarget: deps.powerTarget,
        }),
    )
    .map((card) => ({
      ...toCard(card, current.has(card) ? reason : 'Local card match'),
      localIndexSnapshot: !current.has(card),
    }))
}

/**
 * Local breadth supplements every live query, including Tagger searches and stale-index refreshes.
 * With `pendingLocal`, an index that is not ready never delays live results: the query is recorded
 * for background enrichment instead.
 */
async function localAndLiveCandidates(
  deps: ActionDeps,
  query: LocalCardQuery,
  liveQuery: string,
  reason: string,
): Promise<Card[]> {
  const pending: PendingLocalQuery[] | undefined = deps.pendingLocal
  const ready: ScryfallCard[] | undefined = pending ? deps.localCardsIfReady?.(query) : undefined
  if (pending && !ready && deps.localCardsIfReady) pending.push({ query, liveQuery, reason })
  const [local, live] = await Promise.allSettled([
    pending ? Promise.resolve(ready ?? []) : (deps.fetchLocalCards?.(query) ?? Promise.resolve([])),
    liveQuery ? deps.searchCards(liveQuery, undefined, 'edhrec') : Promise.resolve([]),
  ])
  const localCards = local.status === 'fulfilled' ? local.value : []
  if (live.status === 'rejected' && live.reason instanceof ScryfallRateLimitError) throw live.reason
  const recent = await recentLiveCards(deps, liveQuery)
  if (live.status === 'rejected' && !localCards.length && !recent.length) throw live.reason
  const liveCards = mergeLocalAndLiveCards(live.status === 'fulfilled' ? live.value : [], recent)
  return toLocalAndLiveCards(deps, localCards, liveCards, reason)
}

/**
 * Append background candidates without touching the visible batch: cards that would join a short
 * active batch wait for the next pool build, and queued, decided or deferred cards never return.
 */
export function appendBackgroundCandidates(
  queue: Card[],
  additions: Card[],
  blockedNames: string[],
  focusedRole: TargetKey | null | undefined,
) {
  const visible = focusedRecommendations(queue, focusedRole, rolesForCard).slice(0, 4)
  const names = new Set(
    [...blockedNames, ...queue.map(({ name }) => name)].map((name) => name.toLowerCase()),
  )
  const oracles = new Set(queue.flatMap(({ oracleId }) => oracleId ?? []))
  const fresh: Card[] = []
  for (const card of additions) {
    if (names.has(card.name.toLowerCase()) || (card.oracleId && oracles.has(card.oracleId)))
      continue
    // ponytail: cards that would fill a short visible batch are dropped until the next pool build.
    if (visible.length < 4 && focusedRecommendations([card], focusedRole, rolesForCard).length)
      continue
    names.add(card.name.toLowerCase())
    if (card.oracleId) oracles.add(card.oracleId)
    fresh.push(card)
  }
  return fresh.length ? [...queue, ...fresh] : queue
}

/** Load the optional index after the first batch, then merge its extra candidates at the queue tail. */
export async function enrichWithLocalCards(
  deps: ActionDeps,
  pending: PendingLocalQuery[],
  identityColours: string[],
  isCurrent: () => boolean,
) {
  if (!pending.length || !deps.fetchLocalCards) return
  const found = await Promise.all(
    pending.map(async ({ query, liveQuery, reason }) => {
      try {
        const local: ScryfallCard[] = await deps.fetchLocalCards(query)
        return toLocalAndLiveCards(deps, local, await recentLiveCards(deps, liveQuery), reason)
      } catch {
        return []
      }
    }),
  )
  const additions = found.flat().filter((card) => !cardConstructionError(card, [], identityColours))
  if (!additions.length || !isCurrent()) return
  const current = deps.getCurrentState?.() ?? deps
  const blocked = [
    ...commanderNames(current.commander ?? ''),
    ...(current.ignoredCards ?? []),
    ...[...(current.deck ?? []), ...(current.sideboard ?? [])].map(({ name }: Card) => name),
    ...(current.deferredCards ?? []).map(({ card }: DeferredCard<Card>) => card.name),
  ]
  deps.setQueue((queue: Card[]) =>
    appendBackgroundCandidates(queue, additions, blocked, current.focusedRole),
  )
}

export async function themeRecommendations(
  deps: ActionDeps,
  identityColours: string[],
  themes: string[],
) {
  const { excludeGameChangers, excludeUnreleased } = deps
  const terms = [...new Set(themes.map(themeSearchTerm).filter(Boolean))]
  if (!themes.some(Boolean)) return []
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeUnreleased && 'date<=today',
  ]
    .filter(Boolean)
    .join(' ')
  const query = `id<=${identity} legal:commander (${terms.join(' or ')}) ${bracketFilters}`
  return localAndLiveCandidates(
    deps,
    { colours: identityColours, themes },
    terms.length ? query : '',
    'Interesting new pick',
  )
}

// Scryfall Tagger tags for each spell role; results are re-checked with rolesForCard.
const roleSearchTags: Record<string, string> = {
  ramp: 'otag:ramp',
  draw: 'otag:draw',
  removal: 'otag:removal',
  wipes: 'otag:sweeper',
}
const roleGapLimit = 10

/** Roles the deck is short on that the offered pool can't cover (fewer than twice the shortfall). */
export function uncoveredRoleGaps(deck: Card[], targets: Record<string, number>, offered: Card[]) {
  const { counts } = analyseDeck(deck)
  return (Object.keys(roleSearchTags) as TargetKey[]).flatMap((role) => {
    const shortfall = Math.max(0, (targets[role] ?? 0) - counts[role])
    const supply = offered.filter((card) => rolesForCard(card).includes(role)).length
    return shortfall > 0 && supply < shortfall * 2 ? [role] : []
  })
}

/**
 * Bounded retrieval for role gaps: one Scryfall search for the uncovered roles, keeping at most
 * ten new cards per role, so missing cards can enter the pool when EDHREC lists are thin.
 */
export async function roleGapRecommendations(
  deps: ActionDeps,
  identityColours: string[],
  roles: string[],
  offered: Card[],
) {
  if (!roles.length) return []
  const { excludeGameChangers, excludeUnreleased } = deps
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeUnreleased && 'date<=today',
  ]
    .filter(Boolean)
    .join(' ')
  const tags = roles.map((role) => roleSearchTags[role]).join(' or ')
  const query = `id<=${identity} legal:commander -t:land (${tags}) ${bracketFilters}`
  const cards = await localAndLiveCandidates(
    deps,
    { colours: identityColours, roles },
    query,
    'Popular inclusion',
  )
  const owned = new Set([
    ...offered.filter((card) => !card.localIndexSnapshot).map(({ name }) => name),
    ...[...(deps.deck ?? []), ...(deps.sideboard ?? [])].map(({ name }: Card) => name),
    ...(deps.ignoredCards ?? []),
  ])
  const taken = Object.fromEntries(roles.map((role) => [role, 0]))
  return cards
    .filter((card) => !owned.has(card.name))
    .filter((card) => {
      const role = rolesForCard(card).find((key) => (taken[key] ?? roleGapLimit) < roleGapLimit)
      if (!role) return false
      taken[role] += 1
      return true
    })
}

export async function edhrecRecommendations(
  deps: ActionDeps,
  slug: string,
  identityColours: string[],
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
  const identity = new Set(identityColours)
  const legalIdentityCards = responseCards.filter(({ color_identity }) =>
    color_identity?.every((colour) => identity.has(colour)),
  )
  return buildEdhrecRecommendations(entries, legalIdentityCards, {
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
      const primary = printingOptions([card]).find((printing) => printing.finish === finish) ?? {
        image: scryfallImage(card),
        set: card.set,
        collectorNumber: card.collector_number,
        finish,
      }
      const alternatives = printingOptions(await fetchPrintings(card.prints_search_uri))
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
  deps.setIgnoreReasons?.({})
  if (!preserveDeck) deps.setFocusedRole?.(null)
  setLiked((current: string[]) => (progress ? current : []))
  setBatchAnnouncement('')
  setCommanderSubThemes([])
  if (!preserveDeck) {
    setDeck([])
    setSideboard([])
    deps.setDeckDoctorHistory([])
    deps.setDeckDoctorError('')
    setIgnoredCards([])
    // Extra creature types picked on the start screen carry over as sub-themes.
    setActiveSubThemes(deps.extraCreatureTypes?.slice(0, 2) ?? [])
    setDismissedSubThemes([])
    setPreferenceScores({})
    setCollectionSets([])
    setCollectionGroups([])
    setCollectionMode('none')
    setCollectionSearch('')
    setCollectionPoolSize(null)
    setShowCollectionBrowser(false)
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
    setCommanderDetails({ ...deps.commanderDetails, colours: identityColours })
  else if (images.length)
    setCommanderDetails({
      images,
      art,
      colours: identityColours,
      printings,
      selections: commanders.map(() => 0),
    })
  if (
    preserveDeck &&
    setDeck &&
    commanders.every((card: CommanderCard, index: number) => deps.deck[index]?.name === card.name)
  ) {
    setDeck((current: DeckCard[]) =>
      current.map((card, index) =>
        index < commanders.length ? currentCardData(card, commanders[index]) : card,
      ),
    )
  } else if (!preserveDeck) {
    setDeck(
      commanders.map((card: CommanderCard, index: number) => ({
        ...toDeckCard(card),
        printings: printings[index],
        printing: 0,
        finish: printings[index][0].finish,
        foilType: printings[index][0].foilType,
      })),
    )
  }
}

/** Keep live EDHREC evidence when another source finds the same Oracle identity. */
export function mergeRecommendationCandidates(primary: Card[], additions: Card[]) {
  const merged: Card[] = []
  const oracles = new Map<string, number>()
  const names = new Map<string, number>()
  for (const card of [...primary, ...additions]) {
    const name = card.name.toLowerCase()
    const index = (card.oracleId ? oracles.get(card.oracleId) : undefined) ?? names.get(name)
    if (index !== undefined) {
      if (merged[index].localIndexSnapshot && !card.localIndexSnapshot) {
        merged[index] = card
        if (card.oracleId) oracles.set(card.oracleId, index)
        names.set(name, index)
      }
      continue
    }
    if (card.oracleId) oracles.set(card.oracleId, merged.length)
    names.set(name, merged.length)
    merged.push(card)
  }
  return merged
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
    offeredCards = await edhrecRecommendations(deps, slug, identityColours, excludedNames)
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
    offeredCards = mergeRecommendationCandidates(offeredCards, themeCards)
  } catch (error) {
    if (error instanceof ScryfallRateLimitError) throw error
  }
  try {
    const gaps = uncoveredRoleGaps(
      deps.deck ?? [],
      deps.deckTargets ?? defaultDeckTargets,
      offeredCards,
    )
    return mergeRecommendationCandidates(
      offeredCards,
      await roleGapRecommendations(deps, identityColours, gaps, offeredCards),
    )
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
  const terms = [...new Set(themes.map(themeSearchTerm).filter(Boolean))]
  if (!terms.length) return []

  const requiredColours = new Set(
    [...deps.deck.slice(currentNames.length), ...deps.sideboard].flatMap(
      (card: any) => card.colorIdentity ?? [],
    ),
  )
  const exclusions = [
    deps.excludeGameChangers && '-is:gamechanger',
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
        excludedByOptions(card, {
          excludeGameChangers: deps.excludeGameChangers,
          excludeTutors: deps.excludeTutors,
          excludeExtraTurns: deps.excludeExtraTurns,
          excludeUnreleased: deps.excludeUnreleased,
          powerTarget: deps.powerTarget,
        }) ||
        ![...requiredColours].every((colour) => card.color_identity.includes(colour))
      )
        return false
      seen.add(card.name)
      return true
    })
    .slice(0, 3)
    .map((card: ScryfallCard) => toCard(card, 'Theme-compatible commander'))
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
      prioritizeDeckHealth: deps.prioritizeDeckHealth,
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
      available:
        offered.has(entry.card.name) &&
        withinPriceCap(offered.get(entry.card.name)!, deps.maxPrice),
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
    focusedRecommendations(ranked, deps.focusedRole, rolesForCard).slice(0, 8),
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
  const request = deps.recommendationRequest
  const token = request ? ++request.current : undefined
  const job = deckJob(deps, () => !request || request.current === token)
  deps = job.deps
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
  const pendingLocal: PendingLocalQuery[] = []
  try {
    const loaded = await loadCommanderCards(deps, chosen)
    if (!job.isCurrent()) return false
    addCommanderCards(deps, loaded, preserveDeck)
    if (deps.prepareFirstBatch) {
      deps.setRecommendationState('idle')
      deps.setRecommendationOptionsChanged?.(false)
      return true
    }
    const offeredCards = await collectOfferedCards(
      { ...deps, pendingLocal },
      loaded,
      preserveDeck,
      reset.activeCollectionSets,
      reset.activeCollectionMode,
    )
    if (!job.isCurrent()) return false
    rankInitialRecommendations(
      { ...deps, commanderDetails: { ...deps.commanderDetails, colours: loaded.identityColours } },
      offeredCards,
      chosen,
      preserveDeck,
      reset.activeCollectionSets,
      reset.activeCollectionMode,
      progress,
    )
    if (deps.recommendationPoolKey) deps.recommendationPoolKey.current = poolKey
    deps.setRecommendationOptionsChanged?.(false)
    deps.setFirstBatchPending?.(false)
    void enrichWithLocalCards(deps, pendingLocal, loaded.identityColours, job.isCurrent)
    return true
  } catch (error) {
    if (!job.isCurrent()) return false
    deps.setCollectionError(error instanceof Error ? error.message : 'Suggestions unavailable')
    deps.setRecommendationState('error')
    return false
  }
}
