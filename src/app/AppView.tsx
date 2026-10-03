import { useEffect, type ReactNode } from 'react'

import { duplicateDeckName } from '../deck-state.ts'
import { commanderPromotionInfo } from '../domain/commander-promotion.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { toDeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { cardSearchError } from '../domain/card-search.ts'
import { defaultFinish } from '../domain/printing.ts'
import { CardSearchView } from '../features/builder/CardSearchView.tsx'
import { BuilderTopBar } from '../features/builder/BuilderTopBar.tsx'
import { BuilderView } from '../features/builder/BuilderView.tsx'
import { ExportDeckModal } from '../features/builder/ExportDeckModal.tsx'
import { DeckDoctorView } from '../features/builder/DeckDoctorView.tsx'
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
      key={state.showImport ? 'import-open' : 'import-closed'}
      show={state.showImport}
      importState={state.importState}
      importSource={state.importSource}
      importError={state.importError}
      setImportSource={state.setImportSource}
      setImportState={state.setImportState}
      setImportError={state.setImportError}
      importDeck={(openReviewAfterImport) => actions.importDeck(openReviewAfterImport)}
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
  const manualCard = state.selectedManualCard as ScryfallCard | null
  const selectedDeckCard = manualCard
    ? {
        ...toDeckCard(manualCard),
        finish: defaultFinish(manualCard.finishes),
        printing: state.manualPrinting,
        printings: state.manualPrintings.map((card: ScryfallCard) => ({
          ...toDeckCard(card),
          finish: defaultFinish(card.finishes),
        })),
      }
    : state.selectedDeckCard
  const manualError = manualCard
    ? cardSearchError(
        manualCard,
        state.deck.length < 100 ? state.deck : state.sideboard,
        state.commanderDetails?.colours ?? [],
      )
    : ''
  return (
    <DeckCardModal
      show={state.showDeckCard}
      selectedDeckCard={selectedDeckCard}
      selectedCollectionCard={state.selectedCollectionCard}
      selectedGuidanceCard={Boolean(state.selectedGuidanceCard)}
      selectedCardReference={Boolean(state.selectedCardReference || manualCard)}
      deckComplete={state.deck.length >= 100}
      selectedDeckCardIsCommander={state.selectedDeckCardIsCommander}
      commanderPromotion={
        !manualCard && state.selectedDeckCard && !state.selectedDeckCardIsCommander
          ? commanderPromotionInfo(
              state.selectedDeckCard,
              state.deck,
              state.commanderDetails?.colours ?? [],
            )
          : null
      }
      promoteToCommander={() => {
        if (state.selectedDeckCard) void actions.promoteToCommander(state.selectedDeckCard)
      }}
      loadingArt={state.loadingArt}
      cycleSelectedDeckCardPrinting={() =>
        void (manualCard ? actions.cycleManualPrinting() : actions.cycleSelectedDeckCardPrinting())
      }
      addAction={
        manualCard
          ? {
              label: state.deck.length >= 100 ? 'Add to sideboard' : 'Add to deck',
              disabled: Boolean(manualError) || Boolean(state.loadingArt),
              error: manualError,
              onAdd: () => actions.addManualCard(),
            }
          : undefined
      }
      notice={manualCard ? state.manualPrintingError : ''}
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
      setOptions={state.setOptions}
      setRows={builderData.setRows}
      showSupplementalSets={state.showSupplementalSets}
      setShowSupplementalSets={state.setShowSupplementalSets}
      collectionMode={state.collectionMode}
      chooseCollectionMode={actions.chooseCollectionMode}
      collectionBrowserState={state.collectionBrowserState}
      browseCollection={() => void actions.browseCollection()}
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
    exportModal: (
      <ExportDeckModal
        show={props.state.showExport}
        commander={props.state.commander}
        deckCount={props.state.deck.length}
        exportFormat={props.state.exportFormat}
        setExportFormat={props.state.setExportFormat}
        copied={props.state.copied}
        deckList={props.actions.deckList}
        copyDeck={props.actions.copyDeck}
        closeModal={() => props.actions.closeModal()}
      />
    ),
    importModal: <ImportModalView {...props} />,
    savedDecksModal: <SavedDecksModalView {...props} />,
    deckCardModal: <DeckCardModalView {...props} />,
    recommendationSettingsModal: <RecommendationSettingsView {...props} />,
  }
}

function CardSearchScreen({
  state,
  actions,
  builderData,
  appHeader,
  modals,
}: AppViewProps & {
  appHeader: ReactNode
  modals: ReturnType<typeof renderModals>
}) {
  return (
    <>
      <CardSearchView
        key={state.commander}
        active={state.showCardSearch}
        appHeader={appHeader}
        commander={state.commander}
        commanderDetails={state.commanderDetails}
        loadingArt={state.loadingArt}
        deck={state.deck}
        sideboard={state.sideboard}
        excludeUnreleased={state.excludeUnreleased}
        cycleCommanderPrinting={actions.cycleCommanderPrinting}
        startOver={actions.startOver}
        openCard={(card) => {
          const existing = [...state.deck, ...state.sideboard].find(
            ({ name }) => name === card.name,
          )
          if (existing) actions.openCardReference(existing)
          else void actions.selectManualCard(card)
        }}
        openCommander={(index) => actions.openCardReference(state.deck[index])}
        addCards={actions.addSearchCards}
        closePage={() => {
          state.setBuilderModeReturn(null)
          actions.closeModal()
          requestAnimationFrame(() => state.cardSearchButton.current?.focus())
        }}
      />
      {modals.importModal}
      {modals.savedDecksModal}
      {modals.exportModal}
      {state.showDeckCard && (
        <DeckCardModalView state={state} actions={actions} builderData={builderData} />
      )}
    </>
  )
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
      savedDecks={state.savedDecks.length}
      savedDecksModal={modals.savedDecksModal}
      importModal={modals.importModal}
      commanderNames={commanderNames}
    />
  )
}

function useBuilderMode(state: Record<string, any>) {
  const {
    activeModal,
    builderModeReturn: storedModeReturn,
    setBuilderModeReturn,
    showDeckDoctor,
    showCardSearch,
    showDeckDoctorHistory,
    selectedManualCard,
    setSelectedManualCard,
    manualPrintingRequest,
  } = state
  const preservesMode = ['card', 'export', 'import', 'saved', 'recommendation-settings'].includes(
    activeModal,
  )
  const modeReturn = preservesMode ? storedModeReturn : null
  useEffect(() => {
    if (storedModeReturn && !showDeckDoctor && !showCardSearch && !modeReturn)
      setBuilderModeReturn(null)
  }, [modeReturn, setBuilderModeReturn, showCardSearch, showDeckDoctor, storedModeReturn])

  useEffect(() => {
    if (activeModal !== 'card' && selectedManualCard) {
      manualPrintingRequest.current?.abort()
      setSelectedManualCard(null)
    }
  }, [activeModal, manualPrintingRequest, selectedManualCard, setSelectedManualCard])

  const rememberMode = () => {
    if (showCardSearch) setBuilderModeReturn('search')
    else if (showDeckDoctor)
      setBuilderModeReturn(showDeckDoctorHistory ? 'doctor-history' : 'doctor')
  }
  return { modeReturn, rememberMode }
}

function DeckReviewScreen({
  state,
  actions,
  builderData,
  appHeader,
  modals,
  showHistory,
  rememberMode,
}: AppViewProps & {
  appHeader: ReactNode
  modals: ReturnType<typeof renderModals>
  showHistory: boolean
  rememberMode: () => void
}) {
  const closePage = () => {
    state.setBuilderModeReturn(null)
    actions.navigateView('builder', null, true)
  }
  return (
    <>
      <DeckDoctorView
        appHeader={appHeader}
        showHistory={showHistory}
        commander={state.commander}
        commanderDetails={state.commanderDetails}
        loadingArt={state.loadingArt}
        deck={state.deck}
        sideboard={state.sideboard}
        commanderCount={commanderNames(state.commander).length}
        commanderColours={state.commanderDetails?.colours ?? []}
        theme={state.theme}
        activeSubThemes={state.activeSubThemes}
        deckTargets={state.deckTargets}
        setDeckTargets={(update) => {
          state.setDeckTargets(update)
          state.setRecommendationOptionsChanged(true)
        }}
        analysis={builderData.analysis}
        displayedTypeCounts={builderData.displayedTypeCounts}
        selectManaValue={(value) => {
          state.setDeckReviewFilter(null)
          state.setHighlightedManaValue(value)
          closePage()
        }}
        selectCards={(label, cardNames) => {
          state.setHighlightedManaValue(null)
          state.setDeckReviewFilter({ label, cardNames })
          closePage()
        }}
        recommendationSettingsSummary={builderData.recommendationSettingsSummary}
        recommendationQueryKey={builderData.recommendationQueryKey}
        recommendationOptionsChanged={state.recommendationOptionsChanged}
        openRecommendationSettings={() => {
          rememberMode()
          actions.openModal('recommendation-settings')
        }}
        candidates={state.queue}
        scoreReplacements={builderData.scoreReplacements}
        history={state.deckDoctorHistory}
        error={state.deckDoctorError}
        fetchCandidates={() => actions.fetchDeckDoctorCandidates()}
        fetchCommanderAlternatives={() => actions.fetchDeckDoctorCommanders()}
        openCard={actions.openCardReference}
        cycleCommanderPrinting={actions.cycleCommanderPrinting}
        startOver={actions.startOver}
        applySwapPlan={actions.applyDeckDoctorSwapPlan}
        undoSwap={actions.undoDeckDoctorSwap}
        closePage={closePage}
      />
      {modals.importModal}
      {modals.savedDecksModal}
      {modals.exportModal}
      {modals.recommendationSettingsModal}
      {state.showDeckCard && (
        <DeckCardModalView state={state} actions={actions} builderData={builderData} />
      )}
    </>
  )
}

export function AppView({ state, actions, builderData }: AppViewProps) {
  const { modeReturn, rememberMode } = useBuilderMode(state)
  const modals = renderModals({ state, actions, builderData })
  if (!state.showBuilder) return <StartScreen state={state} actions={actions} modals={modals} />
  const appHeader = (
    <BuilderTopBar
      activeDeckDelta={state.activeDeckDelta}
      activeSavedDeck={state.activeSavedDeck}
      deckCount={state.deck.length}
      startOver={actions.startOver}
      onImport={() => {
        rememberMode()
        actions.openModal('import')
      }}
      onSaveLoad={() => {
        rememberMode()
        actions.openSavedDecks()
      }}
      onExport={() => {
        rememberMode()
        actions.openModal('export')
      }}
    />
  )
  if (state.showCardSearch || modeReturn === 'search')
    return (
      <CardSearchScreen
        state={state}
        actions={actions}
        builderData={builderData}
        appHeader={appHeader}
        modals={modals}
      />
    )
  if (
    state.showDeckDoctor ||
    modeReturn === 'review' ||
    modeReturn === 'doctor' ||
    modeReturn === 'doctor-history'
  )
    return (
      <DeckReviewScreen
        state={state}
        actions={actions}
        builderData={builderData}
        appHeader={appHeader}
        modals={modals}
        showHistory={state.showDeckDoctorHistory || modeReturn === 'doctor-history'}
        rememberMode={rememberMode}
      />
    )
  return (
    <BuilderView model={{ ...state, ...actions, ...builderData, ...modals, appHeader } as any} />
  )
}
