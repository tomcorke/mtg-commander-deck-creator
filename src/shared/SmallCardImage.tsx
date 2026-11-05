import { useEffect, useRef } from 'react'
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
  const ref = useRef<HTMLSpanElement>(null)
  const reference = placement === 'reference'
  useEffect(() => {
    const span = ref.current
    if (!reference || !span) return
    // The image is aria-hidden, so hover and keyboard focus come from the enclosing control.
    const anchor = span.closest<HTMLElement>('button, a') ?? span
    const show = () => showCardPreview(anchor)
    const hide = () => hideCardPreview(anchor)
    const events = [
      ['mouseenter', show],
      ['focusin', show],
      ['mouseleave', hide],
      ['focusout', hide],
    ] as const
    for (const [name, handler] of events) anchor.addEventListener(name, handler)
    return () => {
      for (const [name, handler] of events) anchor.removeEventListener(name, handler)
    }
  }, [reference, image])
  if (!image) return null
  return (
    <span className="small-card-image" aria-hidden="true" ref={ref}>
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
