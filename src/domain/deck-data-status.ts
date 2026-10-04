import type { Card, DeckCard } from './card-model.ts'
import { cardConstructionError, commanderConstructionError } from './commander-construction.ts'
import { commanderNames } from './commander-catalog.ts'
import { cardDataKey } from './current-card-data.ts'

export function recommendationDataError(
  card: DeckCard,
  deck: DeckCard[],
  colours: string[],
  excludeGameChangers: boolean,
) {
  const construction = cardConstructionError(card, deck, colours)
  if (construction) return construction
  if (excludeGameChangers && card.gameChanger !== false)
    return card.gameChanger
      ? 'Game Changers are excluded by your recommendation settings.'
      : 'Game Changer status is unknown. Reload to retry.'
  return ''
}

export function deckDataStatus(
  deck: DeckCard[],
  commander: string,
  queue: Card[],
  sideboard: DeckCard[],
  deferred: { card: Card }[],
) {
  const commanders = deck.slice(0, commanderNames(commander).length)
  const identity = [...new Set(commanders.flatMap((card) => card.colorIdentity ?? []))]
  const commanderError = commanderConstructionError(commanders)
  const errors = deck.flatMap((card, index) => {
    const error = cardConstructionError(card, deck.slice(0, index), identity)
    return error ? [{ card, message: error }] : []
  })
  if (commanderError && deck[0]) errors.unshift({ card: deck[0], message: commanderError })
  const cards = [...deck, ...sideboard, ...queue, ...deferred.map(({ card }) => card)]
  const unique = [...new Map(cards.map((card) => [cardDataKey(card), card])).values()]
  const warnings = unique.flatMap((card) => {
    const error = cardConstructionError(card, [], identity)
    const policy = card.gameChanger === undefined ? 'Game Changer status is unknown.' : ''
    const messages = [...new Set([error, policy, ...(card.dataWarnings ?? [])].filter(Boolean))]
    return messages.length ? [{ card, message: messages.join(' ') }] : []
  })
  const notices = [...errors, ...warnings].filter(
    (notice, index, all) =>
      all.findIndex(
        (other) => other.card.name === notice.card.name && other.message === notice.message,
      ) === index,
  )
  return {
    deckComplete:
      deck.length === 100 &&
      !commanderError &&
      !errors.length &&
      deck.every((card) => card.gameChanger !== undefined),
    cardDataNotices: notices,
    cardDataPending: cards.some((card) => card.dataStatus === 'pending'),
  }
}
