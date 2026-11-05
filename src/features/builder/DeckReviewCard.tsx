import type { ReactNode } from 'react'
import type { Card, DeckCard } from '../../domain/card-model.ts'
import type { RecommendationScoreRating } from '../../domain/recommendation-scoring.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { CardTile } from '../../shared/CardTile.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'

type DoctorCard = Card | DeckCard

type CardSelection = {
  checked: boolean
  label: string
  order?: number
  disabled?: boolean
  onChange: () => void
}

type CardQuantity = { value: number; max: number; onChange: (value: number) => void }

const fitLabels: Record<RecommendationScoreRating, string> = {
  top: 'Top fit',
  strong: 'Strong fit',
  recommended: 'Recommended',
  possible: 'Possible fit',
  low: 'Lower fit',
}
const fitStars: Record<RecommendationScoreRating, number> = {
  top: 5,
  strong: 4,
  recommended: 3,
  possible: 2,
  low: 1,
}

export function ReviewCardTile({
  card,
  status,
  openCard,
  note,
  fit,
  selection,
  quantity,
  children,
}: {
  card: DoctorCard
  status?: string
  openCard: (card: DoctorCard) => void
  note?: string
  fit?: RecommendationScoreRating
  selection?: CardSelection
  quantity?: CardQuantity
  /** Extras below the detail line, such as a disclosure. */
  children?: ReactNode
}) {
  return (
    <CardTile
      size="small"
      className="doctor-card-tile"
      selected={Boolean(selection?.checked || quantity?.value)}
      selection={
        quantity ? (
          <div className="doctor-card-select" role="group" aria-label={`Cut ${card.name}`}>
            <span aria-hidden="true">Cut</span>
            <span className="target-stepper">
              <button
                type="button"
                className="deck-add"
                aria-label={`One fewer ${card.name} to cut`}
                disabled={quantity.value <= 0}
                onClick={() => quantity.onChange(quantity.value - 1)}
              >
                −
              </button>
              <input
                type="number"
                min="0"
                max={quantity.max}
                value={quantity.value}
                aria-label={`Copies of ${card.name} to cut`}
                onChange={(event) =>
                  quantity.onChange(Math.min(quantity.max, Math.max(0, Number(event.target.value))))
                }
              />
              <button
                type="button"
                className="deck-add"
                aria-label={`One more ${card.name} to cut`}
                disabled={quantity.value >= quantity.max}
                onClick={() => quantity.onChange(quantity.value + 1)}
              >
                +
              </button>
            </span>
          </div>
        ) : selection ? (
          <label className="doctor-card-select">
            <input
              type="checkbox"
              checked={selection.checked}
              disabled={selection.disabled}
              aria-label={`${selection.label} ${card.name}`}
              onChange={selection.onChange}
            />
            <span>
              {selection.order ? `${selection.order}. ` : ''}
              {selection.label}
            </span>
          </label>
        ) : undefined
      }
      art={
        <button
          className="doctor-card-art"
          type="button"
          aria-label={`Show details for ${card.name}`}
          onClick={() => openCard(card)}
        >
          {card.image ? <SmallCardImage image={card.image} /> : <span>No card art</span>}
        </button>
      }
      badges={
        status && (
          <span className={`doctor-card-status${status.startsWith('In deck') ? ' in-deck' : ''}`}>
            {status}
          </span>
        )
      }
      name={<CardReference card={card} onOpen={() => openCard(card)} />}
      cost={card.manaCost}
      detail={
        (fit || note) && (
          <>
            {fit && (
              <span className={`doctor-card-fit doctor-card-fit--${fit}`}>
                <span className="doctor-card-fit-stars" aria-hidden="true">
                  {'★'.repeat(fitStars[fit])}
                  <span className="doctor-card-fit-empty">{'★'.repeat(5 - fitStars[fit])}</span>
                </span>{' '}
                {fitLabels[fit]}
              </span>
            )}
            {fit && note && ' · '}
            {note}
          </>
        )
      }
    >
      {children}
    </CardTile>
  )
}
