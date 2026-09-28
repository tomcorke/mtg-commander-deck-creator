import type { Card } from '../domain/card-model.ts'
import { CardImagePreview } from './CardImagePreview.tsx'

type Props = {
  card: Pick<Card, 'name' | 'image'>
  onOpen: () => void
}

export function CardReference({ card, onOpen }: Props) {
  return (
    <span className="card-reference">
      <button
        type="button"
        className="card-reference-name"
        aria-label={`Show details for ${card.name}`}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        {card.name}
      </button>
      <CardImagePreview image={card.image} placement="above" />
    </span>
  )
}
