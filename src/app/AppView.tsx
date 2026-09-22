import { duplicateDeckName } from '../deck-state.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { BuilderView } from '../features/builder/BuilderView.tsx'
import { DeckCardModal } from '../features/modals/DeckCardModal.tsx'
import { ImportDeckModal } from '../features/modals/ImportDeckModal.tsx'
import { RecommendationSettingsModal } from '../features/modals/RecommendationSettingsModal.tsx'
import { SavedDecksModal } from '../features/modals/SavedDecksModal.tsx'
import { StartView } from '../features/start/StartView.tsx'

export type AppViewProps = {
  state: Record<string, any>
  actions: Record<string, any>
  builderData: Record<string, any>
}

function ImportModalView({ state, actions }: AppViewProps) {
  return (
    <ImportDeckModal
      show={state.showImport}
      importState={state.importState}
      importSource={state.importSource}
      importError={state.importError}
      setImportSource={state.setImportSource}
      setImportState={state.setImportState}
      setImportError={state.setImportError}
      importDeck={() => void actions.importDeck()}
      closeModal={() => actions.closeModal()}
    />
  )
}

function SavedDecksModalView({ state, actions }: AppViewProps) {
  return (
    <SavedDecksModal
      show={state.showSavedDecks}
      commander={state.commander}
      deckName={state.deckName}
      setDeckName={state.setDeckName}
      storeDeck={actions.storeDeck}
      deckNameDuplicate={duplicateDeckName(
        state.savedDecks,
        state.deckName,
        state.activeSavedDeckId,
      )}
      activeSavedDeck={state.activeSavedDeck}
      activeDeckDelta={state.activeDeckDelta}
      savedDecks={state.savedDecks}
      pendingSavedDeckRemoval={state.pendingSavedDeckRemoval}
      setPendingSavedDeckRemoval={state.setPendingSavedDeckRemoval}
      loadSavedDeck={actions.loadSavedDeck}
      removeSavedDeck={actions.removeSavedDeck}
      closeModal={() => actions.closeModal()}
    />
  )
}

function DeckCardModalView({ state, actions }: AppViewProps) {
  return (
    <DeckCardModal
      show={state.showDeckCard}
      selectedDeckCard={state.selectedDeckCard}
      selectedCollectionCard={state.selectedCollectionCard}
      selectedGuidanceCard={Boolean(state.selectedGuidanceCard)}
      deckComplete={state.deck.length >= 100}
      selectedDeckCardIsCommander={state.selectedDeckCardIsCommander}
      loadingArt={state.loadingArt}
      cardEffects={state.cardEffects}
      cycleSelectedDeckCardPrinting={() => void actions.cycleSelectedDeckCardPrinting()}
      pendingCardRemoval={state.pendingCardRemoval}
      selectedDeckCardLocation={state.selectedDeckCardLocation}
      removeSelectedDeckCard={actions.removeSelectedDeckCard}
      addSelectedGuidanceCard={actions.addSelectedGuidanceCard}
      closeDeckCard={actions.closeDeckCard}
      toggleCollectionSet={actions.toggleCollectionSet}
      collectionMode={state.collectionMode}
      collectionSets={state.collectionSets}
    />
  )
}

function RecommendationSettingsView({ state, actions, builderData }: AppViewProps) {
  return (
    <RecommendationSettingsModal
      show={state.showRecommendationSettings}
      recommendationStyle={state.recommendationStyle}
      chooseRecommendationStyle={actions.chooseRecommendationStyle}
      powerTarget={state.powerTarget}
      choosePowerTarget={actions.choosePowerTarget}
      prioritizeDeckHealth={state.prioritizeDeckHealth}
      setPrioritizeDeckHealth={state.setPrioritizeDeckHealth}
      includeCreature={state.includeCreature}
      setIncludeCreature={state.setIncludeCreature}
      collectionSearch={state.collectionSearch}
      setCollectionSearch={state.setCollectionSearch}
      collectionSets={state.collectionSets}
      toggleCollectionSet={actions.toggleCollectionSet}
      collectionSetLabel={builderData.collectionSetLabel}
      filteredSetOptions={builderData.filteredSetOptions}
      collectionMode={state.collectionMode}
      chooseCollectionMode={actions.chooseCollectionMode}
      collectionBrowserState={state.collectionBrowserState}
      browseCollection={() => void actions.browseCollection()}
      collectionState={state.collectionState}
      collectionError={state.collectionError}
      collectionPoolSize={state.collectionPoolSize}
      excludeGameChangers={state.excludeGameChangers}
      setExcludeGameChangers={state.setExcludeGameChangers}
      excludeTutors={state.excludeTutors}
      setExcludeTutors={state.setExcludeTutors}
      excludeExtraTurns={state.excludeExtraTurns}
      setExcludeExtraTurns={state.setExcludeExtraTurns}
      excludeUnreleased={state.excludeUnreleased}
      setExcludeUnreleased={state.setExcludeUnreleased}
      recommendationOptionsChanged={state.recommendationOptionsChanged}
      setRecommendationOptionsChanged={state.setRecommendationOptionsChanged}
      recommendationSettingsSummary={builderData.recommendationSettingsSummary}
      closeModal={() => actions.closeModal()}
    />
  )
}

function renderModals(props: AppViewProps) {
  return {
    importModal: <ImportModalView {...props} />,
    savedDecksModal: <SavedDecksModalView {...props} />,
    deckCardModal: <DeckCardModalView {...props} />,
    recommendationSettingsModal: <RecommendationSettingsView {...props} />,
  }
}

function StartScreen({
  state,
  actions,
  modals,
}: {
  state: Record<string, any>
  actions: Record<string, any>
  modals: Record<string, any>
}) {
  return (
    <StartView
      {...({ ...state, ...actions } as any)}
      darkMode={state.darkMode}
      commanderStyling={state.commanderStyling}
      cardEffects={state.cardEffects}
      setDarkMode={state.setDarkMode}
      setCommanderStyling={state.setCommanderStyling}
      setCardEffects={state.setCardEffects}
      savedDecks={state.savedDecks.length}
      savedDecksModal={modals.savedDecksModal}
      importModal={modals.importModal}
      commanderNames={commanderNames}
    />
  )
}

export function AppView({ state, actions, builderData }: AppViewProps) {
  const modals = renderModals({ state, actions, builderData })
  if (!state.showBuilder) return <StartScreen state={state} actions={actions} modals={modals} />
  return <BuilderView model={{ ...state, ...actions, ...builderData, ...modals } as any} />
}
