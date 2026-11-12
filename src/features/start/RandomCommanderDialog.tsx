import { useEffect, useRef, useState } from 'react'

import { fetchRandomScryfallCommander } from '../../adapters/scryfall.ts'
import { toDeckCard, type DeckCard } from '../../domain/card-model.ts'
import { commanderConstructionError } from '../../domain/commander-construction.ts'
import { CardDetailContent } from '../../shared/CardDetailContent.tsx'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import { IdentifiedThemes } from '../../shared/IdentifiedThemes.tsx'

function useRandomCommander() {
  const [card, setCard] = useState<DeckCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roll, setRoll] = useState(0)
  const previous = useRef<string | undefined>(undefined)
  useEffect(() => {
    const controller = new AbortController()
    void fetchRandomScryfallCommander(previous.current, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
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
  }, [roll])
  const reRoll = () => {
    setLoading(true)
    setCard(null)
    setError('')
    setRoll((value) => value + 1)
  }
  return { card, loading, error, reRoll }
}

export function RandomCommanderDialog({
  onClose,
  chooseCommander,
  openCard,
}: {
  onClose: () => void
  chooseCommander: (name: string) => Promise<boolean>
  openCard: (card: DeckCard) => void
}) {
  const { card, loading, error, reRoll } = useRandomCommander()
  const [selecting, setSelecting] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const close = () => {
    if (!selecting) onClose()
  }
  const dialog = useDialogFocus(true, close)
  const select = async () => {
    if (!card || loading || selecting) return
    setSelecting(true)
    setSelectionError('')
    try {
      if (await chooseCommander(card.name)) onClose()
      else setSelectionError('Could not select this commander. Please try again.')
    } catch {
      setSelectionError('Could not select this commander. Please try again.')
    } finally {
      setSelecting(false)
    }
  }

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
        <p>Discover a commander from all colours and themes, independent of your search filters.</p>
        {loading && <p role="status">Finding a random commander…</p>}
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
        {selectionError && (
          <p className="form-error" role="alert">
            {selectionError}
          </p>
        )}
        {selecting && <p role="status">Selecting commander…</p>}
        <div className="export-actions deck-card-modal-actions">
          <button className="export" type="button" onClick={close} disabled={selecting}>
            Cancel
          </button>
          <button
            className="export"
            type="button"
            disabled={loading || selecting}
            onClick={() => {
              setSelectionError('')
              reRoll()
            }}
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
