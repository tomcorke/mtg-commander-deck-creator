import type {
  Card,
  DeckCard,
  DeckCardLocation,
  ExportFormat,
  ScryfallCard,
} from '../domain/card-model.ts'
import type { AddZone } from '../deck-analysis.ts'
import type { SavedDeck } from '../deck-state.ts'
import * as deckActions from './deck-actions.ts'
import * as shareActions from './share-actions.ts'
import type { AppActionContext } from './recommendation-actions.ts'

export function createActionHandlers(deps: AppActionContext) {
  const withBuildIdentity = () => ({
    ...deps,
    buildIdentity: { id: crypto.randomUUID(), today: new Date().toISOString().slice(0, 10) },
  })
  return {
    retryCurrentCardData: () => deckActions.retryCurrentCardData(deps),
    addRecommendationCard: (card: Card) => deckActions.addRecommendationCard(deps, card),
    addThemeAlternative: (card: Card, source: 'queue' | 'later') =>
      deckActions.addThemeAlternative(deps, card, source),
    applyDeckDoctorSwapPlan: (
      cuts: { cutIndex: number; cutCard: DeckCard }[],
      additions: Card[],
      moveCutToSideboard: boolean,
    ) =>
      deckActions.applyDeckDoctorSwapPlan(
        deps,
        cuts,
        additions,
        moveCutToSideboard,
        crypto.randomUUID(),
      ),
    undoDeckDoctorSwap: (id: string) => deckActions.undoDeckDoctorSwap(deps, id),
    addCollectionCard: (card: ScryfallCard) => deckActions.addCollectionCard(deps, card),
    addAllInBatch: () => deckActions.addAllInBatch(deps),
    buildStartingDeck: () => deckActions.buildStartingDeck(deps),
    undoBulkAdd: () => deckActions.undoBulkAdd(deps),
    undoDecision: () => deckActions.undoDecision(deps),
    setAside: (name: string, to: 'add' | 'later' | 'return') =>
      deckActions.setAside(deps, name, to),
    decide: (card: Card, action: 'add' | 'later' | 'ignore') =>
      deckActions.decide(deps, card, action),
    promoteToCommander: (
      card: Card | DeckCard,
      keepOutgoing?: boolean,
      partner?: Card | DeckCard,
    ) => void deckActions.promoteToCommander(deps, card, keepOutgoing, partner),
    cycleCommanderPrinting: (index: number) => deckActions.cycleCommanderPrinting(deps, index),
    cyclePrinting: (card: Card) => deckActions.cyclePrinting(deps, card),
    cycleDeckPrinting: (index: number) => deckActions.cycleDeckPrinting(deps, index),
    cycleSelectedDeckCardPrinting: () => deckActions.cycleSelectedDeckCardPrinting(deps),
    deckList: (format: ExportFormat) => deckActions.deckList(deps, format),
    copyDeck: () => deckActions.copyDeck(deps),
    downloadDeckList: () => shareActions.downloadDeckList(deps),
    copyShareLink: () => shareActions.copyShareLink(deps),
    openSharedDeck: (payload: string) => shareActions.openSharedDeck(deps, payload),
    closeSharedDeck: () => shareActions.closeSharedDeck(deps),
    copySharedDeck: () => shareActions.copySharedDeck(withBuildIdentity()),
    openSharedCard: (card: DeckCard) => shareActions.openSharedCard(deps, card),
    openCollectionCard: (card: ScryfallCard) => deckActions.openCollectionCard(deps, card),
    openCardReference: (card: Card | DeckCard) => deckActions.openCardReference(deps, card),
    openGuidanceCard: (card: Card) => deckActions.openGuidanceCard(deps, card),
    addSelectedGuidanceCard: () => deckActions.addSelectedGuidanceCard(deps),
    addBasicLands: (plan: { name: string; count: number; printing?: ScryfallCard }[]) =>
      deckActions.addBasicLands(deps, plan),
    selectManualCard: (card: ScryfallCard) => deckActions.selectManualCard(deps, card),
    cycleManualPrinting: () => deckActions.cycleManualPrinting(deps),
    addManualCard: () => deckActions.addManualCard(deps),
    addSearchCards: (cards: ScryfallCard[]) => deckActions.addSearchCards(deps, cards),
    addOneBasic: (name: string) => deckActions.addOneBasic(deps, name),
    openDeckCard: (card: DeckCard, location: DeckCardLocation) =>
      deckActions.openDeckCard(deps, card, location),
    openCommanderCard: (index: number) => deckActions.openCommanderCard(deps, index),
    closeDeckCard: () => deckActions.closeDeckCard(deps),
    removeSelectedDeckCard: () => deckActions.removeSelectedDeckCard(deps),
    removeDeckCard: (index: number) => deckActions.removeDeckCard(deps, index),
    removeSideboardCard: (index: number) => deckActions.removeSideboardCard(deps, index),
    moveSideboardCard: (index: number) => deckActions.moveSideboardCard(deps, index),
    moveSelectedDeckCard: () => deckActions.moveSelectedDeckCard(deps),
    chooseAddZone: (zone: AddZone) => deckActions.chooseAddZone(deps, zone),
    storeDeck: (overwrite = false) => deckActions.storeDeck(deps, overwrite),
    loadSavedDeck: (saved: SavedDeck) => deckActions.loadSavedDeck(withBuildIdentity(), saved),
    removeSavedDeck: (saved: SavedDeck) => deckActions.removeSavedDeck(deps, saved),
    importDeck: (openReviewAfterImport: boolean, skipMissing = false, commanders: string[] = []) =>
      deckActions.importDeck(withBuildIdentity(), openReviewAfterImport, skipMissing, commanders),
    startOver: () => deckActions.startOver(withBuildIdentity()),
    openSavedDecks: () => deckActions.openSavedDecks(deps),
  }
}
