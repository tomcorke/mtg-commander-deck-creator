import type { Card, DeckCard } from '../../domain/card-model.ts'
import type { RecommendationScoreRating } from '../../domain/recommendation-scoring.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { OracleText } from '../../shared/ManaSymbols.tsx'
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

export function CardTile({
  card,
  status,
  openCard,
  note,
  fit,
  selection,
  quantity,
}: {
  card: DoctorCard
  status: string
  openCard: (card: DoctorCard) => void
  note?: string
  fit?: RecommendationScoreRating
  selection?: CardSelection
  quantity?: CardQuantity
}) {
  return (
    <article
      className={`doctor-card-tile${selection?.checked || quantity?.value ? ' selected' : ''}`}
    >
      {quantity && (
        <label className="doctor-card-select">
          <span>Cut</span>
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
          <span>of {quantity.max}</span>
        </label>
      )}
      {selection && (
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
      )}
      <button
        className="doctor-card-art"
        type="button"
        aria-label={`Show details for ${card.name}`}
        onClick={() => openCard(card)}
      >
        {card.image ? <SmallCardImage image={card.image} /> : <span>No card art</span>}
      </button>
      <div className="doctor-card-copy">
        <span className={`doctor-card-status${status.startsWith('In deck') ? ' in-deck' : ''}`}>
          {status}
        </span>
        {fit && (
          <span className={`doctor-card-fit doctor-card-fit--${fit}`}>
            <span className="doctor-card-fit-stars" aria-hidden="true">
              {'★'.repeat(fitStars[fit])}
              {'☆'.repeat(5 - fitStars[fit])}
            </span>
            {fitLabels[fit]}
          </span>
        )}
        <CardReference card={card} onOpen={() => openCard(card)} />
        {card.manaCost && (
          <small className="doctor-card-cost">
            <OracleText text={card.manaCost} />
          </small>
        )}
        {note && <small>{note}</small>}
      </div>
    </article>
  )
}
