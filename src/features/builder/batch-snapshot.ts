export type BatchSnapshot = {
  image: string
  copy?: HTMLElement
  height: number
}

export function captureBatch(grid: HTMLElement): BatchSnapshot[] {
  return [...grid.querySelectorAll<HTMLElement>('.card-offer')].map((article) => {
    const copy = article.querySelector<HTMLElement>('.card-copy')
    const clone = copy?.cloneNode(true) as HTMLElement | undefined
    clone?.querySelectorAll('.batch-old-copy').forEach((element) => element.remove())
    return {
      image: article.querySelector<HTMLImageElement>('.finished-card > img')?.src ?? '',
      copy: clone,
      height: copy?.offsetHeight ?? 0,
    }
  })
}

export function retainBatchCopy(element: HTMLElement, previous: BatchSnapshot) {
  const article = element.closest<HTMLElement>('.card-offer')!
  const copy = article.querySelector<HTMLElement>('.card-copy')!
  const outgoing = previous.copy?.cloneNode(true) as HTMLElement | undefined
  article.inert = true
  article.setAttribute('data-batch-changing', '')
  article.style.setProperty('--batch-copy-opacity', '0')
  copy.style.minHeight = `${previous.height}px`
  if (outgoing) {
    outgoing.classList.add('batch-old-copy')
    outgoing.style.removeProperty('min-height')
    outgoing.style.setProperty('--batch-copy-opacity', '1')
    outgoing.setAttribute('aria-hidden', 'true')
    outgoing.inert = true
    outgoing.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
    copy.append(outgoing)
  }
  return {
    update(oldOpacity: number, newOpacity: number) {
      if (outgoing) outgoing.style.opacity = String(oldOpacity)
      article.style.setProperty('--batch-copy-opacity', String(newOpacity))
    },
    remove() {
      outgoing?.remove()
      copy.style.removeProperty('min-height')
      article.style.removeProperty('--batch-copy-opacity')
      article.removeAttribute('data-batch-changing')
      article.inert = false
    },
  }
}
