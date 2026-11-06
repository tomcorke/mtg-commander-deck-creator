import { useState } from 'react'

import { commanderPageSize, useCommanderDiscovery } from '../../app/useCommanderDiscovery.ts'
import { Pagination } from '../../shared/Pagination.tsx'
import { commanderNames } from '../../domain/commander-catalog.ts'
import { toDeckCard, type DeckCard } from '../../domain/card-model.ts'
import {
  cardColourIdentity,
  commanderPromotionInfo,
  missingColourNames,
  promoteDeckCard,
  type CommanderPromotionInfo,
} from '../../domain/commander-promotion.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import {
  ColourPicker,
  CommanderChoiceTile,
  CommanderTilePlaceholders,
} from '../../shared/CommanderChoice.tsx'

/** Why a tile can't be chosen: how many deck cards would fall outside its identity. */
function blockedReason(info: CommanderPromotionInfo) {
  if (info.error) return info.error
  const count = info.dependentCards.length
  return `Can't be commander: ${count} ${count === 1 ? 'card uses' : 'cards use'} ${missingColourNames(info, 'or')}.`
}

/** Card references joined into one phrase ("A and B"). */
function cardList(cards: DeckCard[], openCard: (card: DeckCard) => void) {
  return cards.map((card, index) => (
    <span key={card.name}>
      {index > 0 && (index === cards.length - 1 ? ' and ' : ', ')}
      <CardReference card={card} onOpen={() => openCard(card)} />
    </span>
  ))
}

/** States what applying the change does to the deck, before the user confirms. */
function ChangeOutcome({
  others,
  outgoing,
  outcome,
  displaced,
  openCard,
}: {
  others: number
  outgoing: DeckCard[]
  outcome: 'stays' | 'leaves' | 'outside'
  displaced: DeckCard[]
  openCard: (card: DeckCard) => void
}) {
  return (
    <p className="change-commander-outcome" role="status">
      {others > 0 &&
        (others === 1
          ? 'The other card fits its colours. '
          : `All ${others} other cards fit its colours. `)}
      {outgoing.length > 0 && (
        <>
          {cardList(outgoing, openCard)} {/* Partners take plural verbs. */}
          {outgoing.length === 1
            ? {
                stays: 'stays in the deck.',
                leaves: 'leaves the deck.',
                outside: "leaves the deck: its colours fall outside the new commander's.",
              }[outcome]
            : {
                stays: 'stay in the deck.',
                leaves: 'leave the deck.',
                outside: "leave the deck: their colours fall outside the new commander's.",
              }[outcome]}
        </>
      )}
      {displaced.length > 0 && (
        <>
          {' '}
          The deck is full, so {cardList(displaced, openCard)}{' '}
          {displaced.length === 1 ? 'moves' : 'move'} to the sideboard.
        </>
      )}
    </p>
  )
}

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
  const [selected, setSelected] = useState<DeckCard | null>(null)
  const keepFits = Boolean(selected && commanderPromotionInfo(selected, deck)?.canPromote)
  const keeps = keepOutgoing && keepFits
  const outgoingCards = deck.filter((card) => outgoing.includes(card.name))
  const others = remaining.filter((card) => card.name !== selected?.name).length
  // Mirrors the promote action, so the stated outcome matches what applying does.
  const displaced = selected
    ? promoteDeckCard(keeps ? deck : remaining, [], selected).sideboard
    : []
  const discovery = useCommanderDiscovery({ theme: '', colours, search }, open)
  const close = () => setOpen(false)
  const dialog = useDialogFocus(open, close)

  return (
    <>
      <button
        className="export"
        type="button"
        onClick={() => {
          setColours([...required].sort())
          setSearch('')
          setSelected(null)
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
            {...dialog}
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
            <p className="change-commander-count" role="status">
              {discovery.status === 'loading' && 'Finding legal commanders…'}
              {/* The empty state names the zero itself. */}
              {discovery.status === 'idle' &&
                discovery.count > 0 &&
                `${discovery.count}${discovery.more ? ' loaded' : ''} ${discovery.count === 1 ? 'commander' : 'commanders'}`}
            </p>
            <div className="commander-grid" aria-busy={discovery.status === 'loading'}>
              {discovery.status === 'loading' && <CommanderTilePlaceholders />}
              {discovery.suggestions.map(({ card }) => {
                const candidate = toDeckCard(card)
                const legal = commanderPromotionInfo(candidate, remaining)
                const current = outgoing.includes(card.name)
                const chosen = selected?.name === card.name
                return (
                  <CommanderChoiceTile
                    selected={chosen}
                    key={card.oracle_id ?? card.name}
                    card={card}
                    openCard={openCard}
                    action={
                      <button
                        className="export commander-choose"
                        type="button"
                        aria-label={`Choose ${card.name}`}
                        disabled={current || !legal?.canPromote}
                        aria-pressed={chosen}
                        onClick={() => setSelected(candidate)}
                      >
                        {current ? 'Current' : chosen ? 'Selected' : 'Choose'}
                      </button>
                    }
                    note={
                      legal &&
                      !legal.canPromote && <p className="form-error">{blockedReason(legal)}</p>
                    }
                  />
                )
              })}
            </div>
            {discovery.status === 'error' && (
              <p className="form-error discovery-error" role="alert">
                {discovery.error} Change a colour or the name, or reload the page.
              </p>
            )}
            {discovery.status === 'idle' && !discovery.suggestions.length && (
              <p className="discovery-status" role="status">
                No commanders match. Add a colour or change the name.
              </p>
            )}
            {discovery.status === 'idle' && (
              <Pagination
                label="Commander result pages"
                noun="commanders"
                count={discovery.count}
                pageSize={commanderPageSize}
                page={discovery.page}
                onPage={discovery.setPage}
                partial={discovery.more}
              >
                {discovery.more && <span>Narrow the filters to reach more commanders.</span>}
              </Pagination>
            )}
            {selected && (
              <div className="change-commander-confirm">
                <p>
                  New commander: <CardReference card={selected} onOpen={() => openCard(selected)} />
                </p>
                <label className="intro-guide-option">
                  <input
                    type="checkbox"
                    checked={keeps}
                    disabled={!keepFits}
                    onChange={(event) => setKeepOutgoing(event.target.checked)}
                  />{' '}
                  Keep the current commander in the deck
                </label>
                <div className="export-actions">
                  <ChangeOutcome
                    others={others}
                    // A full deck can push the kept commander out too; the sideboard line names it.
                    outgoing={outgoingCards.filter(
                      (card) => !displaced.some((moved) => moved.name === card.name),
                    )}
                    outcome={keeps ? 'stays' : keepFits ? 'leaves' : 'outside'}
                    displaced={displaced}
                    openCard={openCard}
                  />
                  <button
                    className="primary"
                    type="button"
                    onClick={() => {
                      close()
                      changeCommander(selected, keeps)
                    }}
                  >
                    Change commander
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
