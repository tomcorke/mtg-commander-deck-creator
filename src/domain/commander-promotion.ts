import type { DeckCard } from './card-model.ts'

const manaColours = ['W', 'U', 'B', 'R', 'G'] as const
const colourNames: Record<(typeof manaColours)[number], string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}
type CommanderCandidate = Pick<
  DeckCard,
  'name' | 'typeLine' | 'manaCost' | 'detail' | 'faces' | 'power' | 'toughness'
> & { colorIdentity?: string[] }

export type CommanderPromotionInfo = {
  canPromote: boolean
  missingColours: string[]
  dependentCards: Pick<DeckCard, 'name'>[]
  error?: string
}

function distinct(values: string[]) {
  return [...new Set(values)]
}

export function cardColourIdentity(card: CommanderCandidate) {
  return distinct(card.colorIdentity ?? [])
}

function typeLines(card: Pick<CommanderCandidate, 'typeLine' | 'faces'>) {
  return [card.faces[0]?.typeLine ?? card.typeLine.split(' // ')[0]]
}

export function isLegendaryCreature(card: Pick<CommanderCandidate, 'typeLine' | 'faces'>) {
  return typeLines(card).some(
    (typeLine) => /\bLegendary\b/.test(typeLine) && /\bCreature\b/.test(typeLine),
  )
}

function hasEligibleLegendaryType(typeLine: string, hasPowerToughness: boolean) {
  return (
    /\bLegendary\b/.test(typeLine) &&
    (/\bCreature\b/.test(typeLine) ||
      /\bVehicle\b/.test(typeLine) ||
      (/\bSpacecraft\b/.test(typeLine) && hasPowerToughness))
  )
}

export function isCommanderCandidate(card: CommanderCandidate) {
  const text =
    card.faces[0]?.detail ?? (card.faces.length ? card.detail.split('\n')[0] : card.detail)
  if (/can be your commander/i.test(text)) return true
  if (card.name === 'Grist, the Hunger Tide') return true
  const hasPowerToughness = Boolean(card.power || card.toughness)
  return typeLines(card).some((typeLine) => hasEligibleLegendaryType(typeLine, hasPowerToughness))
}

export function commanderPromotionInfo(
  candidate: CommanderCandidate,
  deck: CommanderCandidate[],
  commanderColours: string[] = [],
): CommanderPromotionInfo | null {
  if (!isCommanderCandidate(candidate)) return null
  if ([candidate, ...deck].some((card) => !card.colorIdentity))
    return {
      canPromote: false,
      missingColours: [],
      dependentCards: [],
      error: 'Cannot use as commander: colour identity is unknown. Refresh card data first.',
    }
  const candidateColours = new Set(cardColourIdentity(candidate))
  const requiredColours = distinct([
    ...commanderColours,
    ...deck.flatMap((card) => cardColourIdentity(card)),
  ])
  const missingColours = requiredColours.filter((colour) => !candidateColours.has(colour))
  return {
    canPromote: missingColours.length === 0,
    missingColours,
    dependentCards: deck.filter((card) =>
      cardColourIdentity(card).some((colour) => missingColours.includes(colour)),
    ),
  }
}

function listNames(names: string[]) {
  if (names.length < 2) return names[0] ?? 'another card'
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export function commanderPromotionWarning(info: CommanderPromotionInfo) {
  if (info.error) return info.error
  const colours = listNames(
    info.missingColours.map(
      (colour) => colourNames[colour as (typeof manaColours)[number]] ?? colour,
    ),
  )
  const cards = listNames([...new Set(info.dependentCards.map((card) => card.name))])
  return `Cannot use as commander: colour identity omits ${colours}, required by ${cards}.`
}

export function promoteDeckCard(deck: DeckCard[], sideboard: DeckCard[], candidate: DeckCard) {
  const nextDeck = [candidate, ...deck.filter((card) => card.name !== candidate.name)]
  const displaced = nextDeck.splice(100)
  return {
    deck: nextDeck,
    sideboard: [...displaced, ...sideboard.filter((card) => card.name !== candidate.name)],
  }
}
