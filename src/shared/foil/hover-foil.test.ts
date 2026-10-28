import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'

function environment(t: TestContext, compile = true) {
  const frames = new Map<number, FrameRequestCallback>()
  const uploads: { src?: string }[] = []
  const draws: { type: number; pointer: number[] }[] = []
  const loaders: MockImage[] = []
  const contexts = new Set<MockCanvas>()
  const media = Object.assign(new EventTarget(), { matches: false })
  let lost = false
  let type = 0
  let pointer: number[] = []
  let frame = 0
  let releaseSlow: () => void = () => {}
  const gl = new Proxy(
    {
      getShaderParameter: () => compile,
      getShaderInfoLog: () => 'Compile failed',
      getProgramParameter: () => true,
      getUniformLocation: (_program: unknown, name: string) => name,
      uniform1i: (name: string, value: number) => {
        if (name === 'uType') type = value
      },
      uniform2f: (name: string, x: number, y: number) => {
        if (name === 'uPointer') pointer = [x, y]
      },
      texImage2D: (...args: { src?: string }[]) => uploads.push(args.at(-1)!),
      drawArrays: () => draws.push({ type, pointer }),
      isContextLost: () => lost,
    },
    {
      get: (target, key: string) =>
        key in target
          ? target[key as keyof typeof target]
          : /^[A-Z_0-9]+$/.test(key)
            ? 1
            : () => {},
    },
  )
  class MockImage extends EventTarget {
    src = ''
    crossOrigin = ''
    decoding = ''
    naturalWidth = 488
    naturalHeight = 680
    constructor() {
      super()
      loaders.push(this)
    }
    async decode() {
      if (this.src === 'bad') throw new Error('CORS failed')
      if (this.src === 'slow') await new Promise<void>((resolve) => (releaseSlow = resolve))
    }
  }
  const globals = {
    document: { createElement: () => new MockCanvas(gl, contexts) },
    Image: MockImage,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    window: { requestIdleCallback: (callback: () => void) => callback() },
    devicePixelRatio: 2,
    matchMedia: () => media,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frame, callback)
      return frame
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  }
  stubGlobals(t, globals)
  return {
    frames,
    uploads,
    draws,
    loaders,
    contexts,
    media,
    releaseSlow: () => releaseSlow(),
    lose: () => {
      lost = true
      contexts.values().next().value!.dispatchEvent(new Event('webglcontextlost'))
    },
    render: () => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(1000))
    },
  }
}

class MockCanvas extends EventTarget {
  className = ''
  style = {}
  width = 0
  height = 0
  parentElement: ReturnType<typeof cardElement> | null = null
  gl: unknown
  contexts: Set<MockCanvas>
  constructor(gl: unknown, contexts: Set<MockCanvas>) {
    super()
    this.gl = gl
    this.contexts = contexts
  }
  setAttribute() {}
  getContext(kind: string) {
    if (kind === 'webgl') {
      this.contexts.add(this)
      return this.gl
    }
    return new Proxy({}, { get: () => () => {} })
  }
  remove() {
    this.parentElement = null
  }
}

function stubGlobals(t: TestContext, globals: Record<string, unknown>) {
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else Reflect.deleteProperty(globalThis, key)
    })
  }
}

function cardElement() {
  const attributes = new Map<string, string>()
  const image = Object.assign(new EventTarget(), {
    complete: true,
    naturalWidth: 488,
    offsetWidth: 244,
    offsetHeight: 340,
    offsetLeft: 3,
    offsetTop: 4,
  })
  return {
    image,
    attributes,
    isConnected: true,
    style: { getPropertyValue: () => '0%' },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 200 }),
    querySelector: () => image,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    hasAttribute: (key: string) => attributes.has(key),
    removeAttribute: (key: string) => attributes.delete(key),
    append(canvas: { parentElement: unknown }) {
      canvas.parentElement = this
    },
  }
}

async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 200 && !check(); attempt++)
    await new Promise((resolve) => setTimeout(resolve, 5))
  assert.ok(check(), 'Timed out waiting for foil preparation')
}

const marked = (element: ReturnType<typeof cardElement>) =>
  element.attributes.has('data-foil-webgl')
const dom = (element: ReturnType<typeof cardElement>) => element as unknown as HTMLElement

test('hover uses one lazy context, decoded CORS textures and movement-only frames; CSS owns every fallback', async (t) => {
  const env = environment(t)
  const { showHoverFoil, moveHoverFoil, hideHoverFoil, foilPointer } =
    await import('./hover-foil.ts')
  const first = cardElement()
  const second = cardElement()
  const foil = { image: 'front', finish: 'foil' as const, foilType: 'surgefoil' }
  assert.deepEqual(foilPointer(dom(first), -10, 500), { x: 0, y: 1 })
  showHoverFoil(dom(first), { image: 'front', finish: 'nonfoil' })
  assert.equal(env.contexts.size, 0)
  assert.equal(env.loaders.length, 0)

  first.setAttribute('data-card-reveal', 'flipping')
  showHoverFoil(dom(first), foil)
  assert.equal(env.loaders.length, 0, 'Hover must not cover an active reveal')
  first.removeAttribute('data-card-reveal')

  first.image.complete = false
  showHoverFoil(dom(first), foil)
  assert.equal(env.contexts.size, 0, 'Import/context creation must not run in the pointer handler')
  await waitFor(() => env.frames.size > 0)
  env.render()
  assert.equal(marked(first), false, 'Keep CSS until the displayed image is loaded')
  first.image.complete = true
  first.image.dispatchEvent(new Event('load'))
  moveHoverFoil(dom(first), { x: 0.2, y: 0.3 })
  moveHoverFoil(dom(first), { x: 0.8, y: 0.9 })
  assert.equal(env.frames.size, 1)
  env.render()
  assert.deepEqual(env.draws.at(-1), { type: 3, pointer: [0.8, 0.9] })
  assert.ok(marked(first))
  assert.equal(env.frames.size, 0, 'There must be no perpetual render loop')
  const canvas = env.contexts.values().next().value!
  assert.equal(canvas.parentElement, first)
  assert.deepEqual([canvas.width, canvas.height], [488, 680])
  assert.deepEqual(canvas.style, { left: '3px', top: '4px', width: '244px', height: '340px' })
  assert.equal(env.loaders[0].crossOrigin, 'anonymous')
  assert.equal(env.loaders[0].decoding, 'async')

  showHoverFoil(dom(first), { ...foil, image: 'slow' })
  await waitFor(() => env.loaders.some(({ src }) => src === 'slow'))
  showHoverFoil(dom(second), { ...foil, foilType: 'unknown' })
  await waitFor(() => env.frames.size > 0)
  env.render()
  env.releaseSlow()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(env.frames.size, 0, 'A stale image must not draw over the new hovered card')
  assert.equal(marked(first), false)
  assert.ok(marked(second))
  assert.equal(canvas.parentElement, second)
  assert.equal(env.draws.at(-1)?.type, 1)
  assert.equal(env.uploads.length, 1, 'Reuse the already-uploaded front texture')
  hideHoverFoil(dom(first))
  assert.ok(marked(second), 'An old card cleanup must not detach the new owner')

  // The component restarts ownership on a face/printing change, even with a stationary pointer.
  showHoverFoil(dom(second), { ...foil, image: 'back', finish: 'etched' })
  assert.equal(marked(second), false)
  await waitFor(() => env.frames.size > 0)
  env.render()
  assert.equal(env.uploads.at(-1)?.src, 'back')
  assert.deepEqual(env.draws.at(-1), { type: 2, pointer: [0, 0] })
  showHoverFoil(dom(second), {
    ...foil,
    image: 'front',
    foilType: 'facetfoil',
    set: 'fra',
    collectorNumber: '449',
    name: 'Enlightened Confidant',
  })
  await waitFor(() => env.frames.size > 0)
  env.render()
  assert.equal(env.draws.at(-1)?.type, 20)
  assert.equal(env.uploads.length, 4, 'Printing metadata must select and upload a facet mask')
  assert.equal(env.loaders.filter(({ src }) => src === 'front').length, 1)
  assert.equal(env.contexts.size, 1)

  env.media.matches = true
  env.media.dispatchEvent(new Event('change'))
  assert.equal(marked(second), false)
  assert.equal(canvas.parentElement, null)
  showHoverFoil(dom(second), foil)
  assert.equal(env.frames.size, 0)
  env.media.matches = false
  showHoverFoil(dom(second), foil)
  await waitFor(() => env.frames.size > 0)
  env.render()
  hideHoverFoil(dom(second)) // Leave, cancel, unmount or Motion and finishes off.
  assert.equal(marked(second), false)
  assert.equal(canvas.parentElement, null)
  showHoverFoil(dom(second), { ...foil, image: 'bad' })
  await waitFor(() => env.loaders.some(({ src }) => src === 'bad'))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(marked(second), false)
  showHoverFoil(dom(second), foil)
  await waitFor(() => env.frames.size > 0)
  env.render()
  env.lose()
  assert.equal(marked(second), false)
  assert.equal(canvas.parentElement, null)
  showHoverFoil(dom(second), foil)
  assert.equal(env.frames.size, 0)
  assert.equal(env.contexts.size, 1, 'Context loss must not create replacement contexts')
})

test('WebGL unavailable leaves CSS visible without creating a context per card', async (t) => {
  const env = environment(t)
  t.mock.method(MockCanvas.prototype, 'getContext', function (this: MockCanvas) {
    this.contexts.add(this)
    return null
  })
  const { showHoverFoil, hideHoverFoil } = await import(
    new URL('./hover-foil.ts?unavailable', import.meta.url).href
  )
  const card = cardElement()
  showHoverFoil(dom(card), { image: 'front', finish: 'foil' })
  await waitFor(() => env.contexts.size > 0)
  assert.equal(marked(card), false)
  assert.equal(env.frames.size, 0)
  showHoverFoil(dom(card), { image: 'back', finish: 'etched' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(env.contexts.size, 1)
  assert.equal(env.loaders.length, 1)
  assert.equal(marked(card), false)
  hideHoverFoil(dom(card))
})

test('shader compilation failure leaves CSS in charge and is not retried per card', async (t) => {
  const env = environment(t, false)
  const { showHoverFoil, hideHoverFoil } = await import(
    new URL('./hover-foil.ts?compile-failure', import.meta.url).href
  )
  const card = cardElement()
  showHoverFoil(dom(card), { image: 'front', finish: 'foil' })
  await waitFor(() => env.contexts.size > 0)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(marked(card), false)
  assert.equal(env.frames.size, 0)
  showHoverFoil(dom(card), { image: 'back', finish: 'etched' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(env.contexts.size, 1)
  assert.equal(env.loaders.length, 1, 'Unavailable WebGL must not load textures on later hovers')
  assert.equal(marked(card), false)
  hideHoverFoil(dom(card))
})
