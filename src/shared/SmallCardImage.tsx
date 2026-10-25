import { CardImagePreview } from './CardImagePreview.tsx'

export function SmallCardImage({ image }: { image: string }) {
  if (!image) return null
  return (
    <span className="small-card-image" aria-hidden="true">
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
      <CardImagePreview image={image} placement="center" />
    </span>
  )
}
