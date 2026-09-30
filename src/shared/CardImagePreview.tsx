import { showCardPreview } from './card-preview.ts'

export function CardImagePreview({
  image,
  placement,
}: {
  image?: string
  placement: 'above' | 'center' | 'reference'
}) {
  return (
    <span
      className={`card-image-preview card-image-preview--${placement}`}
      aria-hidden="true"
      popover={placement === 'reference' ? 'manual' : undefined}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          onLoad={({ currentTarget }) => {
            const preview = currentTarget.parentElement
            if (
              placement === 'reference' &&
              preview?.matches(':popover-open') &&
              preview.parentElement
            )
              showCardPreview(preview.parentElement)
          }}
        />
      ) : (
        'Card art unavailable'
      )}
    </span>
  )
}
