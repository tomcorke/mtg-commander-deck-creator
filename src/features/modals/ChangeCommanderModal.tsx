import { useEffect, useState } from 'react'

import { useCommanderDiscovery } from '../../app/useCommanderDiscovery.ts'
import { commanderNames } from '../../domain/commander-catalog.ts'
import { toDeckCard, type DeckCard } from '../../domain/card-model.ts'
import {
  cardColourIdentity,
  commanderPromotionInfo,
  commanderPromotionWarning,
} from '../../domain/commander-promotion.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { ColourPicker, CommanderChoiceTile } from '../../shared/CommanderChoice.tsx'

type Props = {
  commander: string
  deck: DeckCard[]
  openCard: (card: DeckCard) => void
  changeCommander: (card: DeckCard, keepOutgoing: boolean) => void
}

/** "Change commander" button and its dialog: picks a new commander and keeps the deck. */
// eslint-disable-next-line max-lines-per-function -- The dialog markup stays together.
export function ChangeCommander({ commander, deck, openCard, changeCommander }: Props) {
  const [open, setOpen] = useState(false)
  const outgoing = commanderNames(commander)
  const remaining = deck.filter((card) => !outgoing.includes(card.name))
  const required = [...new Set(remaining.flatMap((card) => cardColourIdentity(card)))]
  const [colours, setColours] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [keepOutgoing, setKeepOutgoing] = useState(true)
  const discovery = useCommanderDiscovery({ theme: '', colours, search }, open)
  const close = () => setOpen(false)
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('keydown', escape, true)
    return () => document.removeEventListener('keydown', escape, true)
  }, [open])

  return (
    <>
      <button
        className="change"
        type="button"
        onClick={() => {
          setColours([...required].sort())
          setSearch('')
          setOpen(true)
        }}
      >
        Change commander
      </button>
      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <section
            className="export-modal change-commander-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-commander-title"
          >
            <div className="export-heading">
              <div>
                <p className="eyebrow">Keep this deck</p>
                <h2 id="change-commander-title">Change commander</h2>
              </div>
              <ModalCloseButton label="Close change commander" onClick={close} />
            </div>
            <p className="import-help">
              {required.length
                ? 'Commanders must cover every colour your other cards use. Add colours to widen the search.'
                : 'Any commander fits the cards you have so far. Pick colours to narrow the search.'}
            </p>
            <ColourPicker
              colours={colours}
              toggleColour={(colour) =>
                setColours((current) =>
                  current.includes(colour)
                    ? current.filter((item) => item !== colour)
                    : [...current, colour],
                )
              }
            />
            <label className="commander-search">
              Name
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search commanders…"
                aria-label="Search commanders"
                autoComplete="off"
              />
            </label>
            <label className="intro-guide-option">
              <input
                type="checkbox"
                checked={keepOutgoing}
                onChange={(event) => setKeepOutgoing(event.target.checked)}
              />{' '}
              Keep the current commander in the deck when its colours fit
            </label>
            <div className="commander-grid" aria-busy={discovery.status === 'loading'}>
              {discovery.suggestions.map(({ card }) => {
                const candidate = toDeckCard(card)
                const legal = commanderPromotionInfo(candidate, remaining)
                const keeps =
                  keepOutgoing && Boolean(commanderPromotionInfo(candidate, deck)?.canPromote)
                const current = outgoing.includes(card.name)
                return (
                  <CommanderChoiceTile
                    key={card.oracle_id ?? card.name}
                    card={card}
                    openCard={openCard}
                    action={
                      <button
                        className="export commander-choose"
                        type="button"
                        aria-label={`Choose ${card.name}`}
                        disabled={current || !legal?.canPromote}
                        onClick={() => {
                          close()
                          changeCommander(candidate, keeps)
                        }}
                      >
                        {current ? 'Current' : 'Choose'}
                      </button>
                    }
                    note={
                      legal && !legal.canPromote ? (
                        <p className="form-error">{commanderPromotionWarning(legal)}</p>
                      ) : (
                        keepOutgoing &&
                        !keeps &&
                        !current && (
                          <p className="import-note">The current commander will leave the deck.</p>
                        )
                      )
                    }
                  />
                )
              })}
            </div>
            {discovery.status === 'loading' && (
              <p className="discovery-status" role="status">
                Finding legal commanders…
              </p>
            )}
            {discovery.status === 'error' && <p role="alert">{discovery.error}</p>}
            {discovery.status === 'idle' && !discovery.suggestions.length && (
              <p role="status">No commanders match these colours and name.</p>
            )}
            {discovery.status === 'idle' && discovery.suggestions.length > 0 && (
              <button className="reroll" type="button" onClick={discovery.reshuffle}>
                Show different commanders
              </button>
            )}
          </section>
        </div>
      )}
    </>
  )
}
