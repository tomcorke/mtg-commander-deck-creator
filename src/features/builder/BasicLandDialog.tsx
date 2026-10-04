import { useEffect, useRef, type RefObject } from 'react'

import type { Card } from '../../domain/card-model.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'

type Props = {
  basicLandState: 'idle' | 'loading' | 'error'
  basicLands: { name: string; count: number }[]
  landGap: number
  calculatedLandTarget: number
  nonbasicLands: Card[]
  cardSearchButton: RefObject<HTMLButtonElement | null>
  opener: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onAddBasicLands: (lands: { name: string; count: number }[]) => void
  onAddRecommendation: (card: Card) => void
  onOpenCard: (card: Card) => void
}

// eslint-disable-next-line max-lines-per-function -- The dialog markup stays intact to preserve its established focus and accessibility behavior.
export function BasicLandDialog({
  basicLandState,
  basicLands,
  landGap,
  calculatedLandTarget,
  nonbasicLands,
  cardSearchButton,
  opener,
  onClose,
  onAddBasicLands,
  onAddRecommendation,
  onOpenCard,
}: Props) {
  const dialog = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = dialog.current
    const openerElement = opener.current
    const searchButton = cardSearchButton.current
    if (!element) return
    element.querySelector<HTMLButtonElement>('.modal-close')?.focus()
    return () => {
      if (element.contains(document.activeElement) || document.activeElement === document.body)
        (openerElement?.isConnected ? openerElement : searchButton)?.focus()
    }
  }, [cardSearchButton, opener])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && basicLandState !== 'loading') onClose()
      }}
    >
      <section
        ref={dialog}
        className="export-modal basic-land-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="basic-land-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            if (basicLandState !== 'loading') onClose()
          }
          if (event.key !== 'Tab') return
          const buttons =
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
          const first = buttons[0]
          const last = buttons[buttons.length - 1]
          if (!first || !last) event.preventDefault()
          else if (
            (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last)
          ) {
            event.preventDefault()
            ;(event.shiftKey ? last : first).focus()
          }
        }}
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Complete mana base</p>
            <h2 id="basic-land-title">Choose lands</h2>
          </div>
          <ModalCloseButton
            disabled={basicLandState === 'loading'}
            onClick={onClose}
            label="Close land choices"
          />
        </div>
        <p aria-live="polite" aria-atomic="true">
          Room for {landGap} more lands toward your {calculatedLandTarget}-land target. Existing
          cards stay unchanged.
        </p>
        {nonbasicLands.length > 0 && (
          <section className="land-fill-step" aria-labelledby="nonbasic-land-title">
            <h3 id="nonbasic-land-title">Start with nonbasic lands</h3>
            <p>Recommended for this commander. Each one you add replaces a basic.</p>
            <ul className="nonbasic-land-list">
              {nonbasicLands.map((card) => (
                <li key={card.name}>
                  <CardReference
                    card={card}
                    onOpen={() => onOpenCard(card)}
                    thumbnail
                    disabled={basicLandState === 'loading'}
                  />
                  <button
                    type="button"
                    className="compact-action"
                    aria-label={`Add ${card.name} to deck`}
                    disabled={basicLandState === 'loading'}
                    onClick={(event) => {
                      const next =
                        event.currentTarget
                          .closest('li')
                          ?.nextElementSibling?.querySelector<HTMLButtonElement>(
                            '.compact-action',
                          ) ?? dialog.current?.querySelector<HTMLButtonElement>('.modal-close')
                      onAddRecommendation(card)
                      next?.focus()
                    }}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="land-fill-step" aria-labelledby="basic-land-split-title">
          <h3 id="basic-land-split-title">
            {nonbasicLands.length > 0 ? 'Then fill the rest with basics' : 'Basic land split'}
          </h3>
          <p>Split by the coloured mana symbols in your deck.</p>
          <ul className="basic-land-plan">
            {basicLands.map((land) => (
              <li key={land.name}>
                <span>{land.name}</span>
                <b>{land.count}</b>
              </li>
            ))}
          </ul>
        </section>
        {basicLandState === 'error' && (
          <p className="form-error" role="alert">
            Could not load basic lands. Try again.
          </p>
        )}
        <div className="export-actions">
          <button
            type="button"
            className="export"
            onClick={onClose}
            disabled={basicLandState === 'loading'}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={basicLandState === 'loading' || landGap === 0}
            onClick={() => onAddBasicLands(basicLands)}
          >
            {basicLandState === 'loading'
              ? 'Adding…'
              : `Add ${landGap} basic${landGap === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </div>
  )
}
