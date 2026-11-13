import { useState } from 'react'

import { usePartnerDiscovery } from '../../app/useCommanderDiscovery.ts'
import { toDeckCard, type DeckCard, type ScryfallCard } from '../../domain/card-model.ts'
import { commanderKey } from '../../domain/commander-catalog.ts'
import { pairingLabel } from '../../domain/commander-pairing.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import { PartnerChoices } from '../../shared/PartnerChoices.tsx'

/**
 * Start's second step for a commander with a partner ability: choose a legal second commander,
 * or skip to lead alone. Either starts the deck through `chooseCommander`.
 */
export function PartnerDialog({
  first,
  onClose,
  chooseCommander,
  openCard,
}: {
  first: ScryfallCard
  onClose: () => void
  chooseCommander: (name: string) => Promise<boolean>
  openCard: (card: DeckCard) => void
}) {
  const leader = toDeckCard(first)
  const discovery = usePartnerDiscovery(first)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState('')
  const close = () => {
    if (!choosing) onClose()
  }
  const dialog = useDialogFocus(true, close)
  const choose = async (name: string) => {
    if (choosing) return
    setChoosing(true)
    setError('')
    try {
      if (await chooseCommander(name)) return onClose()
      setError('Could not start this deck. Please try again.')
    } catch {
      setError('Could not start this deck. Please try again.')
    }
    setChoosing(false)
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        {...dialog}
        className="export-modal change-commander-modal partner-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-title"
        aria-busy={choosing}
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Optional second commander</p>
            <h2 id="partner-title">Add a partner</h2>
          </div>
          <ModalCloseButton label="Close add a partner" onClick={close} disabled={choosing} />
        </div>
        <p className="import-help">
          <CardReference card={leader} onOpen={() => openCard(leader)} /> has {pairingLabel(leader)}
          , so it can share command with a second commander. Their colours combine. Choose one, or
          skip to lead alone.
        </p>
        <PartnerChoices
          first={first}
          discovery={discovery}
          openCard={openCard}
          action={(card) => (
            <button
              className="export commander-choose"
              type="button"
              aria-label={`Choose ${card.name} as partner`}
              disabled={choosing}
              onClick={() => void choose(commanderKey([leader.name, card.name]))}
            >
              Choose
            </button>
          )}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="export-actions">
          <button
            className="nav-forward"
            type="button"
            disabled={choosing}
            onClick={() => void choose(commanderKey([first.name]))}
          >
            Skip
          </button>
        </div>
      </section>
    </div>
  )
}
