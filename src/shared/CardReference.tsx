import type { Card, CardFinish } from '../domain/card-model.ts'
import { FinishedCardImage } from './CardArt.tsx'
import { CardImagePreview } from './CardImagePreview.tsx'
import { showCardPreview, hideCardPreview } from './card-preview.ts'

type Props = {
  card: Pick<Card, 'name' | 'image'> &
    Partial<Pick<Card, 'backImage' | 'finish' | 'foilType' | 'set' | 'collectorNumber'>>
  onOpen: () => void
  thumbnail?: boolean
  disabled?: boolean
  className?: string
}

export function CardReference({
  card,
  onOpen,
  thumbnail = false,
  disabled = false,
  className = '',
}: Props) {
  return (
    <span
      className="card-reference"
      onMouseEnter={({ currentTarget }) => showCardPreview(currentTarget)}
      onFocus={({ currentTarget }) => showCardPreview(currentTarget)}
      onMouseLeave={({ currentTarget }) => hideCardPreview(currentTarget)}
      onBlur={({ currentTarget }) => hideCardPreview(currentTarget)}
    >
      <button
        type="button"
        className={`card-reference-name ${className}`}
        aria-label={`Show details for ${card.name}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={onOpen}
      >
        {thumbnail && card.image && (
          <img
            className="card-reference-thumbnail"
            src={card.image}
            alt=""
            loading="lazy"
            // Keep the thumbnail's space as a plain placeholder when the image fails.
            onError={({ currentTarget }) => {
              currentTarget.removeAttribute('src')
              currentTarget.classList.add('missing')
            }}
          />
        )}
        {card.name}
      </button>
      <CardImagePreview image={card.image} placement="reference">
        {card.image && (
          <FinishedCardImage
            image={card.image}
            backImage={card.backImage}
            finish={card.finish as CardFinish | undefined}
            foilType={card.foilType}
            set={card.set}
            collectorNumber={card.collectorNumber}
            alt={card.name}
            cardName={card.name}
            className=""
          />
        )}
      </CardImagePreview>
    </span>
  )
}
