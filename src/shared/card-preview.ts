export function showCardPreview(anchor: HTMLElement) {
  const preview = anchor.querySelector<HTMLElement>('.card-image-preview')
  if (!preview) return
  preview.showPopover()
  const target = anchor.getBoundingClientRect()
  const bounds = preview.getBoundingClientRect()
  preview.style.top = `${Math.max(16, Math.min(target.top - bounds.height - 8, window.innerHeight - bounds.height - 16))}px`
  preview.style.left = `${Math.max(16, Math.min(target.left + (target.width - bounds.width) / 2, window.innerWidth - bounds.width - 16))}px`
}

export function hideCardPreview(anchor: HTMLElement) {
  if (!anchor.matches(':hover, :focus-within'))
    anchor.querySelector<HTMLElement>('.card-image-preview')?.hidePopover()
}
