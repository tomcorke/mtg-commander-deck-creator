import type { createFoilRenderer } from '../../shared/foil/foil-shader.ts'
import { hideHoverFoil, loadCardTexture } from '../../shared/foil/hover-foil.ts'

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
  front: boolean
  done: boolean
}

// One timeline per batch: all fronts decode before the left-to-right reveal begins.
export function revealBatch(grid: HTMLElement) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  if (motion.matches) return
  const elements = [...grid.querySelectorAll<HTMLElement>('.offered-image > .finished-card')]
  const surfaces: Surface[] = []
  let stopped = false
  let frame = 0
  const dispose = (surface: Surface) => {
    surface.canvas.remove()
    surface.shadow.remove()
    surface.renderer.dispose()
    surface.canvas.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext()
    surface.element.removeAttribute('data-card-reveal')
    surface.done = true
  }
  const stop = () => {
    stopped = true
    clearTimeout(timeout)
    cancelAnimationFrame(frame)
    for (const surface of surfaces) if (!surface.done) dispose(surface)
    for (const element of elements) element.removeAttribute('data-card-reveal')
    motion.removeEventListener('change', stop)
  }
  // Failed or stalled art must never leave a recommendation permanently hidden.
  const timeout = setTimeout(stop, 10000)
  motion.addEventListener('change', stop)
  for (const element of elements) {
    hideHoverFoil(element)
    element.setAttribute('data-card-reveal', 'waiting')
  }
  void (async () => {
    const [{ createFoilRenderer }, back, fronts] = await Promise.all([
      import('../../shared/foil/foil-shader.ts'),
      loadBack(),
      Promise.all(
        elements.map((element) =>
          loadCardTexture(element.querySelector<HTMLImageElement>('img')!.src),
        ),
      ),
    ])
    if (stopped) return
    for (const [index, element] of elements.entries()) {
      const image = element.querySelector<HTMLImageElement>('img')!
      const canvas = document.createElement('canvas')
      canvas.className = 'card-reveal-canvas'
      canvas.setAttribute('aria-hidden', 'true')
      const shadow = document.createElement('span')
      shadow.className = 'card-reveal-shadow'
      shadow.setAttribute('aria-hidden', 'true')
      const ratio = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(image.offsetWidth * 1.25 * ratio)
      canvas.height = Math.round(image.offsetHeight * 1.25 * ratio)
      const renderer = createFoilRenderer(canvas)
      if (!renderer) throw new Error('WebGL unavailable')
      const surface = {
        element,
        image: fronts[index],
        canvas,
        shadow,
        renderer,
        front: false,
        done: false,
      }
      surfaces.push(surface)
      renderer.setImage(back)
      renderer.render(0, { x: 0.5, y: 0.5 }, 0, Math.PI, 0.8)
      element.append(shadow, canvas)
      element.setAttribute('data-card-reveal', 'flipping')
    }
    const start = performance.now()
    const draw = (time: number) => {
      if (stopped) return
      try {
        surfaces.forEach((surface, index) => {
          if (surface.done) return
          const progress = Math.max(0, Math.min(1, (time - start - index * 180) / 750))
          const eased = progress * progress * (3 - 2 * progress)
          surface.shadow.style.transform = `scaleX(${0.35 + 0.65 * Math.abs(Math.cos(Math.PI * (1 - eased)))})`
          if (eased >= 0.5 && !surface.front) {
            surface.renderer.setImage(surface.image)
            surface.front = true
          }
          surface.renderer.render(0, { x: 0.5, y: 0.5 }, time / 1000, Math.PI * (1 - eased), 0.8)
          if (progress === 1) dispose(surface)
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
