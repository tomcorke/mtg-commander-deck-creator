import { appStorage } from '../app-storage.ts'
import { cardNameKey, toDeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { ownedCardsStorageKey, type OwnedCard, type OwnedCardList } from '../domain/owned-cards.ts'
import { builderAction, type AppActionContext } from './builder-action.ts'
import { openCardReference } from './deck-actions.ts'

const allColours = ['W', 'U', 'B', 'R', 'G']

/** Store the owned list in this browser only, or remove it, and re-rank recommendations. */
export function saveOwnedCards(deps: AppActionContext, cards: OwnedCard[] | null) {
  const list: OwnedCardList | null = cards?.length
    ? { cards, updatedAt: new Date().toISOString() }
    : null
  const storage = appStorage()
  if (list) storage.setItem(ownedCardsStorageKey, JSON.stringify(list))
  else storage.removeItem(ownedCardsStorageKey)
  deps.setOwnedCardList(list)
  builderAction(deps, { type: 'ownedCards', list })
}

/** Local-index cards for these owned cards, keyed by `cardNameKey`; null without the index. */
async function indexedOwnedCards(deps: AppActionContext, cards: OwnedCard[]) {
  if (!deps.fetchLocalCards || !cards.length) return null
  try {
    const found: ScryfallCard[] = await deps.fetchLocalCards({
      colours: allColours,
      names: cards.map(({ name }) => cardNameKey(name)),
    })
    if (deps.localCardIndexStatus?.().state === 'unavailable') return null
    return new Map(found.map((card) => [cardNameKey(card.name), card]))
  } catch {
    return null
  }
}

/** Names the local card index does not know as Commander-legal cards; null without the index. */
export async function unrecognisedOwnedNames(deps: AppActionContext, cards: OwnedCard[]) {
  const known = await indexedOwnedCards(deps, cards)
  return known && cards.filter(({ name }) => !known.has(cardNameKey(name))).map(({ name }) => name)
}

/** Owned cards the local index knows, as cards with art for previews; null without the index. */
export async function resolveOwnedCards(deps: AppActionContext, cards: OwnedCard[]) {
  const known = await indexedOwnedCards(deps, cards)
  return known && new Map([...known].map(([key, card]) => [key, toDeckCard(card)]))
}

/** Read-only card details by name, such as an owned card or a missing combo piece: the local
 * index when it knows the card, else Scryfall. */
export async function openOwnedCard(deps: AppActionContext, name: string) {
  try {
    const local: ScryfallCard[] =
      (await deps.fetchLocalCards?.({ colours: allColours, names: [cardNameKey(name)] })) ?? []
    const card: ScryfallCard = local[0] ?? (await deps.fetchCard(name))
    openCardReference(deps, toDeckCard(card))
    return true
  } catch {
    return false
  }
}
