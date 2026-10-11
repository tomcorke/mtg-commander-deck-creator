import { useEffect, useRef, useState, type PointerEvent } from 'react'

import type { CardFinish } from '../domain/card-model.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { createFoilRenderer, foilShaderTypes } from './foil-shader.ts'

type StageCard = { image: string; name: string; finish?: CardFinish; foilType?: string }

const shaderType = ({ finish, foilType }: StageCard) =>
  finish === 'foil'
    ? ((foilShaderTypes as Record<string, number>)[foilType ?? ''] ?? 1)
    : finish === 'etched'
      ? 2
      : 0

// Dev prototype: the selected card drawn by CSS and by the WebGL foil shader, side by side.
export function FoilStage({ card }: { card: StageCard }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0.5, y: 0.5 })
  const [autoTilt, setAutoTilt] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    let renderer: ReturnType<typeof createFoilRenderer>
    try {
      renderer = createFoilRenderer(element)
    } catch (caught) {
      setError(String(caught))
      return
    }
    if (!renderer) {
      setError('WebGL is not available.')
      return
    }
    let frame = 0
    let ready = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      renderer.setImage(image)
      ready = true
    }
    image.onerror = () => setError('Could not load the card image for WebGL.')
    image.src = card.image
    const draw = (time: number) => {
      if (autoTilt) {
        const seconds = time / 1000
        pointer.current = {
          x: 0.5 + 0.4 * Math.sin(seconds * 0.7),
          y: 0.5 + 0.4 * Math.sin(seconds * 0.43),
        }
      }
      if (ready) renderer.render(shaderType(card), pointer.current, time / 1000)
      const { x, y } = pointer.current
      wrapper.current?.style.setProperty(
        'transform',
        `perspective(800px) rotateX(${(0.5 - y) * 16}deg) rotateY(${(x - 0.5) * 16}deg)`,
      )
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [card, autoTilt])

  const track = (event: PointerEvent<HTMLElement>) => {
    if (autoTilt) return
    const bounds = event.currentTarget.getBoundingClientRect()
    pointer.current = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }
  }

  return (
    <section className="foil-stage">
      <h2>
        Compare: {card.name} · {card.foilType ?? card.finish ?? 'nonfoil'}
      </h2>
      <label>
        <input
          type="checkbox"
          checked={autoTilt}
          onChange={(event) => setAutoTilt(event.target.checked)}
        />{' '}
        Auto tilt (turn off to tilt the WebGL card with the pointer)
      </label>
      <div className="foil-stage-cards">
        <figure>
          <FinishedCardImage
            image={card.image}
            alt={`${card.name} card`}
            finish={card.finish}
            foilType={card.foilType}
          />
          <figcaption>CSS (hover it)</figcaption>
        </figure>
        <figure>
          <div ref={wrapper} className="foil-stage-webgl" onPointerMove={track}>
            <canvas ref={canvas} width={488 * 2} height={680 * 2} />
          </div>
          <figcaption>{error || 'WebGL'}</figcaption>
        </figure>
      </div>
    </section>
  )
}
