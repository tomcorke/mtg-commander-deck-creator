import type { PersistedDeckState } from '../deck-state.ts'
import { cardNameKey, toDeckCard, type DeckCard, type ScryfallCard } from './card-model.ts'

export const cardDataKey = (card: DeckCard) =>
  card.oracleId ? `oracle:${card.oracleId}` : `name:${cardNameKey(card.name)}`

export function pendingDeckData(state: PersistedDeckState): PersistedDeckState {
  const pending = <T extends DeckCard>(card: T): T => ({
    ...card,
    dataStatus: 'pending',
    manaValueKnown: card.manaValueKnown ?? false,
  })
  return {
    ...state,
    deck: state.deck.map(pending),
    sideboard: state.sideboard.map(pending),
    queue: state.queue.map(pending),
    deferredCards: state.deferredCards.map((entry) => ({ ...entry, card: pending(entry.card) })),
  }
}

export function currentCardData<T extends DeckCard>(card: T, fetched: ScryfallCard): T {
  const fresh = toDeckCard(fetched)
  const show = (value: unknown) =>
    value === undefined
      ? 'unknown'
      : typeof value === 'boolean'
        ? value
          ? 'yes'
          : 'no'
        : Array.isArray(value)
          ? value.join('') || 'colourless'
          : String(value).replace('_', ' ')
  // Saves from before a field was stored have no old value; filling it in is not a change.
  const changes = (
    [
      ['Commander legality', card.commanderLegality, fresh.commanderLegality],
      ['Colour identity', card.colorIdentity?.toSorted(), fresh.colorIdentity?.toSorted()],
      [
        'Mana value',
        card.manaValueKnown ? card.manaValue : undefined,
        fresh.manaValueKnown ? fresh.manaValue : undefined,
      ],
      ['Game Changer', card.gameChanger, fresh.gameChanger],
    ] as const
  ).flatMap(([label, before, after]) =>
    before === undefined || JSON.stringify(before) === JSON.stringify(after)
      ? []
      : [`${label}: ${show(before)} → ${show(after)}.`],
  )
  // Gameplay data is current; printing, finish, evidence and player selections stay local.
  return {
    ...card,
    ...(card.localIndexSnapshot !== undefined && { localIndexSnapshot: false }),
    oracleId: fresh.oracleId,
    commanderLegality: fresh.commanderLegality,
    colorIdentity: fresh.colorIdentity,
    manaValue: fresh.manaValueKnown ? fresh.manaValue : card.manaValue,
    manaValueKnown: fresh.manaValueKnown,
    gameChanger: fresh.gameChanger,
    layout: fresh.layout,
    typeLine: fresh.typeLine,
    manaCost: fresh.manaCost,
    detail: fresh.detail,
    faces: fresh.faces,
    power: fresh.power,
    toughness: fresh.toughness,
    producedMana: fresh.producedMana,
    tags: fresh.tags,
    dataStatus: undefined,
    // Changes since the last save only; the refreshed values are saved, so old warnings clear.
    dataWarnings: changes,
  }
}

export function applyCurrentCardData<T extends DeckCard>(
  card: T,
  results: ReadonlyMap<string, ScryfallCard>,
): T {
  const fresh = results.get(cardDataKey(card))
  return fresh ? currentCardData(card, fresh) : { ...card, dataStatus: 'unavailable' }
}
