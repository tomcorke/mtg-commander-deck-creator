import type { DeckCard } from './card-model.ts'
import { commanderNames } from './commander-catalog.ts'
import { isCommanderCandidate } from './commander-promotion.ts'

/**
 * Rule: the partner abilities of CR 702.124 (checked 2026-10-03 against the rules effective
 * 2026-09-25; see the knowledge base's commander rules topic). Abilities are distinct and never
 * mix (702.124f). `background` and `doctor` are the halves that another card's ability names.
 */
export type PairingAbility =
  | { kind: 'partner' }
  | { kind: 'partner-with'; name: string }
  | { kind: 'partner-variant'; variant: string }
  | { kind: 'choose-background' }
  | { kind: 'background' }
  | { kind: 'doctors-companion' }
  | { kind: 'doctor' }

/**
 * Rule: the "Partner—[text]" variants in 702.124i. An unrecognised variant gives no ability, so
 * the card stays a single commander until the rules reference lists it.
 */
const partnerVariants = ['character select', 'father & son', 'friends forever', 'survivors']

const text = (card: DeckCard) => card.faces[0]?.detail ?? card.detail
const type = (card: DeckCard) => card.faces[0]?.typeLine ?? card.typeLine
const lines = (card: DeckCard) => text(card).split('\n')

/** The partner ability one rules-text line grants a commander, without its reminder text. */
function lineAbility(line: string): PairingAbility | undefined {
  if (/^Partner$/i.test(line)) return { kind: 'partner' }
  const named = line.match(/^Partner with (.+)$/)?.[1]
  if (named) return { kind: 'partner-with', name: named.trim() }
  const variant = (
    line.match(/^Partner\s*[—-]\s*(.+)$/i)?.[1] ??
    (/^Friends forever$/i.test(line) ? 'friends forever' : '')
  )
    .trim()
    .toLowerCase()
  if (partnerVariants.includes(variant)) return { kind: 'partner-variant', variant }
  if (/^Choose a Background$/i.test(line)) return { kind: 'choose-background' }
  if (/^Doctor['’]s companion$/i.test(line)) return { kind: 'doctors-companion' }
}

/** The partner abilities a card has, from its front face's rules text and type line. */
export function pairingAbilities(card: DeckCard): PairingAbility[] {
  const abilities: PairingAbility[] = []
  const commander = isCommanderCandidate(card)
  if (/Legendary.*Enchantment.*\bBackground\b/.test(type(card)))
    abilities.push({ kind: 'background' })
  if (/Legendary.*Creature\s*—\s*Time Lord Doctor\s*$/.test(type(card)))
    abilities.push({ kind: 'doctor' })
  if (!commander) return abilities
  for (const line of lines(card)) {
    const ability = lineAbility(line.split(' (')[0].trim())
    if (ability) abilities.push(ability)
  }
  return abilities
}

/** Whether one ability of `left` and one of `right` together allow the pair (702.124h–m). */
function abilitiesPair(left: DeckCard, right: DeckCard) {
  const leftAbilities = pairingAbilities(left)
  const rightAbilities = pairingAbilities(right)
  return leftAbilities.some((mine) =>
    rightAbilities.some((theirs) => {
      switch (mine.kind) {
        case 'partner':
          return theirs.kind === 'partner'
        case 'partner-with':
          return (
            mine.name === right.name && theirs.kind === 'partner-with' && theirs.name === left.name
          )
        case 'partner-variant':
          return theirs.kind === 'partner-variant' && theirs.variant === mine.variant
        case 'choose-background':
          return theirs.kind === 'background'
        case 'background':
          return theirs.kind === 'choose-background'
        case 'doctors-companion':
          return theirs.kind === 'doctor'
        case 'doctor':
          return theirs.kind === 'doctors-companion'
      }
    }),
  )
}

/** Why two cards cannot be a partner pair, or '' when one shared partner ability allows them. */
export function partnerPairError(left: DeckCard, right: DeckCard) {
  if ((left.oracleId && left.oracleId === right.oracleId) || left.name === right.name)
    return 'Choose two different commanders.'
  if (abilitiesPair(left, right)) return ''
  const eligible = (card: DeckCard) =>
    isCommanderCandidate(card) || pairingAbilities(card).some(({ kind }) => kind === 'background')
  if (!eligible(left) || !eligible(right)) return 'This pair contains an ineligible commander.'
  return 'These commanders do not share a supported partner ability.'
}

/**
 * Scryfall terms that find every possible second commander for `card`, or '' when it has no
 * partner ability. Results still need `partnerPairError`, since keyword and text matches are wider.
 */
export function partnerSearchScope(card: DeckCard) {
  const terms = pairingAbilities(card).map((ability) => {
    switch (ability.kind) {
      case 'partner':
      case 'partner-variant':
        // Provider data: Scryfall gives every partner variant, including "Partner with", the Partner keyword.
        return 'keyword:partner'
      case 'partner-with':
        return `!${JSON.stringify(ability.name)}`
      case 'choose-background':
        return 't:background'
      case 'background':
        return 'o:"choose a background"'
      case 'doctors-companion':
        return '(t:"time lord" t:doctor)'
      case 'doctor':
        return `o:"doctor's companion"`
    }
  })
  return [...new Set(terms)].join(' or ')
}

/**
 * The stored commander name for a pair. Names containing " & " cannot be split back apart, so
 * such a pair returns '' instead of a name that would load the wrong cards.
 */
export function pairName(first: Pick<DeckCard, 'name'>, second: Pick<DeckCard, 'name'>) {
  const name = `${first.name} & ${second.name}`
  const names = commanderNames(name)
  return names.length === 2 && names[0] === first.name && names[1] === second.name ? name : ''
}

function abilityName(ability: PairingAbility) {
  switch (ability.kind) {
    case 'partner':
      return 'Partner'
    case 'partner-with':
      return 'Partner with'
    case 'partner-variant':
      return `Partner—${ability.variant[0].toUpperCase()}${ability.variant.slice(1)}`
    case 'choose-background':
      return 'Choose a Background'
    case 'background':
      return 'Background'
    case 'doctors-companion':
      return "Doctor's companion"
    case 'doctor':
      return 'the Doctor'
  }
}

/** The card's partner abilities as one phrase, such as "Partner" or "Choose a Background". */
export function pairingLabel(card: DeckCard) {
  return [...new Set(pairingAbilities(card).map(abilityName))].join(' or ')
}

/** Whether the card can lead and take a second commander through one of its partner abilities. */
export const canAddPartner = (card: DeckCard) =>
  isCommanderCandidate(card) && pairingAbilities(card).length > 0
