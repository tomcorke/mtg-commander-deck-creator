import type { CardFinish } from '../../domain/card-model.ts'
import type { createFoilRenderer, foilShaderTypes } from './foil-shader.ts'

type Pointer = { x: number; y: number }
export type FoilCard = {
  image: string
  finish?: CardFinish
  foilType?: string
  set?: string
  collectorNumber?: string
  name?: string
}
type Surface = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  renderer: NonNullable<ReturnType<typeof createFoilRenderer>>
  types: typeof foilShaderTypes
}
type Hover = {
  element: HTMLElement
  image: HTMLImageElement
  card: FoilCard
  pointer: Pointer
  surface?: Surface
  frame: number
  resize: ResizeObserver
  draw: () => void
}

let surfacePromise: Promise<Surface | null> | undefined
let active: Hover | undefined
let unavailable = false
let textureKey = ''
let reducedMotion: MediaQueryList | undefined
const images = new Map<string, Promise<HTMLImageElement>>()

function loadSurface() {
  surfacePromise ??= import('./foil-shader.ts')
    .then(({ createFoilRenderer, foilShaderTypes }) => {
      const canvas = document.createElement('canvas')
      canvas.className = 'foil-canvas'
      canvas.setAttribute('aria-hidden', 'true')
      canvas.addEventListener('webglcontextlost', () => {
        // ponytail: use CSS until reload; restore this same context if recovery is needed.
        unavailable = true
        if (active) hideHoverFoil(active.element)
      })
      const renderer = createFoilRenderer(canvas)
      const gl = canvas.getContext('webgl')
      if (!renderer || !gl) {
        unavailable = true
        return null
      }
      return { canvas, gl, renderer, types: foilShaderTypes }
    })
    .catch(() => {
      unavailable = true
      return null
    })
  return surfacePromise
}

export function loadCardTexture(url: string) {
  let pending = images.get(url)
  if (!pending) {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.src = url
    pending = image.decode().then(() => image)
    images.set(url, pending)
    // Bound decoded-image memory on pages with hundreds of cards.
    if (images.size > 32) images.delete(images.keys().next().value!)
    void pending.catch(() => {
      if (images.get(url) === pending) images.delete(url)
    })
  }
  return pending
}

function motionReduced() {
  if (!reducedMotion) {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion?.matches && active) hideHoverFoil(active.element)
    })
  }
  return reducedMotion.matches
}

export function foilPointer(element: HTMLElement, clientX: number, clientY: number): Pointer {
  const bounds = element.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height)),
  }
}

export function showHoverFoil(element: HTMLElement, card: FoilCard, pointer?: Pointer) {
  if (element.hasAttribute('data-card-reveal')) return
  if (active) hideHoverFoil(active.element)
  if (unavailable || motionReduced() || (card.finish !== 'foil' && card.finish !== 'etched')) return
  const image = element.querySelector<HTMLImageElement>('img:not(.finish-edges)')
  if (!image) return
  const hover: Hover = {
    element,
    image,
    card,
    pointer: pointer ?? {
      x: parseFloat(element.style.getPropertyValue('--foil-x') || '50') / 100,
      y: parseFloat(element.style.getPropertyValue('--foil-y') || '50') / 100,
    },
    frame: 0,
    resize: new ResizeObserver(() => queueDraw(hover)),
    draw: () => queueDraw(hover),
  }
  active = hover
  image.addEventListener('load', hover.draw)
  hover.resize.observe(image)
  void prepareHover(hover).catch(() => {
    if (active === hover) hideHoverFoil(element)
  })
}

async function prepareHover(hover: Hover) {
  const [surface, image] = await Promise.all([loadSurface(), loadCardTexture(hover.card.image)])
  if (active !== hover) return
  if (!surface || unavailable) {
    hideHoverFoil(hover.element)
    return
  }
  // Decode asynchronously, then upload once outside the pointer handler, in idle time when
  // available. Subsequent pointer frames only change uniforms, not the texture.
  await new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window)
      window.requestIdleCallback(() => resolve(), { timeout: 250 })
    else setTimeout(resolve, 0)
  })
  if (active !== hover || unavailable || surface.gl.isContextLost()) return
  const { card } = hover
  const key = JSON.stringify([card.image, card.set, card.collectorNumber, card.name])
  if (textureKey !== key) {
    surface.renderer.setImage(image, {
      set: card.set ?? '',
      collectorNumber: card.collectorNumber ?? '',
      name: card.name,
    })
    textureKey = key
  }
  hover.surface = surface
  queueDraw(hover)
}

export function moveHoverFoil(element: HTMLElement, pointer: Pointer) {
  if (active?.element !== element) return
  active.pointer = pointer
  queueDraw(active)
}

function queueDraw(hover: Hover) {
  if (active !== hover || !hover.surface || hover.frame) return
  hover.frame = requestAnimationFrame((time) => {
    hover.frame = 0
    try {
      drawHover(hover, time)
    } catch {
      if (active === hover) hideHoverFoil(hover.element)
    }
  })
}

function drawHover(hover: Hover, time: number) {
  const { element, image, surface, card, pointer } = hover
  if (active !== hover || !surface) return
  if (!element.isConnected || motionReduced() || surface.gl.isContextLost()) {
    hideHoverFoil(element)
    return
  }
  if (!image.complete || !image.naturalWidth || !image.offsetWidth || !image.offsetHeight) return
  const { canvas, renderer, types } = surface
  const ratio = Math.min(devicePixelRatio || 1, 2)
  const width = Math.round(image.offsetWidth * ratio)
  const height = Math.round(image.offsetHeight * ratio)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  Object.assign(canvas.style, {
    left: `${image.offsetLeft}px`,
    top: `${image.offsetTop}px`,
    width: `${image.offsetWidth}px`,
    height: `${image.offsetHeight}px`,
  })
  const type =
    card.finish === 'etched' ? 2 : ((types as Record<string, number>)[card.foilType ?? ''] ?? 1)
  renderer.render(type, pointer, time / 1000)
  if (canvas.parentElement !== element) element.append(canvas)
  // Only hide CSS after a successful first frame; this attribute is not owned by React.
  element.setAttribute('data-foil-webgl', '')
}

export function hideHoverFoil(element: HTMLElement) {
  if (active?.element !== element) return
  cancelAnimationFrame(active.frame)
  active.resize.disconnect()
  active.image.removeEventListener('load', active.draw)
  active.surface?.canvas.remove()
  element.removeAttribute('data-foil-webgl')
  active = undefined
}
