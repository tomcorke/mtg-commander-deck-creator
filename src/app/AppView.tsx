import { addsToSideboard, mainDeckLimit } from '../deck-analysis.ts'
import { AddZoneToggle } from '../shared/AddZoneToggle.tsx'
import { Fragment, useEffect, useRef, type ReactNode } from 'react'

import { duplicateDeckName } from '../deck-state.ts'
import { commanderPromotionInfo } from '../domain/commander-promotion.ts'
import { commanderNames } from '../domain/commander-catalog.ts'
import { toDeckCard, type DeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { cardSearchError } from '../domain/card-search.ts'
import { defaultFinish, foilTypeFor } from '../domain/printing.ts'
import { CardReference } from '../shared/CardReference.tsx'
import { useScryfallCooldownMessage } from '../shared/RequestActivityIndicator.tsx'
import { CardSearchView } from '../features/builder/CardSearchView.tsx'
import { BuilderTopBar } from '../features/builder/BuilderTopBar.tsx'
import { BuilderView } from '../features/builder/BuilderView.tsx'
import { ExportDeckModal } from '../features/builder/ExportDeckModal.tsx'
import { DeckDoctorView } from '../features/builder/DeckDoctorView.tsx'
import { startingDeckSummary } from '../domain/bulk-add.ts'
import { DeckReviewHistoryModal } from '../features/modals/DeckReviewHistoryModal.tsx'
import {
  readAppRoute,
  reviewBackModal,
  reviewRoutes,
  reviewStepForModal,
  reviewSteps,
  type DeckReviewStep,
} from './routes.ts'
import { ChangeCommander } from '../features/modals/ChangeCommanderModal.tsx'
import { DeckCardModal } from '../features/modals/DeckCardModal.tsx'
import { ImportDeckModal } from '../features/modals/ImportDeckModal.tsx'
import { RecommendationSettingsModal } from '../features/modals/RecommendationSettingsModal.tsx'
import { OwnedCardsModal } from '../features/modals/OwnedCardsModal.tsx'
import { SavedDecksModal } from '../features/modals/SavedDecksModal.tsx'
import { SharedDeckModal } from '../features/modals/SharedDeckModal.tsx'
import { WorkspaceNotice } from '../features/modals/WorkspaceNotice.tsx'
import { StartView } from '../features/start/StartView.tsx'
import { PlayStyleStep } from '../features/builder/PlayStyleStep.tsx'
import { IntroGuide } from '../features/builder/IntroGuide.tsx'
import { ModalCloseButton } from '../shared/CardDetails.tsx'
import { useDialogFocus } from '../shared/hooks.ts'

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
      importFoundCount={state.importFoundCount}
      setImportSource={state.setImportSource}
      setImportState={state.setImportState}
      setImportError={state.setImportError}
      importDeck={actions.importDeck}
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
        foilType: foilTypeFor(manualCard, defaultFinish(manualCard.finishes)),
        printing: state.manualPrinting,
        printings: state.manualPrintings.map((card: ScryfallCard) => ({
          ...toDeckCard(card),
          finish: defaultFinish(card.finishes),
          foilType: foilTypeFor(card, defaultFinish(card.finishes)),
        })),
      }
    : state.selectedDeckCard
  const manualError = manualCard
    ? cardSearchError(
        manualCard,
        addsToSideboard(state) ? state.sideboard : state.deck,
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
      deckComplete={addsToSideboard(state)}
      zoneToggle={
        <AddZoneToggle
          zone={addsToSideboard(state) ? 'sideboard' : 'deck'}
          onChange={actions.chooseAddZone}
        />
      }
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
      openCard={actions.openCardReference}
      loadingArt={state.loadingArt}
      cycleSelectedDeckCardPrinting={() =>
        void (manualCard ? actions.cycleManualPrinting() : actions.cycleSelectedDeckCardPrinting())
      }
      addAction={
        manualCard
          ? {
              label: addsToSideboard(state) ? 'Add to sideboard' : 'Add to deck',
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
      moveSelectedDeckCard={actions.moveSelectedDeckCard}
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
      chooseOptions={actions.chooseOptions}
      focusSets={state.awaitingPlayStyle}
      recommendationStyle={state.recommendationStyle}
      chooseRecommendationStyle={actions.chooseRecommendationStyle}
      powerTarget={state.powerTarget}
      choosePowerTarget={actions.choosePowerTarget}
      maxPrice={state.maxPrice}
      chooseMaxPrice={actions.chooseMaxPrice}
      deckBudget={state.deckBudget}
      includeCreature={state.includeCreature}
      collectionSearch={state.collectionSearch}
      setCollectionSearch={state.setCollectionSearch}
      collectionSets={state.collectionSets}
      toggleCollectionSet={actions.toggleCollectionSet}
      browsingSets={state.commanderSets}
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
      ownershipMode={state.ownershipMode}
      ownedCardList={state.ownedCardList}
      openOwnedCards={() => actions.openModal('owned-cards')}
      excludeGameChangers={state.excludeGameChangersSetting}
      limitGameChangers={state.limitGameChangers}
      excludeTutors={state.excludeTutors}
      excludeExtraTurns={state.excludeExtraTurns}
      excludeUnreleased={state.excludeUnreleased}
      recommendationOptionsChanged={state.recommendationOptionsChanged}
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
        deck={props.state.deck}
        sideboard={props.state.sideboard}
        exportFormat={props.state.exportFormat}
        setExportFormat={props.state.setExportFormat}
        ownedCards={props.state.ownedCards}
        exportNeededOnly={props.state.exportNeededOnly}
        setExportNeededOnly={props.state.setExportNeededOnly}
        copied={props.state.copied}
        deckList={props.actions.deckList}
        copyDeck={props.actions.copyDeck}
        downloadDeckList={props.actions.downloadDeckList}
        shareLinkState={props.state.shareLinkState}
        setShareLinkState={props.state.setShareLinkState}
        copyShareLink={() => void props.actions.copyShareLink()}
        closeModal={() => props.actions.closeModal()}
      />
    ),
    importModal: <ImportModalView {...props} />,
    savedDecksModal: <SavedDecksModalView {...props} />,
    deckCardModal: <DeckCardModalView {...props} />,
    recommendationSettingsModal: (
      <>
        <RecommendationSettingsView {...props} />
        <OwnedCardsModal
          show={props.state.showOwnedCards}
          ownedCardList={props.state.ownedCardList}
          saveOwnedCards={props.actions.saveOwnedCards}
          unrecognisedOwnedNames={props.actions.unrecognisedOwnedNames}
          openOwnedCard={props.actions.openOwnedCard}
          resolveOwnedCards={props.actions.resolveOwnedCards}
          closeModal={() => props.actions.closeModal()}
        />
      </>
    ),
    changeCommander: (
      <ChangeCommander
        commander={props.state.commander}
        deck={props.state.deck}
        commanderColours={props.state.commanderDetails?.colours ?? []}
        openCard={props.actions.openCardReference}
        changeCommander={props.actions.promoteToCommander}
      />
    ),
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
        today={state.today}
        cycleCommanderPrinting={actions.cycleCommanderPrinting}
        changeCommander={modals.changeCommander}
        openCard={(card) => {
          const existing = [...state.deck, ...state.sideboard].find(
            ({ name }) => name === card.name,
          )
          if (existing) actions.openCardReference(existing)
          else void actions.selectManualCard(card)
        }}
        openCommander={(index) => actions.openCardReference(state.deck[index])}
        addCards={actions.addSearchCards}
        mainLimit={mainDeckLimit(state)}
        roleCounts={builderData.analysis.counts}
        deckTargets={state.deckTargets}
        themes={[state.theme, ...state.activeSubThemes]}
        zoneToggle={
          <AddZoneToggle
            zone={addsToSideboard(state) ? 'sideboard' : 'deck'}
            onChange={actions.chooseAddZone}
          />
        }
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
    'owned-cards',
    'doctor-history',
  ].includes(activeModal)
  const modeReturn = preservesMode ? storedModeReturn : null
  useEffect(() => {
    if (storedModeReturn && !showDeckDoctor && !showCardSearch && !modeReturn)
      setBuilderModeReturn(null)
  }, [modeReturn, setBuilderModeReturn, showCardSearch, showDeckDoctor, storedModeReturn])

  const reviewing = useRef(false)
  useEffect(() => {
    if (showDeckDoctor || modeReturn) {
      reviewing.current ||= showDeckDoctor
      return
    }
    if (!reviewing.current) return
    reviewing.current = false
    // Leaving Deck review returns focus to the builder's way in, as leaving card search does.
    if (document.activeElement === document.body)
      document.querySelector<HTMLButtonElement>('[data-guide="review"]')?.focus()
  }, [modeReturn, showDeckDoctor])

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
  const { cancelReviewNavigation: cancel, confirmReviewNavigation: confirm } = actions
  const cancelAndRefocus = () => {
    cancel()
    requestAnimationFrame(() => document.getElementById('deck-review-title')?.focus())
  }
  const dialog = useDialogFocus(state.showReviewExitPrompt, cancelAndRefocus)
  if (!state.showReviewExitPrompt) return null
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancelAndRefocus()
      }}
    >
      <section
        {...dialog}
        className="export-modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doctor-discard-title"
        aria-describedby="doctor-discard-description"
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
          <button className="export" type="button" onClick={cancelAndRefocus}>
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
  const boards = { deck: state.deck, sideboard: state.sideboard }
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
        chooseDeckTarget={(key, value) => actions.chooseDeckTarget(key, value)}
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
        suggestFindingChanges={builderData.suggestFindingChanges}
        history={state.deckDoctorHistory}
        error={state.deckDoctorError}
        fetchCandidates={() => actions.fetchDeckDoctorCandidates()}
        fetchCommanderAlternatives={() => actions.fetchDeckDoctorCommanders()}
        openCard={actions.openCardReference}
        cycleCommanderPrinting={actions.cycleCommanderPrinting}
        changeCommander={modals.changeCommander}
        applySwapPlan={actions.applyDeckDoctorSwapPlan}
        closePage={closePage}
        undoSwap={actions.undoDeckDoctorSwap}
        chooseTheme={() => void (state.setShowSubThemePicker(true), closePage())}
        startingDeck={startingDeckSummary(state.bulkAdd, boards)}
        undoStartingDeck={actions.undoBulkAdd}
        ownedCards={state.ownedCards}
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

function groupNotices(notices: { card: DeckCard; message: string }[]) {
  const groups = new Map<string, { card: DeckCard }[]>()
  for (const notice of notices)
    groups.set(notice.message, [...(groups.get(notice.message) ?? []), notice])
  return groups
}

function CurrentCardDataNotice({ state, actions, builderData }: AppViewProps) {
  // The header shows the check; a banner here would shift the page when it ends.
  const scryfallCooldown = useScryfallCooldownMessage()
  if (builderData.cardDataPending) return null
  return (
    <>
      {builderData.cardDataNotices.length > 0 && (
        <section className="workspace-notice" role="alert" aria-label="Current card data">
          <p className="form-error">
            {`Card data warnings for ${builderData.cardDataNotices.length} ${builderData.cardDataNotices.length === 1 ? 'card' : 'cards'}. Cards and choices have been kept.`}
            {state.deck.length === 100 &&
              !builderData.deckComplete &&
              ' This deck needs validation; it is not verified complete.'}
          </p>
          {scryfallCooldown && <p className="form-error">{scryfallCooldown}</p>}
          <details className="workspace-notice-details">
            <summary>Show cards</summary>
            {[...groupNotices(builderData.cardDataNotices)].map(([message, notices]) => (
              <p key={message}>
                {message}{' '}
                {notices.map(({ card }, index) => (
                  <Fragment key={index}>
                    {index > 0 && ', '}
                    <CardReference card={card} onOpen={() => actions.openCardReference(card)} />
                  </Fragment>
                ))}
              </p>
            ))}
          </details>
          <div className="workspace-notice-actions">
            {builderData.cardDataNotices.some(
              ({ card }: { card: DeckCard }) =>
                card.dataStatus === 'unavailable' ||
                card.gameChanger === undefined ||
                card.commanderLegality === undefined ||
                card.colorIdentity === undefined ||
                !card.manaValueKnown,
            ) && (
              <button className="export" type="button" onClick={actions.retryCurrentCardData}>
                Retry current card data
              </button>
            )}
            {!builderData.deckComplete && (
              <button
                className="export"
                type="button"
                onClick={() => actions.navigateView('builder', 'review')}
              >
                Review deck
              </button>
            )}
          </div>
        </section>
      )}
    </>
  )
}

function renderIntroGuide(state: AppViewProps['state']) {
  return (
    state.showIntroGuide &&
    !state.activeModal && <IntroGuide close={() => state.setShowIntroGuide(false)} />
  )
}

function renderPlayStyleStep({ state, actions }: Pick<AppViewProps, 'state' | 'actions'>) {
  return (
    state.awaitingPlayStyle &&
    state.commanderDetails &&
    state.recommendationState === 'idle' && (
      <PlayStyleStep
        settings={state as any}
        choose={(style) => void actions.beginFirstBatch(style)}
        chooseSets={() => actions.openModal('recommendation-settings')}
      />
    )
  )
}

/** A share link's preview sits over whichever screen is open, so it renders at the root. */
export function AppView(props: AppViewProps) {
  const { state, actions } = props
  return (
    <>
      <AppScreens {...props} />
      <SharedDeckModal
        sharedDeck={state.sharedDeck}
        hidden={state.activeModal === 'card'}
        hasCurrentDeck={Boolean(state.commander && state.deck.length)}
        openCard={actions.openSharedCard}
        copySharedDeck={() => void actions.copySharedDeck()}
        retry={(payload) => void actions.openSharedDeck(payload)}
        closeModal={actions.closeSharedDeck}
      />
    </>
  )
}

// eslint-disable-next-line max-lines-per-function -- Root route composition keeps each screen beside its modal outlets; callbacks remain checked.
function AppScreens({ state, actions, builderData }: AppViewProps) {
  const { modeReturn, rememberMode } = useBuilderMode(state)
  const modals = renderModals({ state, actions, builderData })
  const workspaceNotice = (
    <>
      <WorkspaceNotice
        workspace={state.workspace}
        autosave={state.autosave}
        startNew={actions.startOver}
        chooseDraft={actions.openSavedDecks}
        hideRecovery={!state.showBuilder && Boolean(state.commander && state.deck.length)}
      />
      <CurrentCardDataNotice state={state} actions={actions} builderData={builderData} />
    </>
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
        checkingCardData={builderData.cardDataPending}
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
      <BuilderView
        model={
          {
            ...state,
            ...actions,
            ...builderData,
            ...modals,
            appHeader,
            playStyleStep: renderPlayStyleStep({ state, actions }),
          } as any
        }
      />
      {renderIntroGuide(state)}
      {historyModal}
    </>
  )
}
