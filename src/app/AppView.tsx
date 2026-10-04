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
import { DeckReviewHistoryModal } from '../features/modals/DeckReviewHistoryModal.tsx'
import {
  readAppRoute,
  reviewBackModal,
  reviewRoutes,
  reviewStepForModal,
  reviewSteps,
  type DeckReviewStep,
} from './routes.ts'
import { DeckCardModal } from '../features/modals/DeckCardModal.tsx'
import { ImportDeckModal } from '../features/modals/ImportDeckModal.tsx'
import { RecommendationSettingsModal } from '../features/modals/RecommendationSettingsModal.tsx'
import { SavedDecksModal } from '../features/modals/SavedDecksModal.tsx'
import { WorkspaceNotice } from '../features/modals/WorkspaceNotice.tsx'
import { StartView } from '../features/start/StartView.tsx'
import { ModalCloseButton } from '../shared/CardDetails.tsx'

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
      showBuilder={state.showBuilder}
      workspace={state.workspace}
      autosave={state.autosave}
      loadAutosave={actions.loadAutosave}
      openCard={actions.openCardReference}
      loading={state.recommendationState === 'loading'}
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
      savedDeckChanged={state.savedDeckChanged}
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
      maxPrice={state.maxPrice}
      chooseMaxPrice={actions.chooseMaxPrice}
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
  workspaceNotice,
}: {
  state: Record<string, any>
  actions: Record<string, any>
  modals: Record<string, any>
  workspaceNotice: ReactNode
}) {
  return (
    <>
      <StartView
        {...({ ...state, ...actions } as any)}
        savedDecks={state.savedDecks.length}
        workspaceNotice={workspaceNotice}
        savedDecksModal={modals.savedDecksModal}
        importModal={modals.importModal}
        commanderNames={commanderNames}
      />
      {modals.deckCardModal}
    </>
  )
}

function useBuilderMode(state: Record<string, any>) {
  const {
    activeModal,
    builderModeReturn: storedModeReturn,
    setBuilderModeReturn,
    showDeckDoctor,
    showCardSearch,
    selectedManualCard,
    setSelectedManualCard,
    manualPrintingRequest,
  } = state
  const preservesMode = [
    'card',
    'export',
    'import',
    'saved',
    'recommendation-settings',
    'doctor-history',
  ].includes(activeModal)
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
    else if (showDeckDoctor) setBuilderModeReturn(activeModal)
  }
  return { modeReturn, rememberMode }
}

function ReviewExitConfirmation({ state, actions }: Pick<AppViewProps, 'state' | 'actions'>) {
  if (!state.showReviewExitPrompt) return null
  const { cancelReviewNavigation: cancel, confirmReviewNavigation: confirm } = actions
  const cancelAndRefocus = () => {
    cancel()
    requestAnimationFrame(() => document.getElementById('deck-review-title')?.focus())
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancelAndRefocus()
      }}
    >
      <section
        className="export-modal doctor-discard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doctor-discard-title"
        aria-describedby="doctor-discard-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            cancelAndRefocus()
          } else if (event.key === 'Tab') {
            const buttons =
              event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
            const first = buttons[0]
            const last = buttons[buttons.length - 1]
            if (!first || !last) event.preventDefault()
            else if (
              (event.shiftKey && document.activeElement === first) ||
              (!event.shiftKey && document.activeElement === last)
            ) {
              event.preventDefault()
              const target = event.shiftKey ? last : first
              target.focus()
            }
          }
        }}
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Pending deck review changes</p>
            <h2 id="doctor-discard-title">Discard your choices?</h2>
          </div>
          <ModalCloseButton onClick={cancelAndRefocus} label="Close and keep choices" />
        </div>
        <p id="doctor-discard-description" className="import-help">
          Leaving Deck review will discard your pending cuts and additions.
        </p>
        <div className="export-actions">
          <button autoFocus className="export" type="button" onClick={cancelAndRefocus}>
            Keep choices
          </button>
          <button className="primary" type="button" onClick={confirm}>
            Discard and leave
          </button>
        </div>
      </section>
    </div>
  )
}

function DeckReviewScreen({
  state,
  actions,
  builderData,
  appHeader,
  modals,
  step,
  rememberMode,
}: AppViewProps & {
  appHeader: ReactNode
  modals: ReturnType<typeof renderModals>
  step: DeckReviewStep
  rememberMode: () => void
}) {
  const closePage = () => {
    state.setBuilderModeReturn(null)
    const depth = readAppRoute()?.reviewDepth
    if (depth) window.history.go(-depth)
    else actions.navigateView('builder', null, true)
  }
  return (
    <>
      <DeckDoctorView
        appHeader={appHeader}
        step={step}
        active={state.showDeckDoctor}
        changeStep={(next, replace = false) =>
          actions.navigateView('builder', reviewRoutes[reviewSteps.indexOf(next)], replace)
        }
        back={() => {
          if (step === 'Diagnose') closePage()
          else if (readAppRoute()?.entry) actions.closeModal()
          else actions.navigateView('builder', reviewBackModal(step), true)
        }}
        openHistory={() => {
          rememberMode()
          actions.openModal('doctor-history')
        }}
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
        setPendingReviewChanges={state.setPendingReviewChanges}
        requestExit={actions.requestReviewExit}
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
        closePage={closePage}
      />
      {modals.importModal}
      {modals.savedDecksModal}
      {modals.exportModal}
      {modals.recommendationSettingsModal}
      {state.showDeckCard && (
        <DeckCardModalView state={state} actions={actions} builderData={builderData} />
      )}
      <ReviewExitConfirmation state={state} actions={actions} />
    </>
  )
}

export function AppView({ state, actions, builderData }: AppViewProps) {
  const { modeReturn, rememberMode } = useBuilderMode(state)
  const modals = renderModals({ state, actions, builderData })
  const workspaceNotice = (
    <WorkspaceNotice
      workspace={state.workspace}
      autosave={state.autosave}
      startNew={actions.startOver}
      chooseDraft={actions.openSavedDecks}
    />
  )
  if (!state.showBuilder)
    return (
      <StartScreen
        state={state}
        actions={actions}
        modals={modals}
        workspaceNotice={workspaceNotice}
      />
    )
  const appHeader = (
    <>
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
      {workspaceNotice}
    </>
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
  const reviewStep = reviewStepForModal(state.activeModal) ?? reviewStepForModal(modeReturn)
  const historyModal = (
    <DeckReviewHistoryModal
      show={state.showDeckDoctorHistory}
      history={state.deckDoctorHistory}
      error={state.deckDoctorError}
      openCard={actions.openCardReference}
      undoSwap={actions.undoDeckDoctorSwap}
      closeModal={() => actions.closeModal()}
    />
  )
  if (reviewStep)
    return (
      <>
        <DeckReviewScreen
          state={state}
          actions={actions}
          builderData={builderData}
          appHeader={appHeader}
          modals={modals}
          step={reviewStep}
          rememberMode={rememberMode}
        />
        {historyModal}
      </>
    )
  return (
    <>
      <BuilderView model={{ ...state, ...actions, ...builderData, ...modals, appHeader } as any} />
      {historyModal}
    </>
  )
}
