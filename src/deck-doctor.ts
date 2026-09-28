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
import { manualCardError } from './domain/recommendation-scoring.ts'
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
      evidence: [`${analysis.counts[key]} cards detected against a target of ${deckTargets[key]}.`],
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
  cutCard: DeckCard
  addedCard: DeckCard
  cutIndex: number
  movedToSideboard: boolean
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
  const error = manualCardError(
    {
      name: addCard.name,
      type_line: addCard.typeLine,
      color_identity: addCard.colorIdentity ?? [],
    },
    [...deck, ...sideboard].map(({ name }) => name),
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
  if (!cuts.length || cuts.length !== additions.length)
    throw new Error('Choose the same number of cards to cut and add.')
  if (new Set(cuts.map(({ cutIndex }) => cutIndex)).size !== cuts.length)
    throw new Error('Select each cut card only once.')

  let nextDeck = deck
  let nextSideboard = sideboard
  const records = cuts.map((cut, index) => {
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
  const addedIndex =
    record.cutIndex >= commanderCount &&
    deck[record.cutIndex] &&
    samePrinting(deck[record.cutIndex], record.addedCard)
      ? record.cutIndex
      : deck.findIndex(
          (card, index) => index >= commanderCount && samePrinting(card, record.addedCard),
        )
  if (addedIndex < 0) throw new Error('The added card changed; this swap cannot be undone safely.')
  const error = manualCardError(
    {
      name: record.cutCard.name,
      type_line: record.cutCard.typeLine,
      color_identity: record.cutCard.colorIdentity ?? [],
    },
    deck.filter((_, index) => index !== addedIndex).map(({ name }) => name),
    commanderColours,
  )
  if (error) throw new Error(error)

  let nextSideboard = sideboard
  if (record.movedToSideboard) {
    const cutIndex = sideboard.findIndex((card) => samePrinting(card, record.cutCard))
    if (cutIndex < 0)
      throw new Error('The cut card left the sideboard; this swap cannot be undone safely.')
    nextSideboard = sideboard.filter((_, index) => index !== cutIndex)
  }
  const nextDeck = [...deck]
  nextDeck[addedIndex] = record.cutCard
  return { deck: nextDeck, sideboard: nextSideboard }
}
