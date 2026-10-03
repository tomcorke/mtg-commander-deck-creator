import { rolesForCard } from './deck-analysis.ts'
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
}

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

function canPay(sources: DeckCard[], cost: ManaCost) {
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
  const spellsInHand = hand.flatMap(({ id }) => {
    const cost = spellCosts.get(id)
    return cost ? [{ cost }] : []
  })
  let chosen = -1
  let bestScore = -1
  hand.forEach(({ card }, index) => {
    if (!rolesForCard(card).includes('lands')) return
    const score =
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

function simulateTrial(
  library: SimCard[],
  spells: SimCard[],
  spellCosts: Map<number, ManaCost>,
  counts: SimulationCounts,
  random: () => number,
) {
  const shuffled = shuffledCards(library, random)
  let nextCard = 0
  const hand = shuffled.splice(0, 7)
  const playedLands: DeckCard[] = []
  for (let turn = 0; turn < turnsToSimulate; turn += 1) {
    if (nextCard < shuffled.length) {
      const drawn = shuffled[nextCard++]
      hand.push(drawn)
    }
    const landIndex = chooseLand(hand, playedLands, spellCosts)
    if (landIndex >= 0) {
      playedLands.push(hand.splice(landIndex, 1)[0].card)
      counts.landDrops[turn] += 1
    }
    recordSpellSamples(hand, playedLands, spells, spellCosts, counts, turn)
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
): ManaAccessSimulation {
  return {
    trials,
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
      if (rolesForCard(card).includes('lands')) return []
      const cost = parseManaCost(card.manaCost)
      return cost ? [[id, cost] as const] : []
    }),
  )
  const spells = library.filter(({ id }) => spellCosts.has(id))
  const counts = initialCounts(spells.length)
  for (let trial = 0; trial < trials; trial += 1)
    simulateTrial(library, spells, spellCosts, counts, random)
  return simulationResult(trials, spells, counts)
}
