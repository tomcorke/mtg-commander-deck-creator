import { useEffect, useRef, useState } from 'react'

import { fetchRandomScryfallCommander } from '../../adapters/scryfall.ts'
import { toDeckCard, type DeckCard, type ScryfallCard } from '../../domain/card-model.ts'
import { pickRandomCommander } from '../../domain/commander-discovery.ts'
import { commanderConstructionError } from '../../domain/commander-construction.ts'
import { commanderKey } from '../../domain/commander-catalog.ts'
import { CardDetailContent } from '../../shared/CardDetailContent.tsx'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import { IdentifiedThemes } from '../../shared/IdentifiedThemes.tsx'

/** The Start screen's filtered results, offered when any commander filter is set (#486). */
export type FilteredCommanders = {
  summary: string
  status: 'loading' | 'idle' | 'error'
  cards: readonly ScryfallCard[]
  /** Scryfall's page limit cut the results short, so only the loaded matches can be drawn. */
  more: boolean
}

type Source = 'all' | 'filters'

/** "your 12 filtered results", or "your first 175…" when Scryfall's page limit cut them short. */
function filteredScope({ status, cards, more }: FilteredCommanders) {
  if (status !== 'idle' || !cards.length) return 'your filtered results'
  const count = cards.length
  return `your ${more ? 'first ' : ''}${count} filtered result${count === 1 ? '' : 's'}`
}

/** One draw at a time, from `pool` when given, else from every commander via Scryfall. */
function useRandomCommander(pool: FilteredCommanders | undefined) {
  const [card, setCard] = useState<DeckCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roll, setRoll] = useState(0)
  const previous = useRef<string | undefined>(undefined)
  const poolStatus = pool?.status
  const cards = pool?.cards
  useEffect(() => {
    // Filtered results still loading or failed: the draw waits, and the render reports why.
    if (poolStatus && poolStatus !== 'idle') return
    const controller = new AbortController()
    const draw = cards
      ? Promise.resolve(pickRandomCommander(cards, previous.current))
      : fetchRandomScryfallCommander(previous.current, controller.signal)
    void draw
      .then((result) => {
        if (controller.signal.aborted || !result) return
        previous.current = result.oracle_id
        const converted = toDeckCard(result)
        if (commanderConstructionError([converted]))
          throw new Error('This commander is not supported by the builder. Please re-roll.')
        setCard(converted)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Random commander unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [roll, poolStatus, cards])
  /** Clears the shown commander and draws again; a changed `pool` takes effect with it. */
  const reRoll = () => {
    setLoading(true)
    setCard(null)
    setError('')
    setRoll((value) => value + 1)
  }
  return {
    card,
    loading: poolStatus === 'loading' || (poolStatus !== 'error' && loading),
    error:
      poolStatus === 'error'
        ? 'Your filtered results are unavailable. Draw from all commanders instead.'
        : error,
    reRoll,
  }
}

/** All commanders or the Start filters, shown only when a filter is set, plus what the draw covers. */
function DrawSource({
  filtered,
  source,
  disabled,
  choose,
}: {
  filtered?: FilteredCommanders
  source: Source
  disabled: boolean
  choose: (source: Source) => void
}) {
  return (
    <>
      {filtered && (
        <div className="add-zone-toggle" role="group" aria-label="Draw from">
          <span>Draw from</span>
          {(
            [
              ['all', 'All commanders'],
              ['filters', 'My filters'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              disabled={disabled}
              onClick={() => choose(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <p>
        {filtered && source === 'filters'
          ? `Discover a commander from ${filteredScope(filtered)}: ${filtered.summary}.`
          : 'Discover a commander from all colours and themes, independent of your search filters.'}
      </p>
    </>
  )
}

function NoFilteredMatches({ drawFromAll }: { drawFromAll: () => void }) {
  return (
    <div className="empty random-commander-empty" role="status">
      <h3>No commanders match your filters</h3>
      <p>Draw from all commanders, or close this and change your filters.</p>
      <button className="export" type="button" onClick={drawFromAll}>
        Draw from all commanders
      </button>
    </div>
  )
}

function SelectionStatus({ error, selecting }: { error: string; selecting: boolean }) {
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {selecting && <p role="status">Selecting commander…</p>}
    </>
  )
}

/** Selecting the shown commander; the dialog closes once the builder accepts it. */
function useSelectCommander(
  card: DeckCard | null,
  loading: boolean,
  chooseCommander: (name: string) => Promise<boolean>,
  onClose: () => void,
) {
  const [selecting, setSelecting] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const select = async () => {
    if (!card || loading || selecting) return
    setSelecting(true)
    setSelectionError('')
    try {
      if (await chooseCommander(commanderKey([card.name]))) onClose()
      else setSelectionError('Could not select this commander. Please try again.')
    } catch {
      setSelectionError('Could not select this commander. Please try again.')
    } finally {
      setSelecting(false)
    }
  }
  return { select, selecting, selectionError, setSelectionError }
}

export function RandomCommanderDialog({
  onClose,
  chooseCommander,
  openCard,
  filtered,
}: {
  onClose: () => void
  chooseCommander: (name: string) => Promise<boolean>
  openCard: (card: DeckCard) => void
  /** Absent when no Start filter is set: the draw is then always from every commander. */
  filtered?: FilteredCommanders
}) {
  const [source, setSource] = useState<Source>('all')
  const pool = source === 'filters' ? filtered : undefined
  const { card, loading, error, reRoll } = useRandomCommander(pool)
  const noMatches = pool?.status === 'idle' && !pool.cards.length
  const { select, selecting, selectionError, setSelectionError } = useSelectCommander(
    card,
    loading,
    chooseCommander,
    onClose,
  )
  const draw = () => {
    setSelectionError('')
    reRoll()
  }
  const chooseSource = (next: Source) => {
    if (next === source) return
    setSource(next)
    draw()
  }
  const close = () => {
    if (!selecting) onClose()
  }
  const dialog = useDialogFocus(true, close)

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        className="export-modal deck-card-modal random-commander-modal"
        {...dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="random-commander-heading"
      >
        <div className="export-heading">
          <h2 id="random-commander-heading">Random commander</h2>
          <ModalCloseButton label="Cancel random commander" onClick={close} disabled={selecting} />
        </div>
        <DrawSource
          filtered={filtered}
          source={source}
          disabled={selecting}
          choose={chooseSource}
        />
        {loading && <p role="status">Finding a random commander…</p>}
        {noMatches && <NoFilteredMatches drawFromAll={() => chooseSource('all')} />}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {card && (
          <CardDetailContent
            card={card}
            titleId="random-commander-title"
            title={<CardReference card={card} onOpen={() => openCard(card)} />}
          >
            <IdentifiedThemes card={card} />
          </CardDetailContent>
        )}
        <SelectionStatus error={selectionError} selecting={selecting} />
        <div className="export-actions deck-card-modal-actions">
          <button className="export" type="button" onClick={close} disabled={selecting}>
            Cancel
          </button>
          <button
            className="export"
            type="button"
            disabled={loading || selecting || noMatches}
            onClick={draw}
          >
            Re-roll
          </button>
          <button
            className="primary"
            type="button"
            disabled={!card || loading || selecting}
            onClick={() => void select()}
          >
            Select and continue
          </button>
        </div>
      </section>
    </div>
  )
}
