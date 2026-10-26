import {
  analyseDeck,
  basicLandNames,
  isBasicLandName,
  requiredPipsForCard,
  rolesForCard,
  type AnalysisCard,
  type ManaColour,
} from './deck-analysis.ts'

export type LandSuggestion<T> = { card: T; score: number; benefit: string; drawback: string }

const sourceSymbols = ['W', 'U', 'B', 'R', 'G', 'C'] as const
type SourceSymbol = (typeof sourceSymbols)[number]
const colourNames: Record<SourceSymbol, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
  C: 'colourless',
}
const typeColour = Object.fromEntries(
  Object.entries(basicLandNames).map(([colour, name]) => [name, colour]),
) as Record<string, ManaColour>
const basicTypes = Object.keys(typeColour)
const typesIn = (text: string) =>
  basicTypes.filter((type) => new RegExp(`\\b${type}\\b`).test(text))
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : (items[0] ?? '')

// Weights are a plain ordering heuristic, not a probability or simulated mana outcome.
const weights = { tapped: 0.15, conditional: 0.15, life: 0.1, fetch: 0.25, landfall: 0.25 }
const utilityWeight = { cycling: 0.2, mdfc: 0.4, ability: 0.3, typed: 0.2 }

/**
 * Remaining sources each symbol still lacks, scaled so the largest gap is 1. Pips on cards of
 * mana value 3 or less count double, so early colour needs outrank late ones.
 */
export function sourceGaps(deck: AnalysisCard[], landTarget: number) {
  const { produced } = analyseDeck(deck)
  const demand = Object.fromEntries(
    sourceSymbols.map((symbol) => [
      symbol,
      deck.reduce(
        (sum, card) => sum + requiredPipsForCard(card, symbol) * (card.manaValue <= 3 ? 2 : 1),
        0,
      ),
    ]),
  ) as Record<SourceSymbol, number>
  const total = sourceSymbols.reduce((sum, symbol) => sum + demand[symbol], 0)
  const raw = sourceSymbols.map((symbol) =>
    total ? Math.max(0, Math.round((demand[symbol] / total) * landTarget) - produced[symbol]) : 0,
  )
  const largest = Math.max(0, ...raw)
  return Object.fromEntries(
    sourceSymbols.map((symbol, index) => [symbol, largest ? raw[index] / largest : 0]),
  ) as Record<SourceSymbol, number>
}

type Notes = { score: number; benefits: string[]; drawbacks: string[] }

/** Credits the colours a land adds, directly or by fetching a remaining basic land type. */
function addSourceNotes(
  notes: Notes,
  card: AnalysisCard,
  deck: AnalysisCard[],
  identity: string[],
  gaps: Record<SourceSymbol, number>,
) {
  const { benefits, drawbacks } = notes
  const text = card.detail
  const fetched = typesIn(text.match(/search your library for ([^.]*)/i)?.[1] ?? '')
  const fetchTargets = fetched.filter(
    (type) =>
      identity.includes(typeColour[type]) || deck.some((land) => land.typeLine.includes(type)),
  )
  const output = [
    ...new Set([
      ...card.producedMana.filter((symbol) => symbol === 'C' || identity.includes(symbol)),
      ...fetchTargets.map((type) => typeColour[type]),
    ]),
  ] as SourceSymbol[]
  const helped = output.filter((symbol) => gaps[symbol] > 0)
  notes.score += helped.reduce((sum, symbol) => sum + gaps[symbol], 0)
  if (helped.length)
    benefits.push(`Adds a ${list(helped.map((symbol) => colourNames[symbol]))} source you lack`)
  else if (
    output.length &&
    output.every((symbol) => symbol === 'C') &&
    sourceSymbols.some((s) => gaps[s] > 0)
  )
    drawbacks.push('Makes only colourless mana, so it does not fix a coloured gap')

  if (fetched.length) {
    if (fetchTargets.length) {
      notes.score += weights.fetch
      benefits.push(`Fetches a ${list(fetchTargets)}`)
      if (deck.some((other) => /\blandfall\b/i.test(other.detail))) {
        notes.score += weights.landfall
        benefits.push('Triggers landfall twice')
      }
    } else drawbacks.push(`No ${list(fetched)} left for it to fetch`)
  }
  const searchers = deck.filter((other) => /search your library for/i.test(other.detail))
  const typed = typesIn(card.typeLine).filter((type) =>
    searchers.some((other) => new RegExp(`\\b${type}\\b`).test(other.detail)),
  )
  if (typed.length) {
    notes.score += utilityWeight.typed
    benefits.push(`Has the ${list(typed)} type your search effects find`)
  }
}

function describeLand<T extends AnalysisCard>(
  card: T,
  deck: AnalysisCard[],
  identity: string[],
  gaps: Record<SourceSymbol, number>,
  basic: number,
) {
  const text = card.detail
  const notes: Notes = { score: 0, benefits: [], drawbacks: [] }
  addSourceNotes(notes, card, deck, identity, gaps)
  const { benefits, drawbacks } = notes
  let { score } = notes

  if (
    /enters (?:the battlefield )?tapped unless|you may pay [^.]*\. if you don['’]t, it enters/i.test(
      text,
    )
  ) {
    score -= weights.conditional
    drawbacks.push('Enters tapped unless its condition is met')
  } else if (/enters (?:the battlefield )?tapped/i.test(text)) {
    // Tempo matters more while a basic would still fill a colour gap.
    score -= weights.tapped + basic / 4
    drawbacks.push('Always enters tapped')
  }
  if (/pay \d+ life|deals \d+ damage to you/i.test(text)) {
    score -= weights.life
    drawbacks.push('Costs life to use')
  }
  if (card.layout === 'modal_dfc') {
    score += utilityWeight.mdfc
    benefits.push('Can be played as a spell instead')
    drawbacks.push('Each copy is a land or a spell, not both')
  } else if (/\bcycling\b/i.test(text)) {
    score += utilityWeight.cycling
    benefits.push('Can cycle away late')
  }
  // Any non-mana activated ability, such as card draw or a token maker.
  const ability = text
    .split('\n')
    .find(
      (line) =>
        /^[^:]*\{T\}[^:]*:/.test(line) &&
        !/:\s*add\b/i.test(line) &&
        !/search your library/i.test(line),
    )
  if (ability) {
    score += utilityWeight.ability
    benefits.push(`Utility: ${ability.replace(/^[^:]*:\s*/, '').replace(/\.$/, '')}`)
    if (/^[^:]*\{\d+\}/.test(ability)) drawbacks.push('Its ability costs mana')
  }
  return {
    card,
    score: Math.round(score * 100) / 100,
    benefit: benefits.join('. ') || 'Another land drop',
    drawback: drawbacks.join('. ') || 'Takes the slot a basic would fill',
  }
}

/**
 * Nonbasic lands that beat the untapped basic they would replace, best first. Ties sort by name,
 * so a fixed pool and deck always give the same list.
 */
export function rankLandSuggestions<T extends AnalysisCard>(
  candidates: T[],
  deck: AnalysisCard[],
  {
    excluded,
    identity,
    landTarget,
    limit,
  }: {
    excluded: string[]
    identity: string[]
    landTarget: number
    limit: number
  },
): LandSuggestion<T>[] {
  const gaps = sourceGaps(deck, landTarget)
  // A basic adds the colour with the largest gap, untapped and free.
  const basic = Math.max(0, ...identity.map((colour) => gaps[colour as SourceSymbol] ?? 0))
  return candidates
    .filter(
      (card, index) =>
        rolesForCard(card).includes('lands') &&
        !/\bBasic\b/.test(card.typeLine) &&
        !isBasicLandName(card.name) &&
        !excluded.includes(card.name) &&
        candidates.findIndex((other) => other.name === card.name) === index,
    )
    .map((card) => describeLand(card, deck, identity, gaps, basic))
    .filter(({ score }) => score > basic)
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name))
    .slice(0, Math.max(0, limit))
}
