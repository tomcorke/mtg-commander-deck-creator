import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import { searchScryfallPage } from '../../adapters/scryfall.ts'
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
  type CardSearchFilters,
  type SearchMatch,
} from '../../domain/card-search.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { OracleText } from '../../shared/ManaSymbols.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { CommanderCardArt } from './CommanderCardArt.tsx'
import { CommanderSummary } from './CommanderSummary.tsx'

const pageSize = 12

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
  cycleCommanderPrinting: (index: number) => void
  startOver: () => void
  openCommander: (index: number) => void
  openCard: (card: ScryfallCard) => void
  addCards: (cards: ScryfallCard[]) => string
  closePage: () => void
}

function MatchSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: SearchMatch
  onChange: (match: SearchMatch) => void
}) {
  return (
    <select
      aria-label={`${label} match`}
      value={value}
      className={`search-match search-match--${value}`}
      onChange={(event) => onChange(event.target.value as SearchMatch)}
    >
      <option value="any">Any</option>
      <option value="need">Need</option>
      <option value="exclude">Exclude</option>
    </select>
  )
}

function SearchFilters({
  filters,
  setFilters,
  colours,
}: {
  filters: CardSearchFilters
  setFilters: Dispatch<SetStateAction<CardSearchFilters>>
  colours: string[]
}) {
  const match = (label: string, value: SearchMatch) =>
    setFilters((current) => ({ ...current, matches: { ...current.matches, [label]: value } }))
  return (
    <>
      <label className="search-field">
        Name contains
        <input
          autoFocus
          value={filters.name}
          autoComplete="off"
          placeholder="Any name"
          onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <MatchSelect
        label="Name"
        value={filters.nameMatch}
        onChange={(nameMatch) => setFilters((current) => ({ ...current, nameMatch }))}
      />
      <fieldset>
        <legend>Mana value</legend>
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
        <label className="search-filter-row">
          Within this range
          <MatchSelect
            label="Mana value"
            value={filters.manaValueMatch}
            onChange={(manaValueMatch) => setFilters((current) => ({ ...current, manaValueMatch }))}
          />
        </label>
        <p>Bounds are inclusive. X is 0 when calculating mana value outside the stack.</p>
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
      <fieldset>
        <legend>Mana colours & costs</legend>
        {cardSearchManaOptions(filters.filterIdentity ? colours : ['W', 'U', 'B', 'R', 'G']).map(
          ({ label, symbol }) => (
            <label className="search-filter-row" key={label}>
              <span>
                {symbol && <OracleText text={symbol} />}
                {!colourNames[label] && label}
              </span>
              <MatchSelect
                label={colourNames[label] ?? label}
                value={filters.matches[label] ?? 'any'}
                onChange={(value) => match(label, value)}
              />
            </label>
          ),
        )}
        <p>
          Colours match cost symbols, including hybrid and Phyrexian mana. Colourless cards match
          card colour, not mana produced.
        </p>
      </fieldset>
      <details className="search-keywords" open>
        <summary>Keywords & effects</summary>
        {cardSearchKeywords.map(({ label }) => (
          <label className="search-filter-row" key={label}>
            {label}
            <MatchSelect
              label={label}
              value={filters.matches[label] ?? 'any'}
              onChange={(value) => match(label, value)}
            />
          </label>
        ))}
        <p>
          Keyword filters can include granted abilities. Effects use Scryfall tags or rules text;
          mentions do not guarantee a particular interaction.
        </p>
      </details>
      <label className="search-field">
        Need rules text
        <input
          value={filters.rulesNeed}
          placeholder="e.g. proliferate, treasure"
          onChange={(event) =>
            setFilters((current) => ({ ...current, rulesNeed: event.target.value }))
          }
        />
      </label>
      <label className="search-field">
        Exclude rules text
        <input
          value={filters.rulesExclude}
          placeholder="e.g. discard"
          onChange={(event) =>
            setFilters((current) => ({ ...current, rulesExclude: event.target.value }))
          }
        />
      </label>
      <p>
        Separate phrases with commas. Every Need filter must match; any Exclude match removes a
        card.
      </p>
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
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onAdd: () => void
  fullDeck: boolean
}) {
  const display = toDeckCard(card)
  return (
    <article
      className={`search-card${location ? ' already-in-deck' : ''}${selected ? ' selected' : ''}`}
    >
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
      <button
        className="search-card-art"
        type="button"
        aria-label={`View ${card.name} card`}
        onClick={onOpen}
      >
        {display.image ? <SmallCardImage image={display.image} /> : 'No card art'}
      </button>
      <CardReference card={display} onOpen={onOpen} />
      <span className="search-card-cost">
        <OracleText text={display.manaCost || display.faces[0]?.manaCost || ''} />
      </span>
      <p>{display.typeLine}</p>
      {location && <strong className="search-card-location">{location}</strong>}
      <details>
        <summary>Rules text</summary>
        <p className="search-card-rules">
          <OracleText text={display.detail} />
        </p>
      </details>
      {error && !location && <p className="search-card-error">{error}</p>}
      <button
        type="button"
        className="primary"
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
    </article>
  )
}

function cardLocation(name: string, deck: DeckCard[], sideboard: DeckCard[]) {
  const main = deck.filter((card) => card.name === name).length
  const side = sideboard.filter((card) => card.name === name).length
  return [main ? `In deck (${main})` : '', side ? `In sideboard (${side})` : '']
    .filter(Boolean)
    .join(' · ')
}

export function CardSearchView({
  active,
  appHeader,
  commander,
  commanderDetails,
  loadingArt,
  deck,
  sideboard,
  excludeUnreleased,
  cycleCommanderPrinting,
  startOver,
  openCommander,
  openCard,
  addCards,
  closePage,
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
  const [page, setPage] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const colours = commanderDetails?.colours ?? []
  const usedNames = [...deck, ...sideboard].map(({ name }) => name)
  const available = cards.filter((card) => includeExisting || !usedNames.includes(card.name))
  const pages = Math.ceil(available.length / pageSize)
  const activePage = Math.min(page, Math.max(0, pages - 1))
  const visible = available.slice(activePage * pageSize, (activePage + 1) * pageSize)
  const selected = cards.filter(
    (card) => selectedNames.includes(card.name) && !cardSearchError(card, usedNames, colours),
  )
  const signature = JSON.stringify({ filters, order })

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
        setCards((current) => [
          ...new Map(
            [...(request.page === 1 ? [] : current), ...result.data].map((card) => [
              card.name,
              card,
            ]),
          ).values(),
        ])
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
      const query = buildCardSearchQuery(filters, colours, excludeUnreleased)
      controllerRef.current?.abort()
      setCards([])
      setSelectedNames([])
      setPage(0)
      setHasMore(false)
      setTotal(0)
      setWarnings([])
      setError('')
      setNotice('')
      setStatus('loading')
      setRequest({ query, order, page: 1, signature })
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
    const mainCount = Math.min(chosen.length, Math.max(0, 100 - deck.length))
    setNotice(`Added ${mainCount} to deck and ${chosen.length - mainCount} to sideboard.`)
    setError('')
    setSelectedNames((current) =>
      current.filter((name) => !chosen.some((card) => card.name === name)),
    )
  }

  function goToPage(next: number) {
    setPage(next)
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
          onChangeCommander={startOver}
        />
        <div className="search-page-context">
          <p className="eyebrow">Card discovery</p>
          <h1>Search & add cards</h1>
          <p>
            {deck.length}/100 in deck · {sideboard.length} in sideboard. Search stays open while you
            add cards.
          </p>
          <button className="primary" type="button" onClick={closePage}>
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
              onClick={() => {
                setFilters(defaultCardSearchFilters)
                setOrder('name')
              }}
            >
              Reset filters
            </button>
          </div>
          <SearchFilters filters={filters} setFilters={setFilters} colours={colours} />
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
                  {available.length} available of {cards.length} loaded · {total} Scryfall matches
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
                setPage(0)
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
              Search by name, use filters without a name, or browse all legal cards. Choose cards
              individually or select several to add together.
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
                <button
                  className="export"
                  type="button"
                  disabled={!visible.some((card) => !cardSearchError(card, usedNames, colours))}
                  onClick={() =>
                    setSelectedNames((current) => [
                      ...new Set([
                        ...current,
                        ...visible
                          .filter((card) => !cardSearchError(card, usedNames, colours))
                          .map(({ name }) => name),
                      ]),
                    ])
                  }
                >
                  Select this page
                </button>
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
              <div className="card-search-grid">
                {visible.map((card) => (
                  <SearchCard
                    key={card.name}
                    card={card}
                    location={cardLocation(card.name, deck, sideboard)}
                    error={cardSearchError(card, usedNames, colours)}
                    selected={selected.some(({ name }) => name === card.name)}
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
                    fullDeck={deck.length >= 100}
                  />
                ))}
              </div>
            </>
          )}
          <div className="search-pagination" aria-label="Search result pages">
            {pages > 1 && (
              <>
                <button
                  className="export"
                  type="button"
                  disabled={activePage === 0}
                  onClick={() => goToPage(activePage - 1)}
                >
                  Previous page
                </button>
                <span>
                  Page {activePage + 1} of {pages}
                </span>
                <button
                  className="export"
                  type="button"
                  disabled={activePage === pages - 1}
                  onClick={() => goToPage(activePage + 1)}
                >
                  Next page
                </button>
              </>
            )}
            {hasMore && request && (
              <button
                className="export"
                type="button"
                disabled={status !== 'idle'}
                onClick={() => {
                  setStatus('loading')
                  setError('')
                  setRequest({ ...request, page: request.page + 1 })
                }}
              >
                Load more results
              </button>
            )}
          </div>
        </section>
      </div>
      {selected.length > 0 && (
        <div className="card-search-selection-bar" role="region" aria-label="Selected search cards">
          <span>
            {selected.length} selected · {Math.min(selected.length, Math.max(0, 100 - deck.length))}{' '}
            to deck · {Math.max(0, selected.length - Math.max(0, 100 - deck.length))} to sideboard
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
