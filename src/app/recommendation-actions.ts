import { builderAction, type AppActionContext } from './builder-action.ts'
import { focusedRecommendations } from '../domain/recommendation-tuning.ts'
import { analyseDeck, defaultDeckTargets, rolesForCard, type TargetKey } from '../deck-analysis.ts'
import { ScryfallRateLimitError } from '../adapters/scryfall.ts'
import {
  mergeLocalAndLiveCards,
  type LocalCardQuery,
  type LocalIndexStatus,
} from '../adapters/local-card-index.ts'
import { deckJob } from './deck-job.ts'
import { currentCardData } from '../domain/current-card-data.ts'
import { resetSignatureContext } from './signature-actions.ts'
import { commanderNames, themeSearchTerm } from '../domain/commander-catalog.ts'
import { defaultFinish, printingOptions } from '../domain/printing.ts'
import {
  buildEdhrecRecommendations,
  commanderThemes,
  excludedByOptions,
  parseEdhrecEntries,
  releasedBy,
  type CollectionMode,
  type BuilderProgress,
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
  fallbackPool,
  mergeCollectionCandidates,
  mergeRecommendationCandidates,
  recommend,
} from '../domain/recommender.ts'
import {
  cardConstructionError,
  commanderConstructionError,
} from '../domain/commander-construction.ts'

/** Queue progress carried across a settings change that re-fetches the candidate pool. */
export type RecommendationProgress = BuilderProgress

import { builderPoolKey as recommendationPoolKey } from '../domain/builder-settings.ts'
export { builderPoolKey as recommendationPoolKey } from '../domain/builder-settings.ts'

export type { AppActionContext } from './builder-action.ts'

export { mergeRecommendationCandidates }

export async function fallbackRecommendations(deps: AppActionContext, identityColours: string[]) {
  const { excludeGameChangers, excludeUnreleased, includeCreature } = deps
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeUnreleased && releasedBy(deps.today),
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
  return fallbackPool(mainCards, manaCards, includeCreature, recommendationPoolKey(deps))
}

export async function fetchRecommendationCollectionCards(
  deps: AppActionContext,
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
    today: deps.today,
  })
  return cards.filter(
    (card: ScryfallCard) =>
      !excludedByOptions(card, {
        excludeGameChangers,
        excludeTutors,
        excludeExtraTurns,
        excludeUnreleased,
        powerTarget,
        today: deps.today,
      }),
  )
}

export async function collectionRecommendations(
  deps: AppActionContext,
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

/** Bounded so a long-stale index costs at most this many release-ordered pages (175 cards each). */
export const RECENT_CARD_PAGES = 4

/** Stale or unchecked snapshots add release-ordered live pages so new cards stay visible. */
async function recentLiveCards(deps: AppActionContext, liveQuery: string): Promise<ScryfallCard[]> {
  const status: LocalIndexStatus | undefined = deps.localCardIndexStatus?.()
  if (
    !liveQuery ||
    !status?.bulkUpdatedAt ||
    (status.state !== 'stale' && status.state !== 'unchecked')
  )
    return []
  try {
    // ponytail: newest RECENT_CARD_PAGES pages only; older new cards wait for an index refresh.
    return await deps.searchCards(
      `${liveQuery} date>=${status.bulkUpdatedAt.slice(0, 10)}`,
      undefined,
      'released',
      RECENT_CARD_PAGES,
    )
  } catch (error) {
    if (error instanceof ScryfallRateLimitError) throw error
    return []
  }
}

function toLocalAndLiveCards(
  deps: AppActionContext,
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
          today: deps.today,
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
  deps: AppActionContext,
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
  deps: AppActionContext,
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
    ...[...(current.deck ?? []), ...(current.sideboard ?? [])].map(({ name }) => name),
    ...(current.deferredCards ?? []).map(({ card }: DeferredCard<Card>) => card.name),
  ]
  builderAction(deps, (builder) => ({
    type: 'data',
    changes: {
      queue: appendBackgroundCandidates(builder.queue, additions, blocked, current.focusedRole),
    },
  }))
}

export async function themeRecommendations(
  deps: AppActionContext,
  identityColours: string[],
  themes: string[],
) {
  const { excludeGameChangers, excludeUnreleased } = deps
  const terms = [...new Set(themes.map(themeSearchTerm).filter(Boolean))]
  if (!themes.some(Boolean)) return []
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeUnreleased && releasedBy(deps.today),
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

/**
 * Roles the deck is short on that the offered pool can't cover (fewer than twice the shortfall).
 * Only live candidates count, so local snapshot breadth never skips the live Tagger search (#154).
 */
export function uncoveredRoleGaps(
  deck: DeckCard[],
  targets: Record<string, number>,
  offered: Card[],
) {
  const { counts } = analyseDeck(deck)
  return (Object.keys(roleSearchTags) as TargetKey[]).flatMap((role) => {
    const shortfall = Math.max(0, (targets[role] ?? 0) - counts[role])
    const supply = offered.filter(
      (card) => !card.localIndexSnapshot && rolesForCard(card).includes(role),
    ).length
    return shortfall > 0 && supply < shortfall * 2 ? [role] : []
  })
}

/**
 * Bounded retrieval for role gaps: one Scryfall search for the uncovered roles, keeping at most
 * ten new cards per role, so missing cards can enter the pool when EDHREC lists are thin.
 */
export async function roleGapRecommendations(
  deps: AppActionContext,
  identityColours: string[],
  roles: string[],
  offered: Card[],
) {
  if (!roles.length) return []
  const { excludeGameChangers, excludeUnreleased } = deps
  const identity = identityColours.join('').toLowerCase() || 'c'
  const bracketFilters = [
    excludeGameChangers && '-is:gamechanger',
    excludeUnreleased && releasedBy(deps.today),
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
    ...[...(deps.deck ?? []), ...(deps.sideboard ?? [])].map(({ name }) => name),
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
  deps: AppActionContext,
  slug: string,
  identityColours: string[],
  excludedNames: string[] = [],
) {
  const {
    fetchEdhrec,
    includeCreature,
    excludeGameChangers,
    excludeTutors,
    excludeExtraTurns,
    excludeUnreleased,
    powerTarget,
    fetchCards,
  } = deps
  const result = await fetchEdhrec(slug)
  builderAction(deps, {
    type: 'data',
    changes: { commanderSubThemes: commanderThemes(result.tag_counts ?? []) },
  })
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
    today: deps.today,
  })
}

export async function loadCommanderCards(deps: AppActionContext, chosen: string) {
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
  deps: AppActionContext,
  preserveDeck: boolean,
  progress?: RecommendationProgress,
  commander = deps.commander,
) {
  const activeCollectionSets = preserveDeck ? deps.collectionSets : []
  const activeCollectionMode = preserveDeck ? deps.collectionMode : 'none'
  resetSignatureContext(deps)
  const identity = deps.getBuilderState()
  builderAction(deps, {
    type: 'beginRecommendations',
    commander,
    preserveDeck,
    progress,
    extraCreatureTypes: deps.extraCreatureTypes ?? [],
    today: deps.buildIdentity?.today ?? identity.today,
    signatureDeckKey: deps.buildIdentity?.id ?? identity.signatureDeckKey,
  })
  // A settings refresh keeps the current builder workflow and its pending choices open.
  if (!progress) deps.navigateView('builder', null, deps.activeModal !== null)
  deps.setBatchAnnouncement('')
  if (!preserveDeck) {
    deps.setDeckDoctorError('')
    deps.setCollectionSearch('')
    deps.setCollectionPoolSize(null)
    deps.setShowCollectionBrowser(false)
  }
  deps.setLimitedRecommendations(false)
  deps.setCollectionState('idle')
  deps.setCollectionError('')
  deps.setRecommendationLoadingStep('commander')
  deps.setRecommendationLoadingTitle(
    preserveDeck ? 'Updating recommendations' : 'Building your first batch',
  )
  deps.setRecommendationState('loading')
  return { activeCollectionSets, activeCollectionMode }
}

export function addCommanderCards(deps: AppActionContext, loaded: any, preserveDeck: boolean) {
  const { commanders, images, art, identityColours, printings } = loaded
  if (
    preserveDeck &&
    deps.commanderDetails &&
    commanders.every((card: CommanderCard, index: number) => deps.deck[index]?.name === card.name)
  )
    builderAction(deps, {
      type: 'data',
      changes: { commanderDetails: { ...deps.commanderDetails, colours: identityColours } },
    })
  else if (images.length)
    builderAction(deps, {
      type: 'data',
      changes: {
        commanderDetails: {
          images,
          art,
          colours: identityColours,
          printings,
          selections: commanders.map(() => 0),
        },
      },
    })
  if (
    preserveDeck &&
    commanders.every((card: CommanderCard, index: number) => deps.deck[index]?.name === card.name)
  ) {
    builderAction(deps, (builder) => ({
      type: 'data',
      changes: {
        deck: builder.deck.map((card, index) =>
          index < commanders.length ? currentCardData(card, commanders[index]) : card,
        ),
      },
    }))
  } else if (!preserveDeck) {
    builderAction(deps, {
      type: 'data',
      changes: {
        deck: commanders.map((card: CommanderCard, index: number) => ({
          ...toDeckCard(card),
          printings: printings[index],
          printing: 0,
          finish: printings[index][0].finish,
          foilType: printings[index][0].foilType,
        })),
      },
    })
  }
}

async function coreRecommendations(
  deps: AppActionContext,
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
        ? [...deps.deck, ...deps.sideboard].map(({ name }) => name).concat(deps.ignoredCards ?? [])
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
  deps: AppActionContext,
  offeredCards: Card[],
  identityColours: string[],
  activeCollectionSets: string[],
  activeCollectionMode: CollectionMode,
) {
  if (activeCollectionMode === 'only' && !activeCollectionSets.length) return []
  if (activeCollectionMode === 'none' || !activeCollectionSets.length) return offeredCards
  try {
    const collectionCards = await collectionRecommendations(
      deps,
      identityColours,
      activeCollectionSets,
    )
    return mergeCollectionCandidates(offeredCards, collectionCards, activeCollectionMode)
  } catch (error) {
    if (error instanceof ScryfallRateLimitError || activeCollectionMode === 'only') throw error
    return offeredCards
  }
}

export async function fetchDeckDoctorCandidates(deps: AppActionContext) {
  builderAction(deps, { type: 'discoverDoctor' })
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

export async function fetchDeckDoctorCommanders(deps: AppActionContext): Promise<Card[]> {
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
    deps.excludeUnreleased && releasedBy(deps.today),
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
          today: deps.today,
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
  deps: AppActionContext,
  loaded: any,
  preserveDeck: boolean,
  activeCollectionSets: string[],
  activeCollectionMode: CollectionMode,
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

export function rankInitialRecommendations(
  deps: AppActionContext,
  offeredCards: Card[],
  chosen: string,
  preserveDeck: boolean,
  activeCollectionSets: string[],
  activeCollectionMode: CollectionMode,
  progress?: RecommendationProgress,
) {
  const { setRecommendationState, loadPrintings, preferredPrintSet } = deps
  const result = recommend(
    {
      commander: chosen,
      theme: deps.theme,
      recommendationStyle: deps.recommendationStyle,
      prioritizeDeckHealth: deps.prioritizeDeckHealth,
      includeCreature: deps.includeCreature,
      maxPrice: deps.maxPrice ?? null,
      deckTargets: deps.deckTargets,
      focusedRole: deps.focusedRole,
      identity: deps.commanderDetails?.colours ?? [],
      pool: offeredCards,
      deck: preserveDeck ? deps.deck : [],
      sideboard: preserveDeck ? deps.sideboard : [],
      ignoredCards: preserveDeck ? deps.ignoredCards : [],
      deferredCards: progress?.deferredCards ?? [],
      batchNumber: progress?.batchNumber ?? 1,
      preferenceScores: progress?.preferenceScores ?? (preserveDeck ? deps.preferenceScores : {}),
      activeSubThemes: preserveDeck ? deps.activeSubThemes : [],
      collectionSets: activeCollectionSets,
      collectionMode: activeCollectionMode,
    },
    deps.rankRecommendationCards,
  )
  if (result.error) throw new Error(result.error)
  builderAction(deps, {
    type: 'poolLoaded',
    queue: result.queue,
    deferredCards: result.deferredCards,
    poolKey: recommendationPoolKey({
      ...deps,
      commander: chosen,
      activeSubThemes: preserveDeck ? deps.activeSubThemes : [],
      collectionSets: activeCollectionSets,
      collectionMode: activeCollectionMode,
    }),
  })
  if (progress)
    deps.setBatchAnnouncement(`Recommendations updated for batch ${progress.batchNumber}.`)
  setRecommendationState('idle')
  void loadPrintings(
    focusedRecommendations(result.queue, deps.focusedRole, rolesForCard).slice(0, 8),
    activeCollectionSets[0] || (preserveDeck ? preferredPrintSet : ''),
    activeCollectionSets,
    activeCollectionMode,
  )
  return true
}

export async function start(
  deps: AppActionContext,
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
  const reset = resetRecommendationState(deps, preserveDeck, progress, chosen)
  const pendingLocal: PendingLocalQuery[] = []
  try {
    const loaded = await loadCommanderCards(deps, chosen)
    if (!job.isCurrent()) return false
    addCommanderCards(deps, loaded, preserveDeck)
    if (deps.prepareFirstBatch) {
      deps.setRecommendationState('idle')
      builderAction(deps, { type: 'data', changes: { recommendationOptionsChanged: false } })
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
      {
        ...deps,
        commanderDetails: {
          images: loaded.images,
          art: loaded.art,
          printings: loaded.printings,
          selections: loaded.commanders.map(() => 0),
          colours: loaded.identityColours,
        },
      },
      offeredCards,
      chosen,
      preserveDeck,
      reset.activeCollectionSets,
      reset.activeCollectionMode,
      progress,
    )
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
