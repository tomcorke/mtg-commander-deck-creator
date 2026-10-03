import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import type { Card, CommanderDetails, DeckCard } from '../../domain/card-model.ts'
import {
  manualCardError,
  compareRecommendationScores,
  recommendationScoreRating,
  type RecommendationScoreRating,
} from '../../domain/recommendation-scoring.ts'
import type { RecommendationScoreBreakdown } from '../../domain/recommendation-types.ts'
import {
  analyseDeck,
  cardTypes,
  rolesForCard,
  targetKeys,
  targetLabels,
  type DeckTargets,
  type TargetKey,
} from '../../deck-analysis.ts'
import {
  analyzeDeckDoctor,
  deckReviewMode,
  groupDeckCards,
  type DeckDoctorFinding,
  type DeckDoctorSwapRecord,
} from '../../deck-doctor.ts'
import { simulateManaAccess } from '../../deck-simulation.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { CommanderCardArt } from './CommanderCardArt.tsx'
import { ManaSymbols, OracleText } from '../../shared/ManaSymbols.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { CommanderSummary } from './CommanderSummary.tsx'
import { DeckOverview } from './DeckOverview.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'

type DoctorCard = Card | DeckCard

type CardSelection = {
  checked: boolean
  label: string
  order?: number
  disabled?: boolean
  onChange: () => void
}

type CardQuantity = { value: number; max: number; onChange: (value: number) => void }

type Props = {
  appHeader: ReactNode
  showHistory: boolean
  commander: string
  commanderDetails: CommanderDetails | null
  loadingArt: string
  deck: DeckCard[]
  sideboard: DeckCard[]
  commanderCount: number
  commanderColours: string[]
  theme: string
  activeSubThemes: string[]
  deckTargets: DeckTargets
  setDeckTargets: Dispatch<SetStateAction<DeckTargets>>
  analysis: ReturnType<typeof analyseDeck>
  displayedTypeCounts: readonly (readonly [string, number])[]
  selectManaValue: (value: number) => void
  selectCards: (label: string, cardNames: string[]) => void
  recommendationSettingsSummary: string
  recommendationQueryKey: string
  recommendationOptionsChanged: boolean
  openRecommendationSettings: () => void
  candidates: Card[]
  scoreReplacements: (
    cards: Card[],
    remainingDeck: DeckCard[],
  ) => { card: Card; score: RecommendationScoreBreakdown }[]
  history: DeckDoctorSwapRecord[]
  error: string
  fetchCandidates: () => Promise<Card[]>
  fetchCommanderAlternatives: () => Promise<Card[]>
  openCard: (card: DoctorCard) => void
  cycleCommanderPrinting: (index: number) => void | Promise<void>
  startOver: () => void
  applySwapPlan: (
    cuts: { cutIndex: number; cutCard: DeckCard }[],
    additions: Card[],
    moveCutToSideboard: boolean,
  ) => boolean
  undoSwap: (id: string) => boolean
  closePage: () => void
}

function CardTile({
  card,
  status,
  openCard,
  note,
  fit,
  selection,
  quantity,
}: {
  card: DoctorCard
  status: string
  openCard: (card: DoctorCard) => void
  note?: string
  fit?: RecommendationScoreRating
  selection?: CardSelection
  quantity?: CardQuantity
}) {
  return (
    <article
      className={`doctor-card-tile${selection?.checked || quantity?.value ? ' selected' : ''}`}
    >
      {quantity && (
        <label className="doctor-card-select">
          <span>Cut</span>
          <input
            type="number"
            min="0"
            max={quantity.max}
            value={quantity.value}
            aria-label={`Copies of ${card.name} to cut`}
            onChange={(event) =>
              quantity.onChange(Math.min(quantity.max, Math.max(0, Number(event.target.value))))
            }
          />
          <span>of {quantity.max}</span>
        </label>
      )}
      {selection && (
        <label className="doctor-card-select">
          <input
            type="checkbox"
            checked={selection.checked}
            disabled={selection.disabled}
            aria-label={`${selection.label} ${card.name}`}
            onChange={selection.onChange}
          />
          <span>
            {selection.order ? `${selection.order}. ` : ''}
            {selection.label}
          </span>
        </label>
      )}
      <button
        className="doctor-card-art"
        type="button"
        aria-label={`Show details for ${card.name}`}
        onClick={() => openCard(card)}
      >
        {card.image ? <SmallCardImage image={card.image} /> : <span>No card art</span>}
      </button>
      <div className="doctor-card-copy">
        <span className={`doctor-card-status${status.startsWith('In deck') ? ' in-deck' : ''}`}>
          {status}
        </span>
        {fit && (
          <span className={`doctor-card-fit doctor-card-fit--${fit}`}>
            <span className="doctor-card-fit-stars" aria-hidden="true">
              {'★'.repeat(fitStars[fit])}
              {'☆'.repeat(5 - fitStars[fit])}
            </span>
            {fitLabels[fit]}
          </span>
        )}
        <CardReference card={card} onOpen={() => openCard(card)} />
        {card.manaCost && (
          <small className="doctor-card-cost">
            <OracleText text={card.manaCost} />
          </small>
        )}
        {note && <small>{note}</small>}
      </div>
    </article>
  )
}

const doctorCandidatePageSize = 12
const typeFilters = ['Land', ...cardTypes] as const

function cardTypeLines(card: DoctorCard) {
  return [card.typeLine, ...card.faces.map((face) => face.typeLine)]
}

/** Filters are `type:<Type>`, `role:<TargetKey>`, `tag:<Tag>`, or `all`. */
function matchesCardFilter(card: DoctorCard, filter: string) {
  const [kind, value] = filter.split(/:(.*)/)
  if (kind === 'type') return cardTypeLines(card).some((line) => line.includes(value))
  if (kind === 'role') return rolesForCard(card).includes(value as TargetKey)
  if (kind === 'tag') return card.tags.includes(value)
  return true
}
const fitLabels: Record<RecommendationScoreRating, string> = {
  top: 'Top fit',
  strong: 'Strong fit',
  recommended: 'Recommended',
  possible: 'Possible fit',
  low: 'Lower fit',
}
const fitStars: Record<RecommendationScoreRating, number> = {
  top: 5,
  strong: 4,
  recommended: 3,
  possible: 2,
  low: 1,
}

function hasCardError(card: Card, usedNames: string[], commanderColours: string[]) {
  return Boolean(
    manualCardError(
      {
        name: card.name,
        type_line: card.typeLine,
        color_identity: card.colorIdentity ?? [],
      },
      usedNames,
      commanderColours,
    ),
  )
}

export function DeckDoctorView({
  appHeader,
  showHistory,
  commander,
  commanderDetails,
  loadingArt,
  deck,
  sideboard,
  commanderCount,
  commanderColours,
  theme,
  activeSubThemes,
  deckTargets,
  setDeckTargets,
  analysis,
  displayedTypeCounts,
  selectManaValue,
  selectCards,
  recommendationSettingsSummary,
  recommendationQueryKey,
  recommendationOptionsChanged,
  openRecommendationSettings,
  candidates,
  scoreReplacements,
  history,
  error,
  fetchCandidates,
  fetchCommanderAlternatives,
  openCard,
  cycleCommanderPrinting,
  startOver,
  applySwapPlan,
  undoSwap,
  closePage,
}: Props) {
  const { commanderStyling, darkMode } = useVisualPreferences()
  const [candidateFetch, setCandidateFetch] = useState({
    key: '',
    state: 'idle',
    cards: [] as Card[],
    error: '',
  })
  const candidateRequest = useRef(0)
  const previousQueryKey = useRef(recommendationQueryKey)
  const currentFetch = candidateFetch.key === recommendationQueryKey
  const extraCandidates = currentFetch ? candidateFetch.cards : []
  const candidateState = currentFetch ? candidateFetch.state : 'idle'
  const candidateError = currentFetch ? candidateFetch.error : ''
  const [candidatePage, setCandidatePage] = useState(0)
  const [selectedCutIndexes, setSelectedCutIndexes] = useState<number[]>([])
  const [selectedAdditionNames, setSelectedAdditionNames] = useState<string[]>([])
  const [moveCutToSideboard, setMoveCutToSideboard] = useState(false)
  const [otherCutFilter, setOtherCutFilter] = useState('')
  const [candidateFilter, setCandidateFilter] = useState('all')
  const boardKey = JSON.stringify([deck.map(({ name }) => name), sideboard.map(({ name }) => name)])
  const previousBoards = useRef(boardKey)
  const [exploreCommanders, setExploreCommanders] = useState(false)
  const [commanderCandidates, setCommanderCandidates] = useState<Card[]>([])
  const [commanderState, setCommanderState] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle',
  )
  const [commanderError, setCommanderError] = useState('')
  const simulation = useMemo(
    () => simulateManaAccess({ deck, commanderCount }),
    [deck, commanderCount],
  )
  const findings = useMemo<DeckDoctorFinding[]>(
    () =>
      analyzeDeckDoctor({
        deck,
        sideboard,
        commanderCount,
        theme,
        activeSubThemes,
        deckTargets,
        simulation,
      }),
    [activeSubThemes, commanderCount, deck, deckTargets, sideboard, simulation, theme],
  )
  const candidatePool = [
    ...new Map(
      [...(recommendationOptionsChanged ? [] : candidates), ...extraCandidates].map((card) => [
        card.name,
        card,
      ]),
    ).values(),
  ]
  const usedNames = [...deck, ...sideboard].map(({ name }) => name)
  const availableCandidates = candidatePool.filter(
    (card) => !hasCardError(card, usedNames, commanderColours),
  )
  const ratedCandidates = scoreReplacements(
    availableCandidates.filter((card) => matchesCardFilter(card, candidateFilter)),
    deck.filter((_, index) => !selectedCutIndexes.includes(index)),
  ).sort((left, right) => compareRecommendationScores(left.score, right.score))
  const candidatePageCount = Math.ceil(ratedCandidates.length / doctorCandidatePageSize)
  const activeCandidatePage = Math.min(candidatePage, Math.max(0, candidatePageCount - 1))
  const pageStart = activeCandidatePage * doctorCandidatePageSize
  const visibleCandidates = ratedCandidates.slice(pageStart, pageStart + doctorCandidatePageSize)
  const flaggedNames = new Set(
    findings
      .filter(({ kind }) => kind === 'weak-connection' || kind === 'mana-outlier')
      .flatMap(({ cardNames }) => cardNames),
  )
  const mainDeckCards = deck.flatMap((card, index) =>
    index >= commanderCount ? [{ card, index }] : [],
  )
  const flaggedGroups = groupDeckCards(
    mainDeckCards.filter(({ card }) => flaggedNames.has(card.name)),
  )
  const otherCards = mainDeckCards.filter(({ card }) => !flaggedNames.has(card.name))
  const otherGroups = otherCutFilter
    ? groupDeckCards(otherCards.filter(({ card }) => matchesCardFilter(card, otherCutFilter)))
    : []
  const mode = deckReviewMode(deck.length)
  const requiredCuts = Math.max(0, deck.length - 100)
  const missingCards = Math.max(0, 100 - deck.length)
  const roleGaps = targetKeys.flatMap((key) => {
    const gap = deckTargets[key] - analysis.counts[key]
    return gap > 0 ? [{ key, gap }] : []
  })
  const selectedCuts = selectedCutIndexes.flatMap((cutIndex) => {
    const cutCard = deck[cutIndex]
    return cutCard ? [{ cutIndex, cutCard }] : []
  })
  const selectedAdditions = selectedAdditionNames.flatMap((name) => {
    const card = availableCandidates.find((candidate) => candidate.name === name)
    return card ? [card] : []
  })
  const pairCount = Math.min(selectedCuts.length, selectedAdditions.length)
  const projectedSize = deck.length - selectedCuts.length + selectedAdditions.length
  const commanderCards = deck.slice(0, commanderCount)
  const currentCommander = commanderCards[0]
  const commanderTitle = commanderCards.map(({ name }) => name).join(' // ') || commander
  const planReady =
    selectedCuts.length + selectedAdditions.length > 0 &&
    selectedCuts.length === selectedCutIndexes.length &&
    selectedAdditions.length === selectedAdditionNames.length
  const projectedDeck = planReady
    ? [...deck.filter((_, index) => !selectedCutIndexes.includes(index)), ...selectedAdditions]
    : null
  const projectedAnalysis = projectedDeck ? analyseDeck(projectedDeck) : null
  const selectedThemes = [theme, ...activeSubThemes].filter(Boolean)
  const themeCount = (cards: DoctorCard[]) =>
    cards
      .slice(commanderCount)
      .filter((card) => selectedThemes.some((tag) => card.tags.includes(tag))).length

  useEffect(() => {
    if (previousQueryKey.current === recommendationQueryKey) return
    previousQueryKey.current = recommendationQueryKey
    candidateRequest.current += 1
    setSelectedAdditionNames([])
    setCandidatePage(0)
  }, [recommendationQueryKey])

  useEffect(() => {
    if (!showHistory) return
    const frame = requestAnimationFrame(() =>
      document.getElementById('deck-review-history')?.scrollIntoView({ block: 'start' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [showHistory])

  useEffect(() => {
    if (previousBoards.current !== boardKey) {
      previousBoards.current = boardKey
      setSelectedCutIndexes([])
      setSelectedAdditionNames([])
    }
  }, [boardKey])

  function navigateSection(id: string) {
    const section = document.getElementById(id)
    section?.focus({ preventScroll: true })
    section?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  function toggleIndex(index: number, selected: number[], update: (value: number[]) => void) {
    update(
      selected.includes(index) ? selected.filter((item) => item !== index) : [...selected, index],
    )
  }

  function setGroupCuts(indexes: number[], count: number) {
    setSelectedCutIndexes((selected) => [
      ...selected.filter((index) => !indexes.includes(index)),
      ...indexes.slice(0, count),
    ])
  }

  function filterCandidates(filter: string) {
    setCandidateFilter(filter)
    setCandidatePage(0)
  }

  function cutGroupTile({ card, indexes }: { card: DeckCard; indexes: number[] }) {
    const flagged = flaggedNames.has(card.name)
    const status = flagged ? 'In deck · flagged' : 'In deck'
    if (indexes.length > 1)
      return (
        <CardTile
          key={card.name}
          card={card}
          status={`${status} · ×${indexes.length}`}
          openCard={openCard}
          quantity={{
            value: indexes.filter((index) => selectedCutIndexes.includes(index)).length,
            max: indexes.length,
            onChange: (count) => setGroupCuts(indexes, count),
          }}
        />
      )
    const [index] = indexes
    const selected = selectedCutIndexes.includes(index)
    return (
      <CardTile
        key={card.name}
        card={card}
        status={status}
        openCard={openCard}
        selection={{
          checked: selected,
          label: 'Cut',
          order: selected ? selectedCutIndexes.indexOf(index) + 1 : undefined,
          onChange: () => toggleIndex(index, selectedCutIndexes, setSelectedCutIndexes),
        }}
      />
    )
  }

  function toggleName(name: string) {
    setSelectedAdditionNames((selected) =>
      selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name],
    )
  }

  async function findMoreCandidates() {
    const request = ++candidateRequest.current
    const key = recommendationQueryKey
    setCandidateFetch({ key, state: 'loading', cards: extraCandidates, error: '' })
    try {
      const cards = await fetchCandidates()
      if (request === candidateRequest.current)
        setCandidateFetch({ key, state: 'done', cards, error: '' })
    } catch (error) {
      if (request !== candidateRequest.current) return
      setCandidateFetch({
        key,
        state: 'error',
        cards: extraCandidates,
        error: error instanceof Error ? error.message : 'Could not load more cards.',
      })
    }
  }

  async function findCommanderAlternatives(enabled: boolean) {
    setExploreCommanders(enabled)
    setCommanderCandidates([])
    setCommanderError('')
    if (!enabled) return
    setCommanderState('loading')
    try {
      setCommanderCandidates(await fetchCommanderAlternatives())
      setCommanderState('done')
    } catch (error) {
      setCommanderError(error instanceof Error ? error.message : 'Could not search commanders.')
      setCommanderState('error')
    }
  }

  function applyPlan() {
    if (!planReady) return
    if (applySwapPlan(selectedCuts, selectedAdditions, moveCutToSideboard)) {
      setSelectedCutIndexes([])
      setSelectedAdditionNames([])
    }
  }

  const cutSection = (
    <section className="doctor-selection-section" aria-labelledby="doctor-cuts-title">
      <div className="doctor-section-heading">
        <div>
          <p className="eyebrow">Choose what leaves</p>
          <h2 id="doctor-cuts-title">Select cuts</h2>
        </div>
        <span>
          {selectedCutIndexes.length}
          {requiredCuts ? ` of ${requiredCuts}` : ''} selected
        </span>
      </div>
      <p className="doctor-muted">
        {flaggedGroups.length
          ? 'Flagged cards appear first. Filter the rest of the main deck to choose other cuts.'
          : 'No cards are flagged. Filter the main deck by type or role to choose cuts.'}
      </p>
      {flaggedGroups.length > 0 && (
        <div className="doctor-card-grid">{flaggedGroups.map(cutGroupTile)}</div>
      )}
      <label className="doctor-filter">
        Other main-deck cards
        <select value={otherCutFilter} onChange={(event) => setOtherCutFilter(event.target.value)}>
          <option value="">Choose a type or role</option>
          <option value="all">All {otherCards.length} cards</option>
          <optgroup label="Card type">
            {typeFilters.map((type) => (
              <option key={type} value={`type:${type}`}>
                {type}
              </option>
            ))}
          </optgroup>
          <optgroup label="Role">
            {targetKeys.map((key) => (
              <option key={key} value={`role:${key}`}>
                {targetLabels[key]}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {otherCutFilter &&
        (otherGroups.length ? (
          <div className="doctor-card-grid">{otherGroups.map(cutGroupTile)}</div>
        ) : (
          <p className="doctor-muted">No other main-deck cards match this filter.</p>
        ))}
    </section>
  )

  return (
    <main
      id="deck-doctor-page"
      aria-labelledby="deck-review-title"
      className={`${darkMode ? 'dark ' : ''}deck-doctor-shell${commanderStyling ? ' commander-themed' : ''}`}
    >
      {commanderStyling && commanderDetails?.art.length ? (
        <div className="commander-backdrop" aria-hidden="true">
          {commanderDetails.art.map((image) => (
            <span style={{ backgroundImage: `url(${image})` }} key={image} />
          ))}
        </div>
      ) : null}
      {appHeader}
      <section className="intro commander-header doctor-context">
        <CommanderCardArt
          commander={commander}
          commanderDetails={commanderDetails}
          loadingArt={loadingArt}
          openCommanderCard={(index) => {
            const card = commanderCards[index]
            if (card) openCard(card)
          }}
          cycleCommanderPrinting={cycleCommanderPrinting}
        />
        <CommanderSummary
          commander={commanderTitle}
          colours={commanderDetails?.colours ?? null}
          headingLevel="h2"
          onOpenCommander={() => currentCommander && openCard(currentCommander)}
          onChangeCommander={startOver}
        />
        <div className="doctor-page-context">
          <div className="section-title">
            <div>
              <p className="eyebrow">Review and refine</p>
              <h1 id="deck-review-title">Deck review</h1>
            </div>
            <span>
              {findings.length} finding{findings.length === 1 ? '' : 's'} · {history.length} change
              {history.length === 1 ? '' : 's'}
            </span>
          </div>
          <p>
            Check the signals, tune the deck, and choose any swaps yourself. No suggested change is
            applied until you approve it.
          </p>
          <div className="doctor-context-status">
            <span>
              {sideboard.length} sideboard card{sideboard.length === 1 ? '' : 's'}
            </span>
            {theme && <span>Theme: {theme}</span>}
            {activeSubThemes.length > 0 && (
              <span>
                {activeSubThemes.length} selected sub-theme{activeSubThemes.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="doctor-page-actions">
            {showHistory && (
              <button
                className="export"
                type="button"
                onClick={() => navigateSection('doctor-diagnosis')}
              >
                Back to findings
              </button>
            )}
            <button className="primary" type="button" onClick={closePage}>
              Back to builder
            </button>
          </div>
        </div>
      </section>
      <div className={`doctor-page${planReady ? ' has-ready-plan' : ''}`}>
        <p className="doctor-intro">
          Findings are prompts, not cut decisions. Mana estimates simulate one drawn spell and one
          land drop per turn; they omit ramp, tapped-land timing, mulligans, and card effects. They
          are not win-rate or full-game predictions. You choose and approve any changes.
        </p>
        <div className="doctor-goal-settings">
          <p>
            <b>Recommendation settings:</b> {recommendationSettingsSummary}
            {recommendationOptionsChanged && (
              <span>
                {' '}
                · Refresh replacements below; the builder queue updates with the next
                recommendations.
              </span>
            )}
          </p>
          <button className="export" type="button" onClick={openRecommendationSettings}>
            Adjust goals and filters
          </button>
        </div>
        {mode !== 'review' && (
          <section className="doctor-readiness" aria-labelledby="doctor-readiness-title">
            <div className="doctor-section-heading">
              <div>
                <p className="eyebrow">
                  {deck.length} of 100 cards · {mode === 'build' ? 'Still building' : 'Over 100'}
                </p>
                <h2 id="doctor-readiness-title">
                  {mode === 'build'
                    ? `Add ${missingCards} more card${missingCards === 1 ? '' : 's'}`
                    : `Cut ${requiredCuts} card${requiredCuts === 1 ? '' : 's'} to reach 100`}
                </h2>
              </div>
              {mode === 'trim' && (
                <span>
                  {selectedCutIndexes.length} of {requiredCuts} selected
                </span>
              )}
            </div>
            {mode === 'build' ? (
              <>
                <p>
                  Fill role gaps first. Cuts are optional until the deck nears 100; the full review
                  starts at about 90 cards.
                </p>
                {roleGaps.length > 0 && (
                  <div className="doctor-gap-list">
                    {roleGaps.map(({ key, gap }) => (
                      <button
                        className="export"
                        type="button"
                        key={key}
                        aria-pressed={candidateFilter === `role:${key}`}
                        onClick={() => {
                          filterCandidates(`role:${key}`)
                          navigateSection('doctor-adds')
                        }}
                      >
                        {targetLabels[key]}: {analysis.counts[key]} of {deckTargets[key]} · add{' '}
                        {gap}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p>
                  Commander decks hold exactly 100 cards. Flagged cards are listed first; add
                  replacements only if you want to swap.
                </p>
                <button
                  className="export"
                  type="button"
                  onClick={() => navigateSection('doctor-changes')}
                >
                  Choose cuts
                </button>
              </>
            )}
          </section>
        )}
        <nav className="doctor-navigation" aria-label="Deck review sections">
          <button
            className="export"
            type="button"
            onClick={() => navigateSection('deck-review-overview')}
          >
            Overview
          </button>
          <button
            className="export"
            type="button"
            onClick={() => navigateSection('doctor-diagnosis')}
          >
            Findings
          </button>
          <button
            className="export"
            type="button"
            onClick={() => navigateSection('doctor-changes')}
          >
            Swap cards
          </button>
          <button
            className="export"
            type="button"
            onClick={() => navigateSection('deck-review-history')}
          >
            History ({history.length})
          </button>
        </nav>
        <div id="deck-review-overview" tabIndex={-1}>
          <DeckOverview
            deck={deck}
            sideboardCount={sideboard.length}
            commanderCount={commanderCount}
            commanderColours={commanderColours}
            theme={theme}
            activeSubThemes={activeSubThemes}
            analysis={analysis}
            deckTargets={deckTargets}
            setDeckTargets={setDeckTargets}
            displayedTypeCounts={displayedTypeCounts}
            selectManaValue={selectManaValue}
            selectCards={selectCards}
          />
        </div>
        <div className="doctor-workspace">
          <section
            id="doctor-diagnosis"
            tabIndex={-1}
            className="doctor-findings"
            aria-labelledby="doctor-diagnosis-title"
          >
            <div className="doctor-section-heading">
              <div>
                <p className="eyebrow">Grouped signals</p>
                <h2 id="doctor-diagnosis-title">Diagnosis</h2>
              </div>
              <span>
                {findings.length} finding{findings.length === 1 ? '' : 's'}
              </span>
            </div>
            {findings.length ? (
              findings.map((finding) => (
                <article className="doctor-finding" key={finding.id}>
                  <h3>{finding.title}</h3>
                  <p>{finding.summary}</p>
                  {finding.evidence.length > 0 && (
                    <ul>
                      {finding.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {finding.cardNames.length > 0 && (
                    <div className="doctor-reference-grid">
                      {finding.cardNames.map((name) => {
                        const card = deck.find((item) => item.name === name)
                        if (!card) return null
                        const signal = finding.cardSignals?.find(
                          (item) => item.cardName === card.name,
                        )
                        return (
                          <div className="doctor-reference-card" key={card.name}>
                            <span
                              className={`doctor-card-status${flaggedNames.has(card.name) ? ' in-deck' : ''}`}
                            >
                              {flaggedNames.has(card.name) ? 'In deck · flagged' : 'In deck'}
                            </span>
                            <CardReference card={card} onOpen={() => openCard(card)} />
                            {card.manaCost && (
                              <small className="doctor-card-cost">
                                <OracleText text={card.manaCost} />
                              </small>
                            )}
                            {signal && (
                              <details className="doctor-signal-details">
                                <summary>{signal.summary}</summary>
                                <ul>
                                  {signal.colourGaps.map(({ colour, required, sources }) => (
                                    <li key={colour}>
                                      <ManaSymbols symbols={[colour]} /> {required} pip
                                      {required === 1 ? '' : 's'}; {sources} reported source
                                      {sources === 1 ? '' : 's'}.
                                    </li>
                                  ))}
                                  {signal.simulation && (
                                    <li>
                                      When drawn, it was payable by turn {signal.simulation.turn} in{' '}
                                      {Math.round(signal.simulation.castableChance * 100)}% of
                                      simulated hands ({simulation.trials} trials).
                                    </li>
                                  )}
                                </ul>
                              </details>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="doctor-empty">
                No findings at the current settings. The heuristics cannot verify every interaction.
              </p>
            )}
          </section>

          <div id="doctor-changes" className="doctor-change-panel" tabIndex={-1}>
            {mode === 'build' ? (
              <details className="doctor-other-cuts">
                <summary>Optional: choose cards to cut</summary>
                {cutSection}
              </details>
            ) : (
              cutSection
            )}

            <section
              id="doctor-adds"
              tabIndex={-1}
              className="doctor-selection-section"
              aria-labelledby="doctor-adds-title"
            >
              <div className="doctor-section-heading">
                <div>
                  <p className="eyebrow">Shared replacement pool</p>
                  <h2 id="doctor-adds-title">Select additions</h2>
                </div>
                <span>{selectedAdditionNames.length} selected</span>
              </div>
              <p className="doctor-muted">
                Candidates are ranked for your goal and the deck after the selected cuts. Stars show
                fit, not power or win rate.
              </p>
              <label className="doctor-filter">
                Show candidates for
                <select
                  value={candidateFilter}
                  onChange={(event) => filterCandidates(event.target.value)}
                >
                  <option value="all">Any role or theme</option>
                  <optgroup label="Role">
                    {targetKeys.map((key) => {
                      const gap = roleGaps.find((item) => item.key === key)?.gap
                      return (
                        <option key={key} value={`role:${key}`}>
                          {targetLabels[key]}
                          {gap ? ` (${gap} below target)` : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                  {selectedThemes.length > 0 && (
                    <optgroup label="Theme">
                      {selectedThemes.map((tag) => (
                        <option key={tag} value={`tag:${tag}`}>
                          {tag}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {ratedCandidates.length ? (
                <>
                  <div
                    className="doctor-card-grid doctor-additions-grid"
                    role="region"
                    aria-label="Replacement candidates"
                  >
                    {visibleCandidates.map(({ card, score }) => {
                      const selected = selectedAdditionNames.includes(card.name)
                      return (
                        <CardTile
                          key={card.name}
                          card={card}
                          status="Replacement"
                          openCard={openCard}
                          note={[
                            card.reason,
                            score.theme > 0 && 'Matches your theme',
                            score.deckNeeds > 0 && 'Fills a needed role',
                            score.manaFitPenalty < 0 && 'Check mana support',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          fit={recommendationScoreRating(score.total)}
                          selection={{
                            checked: selected,
                            label: 'Add',
                            order: selected
                              ? selectedAdditionNames.indexOf(card.name) + 1
                              : undefined,
                            onChange: () => toggleName(card.name),
                          }}
                        />
                      )
                    })}
                  </div>
                  {candidatePageCount > 1 && (
                    <div className="doctor-candidate-pages">
                      <button
                        className="export"
                        type="button"
                        disabled={activeCandidatePage === 0}
                        onClick={() => setCandidatePage(activeCandidatePage - 1)}
                      >
                        Previous
                      </button>
                      <span aria-live="polite">
                        Page {activeCandidatePage + 1} of {candidatePageCount}
                      </span>
                      <button
                        className="export"
                        type="button"
                        disabled={activeCandidatePage === candidatePageCount - 1}
                        onClick={() => setCandidatePage(activeCandidatePage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="doctor-muted">
                  {candidateFilter === 'all'
                    ? 'No legal replacement cards in the current queue.'
                    : 'No legal candidates match this filter. Choose another or find more below.'}
                </p>
              )}
              <div className="doctor-more">
                <button
                  className="export"
                  type="button"
                  disabled={candidateState === 'loading'}
                  onClick={() => void findMoreCandidates()}
                >
                  {candidateState === 'loading'
                    ? 'Searching Scryfall and EDHREC…'
                    : candidateState === 'done'
                      ? 'Refresh legal recommendations'
                      : 'Find more legal replacements'}
                </button>
                {candidateError && (
                  <p className="doctor-error" role="status">
                    {candidateError}
                  </p>
                )}
              </div>
            </section>

            <section className="doctor-plan" aria-labelledby="doctor-plan-title">
              <div className="doctor-section-heading">
                <div>
                  <p className="eyebrow">Review before applying</p>
                  <h2 id="doctor-plan-title">Proposed changes</h2>
                </div>
                <span>
                  {selectedCutIndexes.length} cuts · {selectedAdditionNames.length} additions
                </span>
              </div>
              {pairCount > 0 && (
                <div className="doctor-plan-pairs">
                  {Array.from({ length: pairCount }, (_, index) => (
                    <div
                      className="doctor-plan-pair"
                      key={`${index}:${selectedCuts[index].cutCard.name}`}
                    >
                      <span className="doctor-pair-number">Swap {index + 1}</span>
                      <CardTile
                        card={selectedCuts[index].cutCard}
                        status="In deck · cut"
                        openCard={openCard}
                      />
                      <span className="doctor-pair-arrow" aria-hidden="true">
                        →
                      </span>
                      <CardTile
                        card={selectedAdditions[index]}
                        status="Replacement"
                        openCard={openCard}
                      />
                    </div>
                  ))}
                </div>
              )}
              {selectedCuts.length > pairCount && (
                <>
                  <h3>Cut without replacement</h3>
                  <div className="doctor-card-grid">
                    {selectedCuts.slice(pairCount).map(({ cutIndex, cutCard }) => (
                      <CardTile
                        key={cutIndex}
                        card={cutCard}
                        status="In deck · cut"
                        openCard={openCard}
                      />
                    ))}
                  </div>
                </>
              )}
              {selectedAdditions.length > pairCount && (
                <>
                  <h3>Add without cutting</h3>
                  <div className="doctor-card-grid">
                    {selectedAdditions.slice(pairCount).map((card) => (
                      <CardTile key={card.name} card={card} status="Addition" openCard={openCard} />
                    ))}
                  </div>
                </>
              )}
              {!selectedCutIndexes.length && !selectedAdditionNames.length ? (
                <p className="doctor-muted">Select cards to cut or add to review the plan.</p>
              ) : (
                <p className="doctor-muted" role="status">
                  Deck size after applying: {deck.length} → {projectedSize} cards
                  {projectedSize < 100
                    ? ` (${100 - projectedSize} short of 100)`
                    : projectedSize > 100
                      ? ` (${projectedSize - 100} over 100)`
                      : ''}
                  .
                </p>
              )}
              {projectedDeck && projectedAnalysis && (
                <div className="doctor-impact" role="status">
                  <h3>After these changes</h3>
                  <p>
                    {targetKeys.map((role) => (
                      <span key={role}>
                        {targetLabels[role]}: {analysis.counts[role]} →{' '}
                        {projectedAnalysis.counts[role]}
                        {projectedAnalysis.counts[role] < deckTargets[role] &&
                          projectedAnalysis.counts[role] < analysis.counts[role] &&
                          ' (below your target)'}
                      </span>
                    ))}
                    {selectedThemes.length > 0 && (
                      <span>
                        Theme matches: {themeCount(deck)} → {themeCount(projectedDeck)}
                      </span>
                    )}
                  </p>
                </div>
              )}
              <label className="doctor-checkbox">
                <input
                  type="checkbox"
                  checked={moveCutToSideboard}
                  onChange={(event) => setMoveCutToSideboard(event.target.checked)}
                />
                Move cut cards to the sideboard
              </label>
              {error && (
                <p className="doctor-error" role="status">
                  {error}
                </p>
              )}
            </section>
          </div>
        </div>

        <section className="doctor-commander" aria-labelledby="doctor-commander-title">
          <div className="doctor-section-heading">
            <div>
              <p className="eyebrow">Optional comparison</p>
              <h2 id="doctor-commander-title">Try another commander</h2>
            </div>
          </div>
          {commanderCount > 1 ? (
            <p>
              Partner-pair alternatives are not compared. Your current commanders stay unchanged.
            </p>
          ) : !theme && !activeSubThemes.length ? (
            <p>Select a theme or sub-theme to compare commander options.</p>
          ) : (
            <>
              <label className="doctor-checkbox">
                <input
                  type="checkbox"
                  checked={exploreCommanders}
                  onChange={(event) => void findCommanderAlternatives(event.target.checked)}
                />
                Compare theme-compatible commanders (deck remains unchanged)
              </label>
              {exploreCommanders && (
                <div className="doctor-commander-results" aria-live="polite">
                  {commanderState === 'loading' && <p>Searching Commander-legal options…</p>}
                  {commanderState === 'error' && <p className="doctor-error">{commanderError}</p>}
                  {commanderState === 'done' && commanderCandidates.length === 0 && (
                    <p>No Commander-legal alternative found for this theme and deck identity.</p>
                  )}
                  {commanderCandidates.map((candidate) => {
                    const candidateColours = candidate.colorIdentity ?? []
                    const added = candidateColours.filter(
                      (colour) => !commanderColours.includes(colour),
                    )
                    const removed = commanderColours.filter(
                      (colour) => !candidateColours.includes(colour),
                    )
                    return (
                      <article className="doctor-commander-option" key={candidate.name}>
                        <div className="doctor-commander-pair">
                          {currentCommander && (
                            <CardTile
                              card={currentCommander}
                              status="In deck"
                              openCard={openCard}
                            />
                          )}
                          <span className="doctor-pair-arrow" aria-hidden="true">
                            →
                          </span>
                          <CardTile card={candidate} status="Alternative" openCard={openCard} />
                        </div>
                        <p>
                          {added.length ? (
                            <>
                              Adds <ManaSymbols symbols={added} /> to identity.{' '}
                            </>
                          ) : null}
                          {removed.length ? (
                            <>
                              Drops unused <ManaSymbols symbols={removed} />.
                            </>
                          ) : (
                            'Keeps the current colour access.'
                          )}
                        </p>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
        <section
          id="deck-review-history"
          tabIndex={-1}
          className="doctor-history"
          aria-labelledby="history-title"
        >
          <div className="doctor-section-heading">
            <div>
              <p className="eyebrow">Your changes</p>
              <h2 id="history-title">Change history</h2>
            </div>
            <span>{history.length} applied</span>
          </div>
          {history.length ? (
            history.map((swap) => (
              <article className="doctor-history-item" key={swap.id}>
                <div className="doctor-history-pair">
                  {swap.cutCard && (
                    <CardTile
                      card={swap.cutCard}
                      status={swap.movedToSideboard ? 'Moved to sideboard' : 'Cut from deck'}
                      openCard={openCard}
                    />
                  )}
                  {swap.cutCard && swap.addedCard && (
                    <span className="doctor-pair-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                  {swap.addedCard && (
                    <CardTile card={swap.addedCard} status="In deck" openCard={openCard} />
                  )}
                </div>
                <button
                  className="export"
                  type="button"
                  onClick={() => undoSwap(swap.id)}
                  aria-label={
                    swap.cutCard && swap.addedCard
                      ? `Undo ${swap.addedCard.name} for ${swap.cutCard.name}`
                      : swap.addedCard
                        ? `Undo adding ${swap.addedCard.name}`
                        : `Undo cutting ${swap.cutCard?.name}`
                  }
                >
                  Undo this change
                </button>
              </article>
            ))
          ) : (
            <p className="doctor-muted">No changes applied yet.</p>
          )}
          {error && (
            <p className="doctor-error" role="status">
              {error}
            </p>
          )}
        </section>
      </div>
      {planReady && (
        <div className="doctor-apply-bar" role="region" aria-label="Ready to apply changes">
          <button className="primary doctor-apply" type="button" onClick={applyPlan}>
            Apply {selectedCutIndexes.length + selectedAdditionNames.length} change
            {selectedCutIndexes.length + selectedAdditionNames.length === 1 ? '' : 's'} · deck
            becomes {projectedSize}
          </button>
        </div>
      )}
    </main>
  )
}
