import {
  analyseDeck,
  deckGuidance,
  requiredPipsForCard,
  rolesForCard,
  targetLabels,
  type DeckTargets,
  type ManaColour,
} from './deck-analysis.ts'
import { toDeckCardFromRecommendation, type Card, type DeckCard } from './domain/card-model.ts'
import { findSynergyPair } from './domain/recommendation-themes.ts'
import { cardConstructionError } from './domain/commander-construction.ts'
import type { ManaAccessSimulation } from './deck-simulation.ts'

export type DeckDoctorSwap = {
  cutIndex: number
  cutCard: DeckCard
  addCard: Card
  reason: string
}

export type DeckDoctorCardSignal = {
  cardName: string
  summary: string
  colourGaps: { colour: ManaColour; required: number; sources: number }[]
  simulation?: { turn: number; drawnChance: number; castableChance: number }
}

export type DeckDoctorFinding = {
  id: string
  kind: 'theme-support' | 'weak-connection' | 'role-gap' | 'mana-outlier'
  title: string
  summary: string
  evidence: string[]
  cardNames: string[]
  supportCount?: number
  cardSignals?: DeckDoctorCardSignal[]
}

export type DeckDoctorInput = {
  deck: DeckCard[]
  sideboard: DeckCard[]
  commanderCount: number
  theme: string
  activeSubThemes: string[]
  deckTargets: DeckTargets
  simulation?: ManaAccessSimulation
}

const colours = ['W', 'U', 'B', 'R', 'G'] as const
const cardNames = (cards: DeckCard[]) => [...new Set(cards.map(({ name }) => name))]

type DiagnosisContext = DeckDoctorInput & {
  analysis: ReturnType<typeof analyseDeck>
  mainboard: DeckCard[]
  themeTags: string[]
  cuts: { card: DeckCard; index: number }[]
}

function hasKnownSynergy(card: DeckCard, deck: DeckCard[]) {
  return deck.some((other) => other !== card && findSynergyPair([card, other]) !== null)
}

function unconnectedCards(deck: DeckCard[], themeTags: string[], synergyDeck: DeckCard[]) {
  return deck.flatMap((card, index) =>
    themeTags.some((tag) => card.tags.includes(tag)) ||
    rolesForCard(card).length ||
    hasKnownSynergy(card, synergyDeck)
      ? []
      : [{ card, index }],
  )
}

function themeSupportFindings(context: DiagnosisContext): DeckDoctorFinding[] {
  const { mainboard, themeTags } = context
  return themeTags.flatMap((tag) => {
    const support = mainboard.filter((card) => card.tags.includes(tag))
    if (support.length > 1) return []
    return [
      {
        id: `theme-support:${tag}`,
        kind: 'theme-support',
        title: `${tag} has ${support.length ? 'single-card' : 'no detected'} support`,
        summary: `Only ${support.length} main-deck card${support.length === 1 ? '' : 's'} match the ${tag} tag. Tags can miss real interactions.`,
        evidence: support.length ? [] : [`No ${tag}-tagged cards detected.`],
        cardNames: cardNames(support),
        supportCount: support.length,
      },
    ]
  })
}

function weakConnectionFindings(context: DiagnosisContext): DeckDoctorFinding[] {
  const { cuts } = context
  if (!cuts.length) return []
  const names = cardNames(cuts.map(({ card }) => card))
  return [
    {
      id: 'weak-connections',
      kind: 'weak-connection',
      title: `${names.length} card${names.length === 1 ? '' : 's'} have no detected theme, role, or synergy link`,
      summary: 'These are prompts to review the cards, not cut recommendations.',
      evidence: ['No selected-theme tag, deck role, or known card-pair synergy detected.'],
      cardNames: names,
      supportCount: names.length,
    },
  ]
}

function roleGapFindings(context: DiagnosisContext): DeckDoctorFinding[] {
  const { analysis, deck, deckTargets } = context
  if (deck.length < 70) return []
  return deckGuidance(deck.length, analysis.counts, deckTargets).map((guidance) => {
    const key = guidance.key as keyof DeckTargets
    return {
      id: `role-gap:${key}`,
      kind: 'role-gap',
      title: `${targetLabels[key]} may be short`,
      summary: guidance.text,
      evidence: [
        `${analysis.counts[key]} card${analysis.counts[key] === 1 ? '' : 's'} detected against a target of ${deckTargets[key]}.`,
      ],
      cardNames: cardNames(deck.filter((card) => rolesForCard(card).includes(key))),
      supportCount: analysis.counts[key],
    }
  })
}

function manaSimulationEstimate(card: DeckCard, simulation: ManaAccessSimulation | undefined) {
  if (!simulation) return undefined
  const turn = Math.min(10, Math.max(1, Math.ceil(card.manaValue)))
  const castability = simulation.spellCastability.find(({ name }) => name === card.name)
  const drawnChance = castability?.drawnByTurn[turn - 1]
  if (!castability || drawnChance === undefined || drawnChance * simulation.trials < 30)
    return undefined
  return { turn, drawnChance, castableChance: castability.whenDrawnByTurn[turn - 1] }
}

function hybridAlternativeDiscount(card: DeckCard, analysis: ReturnType<typeof analyseDeck>) {
  const alternatives = new Map<ManaColour, number>()
  for (const [, colour] of card.manaCost.matchAll(/\{2\/([WUBRG])\}/g)) {
    const key = colour as ManaColour
    alternatives.set(key, (alternatives.get(key) ?? 0) + 1)
  }
  // ponytail: use source counts for {2/color} alternatives; sampled color draws if this proxy misranks hybrids.
  return [...alternatives].reduce(
    (discount, [colour, count]) => discount + Math.min(count, analysis.produced[colour]),
    0,
  )
}

function manaSignal(card: DeckCard, context: DiagnosisContext): DeckDoctorCardSignal | null {
  const { analysis, simulation } = context
  const average = analysis.averageManaValue
  const colourGaps = colours.flatMap((colour) => {
    const required = requiredPipsForCard(card, colour)
    const sources = analysis.produced[colour as ManaColour]
    return required > 0 && sources < required ? [{ colour, required, sources }] : []
  })
  const estimatedCost = card.manaValue - hybridAlternativeDiscount(card, analysis)
  const highCost = estimatedCost >= 6 && estimatedCost >= average + 2
  if (!colourGaps.length && !highCost) return null

  const summary = [
    highCost && 'Cost is well above the deck average',
    colourGaps.length && 'Colour pips exceed reported mana sources',
  ]
    .filter(Boolean)
    .join('; ')
  return {
    cardName: card.name,
    summary,
    colourGaps,
    simulation: manaSimulationEstimate(card, simulation),
  }
}

function manaFindings(context: DiagnosisContext): DeckDoctorFinding[] {
  const cardSignals = context.mainboard.flatMap((card) => {
    const signal = manaSignal(card, context)
    return signal ? [signal] : []
  })
  if (!cardSignals.length) return []
  return [
    {
      id: 'mana-outliers',
      kind: 'mana-outlier',
      title: `${cardSignals.length} card${cardSignals.length === 1 ? '' : 's'} may be difficult to cast`,
      summary:
        'These cards have high costs or coloured demands compared with reported mana sources.',
      evidence: [],
      cardNames: cardSignals.map(({ cardName }) => cardName),
      supportCount: cardSignals.length,
      cardSignals,
    },
  ]
}

export function analyzeDeckDoctor(input: DeckDoctorInput): DeckDoctorFinding[] {
  const analysis = analyseDeck(input.deck)
  const themeTags = [...new Set([input.theme, ...input.activeSubThemes].filter(Boolean))]
  const mainboard = input.deck.slice(input.commanderCount)
  const cuts = unconnectedCards(mainboard, themeTags, input.deck).map(({ card, index }) => ({
    card,
    index: index + input.commanderCount,
  }))
  const context = { ...input, analysis, mainboard, themeTags, cuts }
  return [
    ...themeSupportFindings(context),
    ...weakConnectionFindings(context),
    ...roleGapFindings(context),
    ...manaFindings(context),
  ]
}

export type DeckDoctorSwapRecord = {
  id: string
  /** Missing on add-only records. */
  cutCard?: DeckCard
  /** Missing on cut-only records. */
  addedCard?: DeckCard
  cutIndex: number
  movedToSideboard: boolean
}

export type DeckReviewMode = 'build' | 'review' | 'trim'

/** Below about 90 cards, fill gaps; above 100, cut down; otherwise review swaps. */
export const deckReviewMode = (deckSize: number): DeckReviewMode =>
  deckSize < 90 ? 'build' : deckSize > 100 ? 'trim' : 'review'

/** Groups deck positions by card name, keeping first-seen order. */
export function groupDeckCards<T extends { card: DeckCard; index: number }>(cards: T[]) {
  const groups = new Map<string, { card: DeckCard; indexes: number[] }>()
  for (const { card, index } of cards) {
    const group = groups.get(card.name)
    if (group) group.indexes.push(index)
    else groups.set(card.name, { card, indexes: [index] })
  }
  return [...groups.values()]
}

function samePrinting(left: DeckCard, right: DeckCard) {
  return (
    left.name === right.name &&
    left.set === right.set &&
    left.collectorNumber === right.collectorNumber
  )
}

export function applyDeckDoctorSwap({
  id,
  deck,
  sideboard,
  commanderCount,
  commanderColours,
  swap,
  moveCutToSideboard,
}: {
  id: string
  deck: DeckCard[]
  sideboard: DeckCard[]
  commanderCount: number
  commanderColours: string[]
  swap: DeckDoctorSwap
  moveCutToSideboard: boolean
}): { deck: DeckCard[]; sideboard: DeckCard[]; record: DeckDoctorSwapRecord } {
  if (swap.cutIndex < commanderCount || swap.cutIndex >= deck.length)
    throw new Error('The commander cannot be cut.')
  const cutCard = deck[swap.cutIndex]
  if (!samePrinting(cutCard, swap.cutCard))
    throw new Error('The deck changed; rerun the diagnosis.')
  const addCard = swap.addCard
  const error = cardConstructionError(
    addCard,
    deck.filter((_, index) => index !== swap.cutIndex),
    commanderColours,
  )
  if (error) throw new Error(error)

  const addedCard = toDeckCardFromRecommendation(addCard)
  const nextDeck = [...deck]
  nextDeck[swap.cutIndex] = addedCard
  return {
    deck: nextDeck,
    sideboard: moveCutToSideboard ? [...sideboard, cutCard] : sideboard,
    record: {
      id,
      cutCard,
      addedCard,
      cutIndex: swap.cutIndex,
      movedToSideboard: moveCutToSideboard,
    },
  }
}

export function applyDeckDoctorSwapPlan({
  id,
  deck,
  sideboard,
  commanderCount,
  commanderColours,
  cuts,
  additions,
  moveCutToSideboard,
}: {
  id: string
  deck: DeckCard[]
  sideboard: DeckCard[]
  commanderCount: number
  commanderColours: string[]
  cuts: { cutIndex: number; cutCard: DeckCard }[]
  additions: Card[]
  moveCutToSideboard: boolean
}): { deck: DeckCard[]; sideboard: DeckCard[]; records: DeckDoctorSwapRecord[] } {
  if (!cuts.length && !additions.length) throw new Error('Choose cards to cut or add.')
  if (new Set(cuts.map(({ cutIndex }) => cutIndex)).size !== cuts.length)
    throw new Error('Select each cut card only once.')

  const pairCount = Math.min(cuts.length, additions.length)
  let nextDeck = deck
  let nextSideboard = sideboard
  const records: DeckDoctorSwapRecord[] = cuts.slice(0, pairCount).map((cut, index) => {
    const result = applyDeckDoctorSwap({
      id: `${id}:${index}`,
      deck: nextDeck,
      sideboard: nextSideboard,
      commanderCount,
      commanderColours,
      swap: { ...cut, addCard: additions[index], reason: '' },
      moveCutToSideboard,
    })
    nextDeck = result.deck
    nextSideboard = result.sideboard
    return result.record
  })

  // Remove from the highest index down so earlier positions stay valid.
  const extraCuts = cuts.slice(pairCount).sort((left, right) => right.cutIndex - left.cutIndex)
  for (const cut of extraCuts) {
    if (cut.cutIndex < commanderCount || cut.cutIndex >= nextDeck.length)
      throw new Error('The commander cannot be cut.')
    const cutCard = nextDeck[cut.cutIndex]
    if (!samePrinting(cutCard, cut.cutCard))
      throw new Error('The deck changed; rerun the diagnosis.')
    nextDeck = nextDeck.filter((_, index) => index !== cut.cutIndex)
    if (moveCutToSideboard) nextSideboard = [...nextSideboard, cutCard]
    records.push({
      id: `${id}:${records.length}`,
      cutCard,
      cutIndex: cut.cutIndex,
      movedToSideboard: moveCutToSideboard,
    })
  }

  for (const addCard of additions.slice(pairCount)) {
    const error = cardConstructionError(addCard, nextDeck, commanderColours)
    if (error) throw new Error(error)
    const addedCard = toDeckCardFromRecommendation(addCard)
    records.push({
      id: `${id}:${records.length}`,
      addedCard,
      cutIndex: nextDeck.length,
      movedToSideboard: false,
    })
    nextDeck = [...nextDeck, addedCard]
  }
  return { deck: nextDeck, sideboard: nextSideboard, records }
}

export function undoDeckDoctorSwap({
  deck,
  sideboard,
  commanderCount,
  commanderColours,
  record,
}: {
  deck: DeckCard[]
  sideboard: DeckCard[]
  commanderCount: number
  commanderColours: string[]
  record: DeckDoctorSwapRecord
}): { deck: DeckCard[]; sideboard: DeckCard[] } {
  const { addedCard, cutCard } = record
  let addedIndex = -1
  if (addedCard) {
    addedIndex =
      record.cutIndex >= commanderCount &&
      deck[record.cutIndex] &&
      samePrinting(deck[record.cutIndex], addedCard)
        ? record.cutIndex
        : deck.findIndex((card, index) => index >= commanderCount && samePrinting(card, addedCard))
    if (addedIndex < 0)
      throw new Error('The added card changed; this swap cannot be undone safely.')
  }
  const remaining = deck.filter((_, index) => index !== addedIndex)
  if (!cutCard) return { deck: remaining, sideboard }

  const error = cardConstructionError(cutCard, remaining, commanderColours)
  if (error) throw new Error(error)

  let nextSideboard = sideboard
  if (record.movedToSideboard) {
    const cutIndex = sideboard.findIndex((card) => samePrinting(card, cutCard))
    if (cutIndex < 0)
      throw new Error('The cut card left the sideboard; this swap cannot be undone safely.')
    nextSideboard = sideboard.filter((_, index) => index !== cutIndex)
  }
  const nextDeck = [...deck]
  if (addedCard) nextDeck[addedIndex] = cutCard
  else nextDeck.splice(Math.max(commanderCount, Math.min(record.cutIndex, deck.length)), 0, cutCard)
  return { deck: nextDeck, sideboard: nextSideboard }
}
