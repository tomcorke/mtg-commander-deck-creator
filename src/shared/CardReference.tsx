import type { Card } from '../domain/card-model.ts'
import { CardImagePreview } from './CardImagePreview.tsx'
import { showCardPreview, hideCardPreview } from './card-preview.ts'

type Props = {
  card: Pick<Card, 'name' | 'image'>
  onOpen: () => void
  thumbnail?: boolean
}

export function CardReference({ card, onOpen, thumbnail = false }: Props) {
  return (
    <span
      className="card-reference"
      onMouseEnter={({ currentTarget }) => showCardPreview(currentTarget)}
      onFocus={({ currentTarget }) => showCardPreview(currentTarget)}
      onMouseLeave={({ currentTarget }) => hideCardPreview(currentTarget)}
      onBlur={({ currentTarget }) => hideCardPreview(currentTarget)}
    >
      {thumbnail && card.image && (
        <img className="card-reference-thumbnail" src={card.image} alt="" loading="lazy" />
      )}
      <button
        type="button"
        className="card-reference-name"
        aria-label={`Show details for ${card.name}`}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        {card.name}
      </button>
      <CardImagePreview image={card.image} placement="reference" />
    </span>
  )
}
