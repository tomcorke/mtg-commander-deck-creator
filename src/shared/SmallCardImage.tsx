import { CardImagePreview } from './CardImagePreview.tsx'
import { hideCardPreview, showCardPreview } from './card-preview.ts'

export function SmallCardImage({
  image,
  placement = 'center',
}: {
  image: string
  // 'reference' renders the preview in the top layer so scroll containers cannot clip it.
  placement?: 'center' | 'reference'
}) {
  if (!image) return null
  const reference = placement === 'reference'
  return (
    <span
      className="small-card-image"
      aria-hidden="true"
      onMouseEnter={reference ? ({ currentTarget }) => showCardPreview(currentTarget) : undefined}
      onMouseLeave={reference ? ({ currentTarget }) => hideCardPreview(currentTarget) : undefined}
    >
      <img
        className="small-card-image-thumbnail"
        src={image}
        alt=""
        loading="lazy"
        // Keep the thumbnail's space as a plain placeholder when the image fails.
        onError={({ currentTarget }) => {
          currentTarget.removeAttribute('src')
          currentTarget.classList.add('missing')
        }}
      />
      <CardImagePreview image={image} placement={placement} />
    </span>
  )
}
