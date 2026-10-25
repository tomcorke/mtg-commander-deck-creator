import { cardFeatures, rolesForCard } from './deck-analysis.ts'
import type { DeckCard } from './domain/card-model.ts'

const turnsToSimulate = 10

type SimCard = { card: DeckCard; id: number }
type ManaCost = { generic: number; pips: string[] }
type SimulationCounts = {
  landDrops: number[]
  drawnHits: number[][]
  castableHits: number[][]
}

export type ManaAccessTurn = {
  turn: number
  landDropRate: number
}

export type SpellCastability = {
  name: string
  drawnByTurn: number[]
  whenDrawnByTurn: number[]
}

export type ManaAccessSimulation = {
  trials: number
  turns: ManaAccessTurn[]
  spellCastability: SpellCastability[]
  /** Spells whose cost the model can't pay (hybrid, X, Phyrexian), so they aren't sampled. */
  unsupported: string[]
  /** The deck has fewer than 100 cards, so the results will shift as it fills. */
  provisional: boolean
}

// Assumptions: one free mulligan (multiplayer Commander) when the opening seven has fewer than two
// or more than five lands; the player draws every turn, plays the land that pays the most spells
// in hand, then casts the cheapest repeatable ramp or land-ramp spell it can pay.
const keepableLands = (hand: SimCard[]) => {
  const lands = hand.filter(({ card }) => isLandCard(card)).length
  return lands >= 2 && lands <= 5
}
// "enters tapped" without a condition ("unless", "if") makes the land useless on the turn it's played.
const entersTapped = (card: DeckCard) =>
  /enters(?: the battlefield)? tapped\./i.test(card.detail) &&
  !/\bif\b[^.]*enters(?: the battlefield)? tapped\./i.test(card.detail)
// Card text checks run every turn of every trial, so each card is classified once.
const cached = <T>(read: (card: DeckCard) => T) => {
  const results = new WeakMap<DeckCard, T>()
  return (card: DeckCard) => {
    if (!results.has(card)) results.set(card, read(card))
    return results.get(card)!
  }
}
const isLandCard = cached((card) => rolesForCard(card).includes('lands'))
const tappedLand = cached(entersTapped)
const rampKind = cached((card) => cardFeatures(card).mana)
type Source = { card: DeckCard; readyTurn: number }

function parseManaCost(value: string): ManaCost | null {
  if (!value || value.replace(/\{[^{}]+\}/g, '')) return null
  const symbols = [...value.matchAll(/\{([^{}]+)\}/g)].map(([, symbol]) => symbol)
  if (!symbols.length) return null
  const cost: ManaCost = { generic: 0, pips: [] }
  for (const symbol of symbols) {
    if (/^\d+$/.test(symbol)) cost.generic += Number(symbol)
    else if (/^[WUBRGC]$/.test(symbol)) cost.pips.push(symbol)
    else return null
  }
  return cost
}

function canPay(played: DeckCard[], cost: ManaCost) {
  // A land that produces no mana pays neither coloured nor generic costs.
  const sources = played.filter((source) => source.producedMana.length > 0)
  if (sources.length < cost.pips.length + cost.generic) return false
  const pips = [...cost.pips].sort(
    (left, right) =>
      sources.filter((source) => source.producedMana.includes(left)).length -
      sources.filter((source) => source.producedMana.includes(right)).length,
  )
  const used = new Set<number>()
  function assign(index: number): boolean {
    if (index === pips.length) return true
    return sources.some((source, sourceIndex) => {
      if (used.has(sourceIndex) || !source.producedMana.includes(pips[index])) return false
      used.add(sourceIndex)
      const assigned = assign(index + 1)
      if (!assigned) used.delete(sourceIndex)
      return assigned
    })
  }
  return assign(0) && sources.length - used.size >= cost.generic
}

function shuffledCards(cards: SimCard[], random: () => number) {
  const shuffled = [...cards]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function chooseLand(hand: SimCard[], playedLands: DeckCard[], spellCosts: Map<number, ManaCost>) {
  // Untapped lands first, so a tapped land is played when it costs nothing this turn.
  const spellsInHand = hand.flatMap(({ id }) => {
    const cost = spellCosts.get(id)
    return cost ? [{ cost }] : []
  })
  let chosen = -1
  let bestScore = -1
  hand.forEach(({ card }, index) => {
    if (!isLandCard(card)) return
    const score =
      Number(!tappedLand(card)) * 10_000 +
      spellsInHand.reduce(
        (count, spell) => count + Number(canPay([...playedLands, card], spell.cost)),
        0,
      ) *
        100 +
      new Set(card.producedMana).size
    if (score > bestScore) {
      chosen = index
      bestScore = score
    }
  })
  return chosen
}

function recordSpellSamples(
  hand: SimCard[],
  playedLands: DeckCard[],
  spells: SimCard[],
  spellCosts: Map<number, ManaCost>,
  counts: SimulationCounts,
  turn: number,
) {
  spells.forEach(({ id }, spellIndex) => {
    if (!hand.some((held) => held.id === id)) return
    counts.drawnHits[spellIndex][turn] += 1
    if (canPay(playedLands, spellCosts.get(id)!)) counts.castableHits[spellIndex][turn] += 1
  })
}

function castRamp(
  hand: SimCard[],
  library: SimCard[],
  sources: Source[],
  spellCosts: Map<number, ManaCost>,
  turn: number,
) {
  const ready = sources.filter(({ readyTurn }) => readyTurn <= turn).map(({ card }) => card)
  const options = hand
    .map((held, index) => ({ held, index, cost: spellCosts.get(held.id) }))
    .filter(({ held, cost }) => {
      const mana = rampKind(held.card)
      return cost && (mana === 'repeatable' || mana === 'land-ramp') && canPay(ready, cost)
    })
    .sort((left, right) => left.held.card.manaValue - right.held.card.manaValue)
  const choice = options[0]
  if (!choice) return
  hand.splice(choice.index, 1)
  if (rampKind(choice.held.card) === 'repeatable')
    sources.push({ card: choice.held.card, readyTurn: turn + 1 })
  else {
    // Land ramp fetches the first basic still in the library; it enters tapped.
    const basic = library.findIndex(({ card }) => /\bBasic\b/.test(card.typeLine))
    if (basic >= 0) sources.push({ card: library.splice(basic, 1)[0].card, readyTurn: turn + 1 })
  }
}

function simulateTrial(
  library: SimCard[],
  spells: SimCard[],
  spellCosts: Map<number, ManaCost>,
  counts: SimulationCounts,
  random: () => number,
) {
  let shuffled = shuffledCards(library, random)
  if (!keepableLands(shuffled.slice(0, 7))) shuffled = shuffledCards(library, random)
  const hand = shuffled.splice(0, 7)
  const sources: Source[] = []
  for (let turn = 0; turn < turnsToSimulate; turn += 1) {
    const drawn = shuffled.shift()
    if (drawn) hand.push(drawn)
    const lands = sources.map(({ card }) => card)
    const landIndex = chooseLand(hand, lands, spellCosts)
    if (landIndex >= 0) {
      const land = hand.splice(landIndex, 1)[0].card
      sources.push({ card: land, readyTurn: tappedLand(land) ? turn + 1 : turn })
      counts.landDrops[turn] += 1
    }
    const ready = sources.filter(({ readyTurn }) => readyTurn <= turn).map(({ card }) => card)
    recordSpellSamples(hand, ready, spells, spellCosts, counts, turn)
    castRamp(hand, shuffled, sources, spellCosts, turn)
  }
}

function initialCounts(spellCount: number): SimulationCounts {
  return {
    landDrops: Array(turnsToSimulate).fill(0),
    drawnHits: Array.from({ length: spellCount }, () => Array(turnsToSimulate).fill(0)),
    castableHits: Array.from({ length: spellCount }, () => Array(turnsToSimulate).fill(0)),
  }
}

function simulationResult(
  trials: number,
  spells: SimCard[],
  counts: SimulationCounts,
  unsupported: string[],
  provisional: boolean,
): ManaAccessSimulation {
  return {
    trials,
    unsupported,
    provisional,
    turns: counts.landDrops.map((landDropCount, turn) => ({
      turn: turn + 1,
      landDropRate: landDropCount / trials,
    })),
    spellCastability: spells.map(({ card }, spellIndex) => ({
      name: card.name,
      drawnByTurn: counts.drawnHits[spellIndex].map((count) => count / trials),
      whenDrawnByTurn: counts.drawnHits[spellIndex].map((count, turn) =>
        count ? counts.castableHits[spellIndex][turn] / count : 0,
      ),
    })),
  }
}

export function simulateManaAccess({
  deck,
  commanderCount,
  trials = 3000,
  random = Math.random,
}: {
  deck: DeckCard[]
  commanderCount: number
  trials?: number
  random?: () => number
}): ManaAccessSimulation {
  if (!Number.isInteger(commanderCount) || commanderCount < 0 || commanderCount > deck.length)
    throw new RangeError('commanderCount must be within the deck')
  if (!Number.isInteger(trials) || trials < 1) throw new RangeError('trials must be positive')

  const library = deck.slice(commanderCount).map((card, id) => ({ card, id }))
  const spellCosts = new Map(
    library.flatMap(({ card, id }) => {
      if (isLandCard(card)) return []
      const cost = parseManaCost(card.manaCost)
      return cost ? [[id, cost] as const] : []
    }),
  )
  const spells = library.filter(({ id }) => spellCosts.has(id))
  const unsupported = library
    .filter(({ card, id }) => !spellCosts.has(id) && !isLandCard(card) && card.manaCost !== '')
    .map(({ card }) => card.name)
  const counts = initialCounts(spells.length)
  for (let trial = 0; trial < trials; trial += 1)
    simulateTrial(library, spells, spellCosts, counts, random)
  return simulationResult(trials, spells, counts, unsupported, deck.length < 100)
}
