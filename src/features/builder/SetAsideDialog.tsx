import { useRef, useState, type ReactNode } from 'react'
import type { Card } from '../../domain/card-model.ts'
import type { setAsideCards } from '../../domain/decision-undo.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { CardTile } from '../../shared/CardTile.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'

type SetAsideAction = 'add' | 'later' | 'return'
type Outcome = { error: string; notice: string }
type Act = (name: string, to: SetAsideAction) => void

const returns = (batches: number) =>
  batches === 1 ? 'Eligible again next batch' : `Eligible again in ${batches} batches`

/**
 * Later & ignored: cards set aside in earlier batches. Later cards can be added or brought back
 * now; ignored cards can be added, moved to Later, or un-ignored.
 */
export function SetAsideDialog({
  cards,
  addBlocked,
  toSideboard,
  zoneToggle,
  onAction,
  onOpenCard,
  onClose,
}: {
  cards: ReturnType<typeof setAsideCards>
  /** Why Add can't take this card now, or empty. */
  addBlocked: (card: Card) => string
  toSideboard: boolean
  zoneToggle: ReactNode
  onAction: (name: string, to: SetAsideAction) => Outcome
  onOpenCard: (card: Card) => void
  onClose: () => void
}) {
  const dialog = useDialogFocus(true, onClose)
  const [outcome, setOutcome] = useState<Outcome>({ error: '', notice: '' })
  const status = useRef<HTMLParagraphElement>(null)
  const act: Act = (name, to) => {
    setOutcome(onAction(name, to))
    // The tile that held focus leaves the list; keep focus in the dialog, on the outcome.
    status.current?.focus()
  }
  const tile = (card: Card, detail: string, actions: ReactNode) => (
    <SetAsideTile key={card.name} card={card} detail={detail} onOpenCard={onOpenCard}>
      <button
        type="button"
        className="primary"
        disabled={Boolean(addBlocked(card))}
        title={addBlocked(card) || undefined}
        onClick={() => act(card.name, 'add')}
      >
        {toSideboard ? 'Add to sideboard' : 'Add to deck'}
      </button>
      {actions}
    </SetAsideTile>
  )
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        {...dialog}
        className="export-modal collection-browser-modal set-aside-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-aside-title"
      >
        <SetAsideHeading onClose={onClose} />
        <div className="collection-browser-filters">{zoneToggle}</div>
        <p
          ref={status}
          tabIndex={-1}
          className={outcome.error ? 'form-error' : 'set-aside-status'}
          role={outcome.error ? 'alert' : 'status'}
        >
          {outcome.error || outcome.notice}
        </p>
        <SetAsideSection id="set-aside-later" title="Later" empty="No cards waiting for later.">
          {cards.later.map(({ card, returnsIn }) =>
            tile(
              card,
              returns(returnsIn),
              <button type="button" className="export" onClick={() => act(card.name, 'return')}>
                Bring back now
              </button>,
            ),
          )}
        </SetAsideSection>
        <SetAsideSection id="set-aside-ignored" title="Ignored" empty="No ignored cards.">
          {cards.ignored.map(({ name, card }) =>
            card ? (
              tile(
                card,
                card.typeLine,
                <>
                  <button type="button" className="export" onClick={() => act(name, 'later')}>
                    Move to Later
                  </button>
                  <UnignoreButton name={name} act={act} />
                </>,
              )
            ) : (
              // Saves from before ignored cards kept their data have the name only.
              <div className="card-tile set-aside-name-only" key={name}>
                <CardReference card={{ name, image: '' }} onOpen={() => {}} disabled />
                <UnignoreButton name={name} act={act} />
              </div>
            ),
          )}
        </SetAsideSection>
      </section>
    </div>
  )
}

function SetAsideHeading({ onClose }: { onClose: () => void }) {
  return (
    <div className="export-heading">
      <div>
        <p className="eyebrow">Recommendations</p>
        <h2 id="set-aside-title">Later & ignored</h2>
        <p className="set-aside-intro">
          Cards you set aside in earlier batches. Later cards come back on their own; ignored cards
          stay out of recommendations until you restore them.
        </p>
      </div>
      <ModalCloseButton onClick={onClose} label="Close Later and ignored" />
    </div>
  )
}

function SetAsideSection({
  id,
  title,
  empty,
  children,
}: {
  id: string
  title: string
  empty: string
  children: ReactNode[]
}) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>
        {title} ({children.length})
      </h3>
      {children.length ? (
        <div className="collection-browser-grid">{children}</div>
      ) : (
        <p className="collection-browser-empty">{empty}</p>
      )}
    </section>
  )
}

/** The collection browser's tile, with a column of set-aside actions. */
function SetAsideTile({
  card,
  detail,
  onOpenCard,
  children,
}: {
  card: Card
  detail: string
  onOpenCard: (card: Card) => void
  children: ReactNode
}) {
  return (
    <CardTile
      className="collection-browser-tile"
      art={
        <button
          className="collection-browser-art"
          type="button"
          aria-label={`Show details for ${card.name}`}
          onClick={() => onOpenCard(card)}
        >
          <SmallCardImage image={card.image} placement="reference" />
        </button>
      }
      name={<CardReference card={card} onOpen={() => onOpenCard(card)} />}
      cost={card.manaCost || card.faces[0]?.manaCost}
      detail={detail}
      actions={<div className="set-aside-actions">{children}</div>}
    />
  )
}

function UnignoreButton({ name, act }: { name: string; act: Act }) {
  return (
    <button type="button" className="export" onClick={() => act(name, 'return')}>
      Un-ignore
    </button>
  )
}
