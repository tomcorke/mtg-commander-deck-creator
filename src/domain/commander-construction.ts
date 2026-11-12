import type { DeckCard } from './card-model.ts'
import { partnerPairError } from './commander-pairing.ts'
import { isCommanderCandidate } from './commander-promotion.ts'

const basicLandColours: Record<string, string> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
}
const copyNumbers: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
}

export function cardCopyLimit(card: DeckCard) {
  // Rule: CR 903.5b and Oracle copy exceptions (113.6n).
  if (/\bBasic\b/.test(card.faces[0]?.typeLine ?? card.typeLine)) return Infinity
  if (/A deck can have any number of cards named /i.test(card.detail)) return Infinity
  const limit = card.detail.match(/A deck can have up to (\w+) cards named /i)?.[1]
  return limit ? (copyNumbers[limit.toLowerCase()] ?? Number(limit)) : 1
}

export function cardConstructionError(card: DeckCard, deck: DeckCard[], colours: string[]) {
  if (card.dataStatus === 'pending') return 'Current card data is being checked.'
  if (card.dataStatus === 'unavailable') return 'Current card data is unavailable.'
  if (card.commanderLegality !== 'legal') return 'Card is not verified legal in Commander.'
  if (!card.colorIdentity) return 'Card colour identity is unknown. Refresh its card data.'
  if (card.manaValueKnown === false || !Number.isFinite(card.manaValue))
    return 'Card mana value is unknown. Refresh its card data.'
  if (card.colorIdentity.some((colour) => !colours.includes(colour)))
    return 'Card is outside your commander’s colour identity.'
  const typeLine = card.faces[0]?.typeLine ?? card.typeLine
  const subtypes = typeLine.split('—')[1]?.split(/\s+/) ?? []
  if (subtypes.some((type) => basicLandColours[type] && !colours.includes(basicLandColours[type])))
    return 'Card is outside your commander’s colour identity.'
  const copies = deck.filter((other) =>
    card.oracleId && other.oracleId ? card.oracleId === other.oracleId : card.name === other.name,
  ).length
  if (copies >= cardCopyLimit(card)) return 'Card is already in your deck at its copy limit.'
  return ''
}

export function commanderConstructionError(commanders: DeckCard[]) {
  if (!commanders.length || commanders.length > 2) return 'Choose one commander or a partner pair.'
  for (const card of commanders) {
    const error = cardConstructionError(card, [], card.colorIdentity ?? [])
    if (error) return `${card.name}: ${error}`
    if (['The Prismatic Piper', 'Faceless One'].includes(card.name))
      return `${card.name}: chosen-colour commanders are not supported yet.`
  }
  if (commanders.length === 1)
    return isCommanderCandidate(commanders[0]) ? '' : 'This card cannot be your commander.'
  return partnerPairError(commanders[0], commanders[1])
}
