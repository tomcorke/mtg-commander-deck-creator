import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

import {
  commanderPageSize,
  useCommanderDiscovery,
  usePartnerDiscovery,
} from '../../app/useCommanderDiscovery.ts'
import { Pagination } from '../../shared/Pagination.tsx'
import { commanderNames } from '../../domain/commander-catalog.ts'
import { toDeckCard, type DeckCard, type ScryfallCard } from '../../domain/card-model.ts'
import { canAddPartner, pairingLabel } from '../../domain/commander-pairing.ts'
import {
  cardColourIdentity,
  commanderPromotionInfo,
  commandersPromotionInfo,
  missingColourNames,
  promoteDeckCards,
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
import { PartnerChoices } from '../../shared/PartnerChoices.tsx'

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
  pair,
  outgoing,
  outcome,
  displaced,
  openCard,
}: {
  others: number
  pair: boolean
  outgoing: DeckCard[]
  outcome: 'stays' | 'leaves' | 'outside'
  displaced: DeckCard[]
  openCard: (card: DeckCard) => void
}) {
  const their = pair ? 'their' : 'its'
  const leader = pair ? "new commanders'" : "new commander's"
  return (
    <p className="change-commander-outcome" role="status">
      {others > 0 &&
        (others === 1
          ? `The other card fits ${their} colours. `
          : `All ${others} other cards fit ${their} colours. `)}
      {outgoing.length > 0 && (
        <>
          {cardList(outgoing, openCard)} {/* Partners take plural verbs. */}
          {outgoing.length === 1
            ? {
                stays: 'stays in the deck.',
                leaves: 'leaves the deck.',
                outside: `leaves the deck: its colours fall outside the ${leader}.`,
              }[outcome]
            : {
                stays: 'stay in the deck.',
                leaves: 'leave the deck.',
                outside: `leave the deck: their colours fall outside the ${leader}.`,
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

type Choice = { raw: ScryfallCard; card: DeckCard }

type Props = {
  commander: string
  deck: DeckCard[]
  commanderColours: string[]
  openCard: (card: DeckCard) => void
  changeCommander: (card: DeckCard, keepOutgoing: boolean, partner?: DeckCard) => void
}

const sameNames = (left: string[], right: string[]) =>
  left.length === right.length && left.every((name) => right.includes(name))

/** One commander result's choose button and note; a partner ability may cover missing colours. */
function commanderAction(
  choice: Choice,
  current: string[],
  remaining: DeckCard[],
  chosen: boolean,
  choose: (choice: Choice) => void,
) {
  const { card, raw } = choice
  const legal = commanderPromotionInfo(card, remaining)
  const pairable = canAddPartner(card)
  const isCurrent = current.includes(card.name)
  const usable = Boolean(legal && (legal.canPromote || pairable) && (!isCurrent || pairable))
  const currentLabel = current.length > 1 ? 'Change partner' : 'Add partner'
  const label = isCurrent ? (pairable ? currentLabel : 'Current') : 'Choose'
  return {
    action: (
      <button
        className="export commander-choose"
        type="button"
        aria-label={
          isCurrent && pairable ? `${currentLabel} for ${raw.name}` : `Choose ${raw.name}`
        }
        disabled={!usable}
        aria-pressed={chosen}
        onClick={() => choose(choice)}
      >
        {chosen ? 'Selected' : label}
      </button>
    ),
    note: legal && !legal.canPromote && (
      <p className={pairable && !legal.error ? 'change-commander-note' : 'form-error'}>
        {pairable && !legal.error
          ? `Needs a partner with ${missingColourNames(legal)}.`
          : blockedReason(legal)}
      </p>
    ),
  }
}

/** The partner step: legal second commanders for the selected commander, then Skip. */
function PartnerStep({
  selected,
  partner,
  current,
  remaining,
  openCard,
  choosePartner,
  back,
  skip,
}: {
  selected: Choice
  partner: Choice | null
  current: string[]
  remaining: DeckCard[]
  openCard: (card: DeckCard) => void
  choosePartner: (choice: Choice) => void
  back: () => void
  skip: () => void
}) {
  const discovery = usePartnerDiscovery(selected.raw)
  const info = (card: ScryfallCard) =>
    commandersPromotionInfo([selected.card, toDeckCard(card)], remaining)
  return (
    <>
      <button className="nav-back partner-step-back" type="button" onClick={back}>
        Back to commanders
      </button>
      <p className="import-help">
        <CardReference card={selected.card} onOpen={() => openCard(selected.card)} /> has{' '}
        {pairingLabel(selected.card)}. Choose a second commander, or skip to lead alone.
      </p>
      <PartnerChoices
        first={selected.raw}
        discovery={discovery}
        openCard={openCard}
        selected={partner?.card.name}
        action={(card) => {
          const chosen = partner?.card.name === card.name
          const unchanged = sameNames([selected.card.name, card.name], current)
          return (
            <button
              className="export commander-choose"
              type="button"
              aria-label={`Choose ${card.name} as partner`}
              aria-pressed={chosen}
              disabled={unchanged || !info(card).canPromote}
              onClick={() => choosePartner({ raw: card, card: toDeckCard(card) })}
            >
              {unchanged ? 'Current' : chosen ? 'Selected' : 'Choose'}
            </button>
          )
        }}
        note={(card) =>
          !info(card).canPromote && <p className="form-error">{blockedReason(info(card))}</p>
        }
      />
      <div className="export-actions">
        <button className="nav-forward" type="button" onClick={skip}>
          Skip
        </button>
      </div>
    </>
  )
}

/** The sticky footer: the new commanders, what happens to the deck, and the apply button. */
function ChangeConfirm({
  cards,
  current,
  deck,
  commanderColours,
  keepOutgoing,
  setKeepOutgoing,
  openCard,
  partnerAction,
  apply,
}: {
  cards: DeckCard[]
  current: string[]
  deck: DeckCard[]
  commanderColours: string[]
  keepOutgoing: boolean
  setKeepOutgoing: (keep: boolean) => void
  openCard: (card: DeckCard) => void
  partnerAction?: ReactNode
  apply: (keeps: boolean) => void
}) {
  const names = cards.map(({ name }) => name)
  const outgoing = current.filter((name) => !names.includes(name))
  const remaining = deck.filter((card) => !current.includes(card.name))
  const fits = commandersPromotionInfo(cards, remaining)
  // Same colours as the promote action, so an enabled keep never fails on apply.
  const keepFits =
    outgoing.length > 0 && commandersPromotionInfo(cards, deck, commanderColours).canPromote
  const keeps = keepOutgoing && keepFits
  const kept = keeps ? deck : deck.filter((card) => !outgoing.includes(card.name))
  // Mirrors the promote action, so the stated outcome matches what applying does.
  const displaced = fits.canPromote ? promoteDeckCards(kept, [], cards).sideboard : []
  const outgoingCards = deck.filter((card) => outgoing.includes(card.name))
  return (
    <div className="change-commander-confirm">
      <p>
        {cards.length > 1 ? 'New commanders: ' : 'New commander: '}
        {cardList(cards, openCard)}
      </p>
      {partnerAction}
      {!fits.canPromote && (
        <p className="form-error" role="alert">
          {fits.error ??
            `Add a partner with ${missingColourNames(fits)}: other cards in the deck use it.`}
        </p>
      )}
      {outgoing.length > 0 && (
        <label className="intro-guide-option">
          <input
            type="checkbox"
            checked={keeps}
            disabled={!keepFits}
            onChange={(event) => setKeepOutgoing(event.target.checked)}
          />{' '}
          {outgoing.length > 1
            ? 'Keep the current commanders in the deck'
            : 'Keep the current commander in the deck'}
        </label>
      )}
      <div className="export-actions">
        {fits.canPromote && (
          <ChangeOutcome
            others={remaining.filter((card) => !names.includes(card.name)).length}
            pair={cards.length > 1}
            // A full deck can push the kept commander out too; the sideboard line names it.
            outgoing={outgoingCards.filter(
              (card) => !displaced.some((moved) => moved.name === card.name),
            )}
            outcome={keeps ? 'stays' : keepFits ? 'leaves' : 'outside'}
            displaced={displaced}
            openCard={openCard}
          />
        )}
        <button
          className="primary"
          type="button"
          disabled={!fits.canPromote || sameNames(names, current)}
          onClick={() => apply(keeps)}
        >
          Change commander
        </button>
      </div>
    </div>
  )
}

/** "Change commander" button and its dialog: picks a new commander or pair and keeps the deck. */
// eslint-disable-next-line max-lines-per-function -- The dialog markup stays together.
export function ChangeCommander({
  commander,
  deck,
  commanderColours,
  openCard,
  changeCommander,
}: Props) {
  const [open, setOpen] = useState(false)
  const current = commanderNames(commander)
  const remaining = deck.filter((card) => !current.includes(card.name))
  const required = [...new Set(remaining.flatMap((card) => cardColourIdentity(card)))]
  const [colours, setColours] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [keepOutgoing, setKeepOutgoing] = useState(true)
  const [selected, setSelected] = useState<Choice | null>(null)
  const [partner, setPartner] = useState<Choice | null>(null)
  const [step, setStep] = useState<'commanders' | 'partner'>('commanders')
  const discovery = useCommanderDiscovery({ theme: '', colours, search }, open)
  const close = () => setOpen(false)
  const dialog = useDialogFocus(open, close)
  const choose = (choice: Choice) => {
    setSelected(choice)
    setPartner(null)
    if (canAddPartner(choice.card)) setStep('partner')
  }

  return (
    <>
      <button
        className="export"
        type="button"
        onClick={() => {
          setColours([...required].sort())
          setSearch('')
          setSelected(null)
          setPartner(null)
          setStep('commanders')
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
                <h2 id="change-commander-title">
                  {step === 'partner' ? 'Add a partner' : 'Change commander'}
                </h2>
              </div>
              <ModalCloseButton label="Close change commander" onClick={close} />
            </div>
            {step === 'partner' && selected ? (
              <PartnerStep
                selected={selected}
                partner={partner}
                current={current}
                remaining={remaining}
                openCard={openCard}
                choosePartner={setPartner}
                back={() => setStep('commanders')}
                skip={() => {
                  setPartner(null)
                  setStep('commanders')
                }}
              />
            ) : (
              <CommanderStep
                required={required}
                colours={colours}
                setColours={setColours}
                search={search}
                setSearch={setSearch}
                discovery={discovery}
                current={current}
                remaining={remaining}
                selected={selected?.card.name}
                choose={choose}
                openCard={openCard}
              />
            )}
            {selected && (
              <ChangeConfirm
                cards={partner ? [selected.card, partner.card] : [selected.card]}
                current={current}
                deck={deck}
                commanderColours={commanderColours}
                keepOutgoing={keepOutgoing}
                setKeepOutgoing={setKeepOutgoing}
                openCard={openCard}
                partnerAction={
                  step === 'commanders' &&
                  canAddPartner(selected.card) && (
                    <button className="export" type="button" onClick={() => setStep('partner')}>
                      {partner ? 'Change partner' : 'Add a partner'}
                    </button>
                  )
                }
                apply={(keeps) => {
                  close()
                  changeCommander(selected.card, keeps, partner?.card)
                }}
              />
            )}
          </section>
        </div>
      )}
    </>
  )
}

/** The commander search: colours, name, and the result grid with its pages. */
function CommanderStep({
  required,
  colours,
  setColours,
  search,
  setSearch,
  discovery,
  current,
  remaining,
  selected,
  choose,
  openCard,
}: {
  required: string[]
  colours: string[]
  setColours: Dispatch<SetStateAction<string[]>>
  search: string
  setSearch: (search: string) => void
  discovery: ReturnType<typeof useCommanderDiscovery>
  current: string[]
  remaining: DeckCard[]
  selected?: string
  choose: (choice: Choice) => void
  openCard: (card: DeckCard) => void
}) {
  return (
    <>
      <p className="import-help">
        {required.length
          ? 'Commanders must cover every colour your other cards use. Add colours to widen the search.'
          : 'Any commander fits the cards you have so far. Pick colours to narrow the search.'}
      </p>
      <ColourPicker
        colours={colours}
        toggleColour={(colour) =>
          setColours((chosen) =>
            chosen.includes(colour)
              ? chosen.filter((item) => item !== colour)
              : [...chosen, colour],
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
      <CommanderResultTiles
        discovery={discovery}
        current={current}
        remaining={remaining}
        selected={selected}
        choose={choose}
        openCard={openCard}
      />
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
    </>
  )
}

function CommanderResultTiles({
  discovery,
  current,
  remaining,
  selected,
  choose,
  openCard,
}: {
  discovery: ReturnType<typeof useCommanderDiscovery>
  current: string[]
  remaining: DeckCard[]
  selected?: string
  choose: (choice: Choice) => void
  openCard: (card: DeckCard) => void
}) {
  return (
    <div className="commander-grid" aria-busy={discovery.status === 'loading'}>
      {discovery.status === 'loading' && <CommanderTilePlaceholders />}
      {discovery.suggestions.map(({ card }) => {
        const chosen = selected === card.name
        const { action, note } = commanderAction(
          { raw: card, card: toDeckCard(card) },
          current,
          remaining,
          chosen,
          choose,
        )
        return (
          <CommanderChoiceTile
            selected={chosen}
            key={card.oracle_id ?? card.name}
            card={card}
            openCard={openCard}
            action={action}
            note={note}
          />
        )
      })}
    </div>
  )
}
