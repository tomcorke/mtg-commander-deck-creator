import type { createFoilRenderer } from '../../shared/foil/foil-shader.ts'
import { hideHoverFoil, loadCardTexture } from '../../shared/foil/hover-foil.ts'

import { retainBatchCopy, type BatchSnapshot } from './batch-snapshot.ts'
import { flipStagger, revealFrame } from './reveal-timing.ts'

export type BatchRevealState = 'idle' | 'preparing' | 'flipping'

const backUrl = '/images/mtg-card-back.png'
let backPromise: Promise<HTMLImageElement> | undefined
function loadBack() {
  backPromise ??= (async () => {
    const image = new Image()
    image.src = backUrl
    await image.decode()
    return image
  })().catch((error: unknown) => {
    backPromise = undefined
    throw error
  })
  return backPromise
}

type Surface = {
  element: HTMLElement
  image: HTMLImageElement
  canvas: HTMLCanvasElement
  shadow: HTMLSpanElement
  renderer: NonNullable<ReturnType<typeof createFoilRenderer>>
  oldImage?: HTMLImageElement
  copy?: ReturnType<typeof retainBatchCopy>
  texture: string
  done: boolean
}

// One timeline per batch: all fronts decode before the left-to-right reveal begins.
export function revealBatch(
  grid: HTMLElement,
  previous?: BatchSnapshot[],
  onStateChange?: (state: BatchRevealState) => void,
) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  if (motion.matches) {
    onStateChange?.('idle')
    return
  }
  onStateChange?.('preparing')
  const elements = [...grid.querySelectorAll<HTMLElement>('.offered-image > .finished-card')]
  const copies = elements.map((element, index) =>
    previous?.[index] ? retainBatchCopy(element, previous[index]) : undefined,
  )
  const surfaces: Surface[] = []
  let stopped = false
  let frame = 0

  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimeout(timeout)
    cancelAnimationFrame(frame)
    for (const surface of surfaces) if (!surface.done) dispose(surface)
    for (const [index, element] of elements.entries()) {
      copies[index]?.remove()
      element.style.removeProperty('background-image')
      element.removeAttribute('data-card-reveal-phase')
      element.removeAttribute('data-card-reveal')
    }
    motion.removeEventListener('change', stop)
    onStateChange?.('idle')
  }
  // Failed or stalled art must never leave a recommendation permanently hidden.
  const timeout = setTimeout(stop, 10000)
  motion.addEventListener('change', stop)
  for (const [index, element] of elements.entries()) {
    if (previous?.[index]?.image)
      element.style.backgroundImage = `url(${JSON.stringify(previous[index].image)})`
    hideHoverFoil(element)
    element.setAttribute('data-card-reveal', 'waiting')
  }
  void (async () => {
    const [{ createFoilRenderer }, back, fronts, oldFronts] = await Promise.all([
      import('../../shared/foil/foil-shader.ts'),
      loadBack(),
      Promise.all(
        elements.map((element) =>
          loadCardTexture(element.querySelector<HTMLImageElement>('img')!.src),
        ),
      ),
      Promise.all(
        elements.map((_, index) =>
          previous?.[index]?.image ? loadCardTexture(previous[index].image) : undefined,
        ),
      ),
    ])
    if (stopped) return
    for (const [index, element] of elements.entries()) {
      const surface = createSurface(
        { element, image: fronts[index], oldImage: oldFronts[index], copy: copies[index] },
        createFoilRenderer,
      )
      surfaces.push(surface)
      surface.renderer.setImage(surface.oldImage ?? back)
      surface.renderer.render(0, { x: 0.5, y: 0.5 }, 0, surface.oldImage ? 0 : Math.PI, 0.8)
      element.append(surface.shadow, surface.canvas)
      element.style.removeProperty('background-image')
      element.setAttribute('data-card-reveal-phase', surface.oldImage ? 'leaving' : 'entering')
      element.setAttribute('data-card-reveal', 'flipping')
    }
    onStateChange?.('flipping')
    const start = performance.now()
    const draw = (time: number) => {
      if (stopped) return
      try {
        surfaces.forEach((surface, index) => {
          if (surface.done) return
          drawSurface(surface, time - start - index * flipStagger, back, time)
        })
      } catch {
        stop()
        return
      }
      if (surfaces.every((surface) => surface.done)) stop()
      else frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
  })().catch(stop)
  return stop
}

function dispose(surface: Surface) {
  surface.canvas.remove()
  surface.shadow.remove()
  surface.renderer.dispose()
  surface.canvas.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext()
  surface.copy?.remove()
  surface.element.removeAttribute('data-card-reveal-phase')
  surface.element.style.removeProperty('background-image')
  surface.element.removeAttribute('data-card-reveal')
  surface.done = true
}

function createSurface(
  source: Pick<Surface, 'element' | 'image' | 'oldImage' | 'copy'>,
  createRenderer: typeof createFoilRenderer,
): Surface {
  const image = source.element.querySelector<HTMLImageElement>('img')!
  const canvas = document.createElement('canvas')
  canvas.className = 'card-reveal-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const shadow = document.createElement('span')
  shadow.className = 'card-reveal-shadow'
  shadow.setAttribute('aria-hidden', 'true')
  const ratio = Math.min(devicePixelRatio || 1, 2)
  canvas.width = Math.round(image.offsetWidth * 1.25 * ratio)
  canvas.height = Math.round(image.offsetHeight * 1.25 * ratio)
  const renderer = createRenderer(canvas)
  if (!renderer) throw new Error('WebGL unavailable')
  return {
    ...source,
    canvas,
    shadow,
    renderer,
    texture: source.oldImage ? 'old' : 'back',
    done: false,
  }
}

function drawSurface(surface: Surface, elapsed: number, back: HTMLImageElement, time: number) {
  const state = revealFrame(elapsed, !!surface.oldImage)
  surface.shadow.style.transform = `scaleX(${0.35 + 0.65 * Math.abs(Math.cos(state.angle))})`
  surface.copy?.update(state.oldOpacity, state.newOpacity)
  if (surface.element.getAttribute('data-card-reveal-phase') !== state.phase)
    surface.element.setAttribute('data-card-reveal-phase', state.phase)
  if (state.side !== surface.texture) {
    surface.renderer.setImage(
      state.side === 'back' ? back : state.side === 'old' ? surface.oldImage! : surface.image,
    )
    surface.texture = state.side
  }
  surface.renderer.render(0, { x: 0.5, y: 0.5 }, time / 1000, state.angle, 0.8)
  if (state.done) dispose(surface)
}
