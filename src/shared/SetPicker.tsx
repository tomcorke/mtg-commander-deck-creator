import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { searchScryfallCached } from '../adapters/scryfall.ts'
import { toCard, type ScryfallCard, type ScryfallSet } from '../domain/card-model.ts'
import { setGuides } from '../domain/set-guides.ts'
import { CardReference } from './CardReference.tsx'
import { ManaSymbols } from './ManaSymbols.tsx'
import { colourLeanings, type SetPickerRow } from '../domain/set-picker.ts'

function SetIcon({ uri }: { uri?: string }) {
  return uri ? (
    <img className="set-picker-icon" src={uri} alt="" loading="lazy" />
  ) : (
    <span className="set-picker-icon" aria-hidden="true" />
  )
}

// Scryfall set_type values read as jargon to newer players.
const setTypeLabels: Record<string, string> = {
  expansion: 'Main set',
  core: 'Core set',
  commander: 'Commander decks',
  masters: 'Reprint set',
  draft_innovation: 'Special draft set',
  funny: 'Joke set (not tournament legal)',
}
const setTypeLabel = (set: ScryfallSet) =>
  setTypeLabels[set.set_type ?? ''] ?? (set.set_type ?? 'Set').replaceAll('_', ' ')

function SetMeta({ set }: { set: ScryfallSet }) {
  return (
    <span className="set-picker-meta">
      {setTypeLabel(set)}
      {set.card_count ? ` · ${set.card_count} cards` : ''} ·{' '}
      <a
        href={`https://scryfall.com/sets/${set.code}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Preview ${set.name} cards on Scryfall (opens in a new tab)`}
      >
        Preview cards
      </a>
    </span>
  )
}

/**
 * True while `ref`'s element is within 200px of the viewport; always true without the observer API.
 * A scrolling ancestor such as the Recommendation settings modal still clips, so rows there load
 * once actually visible.
 */
function useNearViewport(ref: RefObject<Element | null>) {
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      rootMargin: '200px 0px',
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return near
}

/**
 * Searches a set's legends only while its row is near the viewport, so opening the browser does not
 * queue one search per row (#424). Leaving view cancels a queued search; the session cache keeps
 * loaded results across scrolling and search changes.
 */
function useSetLegends(code: string, near: boolean) {
  const [legends, setLegends] = useState<ScryfallCard[] | null>()
  const loaded = legends !== undefined
  useEffect(() => {
    if (!near || loaded) return
    const controller = new AbortController()
    searchScryfallCached(
      `e:${code} is:legendary t:creature not:reprint`,
      fetch,
      controller.signal,
      'edhrec',
    )
      .then(setLegends)
      .catch(() => controller.signal.aborted || setLegends(null))
    return () => controller.abort()
  }, [code, near, loaded])
  return legends
}

/** Browse view: key art banner above the row's header, then description and legends. */
function SetGuide({ set, children }: { set: ScryfallSet; children: ReactNode }) {
  const guideRef = useRef<HTMLDivElement>(null)
  const legends = useSetLegends(set.code, useNearViewport(guideRef))
  const guide = setGuides[set.code]
  const artUri = legends
    ?.map((card) => card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop)
    .find(Boolean)
  const leanings = legends ? colourLeanings(legends) : []
  return (
    <>
      {artUri ? (
        <img className="set-guide-art" src={artUri} alt="" loading="lazy" />
      ) : (
        <span className="set-guide-art" aria-hidden="true" />
      )}
      {children}
      <div className="set-guide" ref={guideRef}>
        {guide ? (
          <p>
            {guide.description}{' '}
            <a
              href={guide.source}
              target="_blank"
              rel="noreferrer"
              aria-label={`Source for the ${set.name} description (opens in a new tab)`}
            >
              Source
            </a>
          </p>
        ) : (
          <p className="set-picker-meta">Description unavailable.</p>
        )}
        {legends === undefined ? (
          <p className="set-picker-meta">Loading legends…</p>
        ) : legends === null ? (
          <p className="set-picker-meta">Couldn’t load legends from Scryfall.</p>
        ) : legends.length > 0 ? (
          <>
            <span className="set-picker-meta set-guide-legends-heading">
              Sample legends
              {leanings.length > 0 && (
                <span className="set-guide-colours">
                  Legends lean <ManaSymbols symbols={leanings} />
                </span>
              )}
            </span>
            <ul className="set-guide-legends">
              {legends.slice(0, 4).map((card) => (
                <li key={card.oracle_id ?? card.name}>
                  <CardReference
                    card={toCard(card, '')}
                    thumbnail
                    onOpen={() => window.open(card.scryfall_uri, '_blank', 'noreferrer')}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="set-picker-meta">No legendary creatures in this set.</p>
        )}
      </div>
    </>
  )
}

function SetHeader(props: { set: ScryfallSet; checked: boolean; toggle: (code: string) => void }) {
  const { set } = props
  return (
    <>
      <label>
        <input type="checkbox" checked={props.checked} onChange={() => props.toggle(set.code)} />
        <SetIcon uri={set.icon_svg_uri} />
        <span className="set-picker-name">{set.name}</span>
        <small>{set.released_at?.slice(0, 4)}</small>
      </label>
      <SetMeta set={set} />
    </>
  )
}

function SetSearch({ query, setQuery }: { query: string; setQuery: (query: string) => void }) {
  return (
    <label className="collection-set-search">
      <span>Find a set</span>
      <span className="collection-set-input">
        <input
          className="clearable-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Set name or code…"
        />
        <button
          type="button"
          className="clear-deck-name"
          onClick={() => setQuery('')}
          aria-label="Clear set search"
        >
          ×
        </button>
      </span>
    </label>
  )
}

type SetPickerProps = {
  query: string
  setQuery: (query: string) => void
  showSupplemental: boolean
  setShowSupplemental: (show: boolean) => void
  setOptions: ScryfallSet[]
  rows: SetPickerRow[]
  selected: string[]
  toggle: (code: string) => void
  label: (code: string) => string
  /** Shown when no set is selected. */
  emptySelection: string
}

/** Find, tick and remove sets; shared by commander browsing and recommendation sets. */
export function SetPicker(props: SetPickerProps) {
  const rowsLabel = useId()
  const searching = props.query.trim().length >= 2
  const [browsing, setBrowsing] = useState(false)
  return (
    <>
      <div className="collection-set-filters">
        <SetSearch query={props.query} setQuery={props.setQuery} />
        <label className="collection-supplemental-toggle">
          <input
            type="checkbox"
            checked={props.showSupplemental}
            onChange={(event) => props.setShowSupplemental(event.target.checked)}
          />
          Show promos and digital sets
        </label>
        <button
          type="button"
          className="export"
          aria-pressed={browsing}
          onClick={() => setBrowsing(!browsing)}
        >
          Browse sets
        </button>
      </div>
      <div className="collection-set-list">
        <span id={rowsLabel}>{searching ? 'Matching sets' : 'Recent releases'}</span>
        {props.rows.length > 0 ? (
          <ul
            className={`set-picker-rows${browsing ? ' browsing' : ''}`}
            aria-labelledby={rowsLabel}
          >
            {props.rows.map(({ set, commander }) => (
              <li key={set.code} className="set-picker-row">
                {browsing ? (
                  <SetGuide set={set}>
                    <SetHeader
                      set={set}
                      checked={props.selected.includes(set.code)}
                      toggle={props.toggle}
                    />
                  </SetGuide>
                ) : (
                  <SetHeader
                    set={set}
                    checked={props.selected.includes(set.code)}
                    toggle={props.toggle}
                  />
                )}
                {commander && (
                  <label className="set-picker-commander">
                    <input
                      type="checkbox"
                      checked={props.selected.includes(commander.code)}
                      onChange={() => props.toggle(commander.code)}
                      aria-label={commander.name}
                    />
                    <span aria-hidden="true">+ Commander decks</span>
                  </label>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="collection-empty">
            {props.setOptions.length === 0
              ? 'Loading sets…'
              : `No sets match “${props.query.trim()}”.`}
          </p>
        )}
      </div>
      <div className="collection-selection">
        <span>Selected</span>
        {props.selected.length > 0 ? (
          <div className="collection-chips">
            {props.selected.map((code) => (
              <button
                type="button"
                key={code}
                onClick={() => props.toggle(code)}
                aria-label={`Remove ${props.label(code)}`}
              >
                {props.label(code)} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="collection-empty">{props.emptySelection}</p>
        )}
      </div>
    </>
  )
}
