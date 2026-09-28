export function CardImagePreview({
  image,
  placement,
}: {
  image?: string
  placement: 'above' | 'center'
}) {
  return (
    <span className={`card-image-preview card-image-preview--${placement}`} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" /> : 'Card art unavailable'}
    </span>
  )
}
