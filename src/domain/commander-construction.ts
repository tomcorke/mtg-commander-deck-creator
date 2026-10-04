import type { DeckCard } from './card-model.ts'
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
  if (card.dataStatus === 'unavailable') return 'Current card data is unavailable. Reload to retry.'
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

function partnerPairError(left: DeckCard, right: DeckCard) {
  if ((left.oracleId && left.oracleId === right.oracleId) || left.name === right.name)
    return 'Choose two different commanders.'
  const text = (card: DeckCard) => card.faces[0]?.detail ?? card.detail
  const type = (card: DeckCard) => card.faces[0]?.typeLine ?? card.typeLine
  const background = (card: DeckCard) => /Legendary.*Enchantment.*\bBackground\b/.test(type(card))
  if (
    (isCommanderCandidate(left) && /Choose a Background/i.test(text(left)) && background(right)) ||
    (isCommanderCandidate(right) && /Choose a Background/i.test(text(right)) && background(left))
  )
    return ''
  const doctor = (card: DeckCard) =>
    /Legendary.*Creature\s*—\s*Time Lord Doctor\s*$/.test(type(card))
  if (
    (doctor(left) && isCommanderCandidate(right) && /Doctor's companion/i.test(text(right))) ||
    (doctor(right) && isCommanderCandidate(left) && /Doctor's companion/i.test(text(left)))
  )
    return ''
  if (!isCommanderCandidate(left) || !isCommanderCandidate(right))
    return 'This pair contains an ineligible commander.'
  const partner = (card: DeckCard) => /^Partner(?:\s*\(|\s*$)/im.test(text(card))
  if (partner(left) && partner(right)) return ''
  const namedPartner = (card: DeckCard, other: DeckCard) =>
    text(card)
      .split('\n')
      .some((line) => line.split(' (')[0].trim() === `Partner with ${other.name}`)
  if (namedPartner(left, right) && namedPartner(right, left)) return ''
  const variant = (card: DeckCard) =>
    text(card)
      .match(/^Partner\s*[—-]\s*([^\n(]+)/im)?.[1]
      .trim()
      .toLowerCase() ??
    (/^Friends forever(?:\s*\(|\s*$)/im.test(text(card)) ? 'friends forever' : undefined)
  const shared = variant(left)
  if (
    shared &&
    ['character select', 'father & son', 'friends forever', 'survivors'].includes(shared) &&
    shared === variant(right)
  )
    return ''
  return 'These commanders do not share a supported partner ability.'
}
