import type { ReactNode } from 'react'
import { showCardPreview } from './card-preview.ts'

export function CardImagePreview({
  image,
  placement,
  children,
}: {
  image?: string
  placement: 'above' | 'center' | 'reference'
  children?: ReactNode
}) {
  return (
    <span
      className={`card-image-preview card-image-preview--${placement}`}
      aria-hidden="true"
      popover={placement === 'reference' ? 'manual' : undefined}
      onLoad={({ currentTarget }) => {
        if (
          placement === 'reference' &&
          currentTarget.matches(':popover-open') &&
          currentTarget.parentElement
        )
          showCardPreview(currentTarget.parentElement)
      }}
    >
      {children ?? (image ? <img src={image} alt="" loading="lazy" /> : 'Card art unavailable')}
    </span>
  )
}
