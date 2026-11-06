import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import { searchScryfallPage } from '../../adapters/scryfall.ts'
import { Pagination } from '../../shared/Pagination.tsx'
import { pageWindow, searchPageSize } from '../../shared/pagination.ts'
import {
  toDeckCard,
  type CommanderDetails,
  type DeckCard,
  type ScryfallCard,
} from '../../domain/card-model.ts'
import { colourNames } from '../../domain/commander-catalog.ts'
import {
  buildCardSearchQuery,
  cardSearchError,
  cardSearchKeywords,
  cardSearchManaOptions,
  defaultCardSearchFilters,
  roleSearchTags,
  type CardSearchFilters,
  type SearchRole,
  type SearchMatch,
} from '../../domain/card-search.ts'
import { targetLabels, type DeckTargets } from '../../deck-analysis.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { OracleText } from '../../shared/ManaSymbols.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { CardTile } from '../../shared/CardTile.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { CommanderCardArt } from './CommanderCardArt.tsx'
import { CommanderSummary } from './CommanderSummary.tsx'
import { mergeSearchCards } from './interactions.ts'

type SearchRequest = { query: string; order: string; page: number; signature: string }
type Props = {
  active: boolean
  appHeader: ReactNode
  commander: string
  commanderDetails: CommanderDetails | null
  loadingArt: string
  deck: DeckCard[]
  sideboard: DeckCard[]
  excludeUnreleased: boolean
  today: string
  cycleCommanderPrinting: (index: number) => void
  changeCommander: ReactNode
  openCommander: (index: number) => void
  openCard: (card: ScryfallCard) => void
  addCards: (cards: ScryfallCard[]) => string
  closePage: () => void
  /** Main-deck size an add fills before the rest goes to the sideboard. */
  mainLimit: number
  zoneToggle: ReactNode
  /** Current role counts and targets, shown beside the deck-need filters. */
  roleCounts: DeckTargets
  deckTargets: DeckTargets
}

const matchLabels: Record<SearchMatch, string> = { any: 'Any', need: 'Must', exclude: 'Not' }

/** One-click Any / Must / Not choice, styled like the add-zone toggle. */
function MatchToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: SearchMatch
  onChange: (match: SearchMatch) => void
}) {
  return (
    <div className="add-zone-toggle search-match" role="group" aria-label={`${label} match`}>
      {(['any', 'need', 'exclude'] as const).map((option) => (
        <button
          key={option}
          type="button"
          data-match={option}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {matchLabels[option]}
        </button>
      ))}
    </div>
  )
}

/** Collapsible filter list; opens itself while any of its filters are set. */
function FilterGroup({
  title,
  active,
  children,
}: {
  title: string
  active: number
  children: ReactNode
}) {
  return (
    <details className="search-filter-group" open={active > 0 || undefined}>
      <summary className="filter-heading">
        {title}
        {active > 0 && <span className="search-active-count">{active} active</span>}
      </summary>
      {children}
    </details>
  )
}

function DeckNeeds({
  filters,
  match,
  roleCounts,
  deckTargets,
}: {
  filters: CardSearchFilters
  match: (label: string, value: SearchMatch) => void
  roleCounts: DeckTargets
  deckTargets: DeckTargets
}) {
  return (
    <fieldset className="search-deck-needs">
      <legend className="filter-heading">Deck needs</legend>
      {(Object.keys(roleSearchTags) as SearchRole[]).map((role) => (
        <div className="search-need-row" key={role}>
          <span>{targetLabels[role]}</span>
          <MatchToggle
            label={targetLabels[role]}
            value={filters.matches[role] ?? 'any'}
            onChange={(value) => match(role, value)}
          />
          <span className="search-need-progress">
            <span className="ratio-bar" aria-hidden="true">
              <i
                style={{
                  width: `${Math.min(100, (roleCounts[role] / Math.max(1, deckTargets[role])) * 100)}%`,
                }}
              />
            </span>
            <b className="search-need-count">
              {roleCounts[role]}/{deckTargets[role]}
              <span className="sr-only"> in deck</span>
            </b>
          </span>
        </div>
      ))}
      <p>Bars show your deck against its role targets. Roles use Scryfall tags.</p>
      <p>Any ignores a filter. Cards must match all filters set to Must and none set to Not.</p>
    </fieldset>
  )
}

// eslint-disable-next-line max-lines-per-function -- Filter controls remain together as one existing UI section.
function SearchFilters({
  filters,
  setFilters,
  colours,
  roleCounts,
  deckTargets,
}: {
  filters: CardSearchFilters
  setFilters: Dispatch<SetStateAction<CardSearchFilters>>
  colours: string[]
  roleCounts: DeckTargets
  deckTargets: DeckTargets
}) {
  // Drop cleared filters so switching back to Any doesn't count as a filter change.
  const match = (label: string, value: SearchMatch) =>
    setFilters((current) => {
      const { [label]: _, ...matches } = current.matches
      return { ...current, matches: value === 'any' ? matches : { ...matches, [label]: value } }
    })
  const active = (labels: string[]) =>
    labels.filter((label) => (filters.matches[label] ?? 'any') !== 'any').length
  const manaOptions = cardSearchManaOptions(
    filters.filterIdentity ? colours : ['W', 'U', 'B', 'R', 'G'],
  )
  return (
    <>
      <DeckNeeds
        filters={filters}
        match={match}
        roleCounts={roleCounts}
        deckTargets={deckTargets}
      />
      <div className="search-text-field">
        <label htmlFor="search-name">Name</label>
        <MatchToggle
          label="Name"
          value={filters.nameMatch}
          onChange={(nameMatch) => setFilters((current) => ({ ...current, nameMatch }))}
        />
        <input
          id="search-name"
          autoFocus
          value={filters.name}
          autoComplete="off"
          placeholder="Any name"
          onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
        />
      </div>
      <div className="search-text-field">
        <label htmlFor="search-type">Type or subtype</label>
        <MatchToggle
          label="Type or subtype"
          value={filters.typeLineMatch}
          onChange={(typeLineMatch) => setFilters((current) => ({ ...current, typeLineMatch }))}
        />
        <input
          id="search-type"
          value={filters.typeLine}
          autoComplete="off"
          placeholder="e.g. Saga, Zombie"
          aria-describedby="search-text-help"
          onChange={(event) =>
            setFilters((current) => ({ ...current, typeLine: event.target.value }))
          }
        />
      </div>
      <label className="search-field">
        Rules text contains
        <input
          value={filters.rulesNeed}
          placeholder="e.g. draw a card"
          aria-describedby="search-text-help"
          onChange={(event) =>
            setFilters((current) => ({ ...current, rulesNeed: event.target.value }))
          }
        />
      </label>
      <label className="search-field">
        Rules text excludes
        <input
          value={filters.rulesExclude}
          placeholder="e.g. discard"
          aria-describedby="search-text-help"
          onChange={(event) =>
            setFilters((current) => ({ ...current, rulesExclude: event.target.value }))
          }
        />
      </label>
      <p id="search-text-help">
        Rules text means Oracle wording, not flavour text. Separate phrases with commas.
      </p>
      <fieldset>
        <legend className="filter-heading">Mana value</legend>
        <div className="search-value-bounds">
          <label className="search-field">
            Minimum
            <input
              aria-label="Minimum mana value"
              type="number"
              min="0"
              step="any"
              placeholder="Any"
              value={filters.minimumManaValue}
              onChange={(event) =>
                setFilters((current) => ({ ...current, minimumManaValue: event.target.value }))
              }
            />
          </label>
          <label className="search-field">
            Maximum
            <input
              aria-label="Maximum mana value"
              type="number"
              min="0"
              step="any"
              placeholder="Any"
              value={filters.maximumManaValue}
              onChange={(event) =>
                setFilters((current) => ({ ...current, maximumManaValue: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="search-filter-row">
          <span>Within range</span>
          <MatchToggle
            label="Mana value"
            value={filters.manaValueMatch}
            onChange={(manaValueMatch) => setFilters((current) => ({ ...current, manaValueMatch }))}
          />
        </div>
        <p>Bounds are inclusive. X counts as 0.</p>
      </fieldset>
      <label className="search-checkbox">
        <input
          type="checkbox"
          checked={filters.filterIdentity}
          onChange={(event) =>
            setFilters((current) => ({ ...current, filterIdentity: event.target.checked }))
          }
        />
        Limit results to commander identity
      </label>
      <FilterGroup
        title="Mana colours & costs"
        active={active(manaOptions.map(({ label }) => label))}
      >
        {manaOptions.map(({ label, symbol }) => (
          <div className="search-filter-row" key={label}>
            <span>
              {symbol && <OracleText text={symbol} />}
              {colourNames[label] ?? label}
            </span>
            <MatchToggle
              label={colourNames[label] ?? label}
              value={filters.matches[label] ?? 'any'}
              onChange={(value) => match(label, value)}
            />
          </div>
        ))}
        <p>
          Colours match cost symbols, including hybrid and Phyrexian mana. Colourless cards match
          card colour, not mana produced.
        </p>
      </FilterGroup>
      <FilterGroup
        title="Keywords & effects"
        active={active(cardSearchKeywords.map(({ label }) => label))}
      >
        {cardSearchKeywords.map(({ label }) => (
          <div className="search-filter-row" key={label}>
            <span>{label}</span>
            <MatchToggle
              label={label}
              value={filters.matches[label] ?? 'any'}
              onChange={(value) => match(label, value)}
            />
          </div>
        ))}
        <p>
          Keywords can include granted abilities. Effects use Scryfall tags or rules text; a match
          does not guarantee an interaction.
        </p>
      </FilterGroup>
    </>
  )
}

function SearchCard({
  card,
  location,
  error,
  selected,
  onSelect,
  onOpen,
  onAdd,
  fullDeck,
}: {
  card: ScryfallCard
  location: string
  error: string
  selected: boolean | null
  onSelect: () => void
  onOpen: () => void
  onAdd: () => void
  fullDeck: boolean
}) {
  const display = toDeckCard(card)
  return (
    <CardTile
      className={`search-card${location ? ' already-in-deck' : ''}`}
      selected={Boolean(selected)}
      selection={
        selected !== null && (
          <label className="search-checkbox">
            <input
              type="checkbox"
              checked={selected}
              disabled={Boolean(error)}
              aria-label={`Select ${card.name}`}
              onChange={onSelect}
            />
            Select
          </label>
        )
      }
      art={
        <button
          className="search-card-art"
          type="button"
          aria-label={`View ${card.name} card`}
          onClick={onOpen}
        >
          {display.image ? <SmallCardImage image={display.image} /> : 'No card art'}
        </button>
      }
      badges={location && <strong className="search-card-location">{location}</strong>}
      name={<CardReference card={display} onOpen={onOpen} />}
      cost={display.manaCost || display.faces[0]?.manaCost}
      detail={display.typeLine}
      actions={
        <button
          type="button"
          className="export"
          disabled={Boolean(error)}
          title={error || undefined}
          onClick={onAdd}
        >
          {error && location
            ? 'Already added'
            : fullDeck
              ? 'Add to sideboard'
              : location
                ? 'Add another'
                : 'Add to deck'}
        </button>
      }
    >
      <details>
        <summary>Rules text</summary>
        <p className="search-card-rules">
          <OracleText text={display.detail} />
        </p>
      </details>
      {error && !location && <p className="search-card-error">{error}</p>}
    </CardTile>
  )
}

function cardLocation(name: string, deck: DeckCard[], sideboard: DeckCard[]) {
  const main = deck.filter((card) => card.name === name).length
  const side = sideboard.filter((card) => card.name === name).length
  return [main ? `In deck (${main})` : '', side ? `In sideboard (${side})` : '']
    .filter(Boolean)
    .join(' · ')
}

// eslint-disable-next-line max-lines-per-function -- The existing search workflow markup stays intact.
export function CardSearchView({
  active,
  appHeader,
  commander,
  commanderDetails,
  loadingArt,
  deck,
  sideboard,
  excludeUnreleased,
  today,
  cycleCommanderPrinting,
  changeCommander,
  openCommander,
  openCard,
  addCards,
  closePage,
  mainLimit,
  zoneToggle,
  roleCounts,
  deckTargets,
}: Props) {
  const { darkMode, commanderStyling } = useVisualPreferences()
  const [filters, setFilters] = useState(defaultCardSearchFilters)
  const [order, setOrder] = useState('name')
  const [includeExisting, setIncludeExisting] = useState(false)
  const [request, setRequest] = useState<SearchRequest | null>(null)
  const [cards, setCards] = useState<ScryfallCard[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [bulk, setBulk] = useState(false)
  // First card shown, so a column-count change keeps the current cards in view.
  const [first, setFirst] = useState(0)
  const [columns, setColumns] = useState(4)
  const gridObserver = useRef<ResizeObserver | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const colours = commanderDetails?.colours ?? []
  const mainSlots = Math.max(0, mainLimit - deck.length)
  const targetBoard = mainSlots ? deck : sideboard
  const usedNames = [...deck, ...sideboard].map(({ name }) => name)
  const available = cards.filter((card) => includeExisting || !usedNames.includes(card.name))
  const pageSize = searchPageSize(columns)
  const page = Math.floor(first / pageSize)
  const { start, end } = pageWindow(available.length, pageSize, page)
  const hidden = cards.length - available.length
  const visible = available.slice(start, end)
  const selected = cards.filter(
    (card) => selectedNames.includes(card.name) && !cardSearchError(card, targetBoard, colours),
  )
  const signature = JSON.stringify({ filters, order })
  const filtersSet =
    signature !== JSON.stringify({ filters: defaultCardSearchFilters, order: 'name' })

  useEffect(() => {
    if (!active || !returnFocus.current) return
    const target = returnFocus.current.isConnected ? returnFocus.current : resultsHeading.current
    target?.focus()
    returnFocus.current = null
  }, [active])

  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    controllerRef.current = controller
    void searchScryfallPage(request.query, fetch, controller.signal, request.order, request.page)
      .then((result) => {
        if (controller.signal.aborted) return
        setCards((current) => mergeSearchCards(current, result.data, request.page === 1))
        setTotal(result.total_cards ?? result.data.length)
        setHasMore(Boolean(result.has_more))
        setWarnings(result.warnings ?? [])
        setStatus('idle')
      })
      .catch((reason) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Search unavailable. Try again.')
        setStatus('error')
      })
    return () => controller.abort()
  }, [request])

  function search() {
    try {
      const query = buildCardSearchQuery(filters, colours, excludeUnreleased, today)
      controllerRef.current?.abort()
      setCards([])
      setSelectedNames([])
      setFirst(0)
      setHasMore(false)
      setTotal(0)
      setWarnings([])
      setError('')
      setNotice('')
      setStatus('loading')
      setRequest({ query, order, page: 1, signature })
      // On stacked layouts the results start below the filters; bring them into view.
      const heading = resultsHeading.current
      if (heading && heading.getBoundingClientRect().top > innerHeight)
        heading.scrollIntoView({ block: 'start' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invalid filters.')
    }
  }

  function add(chosen: ScryfallCard[]) {
    const failure = addCards(chosen)
    if (failure) {
      setError(failure)
      return
    }
    const mainCount = Math.min(chosen.length, mainSlots)
    setNotice(`Added ${mainCount} to deck and ${chosen.length - mainCount} to sideboard.`)
    setError('')
    setSelectedNames((current) =>
      current.filter((name) => !chosen.some((card) => card.name === name)),
    )
  }

  function loadMore() {
    if (!request) return
    setStatus('loading')
    setError('')
    setRequest({ ...request, page: request.page + 1 })
  }

  function observeGrid(grid: HTMLDivElement | null) {
    gridObserver.current?.disconnect()
    if (!grid) return
    gridObserver.current = new ResizeObserver(() =>
      setColumns(getComputedStyle(grid).gridTemplateColumns.split(' ').length),
    )
    gridObserver.current.observe(grid)
  }

  function goToPage(next: number) {
    setFirst(next * pageSize)
    resultsHeading.current?.focus()
    resultsHeading.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <main
      className={`card-search-shell${darkMode ? ' dark' : ''}${commanderStyling ? ' commander-themed' : ''}`}
    >
      {appHeader}
      <section className="intro commander-header">
        <CommanderCardArt
          commander={commander}
          commanderDetails={commanderDetails}
          loadingArt={loadingArt}
          openCommanderCard={openCommander}
          cycleCommanderPrinting={cycleCommanderPrinting}
        />
        <CommanderSummary
          commander={commander}
          colours={commanderDetails?.colours ?? null}
          onOpenCommander={() => openCommander(0)}
          changeCommander={changeCommander}
        />
        <div className="search-page-context">
          <p className="eyebrow">Card discovery</p>
          <h1>Search & add cards</h1>
          <p>
            {deck.length}/100 in deck · {sideboard.length} in sideboard. Search stays open while you
            add cards.
          </p>
          <button className="nav-back" type="button" onClick={closePage}>
            Back to builder
          </button>
        </div>
      </section>
      <div className={`card-search-workspace${selected.length ? ' has-selection' : ''}`}>
        <form
          className="card-search-filters"
          onSubmit={(event) => {
            event.preventDefault()
            search()
          }}
        >
          <div className="search-filter-actions">
            <button className="primary" type="submit">
              Search cards
            </button>
            <button
              className="export"
              type="button"
              disabled={!filtersSet}
              onClick={() => {
                setFilters(defaultCardSearchFilters)
                setOrder('name')
              }}
            >
              Clear filters
            </button>
          </div>
          <SearchFilters
            filters={filters}
            setFilters={setFilters}
            colours={colours}
            roleCounts={roleCounts}
            deckTargets={deckTargets}
          />
        </form>
        <section
          className="card-search-results-panel"
          aria-labelledby="card-search-results-title"
          aria-busy={status === 'loading'}
        >
          <div className="search-results-heading">
            <div>
              <h2 id="card-search-results-title" tabIndex={-1} ref={resultsHeading}>
                Search results
              </h2>
              {request && (
                <p>
                  {total} matching {total === 1 ? 'card' : 'cards'}
                  {hasMore && ` · ${cards.length} loaded`}
                  {hidden > 0 && ` · ${hidden} already in your deck or sideboard, hidden`}
                </p>
              )}
            </div>
            <label className="search-field">
              Sort by
              <select
                aria-label="Sort search results"
                value={order}
                onChange={(event) => setOrder(event.target.value)}
              >
                <option value="name">Name</option>
                <option value="cmc">Mana value</option>
                <option value="edhrec">Commander popularity</option>
                <option value="usd">Price (USD)</option>
              </select>
            </label>
          </div>
          <label className="search-checkbox">
            <input
              type="checkbox"
              checked={includeExisting}
              onChange={(event) => {
                setIncludeExisting(event.target.checked)
                setFirst(0)
              }}
            />
            Show cards already in deck or sideboard
          </label>
          {request && request.signature !== signature && (
            <p className="search-notice">Filters changed. Search again to update results.</p>
          )}
          <p role="status" aria-live="polite" className="search-notice">
            {notice}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {status === 'error' && request && (
            <button
              className="export"
              type="button"
              onClick={() => {
                setError('')
                setStatus('loading')
                setRequest({ ...request })
              }}
            >
              Retry search
            </button>
          )}
          {warnings.map((warning) => (
            <p className="search-notice" key={warning}>
              {warning}
            </p>
          ))}
          {status === 'loading' && <p role="status">Searching Scryfall…</p>}
          {!request && (
            <p>
              Pick a deck need or any filter, then search. No name is needed. Add cards one at a
              time or select several to add together.
            </p>
          )}
          {request && status === 'idle' && !available.length && (
            <p>
              {cards.length
                ? 'All loaded cards are already in your deck or sideboard. Show existing cards or load more results.'
                : 'No cards match these filters.'}
            </p>
          )}
          {visible.length > 0 && (
            <>
              <div className="search-result-actions">
                {zoneToggle}
                <button
                  className="export"
                  type="button"
                  aria-pressed={bulk}
                  onClick={() => {
                    setBulk(!bulk)
                    setSelectedNames([])
                  }}
                >
                  {bulk ? 'Done selecting' : 'Select several'}
                </button>
                {bulk && (
                  <button
                    className="export"
                    type="button"
                    disabled={!visible.some((card) => !cardSearchError(card, targetBoard, colours))}
                    onClick={() =>
                      setSelectedNames((current) => [
                        ...new Set([
                          ...current,
                          ...visible
                            .filter((card) => !cardSearchError(card, targetBoard, colours))
                            .map(({ name }) => name),
                        ]),
                      ])
                    }
                  >
                    Select this page
                  </button>
                )}
                {request && (
                  <a
                    href={`https://scryfall.com/search?q=${encodeURIComponent(request.query)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View search on Scryfall
                  </a>
                )}
              </div>
              <div className="card-search-grid" ref={observeGrid}>
                {visible.map((card) => (
                  <SearchCard
                    key={card.name}
                    card={card}
                    location={cardLocation(card.name, deck, sideboard)}
                    error={cardSearchError(card, targetBoard, colours)}
                    selected={bulk ? selected.some(({ name }) => name === card.name) : null}
                    onSelect={() =>
                      setSelectedNames((current) =>
                        current.includes(card.name)
                          ? current.filter((name) => name !== card.name)
                          : [...current, card.name],
                      )
                    }
                    onOpen={() => {
                      returnFocus.current = document.activeElement as HTMLElement
                      openCard(card)
                    }}
                    onAdd={() => add([card])}
                    fullDeck={!mainSlots}
                  />
                ))}
              </div>
            </>
          )}
          <Pagination
            label="Search result pages"
            noun="cards"
            count={available.length}
            pageSize={pageSize}
            page={page}
            onPage={goToPage}
            partial={hasMore}
            onMore={status === 'idle' ? loadMore : undefined}
          >
            {hasMore && request && (
              <button
                className="export"
                type="button"
                disabled={status !== 'idle'}
                onClick={loadMore}
              >
                Load more results
              </button>
            )}
          </Pagination>
        </section>
      </div>
      {selected.length > 0 && (
        <div className="card-search-selection-bar" role="region" aria-label="Selected search cards">
          <span>
            {selected.length} selected · {Math.min(selected.length, mainSlots)} to deck ·{' '}
            {Math.max(0, selected.length - mainSlots)} to sideboard
          </span>
          <button className="export" type="button" onClick={() => setSelectedNames([])}>
            Clear selection
          </button>
          <button className="primary" type="button" onClick={() => add(selected)}>
            Add selected ({selected.length})
          </button>
        </div>
      )}
    </main>
  )
}
