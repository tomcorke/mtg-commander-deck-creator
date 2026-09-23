import { type CSSProperties, type Dispatch, type SetStateAction } from 'react'

import {
  cardScryfallUri,
  edhrecSlug,
  scryfallBackImage,
  scryfallImage,
  type Card,
  type CommanderDetails,
  type DeckCard,
  type ScryfallCard,
} from '../../domain/card-model.ts'
import { commanderNames, colourNames } from '../../domain/commander-catalog.ts'
import { commanderPromotionInfo } from '../../domain/commander-promotion.ts'
import { defaultFinish } from '../../domain/printing.ts'
import {
  cardText,
  manualCardError,
  type CollectionMode,
  type RecommendationStyle,
} from '../../recommendations.ts'
import {
  analyseDeck,
  curveBucket,
  type DeckTargets,
  type ManaColour,
  rolesForCard,
  targetKeys,
  targetLabels,
} from '../../deck-analysis.ts'
import type {
  DeferredCard,
  RecommendationScoreBreakdown,
} from '../../domain/recommendation-types.ts'
import type { SavedDeck } from '../../deck-state.ts'
import { ArtLoading, FinishedCardImage } from '../../shared/CardArt.tsx'
import { CardDetails, ModalCloseButton } from '../../shared/CardDetails.tsx'
import { ManaSymbols, OracleText } from '../../shared/ManaSymbols.tsx'
import { CommanderPromotion } from '../../shared/CommanderPromotion.tsx'
import { ScoreBreakdown } from '../score/ScoreBreakdown.tsx'

type AnyFunction = (...args: any[]) => any

type BuilderViewModel = {
  [key: string]: any
  activeDeckDelta: { added: number; removed: number } | null
  activeSavedDeck: SavedDeck | undefined
  activeSubThemes: string[]
  analysis: ReturnType<typeof analyseDeck>
  basicLandState: 'idle' | 'loading' | 'error'
  basicLands: { name: string; count: number }[]
  batchAnnouncement: string
  batchNumber: number
  calculatedLandTarget: number
  cardEffects: boolean
  cardSearch: string
  cardSearchResults: ScryfallCard[]
  cardSearchState: 'idle' | 'loading' | 'error'
  collectionBrowserCards: ScryfallCard[]
  collectionBrowserError: string
  collectionBrowserMana: string
  collectionBrowserState: 'idle' | 'loading' | 'error'
  collectionBrowserType: string
  collectionError: string
  collectionMode: CollectionMode
  collectionPoolSize: number | null
  collectionSets: string[]
  commander: string
  commanderDetails: CommanderDetails | null
  commanderStyling: boolean
  copied: boolean
  darkMode: boolean
  decisions: Record<string, 'add' | 'later' | 'ignore'>
  deck: DeckCard[]
  deckCards: DeckCard[]
  deckTargets: DeckTargets
  deferredCards: DeferredCard<Card>[]
  displayedTypeCounts: readonly (readonly [string, number])[]
  exportFormat: 'moxfield' | 'plain' | 'csv'
  filterCardIdentity: boolean
  filteredCollectionCards: ScryfallCard[]
  filteredSubThemes: string[]
  groupedBasics: { name: string; cards: { card: DeckCard; index: number }[] }[]
  groupedDeckColumns: {
    section: string
    cards: { card: DeckCard; index: number }[]
    count: number
  }[][]
  guidance: { key: string; strong: boolean; text: string }[]
  healthSuggestions: Card[]
  highlightedManaValue: number | null
  inferredSubThemes: string[]
  legalBasicNames: string[]
  liked: string[]
  limitedRecommendations: boolean
  loadingArt: string
  manaColours: readonly ManaColour[]
  manualPrinting: number
  manualPrintings: ScryfallCard[]
  maxCurveCount: number
  maxTypeCount: number
  missingHealthRoles: string[]
  pairCards: Card[]
  pendingRemoval: number | null
  primaryTheme: [string, string]
  queue: Card[]
  recommendationLoadingStep: 'commander' | 'recommendations'
  recommendationLoadingTitle: string
  recommendationOptionsChanged: boolean
  recommendationSettingsSummary: string
  recommendationState: 'idle' | 'loading' | 'error'
  recommendationStyle: RecommendationStyle
  recommendedCard: { card: Card | null; score: number }
  scoredBatch: { card: Card; score: RecommendationScoreBreakdown }[]
  secondaryTheme: [string, string]
  search: string
  selectedManualCard: ScryfallCard | null
  sideboard: DeckCard[]
  showBasicLands: boolean
  showCardSearch: boolean
  showCollectionBrowser: boolean
  showExport: boolean
  showSubThemePicker: boolean
  subThemeSearch: string
  synergyPair: { cards: Card[]; explanation: string } | null
  theme: string
  toggleCollectionSet: (code: string) => void
  start: AnyFunction
  setActiveSubThemes: Dispatch<SetStateAction<string[]>>
  setBasicLandState: (value: 'idle' | 'loading' | 'error') => void
  setCardEffects: Dispatch<SetStateAction<boolean>>
  setCardSearch: Dispatch<SetStateAction<string>>
  setCardSearchResults: Dispatch<SetStateAction<ScryfallCard[]>>
  setCardSearchState: Dispatch<SetStateAction<'idle' | 'loading' | 'error'>>
  setCollectionBrowserMana: Dispatch<SetStateAction<string>>
  setCollectionBrowserType: Dispatch<SetStateAction<string>>
  setCommanderStyling: Dispatch<SetStateAction<boolean>>
  setDarkMode: Dispatch<SetStateAction<boolean>>
  setDeckTargets: Dispatch<SetStateAction<DeckTargets>>
  setDismissedSubThemes: Dispatch<SetStateAction<string[]>>
  setExportFormat: Dispatch<SetStateAction<'moxfield' | 'plain' | 'csv'>>
  setFilterCardIdentity: Dispatch<SetStateAction<boolean>>
  setHighlightedManaValue: Dispatch<SetStateAction<number | null>>
  setLiked: Dispatch<SetStateAction<string[]>>
  setPendingRemoval: Dispatch<SetStateAction<number | null>>
  setRecommendationOptionsChanged: Dispatch<SetStateAction<boolean>>
  setSelectedManualCard: Dispatch<SetStateAction<ScryfallCard | null>>
  setShowCollectionBrowser: Dispatch<SetStateAction<boolean>>
  setShowSubThemePicker: Dispatch<SetStateAction<boolean>>
  setSubThemeSearch: Dispatch<SetStateAction<string>>
  setTheme: Dispatch<SetStateAction<string>>
}

export function BuilderView({ model }: { model: BuilderViewModel }) {
  const {
    activeDeckDelta,
    activeSavedDeck,
    activeSubThemes,
    addBasicLands,
    addCollectionCard,
    addManualCard,
    addOneBasic,
    addRecommendationCard,
    analysis,
    basicLandState,
    basicLands,
    batchAnnouncement,
    batchNumber,
    calculatedLandTarget,
    cardEffects,
    cardReason,
    cardSearch,
    cardSearchButton,
    cardSearchDialog,
    cardSearchInput,
    cardSearchResults,
    cardSearchState,
    chooseSubTheme,
    clickCardImage,
    closeCardSearch,
    closeModal,
    collectionBrowserCards,
    collectionBrowserError,
    collectionBrowserMana,
    collectionBrowserState,
    collectionBrowserType,
    collectionError,
    collectionMode,
    collectionPoolSize,
    collectionSets,
    commander,
    commanderDetails,
    commanderStyling,
    copied,
    copyDeck,
    cycleCommanderPrinting,
    cycleDeckPrinting,
    cycleManualPrinting,
    cyclePrinting,
    darkMode,
    decide,
    decisions,
    deck,
    deckCardModal,
    deckCards,
    deckList,
    deckTargets,
    deferredCards,
    edhrecRetryRemaining,
    displayedTypeCounts,
    exportFormat,
    fanCards,
    filterCardIdentity,
    filteredCollectionCards,
    filteredSubThemes,
    groupedBasics,
    groupedDeckColumns,
    guidance,
    handleCardSearchKeys,
    healthSuggestions,
    highlightedManaValue,
    importModal,
    inferredSubThemes,
    legalBasicNames,
    liked,
    limitedRecommendations,
    loadingArt,
    manaColours,
    manualPrinting,
    manualPrintings,
    maxCurveCount,
    maxTypeCount,
    missingHealthRoles,
    moveSideboardCard,
    nextBatch,
    openCollectionCard,
    openCommanderCard,
    openGuidanceCard,
    openDeckCard,
    promoteToCommander,
    openModal,
    openSavedDecks,
    pendingRemoval,
    positionDeckPreview,
    primaryTheme,
    queue,
    recommendationLoadingStep,
    recommendationLoadingTitle,
    recommendationOptionsChanged,
    recommendationSettingsModal,
    recommendationSettingsSummary,
    recommendationState,
    recommendationStyle,
    recommendedCard,
    removeDeckCard,
    removeSideboardCard,
    representativeSpellCount,
    resetFan,
    retryEdhrec,
    savedDecksModal,
    scoredBatch,
    secondaryTheme,
    selectManualCard,
    selectedManualCard,
    setActiveSubThemes,
    setBasicLandState,
    setCardEffects,
    setCardSearch,
    setCardSearchResults,
    setCardSearchState,
    setCollectionBrowserMana,
    setCollectionBrowserType,
    setCommanderStyling,
    setDarkMode,
    setDeckTargets,
    setDismissedSubThemes,
    setExportFormat,
    setFilterCardIdentity,
    setHighlightedManaValue,
    setLiked,
    setPendingRemoval,
    setRecommendationOptionsChanged,
    setSelectedManualCard,
    setShowCollectionBrowser,
    setShowSubThemePicker,
    setSubThemeSearch,
    setTheme,
    showBasicLands,
    showCardSearch,
    showCollectionBrowser,
    showExport,
    showSubThemePicker,
    sideboard,
    startOver,
    subThemeSearch,
    pairCards,
    synergyPair,
    start,
    theme,
    toggleCollectionSet,
  } = model

  return (
    <main
      className={`${darkMode ? 'dark ' : ''}${commanderStyling ? 'commander-themed' : ''}`}
      style={
        {
          '--commander-accent': primaryTheme[0],
          '--commander-highlight': secondaryTheme[1],
        } as CSSProperties
      }
    >
      {commanderStyling && commanderDetails?.art.length ? (
        <div className="commander-backdrop" aria-hidden="true">
          {commanderDetails.art.map((image) => (
            <span style={{ backgroundImage: `url(${image})` }} key={image} />
          ))}
        </div>
      ) : null}
      <header>
        <button className="brand reset" onClick={startOver}>
          Commander Deck Creator <small>v{__APP_VERSION__}</small>
        </button>
        <div className="deck-status">
          {activeSavedDeck && (
            <div className="saved-status">
              <b>{activeSavedDeck.name}</b>
              <small>
                Saved {new Date(activeSavedDeck.updatedAt).toLocaleString()}{' '}
                <span className="delta-added">+{activeDeckDelta?.added}</span>{' '}
                <span className="delta-removed">−{activeDeckDelta?.removed}</span>
              </small>
            </div>
          )}
          <div className="progress">
            <span
              style={{
                background: `linear-gradient(90deg, var(--commander-accent, #7650ae) ${deck.length}%, #dedcea ${deck.length}%)`,
              }}
            />
            {deck.length} / 100 cards
          </div>
        </div>
        <div className="header-actions">
          <label className="theme-option">
            <input
              type="checkbox"
              checked={commanderStyling}
              onChange={(event) => setCommanderStyling(event.target.checked)}
            />{' '}
            Commander art and colours
          </label>
          <label
            className="theme-option"
            title="Enable card movement and foil or etched finish effects"
          >
            <input
              type="checkbox"
              checked={cardEffects}
              onChange={(event) => setCardEffects(event.target.checked)}
            />{' '}
            Motion and finishes
          </label>
          <button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>
            {darkMode ? '◐ Dark' : '☀ Light'}
          </button>
          <button className="start-over" type="button" onClick={startOver}>
            Start over
          </button>
          <button className="export" type="button" onClick={() => openModal('import')}>
            Import
          </button>
          <button className="export" type="button" onClick={openSavedDecks}>
            Save / load
          </button>
          <button className="export" type="button" onClick={() => openModal('export')}>
            Export deck
          </button>
        </div>
      </header>
      {savedDecksModal}
      {importModal}
      {recommendationSettingsModal}
      <section className="intro commander-header">
        {commanderDetails ? (
          <figure
            className={`commander-card ${commanderDetails.images.length > 1 ? 'pair' : ''}`}
            tabIndex={0}
            aria-label={`View ${commander} card${commanderDetails.images.length > 1 ? 's' : ''}`}
          >
            {commanderDetails.images.map((image, index) => (
              <img
                src={image}
                alt={`${commanderNames(commander)[index]} card`}
                onClick={() => openCommanderCard(index)}
                key={commanderNames(commander)[index]}
              />
            ))}
            {commanderDetails.printings.some((printings) => printings.length > 1) && (
              <span className="printing-indicator" aria-hidden="true">
                ↻ Art
              </span>
            )}
            <span className="card-zoom">
              {commanderDetails.images.map((image, index) => (
                <span className="commander-printing" key={commanderNames(commander)[index]}>
                  <FinishedCardImage
                    image={image}
                    backImage={
                      commanderDetails.printings[index][commanderDetails.selections[index]]
                        ?.backImage
                    }
                    alt={`${commanderNames(commander)[index]} full card`}
                    cardName={commanderNames(commander)[index]}
                    finish={
                      commanderDetails.printings[index][commanderDetails.selections[index]]?.finish
                    }
                    effectsEnabled={cardEffects}
                    showFlipButton
                    printing={{
                      count: commanderDetails.printings[index].length,
                      index: commanderDetails.selections[index],
                      loading: Boolean(loadingArt),
                      name: commanderNames(commander)[index],
                      onClick: () => void cycleCommanderPrinting(index),
                    }}
                  />
                </span>
              ))}
            </span>
          </figure>
        ) : (
          <span className="commander-card commander-placeholder" aria-hidden="true" />
        )}
        <div className="commander-summary">
          <p className="eyebrow">Building around</p>
          <h1>
            <button type="button" className="commander-name" onClick={() => openCommanderCard(0)}>
              {commander}
            </button>
          </h1>
          <div
            className="identity"
            aria-label={`Colour identity: ${commanderDetails?.colours.map((colour) => colourNames[colour]).join(', ') || 'loading'}`}
          >
            <span>Colour identity</span>
            {commanderDetails?.colours.length === 0 && (
              <img
                className="colour"
                src="https://svgs.scryfall.io/card-symbols/C.svg"
                alt="Colourless"
              />
            )}
            {commanderDetails?.colours.map((colour) => (
              <img
                className="colour"
                src={`https://svgs.scryfall.io/card-symbols/${colour}.svg`}
                alt={colourNames[colour]}
                key={colour}
              />
            ))}
          </div>
          <button className="change" onClick={startOver}>
            Change commander
          </button>
        </div>
        <div className="recommendation-setup">
          <div className="section-title">
            <div>
              <p className="eyebrow">Next pick</p>
              <h2>Add to your deck</h2>
            </div>
            <span>Batch {batchNumber}</span>
          </div>
          <div className="recommendation-settings-summary">
            <button
              type="button"
              className="export"
              onClick={() => openModal('recommendation-settings')}
            >
              Recommendation settings
            </button>
            <p title={recommendationSettingsSummary}>{recommendationSettingsSummary}</p>
            {recommendationOptionsChanged && (
              <span className="options-pending" role="status">
                Changes apply with next recommendations.
              </span>
            )}
          </div>
        </div>
      </section>
      {showCollectionBrowser && (
        <div
          className="modal-backdrop collection-browser-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCollectionBrowser(false)
          }}
        >
          <section
            className="collection-browser collection-browser-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-browser-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setShowCollectionBrowser(false)
              }
            }}
          >
            <div className="collection-browser-heading">
              <div>
                <p className="eyebrow">Discovery</p>
                <h2 id="collection-browser-title">Browse selected collection</h2>
                <p>
                  {collectionPoolSize ?? collectionBrowserCards.length} legal unique cards, shown in
                  random order.
                </p>
              </div>
              <ModalCloseButton
                autoFocus
                onClick={() => setShowCollectionBrowser(false)}
                label="Close collection browser"
              />
            </div>
            <div className="collection-browser-filters">
              <label>
                Card type{' '}
                <select
                  value={collectionBrowserType}
                  onChange={(event) => setCollectionBrowserType(event.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="creature">Creatures</option>
                  <option value="artifact">Artifacts</option>
                  <option value="enchantment">Enchantments</option>
                  <option value="instant">Instants</option>
                  <option value="sorcery">Sorceries</option>
                  <option value="land">Lands</option>
                </select>
              </label>
              <label>
                Mana value{' '}
                <input
                  type="number"
                  min="0"
                  max="16"
                  value={collectionBrowserMana}
                  onChange={(event) => setCollectionBrowserMana(event.target.value)}
                  placeholder="Any"
                />
              </label>
            </div>
            {collectionBrowserState === 'loading' && (
              <p role="status">Loading legal collection cards…</p>
            )}
            {collectionBrowserState === 'error' && (
              <p className="form-error" role="alert">
                {collectionBrowserError}
              </p>
            )}
            {collectionBrowserState === 'idle' && (
              <div className="collection-browser-grid">
                {filteredCollectionCards.map((card) => (
                  <article key={`${card.name}-${card.set}-${card.collector_number}`}>
                    <button
                      type="button"
                      className="collection-card-open"
                      onClick={() => openCollectionCard(card)}
                    >
                      <div>{scryfallImage(card) && <img src={scryfallImage(card)} alt="" />}</div>
                      <h3>{card.name}</h3>
                      <p>{card.type_line}</p>
                      <span>
                        {card.cmc ?? 0} mana · {card.set.toUpperCase()}
                      </span>
                      <small>View details</small>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(
                        manualCardError(
                          card,
                          [...deck, ...sideboard].map((item) => item.name),
                          commanderDetails?.colours ?? [],
                        ),
                      )}
                      onClick={() => addCollectionCard(card)}
                    >
                      Add to deck
                    </button>
                  </article>
                ))}
              </div>
            )}
            {collectionBrowserState === 'idle' && !filteredCollectionCards.length && (
              <p>No cards match those filters.</p>
            )}
          </section>
        </div>
      )}
      {deckCardModal}
      {showCardSearch && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCardSearch()
          }}
        >
          <section
            className="export-modal card-search-modal"
            ref={cardSearchDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-search-title"
            onKeyDown={handleCardSearchKeys}
          >
            <div className="export-heading">
              <div>
                <p className="eyebrow">Add any legal card</p>
                <h2 id="card-search-title">Find a card</h2>
              </div>
              <ModalCloseButton onClick={closeCardSearch} label="Close card search" />
            </div>
            <form
              className="card-search-form"
              onSubmit={(event) => {
                event.preventDefault()
                const card =
                  cardSearchResults.find(
                    (item) => item.name.toLowerCase() === cardSearch.trim().toLowerCase(),
                  ) ?? cardSearchResults[0]
                if (card) selectManualCard(card)
              }}
            >
              <input
                ref={cardSearchInput}
                value={cardSearch}
                onChange={(event) => {
                  setCardSearch(event.target.value)
                  setCardSearchResults([])
                  setCardSearchState('idle')
                  setSelectedManualCard(null)
                }}
                placeholder="Search card names…"
                aria-label="Card name"
                autoComplete="off"
              />
              <button
                className="primary"
                disabled={!cardSearchResults.length || cardSearchState === 'loading'}
              >
                Search
              </button>
            </form>
            <label className="card-search-filter">
              <input
                type="checkbox"
                checked={filterCardIdentity}
                onChange={(event) => {
                  setFilterCardIdentity(event.target.checked)
                  setCardSearchResults([])
                  setSelectedManualCard(null)
                }}
              />{' '}
              Only show cards in commander colour identity
            </label>
            {cardSearchState === 'loading' && (
              <p className="card-search-status" role="status">
                Searching…
              </p>
            )}
            {cardSearchState === 'error' && (
              <p className="form-error" role="alert">
                Scryfall unavailable. Try again.
              </p>
            )}
            {cardSearch.length >= 2 &&
              cardSearchState === 'idle' &&
              !cardSearchResults.length &&
              !selectedManualCard && <p className="card-search-status">No cards found.</p>}
            {!selectedManualCard && cardSearchResults.length > 0 && (
              <div className="card-search-results" aria-label="Card search results">
                {cardSearchResults.map((card) => (
                  <div className="card-search-result" key={card.name}>
                    <button type="button" onClick={() => void selectManualCard(card)}>
                      <span>
                        <b>{card.name}</b>
                        <small>{card.type_line}</small>
                      </span>
                      <span className="search-result-mana">
                        <OracleText
                          text={card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ''}
                        />
                      </span>
                    </button>
                    {(card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal) && (
                      <span className="search-card-popover">
                        <FinishedCardImage
                          image={
                            card.image_uris?.normal ??
                            card.card_faces?.[0]?.image_uris?.normal ??
                            ''
                          }
                          backImage={scryfallBackImage(card)}
                          alt={`${card.name} card`}
                          cardName={card.name}
                          finish={defaultFinish(card.finishes)}
                          effectsEnabled={cardEffects}
                          showFlipButton
                        />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {selectedManualCard && (
              <div className="manual-card-preview">
                {scryfallImage(selectedManualCard) && (
                  <figure className="manual-card-image" tabIndex={0}>
                    <img
                      src={scryfallImage(selectedManualCard)}
                      alt={`${selectedManualCard.name} card`}
                    />
                    <span className="manual-card-zoom">
                      <FinishedCardImage
                        image={scryfallImage(selectedManualCard)}
                        backImage={scryfallBackImage(selectedManualCard)}
                        alt={`${selectedManualCard.name} enlarged card`}
                        cardName={selectedManualCard.name}
                        finish={defaultFinish(selectedManualCard.finishes)}
                        effectsEnabled={cardEffects}
                        showFlipButton
                        printing={{
                          count: manualPrintings.length,
                          index: manualPrinting,
                          loading: Boolean(loadingArt),
                          name: selectedManualCard.name,
                          onClick: () => void cycleManualPrinting(),
                        }}
                      />
                    </span>
                    <ArtLoading active={loadingArt === selectedManualCard.name} />
                  </figure>
                )}
                <div>
                  <p className="eyebrow">
                    {selectedManualCard.set.toUpperCase()} · {selectedManualCard.collector_number}
                  </p>
                  <h3>{selectedManualCard.name}</h3>
                  <p>{selectedManualCard.type_line}</p>
                  <p>
                    <OracleText text={cardText(selectedManualCard)} />
                  </p>
                  {manualCardError(
                    selectedManualCard,
                    [...deck, ...sideboard].map((card) => card.name),
                    commanderDetails?.colours ?? [],
                  ) && (
                    <p className="form-error" role="alert">
                      {manualCardError(
                        selectedManualCard,
                        [...deck, ...sideboard].map((card) => card.name),
                        commanderDetails?.colours ?? [],
                      )}
                    </p>
                  )}
                  <div className="export-actions">
                    <button type="button" onClick={() => setSelectedManualCard(null)}>
                      Back
                    </button>
                    <button
                      className="primary"
                      type="button"
                      disabled={Boolean(
                        manualCardError(
                          selectedManualCard,
                          [...deck, ...sideboard].map((card) => card.name),
                          commanderDetails?.colours ?? [],
                        ),
                      )}
                      onClick={addManualCard}
                    >
                      {deck.length >= 100 ? 'Add to sideboard' : 'Add to deck'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {showBasicLands && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && basicLandState !== 'loading') closeModal()
          }}
        >
          <section
            className="export-modal basic-land-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="basic-land-title"
          >
            <div className="export-heading">
              <div>
                <p className="eyebrow">Complete mana base</p>
                <h2 id="basic-land-title">Add basic lands?</h2>
              </div>
              <ModalCloseButton
                disabled={basicLandState === 'loading'}
                onClick={() => closeModal()}
                label="Close basic land review"
              />
            </div>
            <p>
              This fills {basicLands.reduce((sum, land) => sum + land.count, 0)} slots toward your{' '}
              {calculatedLandTarget}-land target. Existing cards stay unchanged.
            </p>
            <ul className="basic-land-plan">
              {basicLands.map((land) => (
                <li key={land.name}>
                  <span>{land.name}</span>
                  <b>{land.count}</b>
                </li>
              ))}
            </ul>
            {basicLandState === 'error' && (
              <p className="form-error" role="alert">
                Could not load basic lands. Try again.
              </p>
            )}
            <div className="export-actions">
              <button onClick={() => closeModal()} disabled={basicLandState === 'loading'}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={basicLandState === 'loading'}
                onClick={() => void addBasicLands(basicLands)}
              >
                {basicLandState === 'loading' ? 'Adding…' : 'Add lands'}
              </button>
            </div>
          </section>
        </div>
      )}
      {showExport && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <section
            className="export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
          >
            <div className="export-heading">
              <div>
                <p className="eyebrow">Export deck</p>
                <h2 id="export-title">Copy your deck list</h2>
              </div>
              <ModalCloseButton onClick={() => closeModal()} label="Close export" />
            </div>
            <div className="format-tabs" role="group" aria-label="Deck list format">
              <button
                className={exportFormat === 'moxfield' ? 'selected' : ''}
                onClick={() => setExportFormat('moxfield')}
              >
                Moxfield
              </button>
              <button
                className={exportFormat === 'plain' ? 'selected' : ''}
                onClick={() => setExportFormat('plain')}
              >
                Plain text
              </button>
              <button
                className={exportFormat === 'csv' ? 'selected' : ''}
                onClick={() => setExportFormat('csv')}
              >
                CSV
              </button>
            </div>
            {exportFormat === 'moxfield' && (
              <p className="moxfield-instructions">
                <b>Commander must be selected manually in Moxfield.</b> Moxfield does not support
                importing a deck with its commander included. Choose Commander format, set{' '}
                {commanderNames(commander).length > 1 ? 'commanders' : 'commander'} to{' '}
                <b>{commanderNames(commander).join(' and ')}</b>, then paste this{' '}
                {deck.length - commanderNames(commander).length}-card mainboard list.
              </p>
            )}
            <textarea
              readOnly
              value={deckList(exportFormat)}
              onFocus={(event) => event.currentTarget.select()}
              aria-label={`${exportFormat} deck list`}
            />
            <div className="export-actions">
              <a href="https://www.moxfield.com/decks/personal" target="_blank" rel="noreferrer">
                Open Moxfield decks ↗
              </a>
              <button className="primary" onClick={() => void copyDeck()}>
                {copied ? 'Copied' : 'Copy to clipboard'}
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="workspace">
        <section className="recommendations">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {batchAnnouncement}
          </p>
          {limitedRecommendations && recommendationState === 'idle' && (
            <div className="limited-mode">
              <span role="status">
                {collectionMode === 'only'
                  ? 'Collection-only recommendations use legal Scryfall cards.'
                  : 'Limited recommendations - EDHREC unavailable, using Scryfall popularity.'}
              </span>
              {collectionMode !== 'only' && (
                <button
                  type="button"
                  className="export"
                  disabled={edhrecRetryRemaining > 0}
                  onClick={() => void retryEdhrec()}
                >
                  {edhrecRetryRemaining > 0
                    ? `Retry EDHREC recommendations in ${edhrecRetryRemaining}s`
                    : 'Retry EDHREC recommendations'}
                </button>
              )}
            </div>
          )}
          <div className="recommendation-toolbar">
            <div className="subthemes" aria-label="Deck themes">
              {theme && (
                <button
                  type="button"
                  onClick={() => {
                    setTheme('')
                    setRecommendationOptionsChanged(true)
                  }}
                  title="Remove declared theme"
                >
                  {theme} <span>×</span>
                </button>
              )}
              {activeSubThemes.map((name) => (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubThemes((current) => current.filter((item) => item !== name))
                    setRecommendationOptionsChanged(true)
                  }}
                  title={`Remove ${name} sub-theme`}
                  key={name}
                >
                  {name} <span>×</span>
                </button>
              ))}
              {inferredSubThemes.map((inferredSubTheme) => (
                <span className="suggested-subtheme" key={inferredSubTheme}>
                  <span>{inferredSubTheme}?</span>
                  <button
                    type="button"
                    onClick={() => chooseSubTheme(inferredSubTheme)}
                    aria-label={`Accept ${inferredSubTheme} sub-theme`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDismissedSubThemes((current) => [
                        ...current.filter(
                          (item) =>
                            !item.startsWith(`${inferredSubTheme}:`) && item !== inferredSubTheme,
                        ),
                        `${inferredSubTheme}:${deckCards.filter((card) => card.tags.includes(inferredSubTheme)).length}`,
                      ])
                    }
                    aria-label={`Dismiss ${inferredSubTheme} sub-theme`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {activeSubThemes.length < 2 && (
                <button
                  className="add-subtheme"
                  type="button"
                  onClick={() => setShowSubThemePicker((current) => !current)}
                >
                  + Choose sub-theme
                </button>
              )}
            </div>
            <div className="toolbar-actions">
              <button
                className="manual-card-button"
                type="button"
                onClick={() => openModal('search')}
              >
                + Add card by name
              </button>
              {(queue.length > 0 || deferredCards.length > 0) && recommendationState === 'idle' && (
                <div className="batch-controls">
                  <button className="primary" onClick={() => void nextBatch()}>
                    Next recommendations →
                  </button>
                </div>
              )}
            </div>
          </div>
          {showSubThemePicker && (
            <div className="subtheme-picker">
              <input
                value={subThemeSearch}
                onChange={(event) => setSubThemeSearch(event.target.value)}
                placeholder="Search sub-themes…"
                aria-label="Search sub-themes"
              />
              <div>
                {filteredSubThemes.slice(0, 8).map((name) => (
                  <button type="button" key={name} onClick={() => chooseSubTheme(name)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {deck.length >= 100 && (
            <div className="completion sideboard-completion">
              <p className="eyebrow">Main deck complete</p>
              <h2>Build your sideboard</h2>
              <p>Further picks go to sideboard. Move cards into main deck after removing a card.</p>
              <button className="primary" type="button" onClick={() => openModal('export')}>
                Review and export deck
              </button>
            </div>
          )}
          {recommendationState === 'loading' ? (
            <div className="recommendation-loading" role="status" aria-live="polite">
              <span className="loading-orb" aria-hidden="true" />
              <div>
                <p className="eyebrow">{recommendationLoadingTitle}</p>
                <h3>
                  {recommendationLoadingStep === 'commander'
                    ? 'Checking commander details…'
                    : 'Finding cards that work together…'}
                </h3>
                <ol>
                  <li className={recommendationLoadingStep === 'commander' ? 'active' : 'done'}>
                    Commander
                  </li>
                  <li className={recommendationLoadingStep === 'recommendations' ? 'active' : ''}>
                    Recommendations
                  </li>
                </ol>
              </div>
            </div>
          ) : recommendationState === 'error' ? (
            <div className="empty">
              <h3>Suggestions unavailable</h3>
              <p>{collectionError || 'Scryfall is busy. Try this commander again shortly.'}</p>
              <button className="primary" onClick={() => void start(commander)}>
                Retry
              </button>
            </div>
          ) : queue.length ? (
            <div
              className={`card-grid connector-glow juicy-fan ${cardEffects ? '' : 'static-fan'}`}
              onMouseMove={cardEffects ? fanCards : undefined}
              onMouseLeave={cardEffects ? resetFan : undefined}
            >
              {scoredBatch.map(({ card, score }, index) => (
                <article
                  className={`card-offer ${decisions[card.name] ?? ''} ${pairCards.includes(card) ? `synergy-pair synergy-${pairCards.indexOf(card) + 1}` : ''}`}
                  style={
                    {
                      '--fan-position': index - (scoredBatch.length - 1) / 2,
                      '--fan-drop': `${Math.abs(index - (scoredBatch.length - 1) / 2) * 7}px`,
                    } as CSSProperties
                  }
                  onClick={(event) => clickCardImage(event, card)}
                  key={card.name}
                >
                  {decisions[card.name] && (
                    <span className="decision-badge">
                      {decisions[card.name] === 'add'
                        ? sideboard.some((item) => item.name === card.name)
                          ? 'Added to sideboard'
                          : 'Added to deck'
                        : decisions[card.name] === 'later'
                          ? 'Later'
                          : 'Ignored'}
                    </span>
                  )}
                  <div className="offer-heading">
                    <h3 className="suggestion-type">{cardReason(card)}</h3>
                    {recommendedCard.card === card && (
                      <span className="recommended-badge">Recommended</span>
                    )}
                  </div>
                  <div className={`actions ${deck.length >= 100 ? 'sideboard-actions' : ''}`}>
                    <div>
                      <button
                        className="primary"
                        aria-pressed={decisions[card.name] === 'add'}
                        onClick={() => decide(card, 'add')}
                      >
                        {deck.length >= 100 && decisions[card.name] !== 'add' ? 'Sideboard' : 'Add'}
                      </button>
                      <span className="action-help-wrap">
                        <button
                          aria-pressed={decisions[card.name] === 'later'}
                          onClick={() => decide(card, 'later')}
                          aria-describedby={`later-${card.name}`}
                        >
                          Later
                        </button>
                        <span className="action-help" id={`later-${card.name}`} role="tooltip">
                          Skip for now. This card may return in a later batch.
                        </span>
                      </span>
                      <span className="action-help-wrap">
                        <button
                          className="quiet"
                          aria-pressed={decisions[card.name] === 'ignore'}
                          onClick={() => decide(card, 'ignore')}
                          aria-describedby={`ignore-${card.name}`}
                        >
                          Ignore
                        </button>
                        <span className="action-help" id={`ignore-${card.name}`} role="tooltip">
                          Remove this card from all future recommendations.
                        </span>
                      </span>
                    </div>
                    <span className="similar-wrap">
                      <button
                        className={`similar ${liked.includes(card.name) ? 'selected' : ''}`}
                        type="button"
                        disabled={decisions[card.name] === 'ignore'}
                        aria-pressed={liked.includes(card.name)}
                        onClick={() =>
                          setLiked((current) =>
                            current.includes(card.name)
                              ? current.filter((name) => name !== card.name)
                              : [...current, card.name],
                          )
                        }
                        aria-label={`Find more cards like ${card.name}`}
                        aria-describedby={`similar-${card.name}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                        </svg>
                      </button>
                      <span className="similar-help" id={`similar-${card.name}`} role="tooltip">
                        Prioritise similar cards in future recommendations.
                      </span>
                    </span>
                  </div>
                  <div className="offered-image">
                    <FinishedCardImage
                      image={card.image}
                      backImage={card.backImage}
                      alt={`${card.name} card`}
                      cardName={card.name}
                      finish={card.finish}
                      effectsEnabled={cardEffects}
                      hasSynergyGlow={pairCards.includes(card)}
                      className="card-face-image"
                      showFlipButton
                      printing={{
                        count: card.printings?.length ?? 0,
                        index: card.printing ?? 0,
                        loading: Boolean(loadingArt),
                        name: card.name,
                        onClick: () => void cyclePrinting(card),
                      }}
                    />
                    {pairCards.includes(card) && synergyPair && (
                      <span className="synergy-info">
                        <button type="button" aria-describedby={`synergy-${card.name}`}>
                          ⓘ Synergy
                        </button>
                        <span
                          className="synergy-popover"
                          id={`synergy-${card.name}`}
                          role="tooltip"
                        >
                          <strong>
                            {card.name} + {pairCards.find((item) => item !== card)?.name}
                          </strong>
                          <span>{synergyPair.explanation}.</span>
                        </span>
                      </span>
                    )}
                    <ArtLoading active={loadingArt === card.name} />
                  </div>
                  <div className="card-copy">
                    <h3>{card.name}</h3>
                    <p>
                      <OracleText text={card.detail} />
                    </p>
                    <CardDetails
                      card={card}
                      source={
                        limitedRecommendations || card.source === 'scryfall' || card.collectionMatch
                          ? { label: 'Scryfall', uri: cardScryfallUri(card) }
                          : {
                              label: 'EDHREC',
                              uri: `https://edhrec.com/cards/${edhrecSlug(undefined, card.name)}`,
                            }
                      }
                      onToggleSet={() => toggleCollectionSet(card.set)}
                      collectionSelected={
                        collectionMode !== 'none' && collectionSets.includes(card.set)
                      }
                    />
                    <ScoreBreakdown
                      score={score}
                      showPopularityPenalty={recommendationStyle === 'story'}
                      showCollection={collectionMode !== 'none' && collectionSets.length > 0}
                      showTheme={Boolean(theme)}
                      showSubThemes={activeSubThemes.length > 0}
                    />
                  </div>
                  {commanderPromotionInfo(card, deck, commanderDetails?.colours ?? []) && (
                    <CommanderPromotion
                      info={commanderPromotionInfo(card, deck, commanderDetails?.colours ?? [])!}
                      onPromote={() => void promoteToCommander(card)}
                    />
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>{deferredCards.length ? 'Suggestions resting' : 'No more suggestions'}</h3>
              <p>
                {deferredCards.length
                  ? 'Advance recommendations to keep their waiting period, then bring them back.'
                  : 'Review your deck or choose another commander.'}
              </p>
            </div>
          )}
          {healthSuggestions.length > 0 && (
            <section className="health-lane" aria-labelledby="health-lane-title">
              <div>
                <p className="eyebrow">Optional guidance</p>
                <h3 id="health-lane-title">Deck health suggestions</h3>
                <p>Story mode keeps these separate from your theme picks.</p>
              </div>
              <div className="health-suggestion-list">
                {healthSuggestions.map((card) => {
                  const role = rolesForCard(card).find((item) => missingHealthRoles.includes(item))
                  return (
                    <article key={card.name}>
                      <button
                        type="button"
                        className="health-card-open"
                        onClick={() => openGuidanceCard(card)}
                        aria-label={`View ${card.name} details`}
                      >
                        <span className="health-card-thumbnail">
                          <FinishedCardImage
                            image={card.image}
                            alt=""
                            finish={card.finish}
                            effectsEnabled={cardEffects}
                            className="health-card-thumbnail-image"
                          />
                        </span>
                        <span className="health-card-copy">
                          <span className="health-card-reason">
                            {role
                              ? targetLabels[role as keyof typeof targetLabels]
                              : 'Deck support'}
                          </span>
                          <b>{card.name}</b>
                        </span>
                      </button>
                      <span className="health-card-zoom">
                        <FinishedCardImage
                          image={card.image}
                          backImage={card.backImage}
                          alt={`${card.name} card`}
                          cardName={card.name}
                          finish={card.finish}
                          effectsEnabled={cardEffects}
                          className="health-card-full-image"
                          showFlipButton
                        />
                      </span>
                      <button
                        type="button"
                        className="health-card-add"
                        onClick={() => addRecommendationCard(card)}
                      >
                        Add
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </section>
        <aside className="analysis-panel">
          <section className="deck-analysis" aria-labelledby="analysis-title">
            <h3 id="analysis-title">Deck analysis</h3>
            <p className="sr-only" aria-live="polite">
              {highlightedManaValue === null
                ? 'Mana-value filter cleared.'
                : `Showing mana value ${highlightedManaValue === 7 ? '7 or more' : highlightedManaValue} cards.`}
            </p>
            <div className="curve-scroll">
              <div className="mana-curve" aria-label="Mana-value curve">
                {analysis.curve.map((point) => (
                  <button
                    type="button"
                    className={highlightedManaValue === point.manaValue ? 'selected' : ''}
                    onClick={() =>
                      setHighlightedManaValue((current) =>
                        current === point.manaValue ? null : point.manaValue,
                      )
                    }
                    aria-pressed={highlightedManaValue === point.manaValue}
                    aria-label={`Mana value ${point.manaValue === 7 ? '7 or more' : point.manaValue}: ${point.permanents} permanents, ${point.nonPermanents} non-permanents`}
                    key={point.manaValue}
                  >
                    <span className="curve-bars">
                      <i
                        className="permanent"
                        style={{ height: `${(point.permanents / maxCurveCount) * 100}%` }}
                      />
                      <i
                        className="non-permanent"
                        style={{ height: `${(point.nonPermanents / maxCurveCount) * 100}%` }}
                      />
                    </span>
                    <b>{point.manaValue === 7 ? '7+' : point.manaValue}</b>
                    {highlightedManaValue === point.manaValue && (
                      <span className="sr-only">Selected</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="curve-legend">
              <span>
                <i className="permanent" /> Permanent
              </span>
              <span>
                <i className="non-permanent" /> Non-permanent
              </span>
              <b>Avg {analysis.averageManaValue.toFixed(1)}</b>
            </div>
            <div className="mana-balance">
              <h4>Colour balance</h4>
              {(
                [
                  ['Pips', analysis.required],
                  ['Sources', analysis.produced],
                ] as const
              ).map(([label, values]) => (
                <div className="mana-balance-row" key={label}>
                  <span>{label}</span>
                  <div className="colour-bar">
                    {manaColours.some((colour) => values[colour] > 0) ? (
                      manaColours
                        .filter((colour) => values[colour] > 0)
                        .map((colour) => (
                          <span
                            className={`colour-segment colour-${colour.toLowerCase()}`}
                            style={{ flexGrow: values[colour] }}
                            title={`${colourNames[colour]}: ${values[colour]} ${label.toLowerCase()}`}
                            key={colour}
                          >
                            <img
                              src={`https://svgs.scryfall.io/card-symbols/${colour}.svg`}
                              alt=""
                            />
                            <b>
                              <span className="sr-only">{colourNames[colour]}: </span>
                              {values[colour]}
                            </b>
                          </span>
                        ))
                    ) : (
                      <span className="colour-empty">None</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="target-heading">
              <h4>Deck targets</h4>
              <span>
                Suggested lands {analysis.landRange[0]}-{analysis.landRange[1]}
              </span>
            </div>
            {representativeSpellCount < 5 && analysis.counts.lands < calculatedLandTarget ? (
              <p className="basic-land-wait">
                Add {5 - representativeSpellCount} more non-land{' '}
                {5 - representativeSpellCount === 1 ? 'card' : 'cards'} to calculate basic land
                colours.
              </p>
            ) : (
              basicLands.length > 0 && (
                <button
                  className="basic-land-button"
                  type="button"
                  onClick={() => {
                    setBasicLandState('idle')
                    openModal('basics')
                  }}
                >
                  <span>Fill to land target</span>
                  <b>+{basicLands.reduce((sum, land) => sum + land.count, 0)} basics</b>
                </button>
              )
            )}
            <div className="deck-targets">
              {targetKeys.map((key) => (
                <label key={key}>
                  <span className="bar-label">
                    <span>{targetLabels[key]}</span>
                    <span className="ratio-bar">
                      <i
                        style={{
                          width: `${Math.min(100, (analysis.counts[key] / Math.max(1, deckTargets[key])) * 100)}%`,
                        }}
                      />
                    </span>
                    <b>
                      {analysis.counts[key]} /{' '}
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={deckTargets[key]}
                        onChange={(event) =>
                          setDeckTargets((current) => ({
                            ...current,
                            [key]: Math.max(0, Number(event.target.value)),
                          }))
                        }
                        aria-label={`${targetLabels[key]} target`}
                      />
                    </b>
                  </span>
                </label>
              ))}
            </div>
            {displayedTypeCounts.some(([, count]) => count > 0) && (
              <>
                <h4>Card type distribution</h4>
                <div className="type-counts">
                  {displayedTypeCounts
                    .filter(([, count]) => count > 0)
                    .map(([type, count]) => (
                      <span key={type}>
                        <span className="bar-label">
                          <span>{type}</span>
                          <span className="ratio-bar">
                            <i style={{ width: `${(count / maxTypeCount) * 100}%` }} />
                          </span>
                          <b>{count}</b>
                        </span>
                      </span>
                    ))}
                </div>
              </>
            )}
            {guidance.length > 0 && (
              <div className="deck-guidance" aria-live="polite">
                {guidance.map((item) => (
                  <p className={item.strong ? 'strong' : ''} key={item.key}>
                    {item.text}
                  </p>
                ))}
              </div>
            )}
          </section>
        </aside>
        <section className="deck-board" aria-labelledby="deck-list-title">
          <div className="deck-board-heading">
            <div>
              <p className="eyebrow">Your deck</p>
              <h2 id="deck-list-title">{deck.length} cards</h2>
            </div>
            <div>
              <span>{deck.length}% complete</span>
              <button
                className="manual-card-button"
                ref={cardSearchButton}
                type="button"
                onClick={() => openModal('search')}
              >
                + Add card by name
              </button>
            </div>
          </div>
          <div className="meter">
            <span style={{ width: `${deck.length}%` }} />
          </div>
          <div className={`deck-list ${sideboard.length ? 'has-sideboard' : ''}`}>
            {groupedDeckColumns.map((column, columnIndex) => (
              <div className="deck-column" key={`deck-column-${columnIndex}`}>
                {column.map(({ section, cards, count }) => (
                  <section className="deck-group" key={section}>
                    <h3>
                      {section}
                      <span>{count}</span>
                    </h3>
                    <ol>
                      {cards.map(({ card, index }) => {
                        const curveValue = curveBucket(card)
                        const highlighted =
                          highlightedManaValue === null || highlightedManaValue === curveValue
                        return (
                          <li
                            className={highlighted ? '' : 'curve-dimmed'}
                            key={`${card.name}-${index}`}
                            tabIndex={0}
                            onMouseEnter={(event) =>
                              positionDeckPreview(event.currentTarget, event.clientX)
                            }
                            onFocus={(event) => positionDeckPreview(event.currentTarget)}
                          >
                            {highlightedManaValue !== null && highlighted && (
                              <span className="sr-only">Matches active mana-value filter. </span>
                            )}
                            <button
                              type="button"
                              className={`deck-card-name ${card.finish === 'foil' ? 'foil-card-name' : card.finish === 'etched' ? 'etched-card-name' : ''}`}
                              onClick={() => openDeckCard(card, { board: 'deck', index })}
                            >
                              {(card.printing ?? 0) > 0 && (
                                <span
                                  className="alternate-printing"
                                  title="Alternate printing selected"
                                  aria-label="Alternate printing selected"
                                />
                              )}
                              {card.name}
                              {card.finish && card.finish !== 'nonfoil' && (
                                <small className="finish-label">{card.finish}</small>
                              )}
                            </button>
                            <span className="deck-card-meta">
                              <span className="deck-mana">
                                {card.typeLine.includes('Land') && card.producedMana.length ? (
                                  <ManaSymbols symbols={card.producedMana} />
                                ) : (
                                  <OracleText text={card.manaCost} />
                                )}
                              </span>
                              {index >= commanderNames(commander).length && (
                                <span className="deck-remove-wrap">
                                  <button
                                    className={`deck-remove ${pendingRemoval === index ? 'confirm' : ''}`}
                                    type="button"
                                    onClick={() =>
                                      pendingRemoval === index
                                        ? removeDeckCard(index)
                                        : setPendingRemoval(index)
                                    }
                                    aria-label={
                                      pendingRemoval === index
                                        ? `Confirm removal of ${card.name}`
                                        : `Remove ${card.name}`
                                    }
                                  >
                                    {pendingRemoval === index ? '✓' : '×'}
                                  </button>
                                  {pendingRemoval === index && (
                                    <span className="remove-confirm" role="tooltip">
                                      Click again to confirm removal
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                            {card.image && (
                              <span className="deck-card-popover">
                                <FinishedCardImage
                                  image={card.image}
                                  backImage={card.backImage}
                                  alt={`${card.name} card`}
                                  cardName={card.name}
                                  finish={card.finish}
                                  effectsEnabled={cardEffects}
                                  className="deck-card-preview"
                                  showFlipButton
                                  printing={{
                                    count: card.printings?.length ?? 0,
                                    index: card.printing ?? 0,
                                    loading: Boolean(loadingArt),
                                    name: card.name,
                                    onClick: () => void cycleDeckPrinting(index),
                                  }}
                                />
                                <ArtLoading active={loadingArt === card.name} />
                              </span>
                            )}
                          </li>
                        )
                      })}
                      {section === 'Lands' && (
                        <>
                          {groupedBasics.map(({ name, cards: basics }) => {
                            const { card, index } = basics[0]
                            return (
                              <li className="basic-land-row" key={name}>
                                <button
                                  type="button"
                                  className="deck-card-name"
                                  onClick={() => openDeckCard(card, { board: 'deck', index })}
                                >
                                  <b className="card-quantity">{basics.length}x</b> {card.name}
                                </button>
                                <span className="deck-card-meta">
                                  <span className="deck-mana">
                                    <ManaSymbols symbols={card.producedMana} />
                                  </span>
                                  <button
                                    className="deck-add"
                                    type="button"
                                    disabled={deck.length >= 100}
                                    onClick={() => void addOneBasic(card.name)}
                                    aria-label={`Add another ${card.name}`}
                                  >
                                    +
                                  </button>
                                  <button
                                    className="deck-remove"
                                    type="button"
                                    onClick={() => removeDeckCard(index)}
                                    aria-label={`Remove one ${card.name}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              </li>
                            )
                          })}
                          {legalBasicNames
                            .filter((name) => !groupedBasics.some((group) => group.name === name))
                            .map((name) => (
                              <li className="basic-placeholder" key={name}>
                                <button
                                  type="button"
                                  disabled={deck.length >= 100}
                                  onClick={() => void addOneBasic(name)}
                                >
                                  <span>Add {name}</span>
                                  <b>+</b>
                                </button>
                              </li>
                            ))}
                        </>
                      )}
                    </ol>
                  </section>
                ))}
              </div>
            ))}
            {sideboard.length > 0 && (
              <section className="deck-column deck-group sideboard-column">
                <h3>
                  Sideboard<span>{sideboard.length}</span>
                </h3>
                <ol>
                  {sideboard.map((card, index) => (
                    <li
                      key={`${card.name}-${index}`}
                      tabIndex={0}
                      onMouseEnter={(event) =>
                        positionDeckPreview(event.currentTarget, event.clientX)
                      }
                      onFocus={(event) => positionDeckPreview(event.currentTarget)}
                    >
                      <button
                        type="button"
                        className={`deck-card-name ${card.finish === 'foil' ? 'foil-card-name' : card.finish === 'etched' ? 'etched-card-name' : ''}`}
                        onClick={() => openDeckCard(card, { board: 'sideboard', index })}
                      >
                        {card.name}
                        {card.finish && card.finish !== 'nonfoil' && (
                          <small className="finish-label">{card.finish}</small>
                        )}
                      </button>
                      <span className="deck-card-meta">
                        <button
                          className="sideboard-move"
                          type="button"
                          disabled={deck.length >= 100}
                          onClick={() => moveSideboardCard(index)}
                        >
                          Move to deck
                        </button>
                        <button
                          className="deck-remove"
                          type="button"
                          onClick={() => removeSideboardCard(index)}
                          aria-label={`Remove ${card.name} from sideboard`}
                        >
                          ×
                        </button>
                      </span>
                      {card.image && (
                        <span className="deck-card-popover">
                          <FinishedCardImage
                            image={card.image}
                            backImage={card.backImage}
                            alt={`${card.name} card`}
                            cardName={card.name}
                            finish={card.finish}
                            effectsEnabled={cardEffects}
                            className="deck-card-preview"
                            showFlipButton
                          />
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </section>
        <svg className="filter-definitions" aria-hidden="true">
          <filter
            id="etched-edges"
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix type="saturate" values="0" result="grey" />
            <feConvolveMatrix
              in="grey"
              order="3"
              kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
              preserveAlpha="true"
              result="edges"
            />
            <feColorMatrix in="edges" values="0 0 0 0 1 0 0 0 0 .88 0 0 0 0 .55 1 1 1 0 -.12" />
          </filter>
        </svg>
      </div>
    </main>
  )
}
