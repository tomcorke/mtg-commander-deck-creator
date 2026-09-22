import type { DeckCard } from './card-model.ts'

const manaColours = ['W', 'U', 'B', 'R', 'G'] as const
const colourNames: Record<(typeof manaColours)[number], string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}
const basicLandColours: Record<string, (typeof manaColours)[number]> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
}

type CommanderCandidate = Pick<
  DeckCard,
  'name' | 'typeLine' | 'manaCost' | 'detail' | 'producedMana' | 'faces' | 'power' | 'toughness'
> & { colorIdentity?: string[] }

export type CommanderPromotionInfo = {
  canPromote: boolean
  missingColours: string[]
  dependentCards: Pick<DeckCard, 'name'>[]
}

function distinct(values: string[]) {
  return [...new Set(values)]
}

function addSymbolColours(found: Set<string>, symbol: string) {
  for (const colour of manaColours) if (symbol.includes(colour)) found.add(colour)
}

function coloursFromText(text: string) {
  const found = new Set<string>()
  for (const match of text.matchAll(/\{([^}]+)\}/g))
    for (const symbol of match[1].split('/')) addSymbolColours(found, symbol)
  return found
}

export function cardColourIdentity(card: CommanderCandidate) {
  if (card.colorIdentity !== undefined) return distinct(card.colorIdentity)
  const found = coloursFromText(
    [
      card.name,
      card.typeLine,
      card.manaCost,
      card.detail,
      ...card.faces.flatMap((face) => [face.typeLine, face.manaCost]),
    ].join('\n'),
  )
  for (const colour of card.producedMana)
    if (manaColours.includes(colour as (typeof manaColours)[number])) found.add(colour)
  for (const [basicLand, colour] of Object.entries(basicLandColours))
    if (card.typeLine.includes(basicLand)) found.add(colour)
  return [...found]
}

function typeLines(card: Pick<CommanderCandidate, 'typeLine' | 'faces'>) {
  return [card.typeLine, ...card.faces.map((face) => face.typeLine)]
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
  if (/can be your commander/i.test(card.detail)) return true
  const hasPowerToughness = Boolean(card.power || card.toughness)
  return typeLines(card).some((typeLine) => hasEligibleLegendaryType(typeLine, hasPowerToughness))
}

export function commanderPromotionInfo(
  candidate: CommanderCandidate,
  deck: CommanderCandidate[],
  commanderColours: string[] = [],
): CommanderPromotionInfo | null {
  if (!isCommanderCandidate(candidate)) return null
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
