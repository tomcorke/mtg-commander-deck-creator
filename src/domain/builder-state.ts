import {
  planFetches,
  mergeBoundaryResults,
  settleFetch,
  fetchGeneration,
  type PlannedFetch,
  type FetchBoundary,
  type FetchResponse,
} from './builder-fetches.ts'
import {
  analyseDeck,
  addsToSideboard,
  mainDeckLimit,
  type AddZone,
  type AddZoneChoice,
  defaultDeckTargets,
  rolesForCard,
  type DeckTargets,
  type TargetKey,
} from '../deck-analysis.ts'
import {
  applyDeckDoctorSwapPlan,
  undoDeckDoctorSwap,
  type DeckDoctorSwapRecord,
} from '../deck-doctor.ts'
import {
  toDeckCard,
  toDeckCardFromRecommendation,
  type Card,
  type CommanderDetails,
  type DeckCard,
  type ScryfallCard,
  type Printing,
} from './card-model.ts'
import { commanderNames } from './commander-catalog.ts'
import { gameChangersAtLimit } from './play-style.ts'
import { commanderPromotionInfo, promoteDeckCard } from './commander-promotion.ts'
import { applyBuilderHydration, applyBuilderPrinting, retryBuilderData } from './builder-data.ts'
import { beginBuilderRecommendations, resetBuilder } from './builder-lifecycle.ts'
import { builderPoolKey } from './builder-settings.ts'
import { cardConstructionError, commanderConstructionError } from './commander-construction.ts'
import { recommendationDataError } from './deck-data-status.ts'
import { addCardSearchCards } from './card-search.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import {
  advanceRecommendationQueue,
  deferBatch,
  rankRecommendationCards,
  selectSubTheme,
  updatePreferenceScores,
} from './recommendation-queue.ts'
import {
  focusedRecommendations,
  normalizeMaxPrice,
  type IgnoreReason,
} from './recommendation-tuning.ts'
import type {
  CollectionMode,
  DeferredCard,
  PowerTarget,
  RecommendationStyle,
} from './recommendation-types.ts'

/** Resolved build inputs and progress; storage and transport state belong to the caller. */
export type BuilderState = {
  today: string
  addZoneChoice: AddZoneChoice
  signatureDeckKey: string
  commander: string
  commanderDetails: CommanderDetails | null
  deck: DeckCard[]
  sideboard: DeckCard[]
  queue: Card[]
  deferredCards: DeferredCard<Card>[]
  batchNumber: number
  decisions: Record<string, 'add' | 'later' | 'ignore'>
  ignoreReasons: Record<string, IgnoreReason>
  ignoredCards: string[]
  liked: string[]
  preferenceScores: Record<string, number>
  deckTargets: DeckTargets
  theme: string
  activeSubThemes: string[]
  dismissedSubThemes: string[]
  commanderSubThemes: string[]
  recommendationStyle: RecommendationStyle
  powerTarget: PowerTarget
  maxPrice: number | null
  focusedRole: TargetKey | null
  includeCreature: boolean
  excludeGameChangers: boolean
  limitGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
  excludeUnreleased: boolean
  collectionMode: CollectionMode
  collectionSets: string[]
  collectionGroups: string[]
  preferredPrintSet: string
  recommendationOptionsChanged: boolean
  committedPoolKey: string
  deckDoctorHistory: DeckDoctorSwapRecord[]
  /** Per-build logical quota; transport caches and wall clocks never replenish it. */
  signatureQuota: { pages: number; cards: number }
  fetchEpoch: number
  hydrationBoundary: number
  fetchSequence: number
  fetchBoundary: FetchBoundary | null
  pendingFetches: BuilderFetchWork[]
  completedFetches: BuilderFetchWork[]
}

export function createBuilderState(today: string, signatureDeckKey: string): BuilderState {
  const state: BuilderState = {
    today,
    addZoneChoice: null,
    signatureDeckKey,
    commander: '',
    commanderDetails: null,
    deck: [],
    sideboard: [],
    queue: [],
    deferredCards: [],
    batchNumber: 1,
    decisions: {},
    ignoreReasons: {},
    ignoredCards: [],
    liked: [],
    preferenceScores: {},
    deckTargets: { ...defaultDeckTargets },
    theme: '',
    activeSubThemes: [],
    dismissedSubThemes: [],
    commanderSubThemes: [],
    recommendationStyle: 'balanced',
    powerTarget: 'precon',
    maxPrice: null,
    focusedRole: null,
    includeCreature: true,
    excludeGameChangers: true,
    limitGameChangers: false,
    excludeTutors: true,
    excludeExtraTurns: true,
    excludeUnreleased: true,
    collectionMode: 'none',
    collectionSets: [],
    collectionGroups: [],
    preferredPrintSet: '',
    recommendationOptionsChanged: false,
    committedPoolKey: '',
    deckDoctorHistory: [],
    pendingFetches: [],
    completedFetches: [],
    signatureQuota: { pages: 0, cards: 0 },
    fetchEpoch: 0,
    hydrationBoundary: 0,
    fetchSequence: 0,
    fetchBoundary: null,
  }
  state.committedPoolKey = builderPoolKey(state)
  return state
}

export type BuilderSettings = Pick<
  BuilderState,
  | 'recommendationStyle'
  | 'powerTarget'
  | 'maxPrice'
  | 'includeCreature'
  | 'excludeGameChangers'
  | 'limitGameChangers'
  | 'excludeTutors'
  | 'excludeExtraTurns'
  | 'excludeUnreleased'
  | 'deckTargets'
>

export type BuilderProgress = Pick<
  BuilderState,
  'deferredCards' | 'batchNumber' | 'preferenceScores'
>

export type BuilderAction =
  | { type: 'settleFetch'; id: string; response: FetchResponse }
  | { type: 'startOver'; today: string; signatureDeckKey: string }
  | {
      type: 'beginRecommendations'
      commander: string
      preserveDeck: boolean
      progress?: BuilderProgress
      extraCreatureTypes: string[]
      today: string
      signatureDeckKey: string
    }
  | { type: 'restore'; state: BuilderState }
  | { type: 'data'; changes: Partial<BuilderState> }
  | { type: 'hydrate'; results: [string, ScryfallCard][] }
  | { type: 'retryData' }
  | {
      type: 'printing'
      board: 'queue' | 'deck' | 'sideboard'
      index: number
      name: string
      printings: Printing[]
      selection: number
      automatic: boolean
    }
  | { type: 'chooseZone'; zone: AddZone }
  | { type: 'decide'; card: Card; decision: 'add' | 'later' | 'ignore' }
  | { type: 'ignoreReason'; name: string; reason: IgnoreReason | null }
  | { type: 'like'; name: string }
  | { type: 'theme'; theme: string }
  | { type: 'selectSubTheme'; name: string }
  | { type: 'removeSubTheme'; name: string }
  | { type: 'dismissSubTheme'; name: string; evidenceCount: number }
  | { type: 'settings'; settings: Partial<BuilderSettings> }
  | { type: 'targets'; targets: Partial<DeckTargets> }
  | { type: 'discoverDoctor' }
  | {
      type: 'promote'
      candidate: DeckCard
      outgoingNames: string[]
      keepOutgoing: boolean
      details: CommanderDetails | null
    }
  | { type: 'focus'; role: TargetKey | null }
  | { type: 'completeFocus' }
  | { type: 'collectionMode'; mode: CollectionMode }
  | { type: 'toggleSet'; code: string }
  | { type: 'commitSettings' }
  | { type: 'nextBatch'; extraSubTheme?: string }
  | { type: 'poolLoaded'; queue: Card[]; deferredCards: DeferredCard<Card>[]; poolKey: string }
  | { type: 'addGuidance'; card: Card }
  | { type: 'addCollection'; card: ScryfallCard }
  | { type: 'addSearch'; cards: ScryfallCard[] }
  | { type: 'addBasics'; cards: { card: DeckCard; count: number }[] }
  | { type: 'addOneBasic'; card: DeckCard }
  | { type: 'removeCard'; board: 'deck' | 'sideboard'; index: number }
  | { type: 'moveCard'; board: 'deck' | 'sideboard'; index: number }
  | { type: 'commanders'; cards: DeckCard[]; details: CommanderDetails; signatureDeckKey: string }
  | {
      type: 'doctorApply'
      id: string
      cuts: { cutIndex: number; cutCard: DeckCard }[]
      additions: Card[]
      moveCutToSideboard: boolean
    }
  | { type: 'doctorUndo'; id: string; refreshedCut?: DeckCard }

/** Phase 3 adds reservations, quotas and settlement to these boundary descriptions. */
export type BuilderFetchRequest =
  | { kind: 'pool'; boundary: 'commitSettings' | 'initialisation' }
  | { kind: 'doctor-candidates'; boundary: 'deckEdit' }
  | PlannedFetch
export type BuilderFetchWork = PlannedFetch
export type BuilderActionResult = {
  state: BuilderState
  fetchRequests: BuilderFetchRequest[]
  error?: string
}

const excludesGameChangers = (state: BuilderState) =>
  state.excludeGameChangers || (state.limitGameChangers && gameChangersAtLimit(state.deck))

const context = (state: BuilderState, candidates: Card[]) =>
  buildRecommendationContext(
    {
      ...state,
      commanderDetails: state.commanderDetails ?? undefined,
      prioritizeDeckHealth: state.recommendationStyle !== 'thematic',
    },
    candidates,
  )

function commitFeedback(state: BuilderState): BuilderState {
  const batch = focusedRecommendations(state.queue, state.focusedRole, rolesForCard).slice(0, 4)
  return {
    ...state,
    preferenceScores: updatePreferenceScores(
      batch,
      state.decisions,
      state.liked,
      state.preferenceScores,
      state.ignoreReasons,
      [state.theme, ...state.activeSubThemes],
    ),
    deferredCards: [
      ...state.deferredCards,
      ...deferBatch(
        batch.filter((card) => state.decisions[card.name] === 'later'),
        state.decisions,
        state.batchNumber,
        (card) => card.name,
      ),
    ],
    decisions: {},
    ignoreReasons: {},
    liked: state.liked.filter((name) => !batch.some((card) => card.name === name)),
  }
}

function commitSettings(state: BuilderState): BuilderActionResult {
  const poolChanged = state.committedPoolKey !== builderPoolKey(state)
  const committed = commitFeedback(state)
  if (poolChanged)
    return { state: committed, fetchRequests: [{ kind: 'pool', boundary: 'commitSettings' }] }
  const excluded = new Set([
    ...committed.ignoredCards,
    ...[...committed.deck, ...committed.sideboard].map((card) => card.name),
    ...committed.deferredCards.map(({ card }) => card.name),
  ])
  const candidates = committed.queue.filter((card) => !excluded.has(card.name))
  return {
    state: {
      ...committed,
      recommendationOptionsChanged: false,
      queue: rankRecommendationCards(
        candidates,
        context(committed, candidates),
        committed.includeCreature,
        rolesForCard,
      ),
    },
    fetchRequests: [],
  }
}

function decision(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'decide' }>,
): BuilderActionResult {
  const { card } = action
  const previous = state.decisions[card.name]
  const sideboarding = addsToSideboard(state)
  const board = sideboarding ? 'sideboard' : 'deck'
  const ignoring = action.decision === 'ignore' && previous !== action.decision
  if (previous !== 'add' && action.decision === 'add') {
    const error = recommendationDataError(
      card,
      state[board],
      state.commanderDetails?.colours ?? [],
      excludesGameChangers(state),
    )
    if (error) return { state, fetchRequests: [], error: `${card.name}: ${error}` }
  }
  const decisions = { ...state.decisions }
  const ignoreReasons = { ...state.ignoreReasons }
  delete ignoreReasons[card.name]
  if (previous === action.decision) delete decisions[card.name]
  else decisions[card.name] = action.decision
  let deck = state.deck
  let sideboard = state.sideboard
  if (previous === 'add') {
    deck = deck.filter((item) => item.name !== card.name)
    sideboard = sideboard.filter((item) => item.name !== card.name)
  } else if (action.decision === 'add') {
    const added = toDeckCardFromRecommendation(card)
    if (sideboarding) sideboard = [...sideboard, added]
    else deck = [...deck, added]
  }
  return {
    state: {
      ...state,
      deck,
      sideboard,
      decisions,
      ignoreReasons,
      ignoredCards: ignoring
        ? [...new Set([...state.ignoredCards, card.name])]
        : state.ignoredCards.filter((name) => name !== card.name),
      liked: ignoring ? state.liked.filter((name) => name !== card.name) : state.liked,
    },
    fetchRequests: [],
  }
}

const done = (state: BuilderState): BuilderActionResult => ({ state, fetchRequests: [] })
const invalid = (state: BuilderState, error: string): BuilderActionResult => ({
  ...done(state),
  error,
})

function applyDecide(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'decide' }>,
): BuilderActionResult {
  return decision(state, action)
}

function applyIgnoreReason(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'ignoreReason' }>,
): BuilderActionResult {
  const ignoreReasons = { ...state.ignoreReasons }
  if (action.reason === null) delete ignoreReasons[action.name]
  else ignoreReasons[action.name] = action.reason
  return done({ ...state, ignoreReasons })
}

function applyLike(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'like' }>,
): BuilderActionResult {
  return done({
    ...state,
    liked: state.liked.includes(action.name)
      ? state.liked.filter((name) => name !== action.name)
      : [...state.liked, action.name],
  })
}

function applyTheme(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'theme' }>,
): BuilderActionResult {
  return done({ ...state, theme: action.theme, recommendationOptionsChanged: true })
}

function applySelectSubTheme(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'selectSubTheme' }>,
): BuilderActionResult {
  const selected = selectSubTheme(state.activeSubThemes, action.name)
  return done({
    ...state,
    activeSubThemes: selected.activeSubThemes,
  })
}

function applyRemoveSubTheme(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'removeSubTheme' }>,
): BuilderActionResult {
  return done({
    ...state,
    activeSubThemes: state.activeSubThemes.filter((name) => name !== action.name),
    recommendationOptionsChanged: true,
  })
}

function applyDismissSubTheme(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'dismissSubTheme' }>,
): BuilderActionResult {
  return done({
    ...state,
    dismissedSubThemes: [
      ...state.dismissedSubThemes.filter(
        (item) => item !== action.name && !item.startsWith(`${action.name}:`),
      ),
      `${action.name}:${action.evidenceCount}`,
    ],
  })
}

function applySettings(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'settings' }>,
): BuilderActionResult {
  return done({
    ...state,
    ...action.settings,
    maxPrice:
      action.settings.maxPrice === undefined
        ? state.maxPrice
        : normalizeMaxPrice(action.settings.maxPrice),
    recommendationOptionsChanged: true,
  })
}

function applyCollectionMode(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'collectionMode' }>,
): BuilderActionResult {
  return done({
    ...state,
    collectionMode: action.mode,
    collectionSets: action.mode === 'none' ? [] : state.collectionSets,
    collectionGroups: action.mode === 'none' ? [] : state.collectionGroups,
    recommendationOptionsChanged: true,
  })
}

function applyToggleSet(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'toggleSet' }>,
): BuilderActionResult {
  const collectionSets = state.collectionSets.includes(action.code)
    ? state.collectionSets.filter((code) => code !== action.code)
    : [...state.collectionSets, action.code]
  return done({
    ...state,
    collectionSets,
    collectionGroups: [],
    recommendationOptionsChanged: true,
    collectionMode: !collectionSets.length
      ? 'none'
      : state.collectionMode === 'none'
        ? 'prefer'
        : state.collectionMode,
  })
}

function applyFocus(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'focus' }>,
): BuilderActionResult {
  const result = commitSettings(state)
  return {
    ...result,
    state: {
      ...result.state,
      focusedRole: action.role === state.focusedRole ? null : action.role,
    },
  }
}

function applyCompleteFocus(
  state: BuilderState,
  _action: Extract<BuilderAction, { type: 'completeFocus' }>,
): BuilderActionResult {
  return state.focusedRole &&
    !state.recommendationOptionsChanged &&
    analyseDeck(state.deck).counts[state.focusedRole] >= state.deckTargets[state.focusedRole]
    ? applyBuilderAction(state, { type: 'focus', role: null })
    : done(state)
}

function applyCommitSettings(
  state: BuilderState,
  _action: Extract<BuilderAction, { type: 'commitSettings' }>,
): BuilderActionResult {
  return commitSettings(state)
}

function applyNextBatch(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'nextBatch' }>,
): BuilderActionResult {
  if (state.recommendationOptionsChanged || state.committedPoolKey !== builderPoolKey(state))
    return commitSettings(state)
  const batch = focusedRecommendations(state.queue, state.focusedRole, rolesForCard).slice(0, 4)
  const next = advanceRecommendationQueue({
    ...state,
    ...context(state, state.queue),
    cardRoles: rolesForCard,
    extraSubTheme: action.extraSubTheme ?? '',
  })
  return done({
    ...state,
    ...next,
    decisions: {},
    ignoreReasons: {},
    liked: state.liked.filter((name) => !batch.some((card) => card.name === name)),
  })
}

function applyAddGuidanceOrAddCollection(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'addGuidance' | 'addCollection' }>,
): BuilderActionResult {
  const identity = state.commanderDetails?.colours ?? []
  const added =
    action.type === 'addCollection'
      ? toDeckCard(action.card)
      : toDeckCardFromRecommendation(action.card)
  const board = addsToSideboard(state) ? 'sideboard' : 'deck'
  const error =
    action.type === 'addCollection'
      ? cardConstructionError(added, state[board], identity)
      : recommendationDataError(added, state[board], identity, excludesGameChangers(state))
  return error
    ? invalid(state, `${added.name}: ${error}`)
    : done({
        ...state,
        [board]: [...state[board], added],
        queue: state.queue.filter((card) => card.name !== added.name),
      })
}

function applyAddSearch(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'addSearch' }>,
): BuilderActionResult {
  const identity = state.commanderDetails?.colours ?? []
  try {
    if (!action.cards.length) return invalid(state, 'Select at least one card.')
    const result = addCardSearchCards(
      action.cards,
      state.deck,
      state.sideboard,
      identity,
      mainDeckLimit(state),
    )
    const names = new Set(action.cards.map((card) => card.name))
    return done({
      ...state,
      deck: result.deck,
      sideboard: result.sideboard,
      queue: state.queue.filter((card) => !names.has(card.name)),
    })
  } catch (error) {
    return invalid(
      state,
      error instanceof Error ? error.message : 'Could not add the selected cards.',
    )
  }
}

function applyAddBasics(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'addBasics' }>,
): BuilderActionResult {
  const identity = state.commanderDetails?.colours ?? []
  for (const { card, count } of action.cards) {
    if (!Number.isInteger(count) || count < 0 || count > 100)
      return invalid(state, 'Invalid basic-land count.')
    if (!/\bBasic\b/.test(card.typeLine)) return invalid(state, 'Choose a basic land.')
    const error = cardConstructionError(card, state.deck, identity)
    if (error) return invalid(state, error)
  }
  const additions = action.cards.flatMap(({ card, count }) =>
    Array.from({ length: count }, () => ({ ...card })),
  )
  return done({ ...state, deck: [...state.deck, ...additions].slice(0, 100) })
}

function applyAddOneBasic(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'addOneBasic' }>,
): BuilderActionResult {
  const identity = state.commanderDetails?.colours ?? []
  const error = cardConstructionError(action.card, state.deck, identity)
  return error ? invalid(state, error) : done({ ...state, deck: [...state.deck, action.card] })
}

function applyRemoveCard(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'removeCard' }>,
): BuilderActionResult {
  const removed = state[action.board][action.index]
  if (!removed) return done(state)
  const decisions = { ...state.decisions }
  if (decisions[removed.name] === 'add') delete decisions[removed.name]
  return done({
    ...state,
    decisions,
    [action.board]: state[action.board].filter((_, index) => index !== action.index),
  })
}

function applyMoveCard(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'moveCard' }>,
): BuilderActionResult {
  const identity = state.commanderDetails?.colours ?? []
  const card = state[action.board][action.index]
  if (!card) return done(state)
  const destination = action.board === 'deck' ? 'sideboard' : 'deck'
  if (destination === 'deck') {
    const error = cardConstructionError(card, state.deck, identity)
    if (error) return invalid(state, `${card.name}: ${error}`)
  }
  return done({
    ...state,
    [destination]: [...state[destination], card],
    [action.board]: state[action.board].filter((_, index) => index !== action.index),
  })
}

function applyCommanders(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'commanders' }>,
): BuilderActionResult {
  const error = commanderConstructionError(action.cards)
  if (error) return invalid(state, error)
  return done({
    ...state,
    commander: action.cards.map((card) => card.name).join(' & '),
    commanderDetails: {
      ...action.details,
      colours: [...new Set(action.cards.flatMap((card) => card.colorIdentity ?? []))],
    },
    signatureDeckKey: action.signatureDeckKey,
    deck: action.cards,
  })
}

function applyDoctorApply(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'doctorApply' }>,
): BuilderActionResult {
  const identity = state.commanderDetails?.colours ?? []
  try {
    for (const card of action.additions) {
      const error = recommendationDataError(card, [], identity, excludesGameChangers(state))
      if (error) return invalid(state, error)
    }
    const result = applyDeckDoctorSwapPlan({
      ...action,
      deck: state.deck,
      sideboard: state.sideboard,
      commanderCount: commanderNames(state.commander).length,
      commanderColours: identity,
    })
    return done({
      ...state,
      deck: result.deck,
      sideboard: result.sideboard,
      deckDoctorHistory: [...state.deckDoctorHistory, ...result.records],
    })
  } catch (error) {
    return invalid(state, error instanceof Error ? error.message : 'Could not apply the changes.')
  }
}

function applyDoctorUndo(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'doctorUndo' }>,
): BuilderActionResult {
  const identity = state.commanderDetails?.colours ?? []
  const record = state.deckDoctorHistory.find((swap) => swap.id === action.id)
  if (!record) return invalid(state, 'Swap not found.')
  if (record.cutCard && !action.refreshedCut)
    return invalid(state, 'Refresh the cut card before undoing this swap.')
  try {
    const result = undoDeckDoctorSwap({
      deck: state.deck,
      sideboard: state.sideboard,
      commanderCount: commanderNames(state.commander).length,
      commanderColours: identity,
      record: { ...record, cutCard: action.refreshedCut },
    })
    return done({
      ...state,
      deck: result.deck,
      sideboard: result.sideboard,
      deckDoctorHistory: state.deckDoctorHistory.filter((swap) => swap.id !== action.id),
    })
  } catch (error) {
    return invalid(state, error instanceof Error ? error.message : 'Could not undo swap safely.')
  }
}

function applyPromotion(
  state: BuilderState,
  action: Extract<BuilderAction, { type: 'promote' }>,
): BuilderActionResult {
  const deck = action.keepOutgoing
    ? state.deck
    : state.deck.filter((card) => !action.outgoingNames.includes(card.name))
  const promotion = commanderPromotionInfo(
    action.candidate,
    deck,
    action.keepOutgoing ? (state.commanderDetails?.colours ?? []) : [],
  )
  if (!promotion?.canPromote)
    return invalid(state, promotion?.error ?? 'This card cannot lead the current deck.')
  const error = commanderConstructionError([action.candidate])
  if (error) return invalid(state, error)
  const next = promoteDeckCard(deck, state.sideboard, action.candidate)
  return done({
    ...state,
    ...next,
    commander: action.candidate.name,
    commanderDetails: action.details,
    queue: state.queue.filter((card) => card.name !== action.candidate.name),
  })
}

/** No mutation, IDs, clock reads, storage, or live requests. */
function reduceBuilderAction(state: BuilderState, action: BuilderAction): BuilderActionResult {
  switch (action.type) {
    case 'settleFetch':
      return done(state)
    case 'poolLoaded':
      return done({
        ...state,
        hydrationBoundary: state.hydrationBoundary + 1,
        queue: action.queue,
        deferredCards: action.deferredCards,
        committedPoolKey: action.poolKey,
        recommendationOptionsChanged: false,
      })
    case 'startOver':
      return done(resetBuilder(state, action))
    case 'beginRecommendations':
      return {
        state: beginBuilderRecommendations(state, action),
        fetchRequests: [{ kind: 'pool', boundary: 'initialisation' }],
      }
    case 'chooseZone':
      return done({
        ...state,
        addZoneChoice: { zone: action.zone, full: state.deck.length >= 100 },
      })
    case 'promote':
      return applyPromotion(state, action)
    case 'discoverDoctor':
      return { state, fetchRequests: [{ kind: 'doctor-candidates', boundary: 'deckEdit' }] }
    case 'targets':
      return done({ ...state, deckTargets: { ...state.deckTargets, ...action.targets } })
    case 'hydrate':
      return done(applyBuilderHydration(state, action))
    case 'printing':
      return done(applyBuilderPrinting(state, action))
    case 'retryData':
      return done({ ...retryBuilderData(state), hydrationBoundary: state.hydrationBoundary + 1 })
    case 'restore':
      return done(action.state)
    case 'data':
      return done({ ...state, ...action.changes })
    case 'decide':
      return applyDecide(state, action)
    case 'ignoreReason':
      return applyIgnoreReason(state, action)
    case 'like':
      return applyLike(state, action)
    case 'theme':
      return applyTheme(state, action)
    case 'selectSubTheme':
      return applySelectSubTheme(state, action)
    case 'removeSubTheme':
      return applyRemoveSubTheme(state, action)
    case 'dismissSubTheme':
      return applyDismissSubTheme(state, action)
    case 'settings':
      return applySettings(state, action)
    case 'collectionMode':
      return applyCollectionMode(state, action)
    case 'toggleSet':
      return applyToggleSet(state, action)
    case 'focus':
      return applyFocus(state, action)
    case 'completeFocus':
      return applyCompleteFocus(state, action)
    case 'commitSettings':
      return applyCommitSettings(state, action)
    case 'nextBatch':
      return applyNextBatch(state, action)
    case 'addGuidance':
      return applyAddGuidanceOrAddCollection(state, action)
    case 'addCollection':
      return applyAddGuidanceOrAddCollection(state, action)
    case 'addSearch':
      return applyAddSearch(state, action)
    case 'addBasics':
      return applyAddBasics(state, action)
    case 'addOneBasic':
      return applyAddOneBasic(state, action)
    case 'removeCard':
      return applyRemoveCard(state, action)
    case 'moveCard':
      return applyMoveCard(state, action)
    case 'commanders':
      return applyCommanders(state, action)
    case 'doctorApply':
      return applyDoctorApply(state, action)
    case 'doctorUndo':
      return applyDoctorUndo(state, action)
  }
}

/** Reserve before transport and commit only a fully settled boundary. */
export function applyBuilderAction(
  state: BuilderState,
  action: BuilderAction,
): BuilderActionResult {
  // A reserved boundary owns hydration; an older initialisation response must not cancel it.
  if (action.type === 'hydrate' && state.fetchBoundary) return done(state)
  if (action.type === 'settleFetch') {
    const result = settleFetch(state, action.id, action.response)
    if (result.state === state) return result
    return finishFetchBoundary(result)
  }
  if (
    action.type === 'nextBatch' &&
    !state.recommendationOptionsChanged &&
    state.committedPoolKey === builderPoolKey(state)
  )
    return finishFetchBoundary(planFetches(state, action.extraSubTheme))
  const result = reduceBuilderAction(state, action)
  if (['startOver', 'restore', 'beginRecommendations', 'poolLoaded'].includes(action.type))
    result.state = {
      ...result.state,
      fetchEpoch: state.fetchEpoch + 1,
      fetchBoundary: null,
      pendingFetches: [],
    }
  if (
    result.state.fetchBoundary &&
    fetchGeneration(result.state) !== result.state.fetchBoundary.generation
  )
    result.state = { ...result.state, fetchBoundary: null, pendingFetches: [] }
  return result
}

function finishFetchBoundary(result: BuilderActionResult): BuilderActionResult {
  const { state } = result
  if (!state.fetchBoundary || state.pendingFetches.length) return result
  const extraSubTheme = state.fetchBoundary.extraSubTheme
  const advanced = reduceBuilderAction(
    { ...state, fetchBoundary: null },
    { type: 'nextBatch', extraSubTheme },
  )
  const merged = mergeBoundaryResults(advanced.state, state.fetchBoundary.id)
  if (merged.queue !== advanced.state.queue)
    advanced.state = {
      ...merged,
      queue: rankRecommendationCards(
        merged.queue,
        context(merged, merged.queue),
        merged.includeCreature,
        rolesForCard,
      ),
    }
  return advanced
}
