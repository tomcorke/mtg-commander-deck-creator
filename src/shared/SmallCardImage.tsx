import { CardImagePreview } from './CardImagePreview.tsx'

export function SmallCardImage({ image }: { image: string }) {
  if (!image) return null
  return (
    <span className="small-card-image" aria-hidden="true">
      <img className="small-card-image-thumbnail" src={image} alt="" loading="lazy" />
      <CardImagePreview image={image} placement="center" />
    </span>
  )
}
