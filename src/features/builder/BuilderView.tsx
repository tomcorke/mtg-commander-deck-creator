import {
  useEffect,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import {
  cardScryfallUri,
  edhrecSlug,
  scryfallImage,
  type Card,
  type CommanderDetails,
  type DeckCard,
  type ScryfallCard,
} from '../../domain/card-model.ts'
import { commanderNames, colourNames } from '../../domain/commander-catalog.ts'
import { commanderPromotionInfo } from '../../domain/commander-promotion.ts'
import {
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
import type { DeckReviewFilter } from '../../deck-review.ts'
import { ArtLoading, FinishedCardImage } from '../../shared/CardArt.tsx'
import { CardDetails, ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { ManaSymbols, OracleText } from '../../shared/ManaSymbols.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { CommanderPromotion } from '../../shared/CommanderPromotion.tsx'
import { ScoreBreakdown } from '../score/ScoreBreakdown.tsx'
import { CommanderCardArt } from './CommanderCardArt.tsx'
import { ManaCurve } from './ManaCurve.tsx'
import { CommanderSummary } from './CommanderSummary.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'

type AnyFunction = (...args: any[]) => any

type BuilderViewModel = {
  [key: string]: any
  appHeader: ReactNode
  exportModal: ReactNode
  activeModal: string | null
  activeSubThemes: string[]
  analysis: ReturnType<typeof analyseDeck>
  basicLandState: 'idle' | 'loading' | 'error'
  basicLands: { name: string; count: number }[]
  batchAnnouncement: string
  batchNumber: number
  calculatedLandTarget: number
  collectionBrowserCards: ScryfallCard[]
  collectionBrowserError: string
  collectionBrowserMana: string
  collectionBrowserState: 'idle' | 'loading' | 'error'
  collectionBrowserType: string
  collectionError: string
  collectionMode: CollectionMode
  collectionPoolSize: number | null
  collectionSets: string[]
  collectionSetLabel: (code: string) => string
  commander: string
  commanderDetails: CommanderDetails | null
  deckReviewFilter: DeckReviewFilter | null
  decisions: Record<string, 'add' | 'later' | 'ignore'>
  deck: DeckCard[]
  deckCards: DeckCard[]
  deckTargets: DeckTargets
  deferredCards: DeferredCard<Card>[]
  displayedTypeCounts: readonly (readonly [string, number])[]
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
  maxTypeCount: number
  missingHealthRoles: string[]
  pairCards: Card[]
  pendingRemoval: number | null
  queue: Card[]
  recommendationLoadingStep: 'commander' | 'recommendations'
  recommendationLoadingTitle: string
  recommendationSettingsSummary: string
  recommendationState: 'idle' | 'loading' | 'error'
  recommendationStyle: RecommendationStyle
  recommendedCard: { card: Card | null; score: number }
  scoredBatch: { card: Card; score: RecommendationScoreBreakdown }[]
  search: string
  sideboard: DeckCard[]
  showBasicLands: boolean
  showCollectionBrowser: boolean
  showSubThemePicker: boolean
  subThemeSearch: string
  synergyPair: { cards: Card[]; explanation: string } | null
  theme: string
  toggleCollectionSet: (code: string) => void
  start: AnyFunction
  setActiveSubThemes: Dispatch<SetStateAction<string[]>>
  setBasicLandState: (value: 'idle' | 'loading' | 'error') => void
  setCollectionBrowserMana: Dispatch<SetStateAction<string>>
  setCollectionBrowserType: Dispatch<SetStateAction<string>>
  setDeckReviewFilter: Dispatch<SetStateAction<DeckReviewFilter | null>>
  setDeckTargets: Dispatch<SetStateAction<DeckTargets>>
  setDismissedSubThemes: Dispatch<SetStateAction<string[]>>
  setHighlightedManaValue: Dispatch<SetStateAction<number | null>>
  setLiked: Dispatch<SetStateAction<string[]>>
  setPendingRemoval: Dispatch<SetStateAction<number | null>>
  setRecommendationOptionsChanged: Dispatch<SetStateAction<boolean>>
  setShowCollectionBrowser: Dispatch<SetStateAction<boolean>>
  setShowSubThemePicker: Dispatch<SetStateAction<boolean>>
  setSubThemeSearch: Dispatch<SetStateAction<string>>
  setTheme: Dispatch<SetStateAction<string>>
}

function recommendationReason(
  card: Card,
  explanation: { label: string; sentence: string },
  selected: DeckCard[],
  onOpen: (card: DeckCard) => void,
) {
  const evidence = card.seedEvidence?.[0]
  if (!evidence || !card.reason.startsWith('Seen with ')) return explanation
  const seed = selected.find(({ name }) => name === evidence.seed)
  const decks = evidence.decks ? ` in ${evidence.decks.toLocaleString('en')} decks on EDHREC` : ''
  return {
    label: 'Deck engine',
    sentence: seed ? (
      <>
        Played with <CardReference card={seed} onOpen={() => onOpen(seed)} />
        {decks}, which is in your deck.
      </>
    ) : (
      'Often played with a card you picked earlier.'
    ),
  }
}

export function BuilderView({ model }: { model: BuilderViewModel }) {
  const { cardEffects, commanderStyling, darkMode } = useVisualPreferences()
  const {
    appHeader,
    exportModal,
    activeModal,
    activeSubThemes,
    addBasicLands,
    addCollectionCard,
    addOneBasic,
    addRecommendationCard,
    analysis,
    basicLandState,
    basicLands,
    batchAnnouncement,
    batchNumber,
    calculatedLandTarget,
    explainRecommendation,
    cardSearchButton,
    chooseSubTheme,
    clickCardImage,
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
    collectionSetLabel,
    commander,
    commanderDetails,
    cycleCommanderPrinting,
    cycleDeckPrinting,
    cyclePrinting,
    deckReviewFilter,
    decide,
    decisions,
    deck,
    deckCardModal,
    deckCards,
    deckDoctorHistory,
    deckTargets,
    deferredCards,
    edhrecRetryRemaining,
    displayedTypeCounts,
    fanCards,
    filteredCollectionCards,
    filteredSubThemes,
    groupedBasics,
    groupedDeckColumns,
    guidance,
    healthSuggestions,
    highlightedManaValue,
    importModal,
    inferredSubThemes,
    legalBasicNames,
    liked,
    limitedRecommendations,
    loadingArt,
    manaColours,
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
    pendingRemoval,
    positionDeckPreview,
    queue,
    recommendationLoadingStep,
    recommendationLoadingTitle,
    recommendationSettingsModal,
    recommendationSettingsSummary,
    recommendationState,
    recommendationStyle,
    recommendedCard,
    removeDeckCard,
    removeSideboardCard,
    resetFan,
    retryEdhrec,
    savedDecksModal,
    scoredBatch,
    setActiveSubThemes,
    setBasicLandState,
    setCollectionBrowserMana,
    setCollectionBrowserType,
    setDeckReviewFilter,
    setDeckDoctorError,
    setDeckTargets,
    setDismissedSubThemes,
    setHighlightedManaValue,
    setLiked,
    setPendingRemoval,
    setRecommendationOptionsChanged,
    setShowCollectionBrowser,
    setShowSubThemePicker,
    setSubThemeSearch,
    setTheme,
    showBasicLands,
    showCollectionBrowser,
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
  const reviewFilterNames = new Set(deckReviewFilter?.cardNames ?? [])
  const activeHighlightLabel =
    deckReviewFilter?.label ??
    (highlightedManaValue === null
      ? null
      : `mana value ${highlightedManaValue === 7 ? '7 or more' : highlightedManaValue}`)
  const highlightedCardCount = deckReviewFilter
    ? deck.filter((card) => reviewFilterNames.has(card.name)).length
    : highlightedManaValue === null
      ? 0
      : deck.filter((card) => curveBucket(card) === highlightedManaValue).length

  useEffect(() => {
    if (activeModal || !activeHighlightLabel) return
    document
      .getElementById('deck-list-title')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeHighlightLabel, activeModal])

  return (
    <main className={`${darkMode ? 'dark ' : ''}${commanderStyling ? 'commander-themed' : ''}`}>
      {commanderStyling && commanderDetails?.art.length ? (
        <div className="commander-backdrop" aria-hidden="true">
          {commanderDetails.art.map((image) => (
            <span style={{ backgroundImage: `url(${image})` }} key={image} />
          ))}
        </div>
      ) : null}
      {appHeader}
      {savedDecksModal}
      {importModal}
      {exportModal}
      {recommendationSettingsModal}
      <section className="intro commander-header">
        <CommanderCardArt
          commander={commander}
          commanderDetails={commanderDetails}
          loadingArt={loadingArt}
          openCommanderCard={openCommanderCard}
          cycleCommanderPrinting={cycleCommanderPrinting}
        />
        <CommanderSummary
          commander={commander}
          colours={commanderDetails?.colours ?? null}
          onOpenCommander={() => openCommanderCard(0)}
          onChangeCommander={startOver}
        />
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
            {collectionMode !== 'none' && collectionSets.length > 0 && (
              <div className="builder-set-chips">
                <span>{collectionMode === 'only' ? 'Only sets:' : 'Preferring sets:'}</span>
                {collectionSets.map((code) => (
                  <button
                    type="button"
                    key={code}
                    onClick={() => toggleCollectionSet(code)}
                    aria-label={`Stop building from ${collectionSetLabel(code)}`}
                    title={`Stop building from ${collectionSetLabel(code)}`}
                  >
                    {collectionSetLabel(code)} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
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
                      <div>
                        <SmallCardImage image={scryfallImage(card)} />
                      </div>
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
                className="export"
                type="button"
                onClick={() => {
                  setDeckDoctorError('')
                  openModal('review')
                }}
              >
                Deck review
              </button>
              <button
                className="manual-card-button"
                type="button"
                onClick={() => openModal('search')}
              >
                + Search & add cards
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
              <button className="primary" type="button" onClick={() => openModal('review')}>
                Review deck
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
              <button className="primary" type="button" onClick={() => void start(commander, true)}>
                Retry
              </button>
            </div>
          ) : queue.length ? (
            <div
              className={`card-grid connector-glow juicy-fan ${cardEffects ? '' : 'static-fan'}`}
              onMouseMove={cardEffects ? fanCards : undefined}
              onMouseLeave={cardEffects ? resetFan : undefined}
            >
              {scoredBatch.map(({ card, score }, index) => {
                const reason = recommendationReason(
                  card,
                  explainRecommendation(card),
                  [...deck, ...sideboard],
                  model.openCardReference,
                )
                return (
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
                      <p className="suggestion-type">{reason.label}</p>
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
                          {deck.length >= 100 && decisions[card.name] !== 'add'
                            ? 'Sideboard'
                            : 'Add'}
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
                          aria-describedby={`similar-${card.name}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                          </svg>
                          More like this
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
                      <p className="offer-reason">{reason.sentence}</p>
                      <p>
                        <OracleText text={card.detail} />
                      </p>
                      <CardDetails
                        card={card}
                        source={
                          limitedRecommendations ||
                          card.source === 'scryfall' ||
                          card.collectionMatch
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
                        showPopularityPenalty={recommendationStyle === 'thematic'}
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
                )
              })}
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
                <p>The thematic goal keeps these separate from your theme picks.</p>
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
            <div className="deck-analysis-heading">
              <h3 id="analysis-title">Deck analysis</h3>
              <div className="deck-analysis-actions">
                {deckDoctorHistory.length > 0 && (
                  <button
                    className="export"
                    type="button"
                    onClick={() => openModal('doctor-history')}
                  >
                    Change history ({deckDoctorHistory.length})
                  </button>
                )}
                <button className="export" type="button" onClick={() => openModal('review')}>
                  Deck review
                </button>
              </div>
            </div>
            <p className="sr-only" aria-live="polite">
              {activeHighlightLabel
                ? `${highlightedCardCount} cards highlighted for ${activeHighlightLabel}. Other cards are dimmed.`
                : 'Deck highlight filter cleared.'}
            </p>
            <ManaCurve
              analysis={analysis}
              selected={highlightedManaValue}
              onSelect={(manaValue) => {
                setDeckReviewFilter(null)
                setHighlightedManaValue((current) => (current === manaValue ? null : manaValue))
              }}
            />
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
            {basicLands.length > 0 && (
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
                + Search & add cards
              </button>
            </div>
          </div>
          {activeHighlightLabel && (
            <div className="deck-review-filter-status" role="status">
              <span>
                {highlightedCardCount} cards highlighted for {activeHighlightLabel}; other cards are
                dimmed.
              </span>
              <button
                className="export"
                type="button"
                onClick={() => {
                  setDeckReviewFilter(null)
                  setHighlightedManaValue(null)
                }}
              >
                Clear highlight
              </button>
            </div>
          )}
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
                          (!deckReviewFilter || reviewFilterNames.has(card.name)) &&
                          (highlightedManaValue === null || highlightedManaValue === curveValue)
                        return (
                          <li
                            className={highlighted ? '' : 'deck-highlight-dimmed'}
                            key={`${card.name}-${index}`}
                            tabIndex={0}
                            onMouseEnter={(event) =>
                              positionDeckPreview(event.currentTarget, event.clientX)
                            }
                            onFocus={(event) => positionDeckPreview(event.currentTarget)}
                          >
                            {activeHighlightLabel && highlighted && (
                              <span className="sr-only">
                                Matches active deck highlight filter.{' '}
                              </span>
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
