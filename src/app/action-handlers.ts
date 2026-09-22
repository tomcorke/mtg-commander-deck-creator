import type { KeyboardEvent, MouseEvent } from 'react'

import type {
  Card,
  DeckCard,
  DeckCardLocation,
  ExportFormat,
  ScryfallCard,
} from '../domain/card-model.ts'
import type { SavedDeck } from '../deck-state.ts'
import * as deckActions from './deck-actions.ts'
import type { ActionDeps } from './recommendation-actions.ts'

export function createActionHandlers(deps: ActionDeps) {
  return {
    addRecommendationCard: (card: Card) => deckActions.addRecommendationCard(deps, card),
    addCollectionCard: (card: ScryfallCard) => deckActions.addCollectionCard(deps, card),
    decide: (card: Card, action: 'add' | 'later' | 'ignore') =>
      deckActions.decide(deps, card, action),
    cycleCommanderPrinting: (index: number) => deckActions.cycleCommanderPrinting(deps, index),
    cyclePrinting: (card: Card) => deckActions.cyclePrinting(deps, card),
    cycleDeckPrinting: (index: number) => deckActions.cycleDeckPrinting(deps, index),
    cycleSelectedDeckCardPrinting: () => deckActions.cycleSelectedDeckCardPrinting(deps),
    deckList: (format: ExportFormat) => deckActions.deckList(deps, format),
    copyDeck: () => deckActions.copyDeck(deps),
    openCollectionCard: (card: ScryfallCard) => deckActions.openCollectionCard(deps, card),
    openGuidanceCard: (card: Card) => deckActions.openGuidanceCard(deps, card),
    addSelectedGuidanceCard: () => deckActions.addSelectedGuidanceCard(deps),
    addBasicLands: (plan: { name: string; count: number }[]) =>
      deckActions.addBasicLands(deps, plan),
    closeCardSearch: () => deckActions.closeCardSearch(deps),
    selectManualCard: (card: ScryfallCard) => deckActions.selectManualCard(deps, card),
    cycleManualPrinting: () => deckActions.cycleManualPrinting(deps),
    addManualCard: () => deckActions.addManualCard(deps),
    handleCardSearchKeys: (event: KeyboardEvent<HTMLElement>) =>
      deckActions.handleCardSearchKeys(deps, event),
    addOneBasic: (name: string) => deckActions.addOneBasic(deps, name),
    positionDeckPreview: (
      rowOrEvent: HTMLLIElement | MouseEvent<HTMLLIElement>,
      pointerX?: number,
    ) => deckActions.positionDeckPreview(deps, rowOrEvent, pointerX),
    openDeckCard: (card: DeckCard, location: DeckCardLocation) =>
      deckActions.openDeckCard(deps, card, location),
    openCommanderCard: (index: number) => deckActions.openCommanderCard(deps, index),
    closeDeckCard: () => deckActions.closeDeckCard(deps),
    removeSelectedDeckCard: () => deckActions.removeSelectedDeckCard(deps),
    removeDeckCard: (index: number) => deckActions.removeDeckCard(deps, index),
    removeSideboardCard: (index: number) => deckActions.removeSideboardCard(deps, index),
    moveSideboardCard: (index: number) => deckActions.moveSideboardCard(deps, index),
    storeDeck: () => deckActions.storeDeck(deps),
    loadSavedDeck: (saved: SavedDeck) => deckActions.loadSavedDeck(deps, saved),
    removeSavedDeck: (saved: SavedDeck) => deckActions.removeSavedDeck(deps, saved),
    importDeck: () => deckActions.importDeck(deps),
    startOver: () => deckActions.startOver(deps),
    openSavedDecks: () => deckActions.openSavedDecks(deps),
  }
}
