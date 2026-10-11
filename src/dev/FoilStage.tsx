import { useEffect, useRef, useState, type PointerEvent } from 'react'

import type { CardFinish } from '../domain/card-model.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { NotePanel, noteId, type FeedbackNote } from './FoilFeedback.tsx'
import { createFoilRenderer, foilShaderTypes } from './foil-shader.ts'

type StageCard = { image: string; name: string; finish?: CardFinish; foilType?: string }

const shaderType = ({ finish, foilType }: StageCard) =>
  finish === 'foil'
    ? ((foilShaderTypes as Record<string, number>)[foilType ?? ''] ?? 1)
    : finish === 'etched'
      ? 2
      : 0

// Runs the WebGL foil renderer for one card, tilting with the pointer or automatically.
function useFoilCanvas({ image, finish, foilType }: StageCard, autoTilt: boolean) {
  const type = shaderType({ image, name: '', finish, foilType })
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0.5, y: 0.5 })
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
    const loader = new Image()
    loader.crossOrigin = 'anonymous'
    loader.onload = () => {
      renderer.setImage(loader)
      ready = true
    }
    loader.onerror = () => setError('Could not load the card image for WebGL.')
    loader.src = image
    const draw = (time: number) => {
      if (autoTilt) {
        const seconds = time / 1000
        pointer.current = {
          x: 0.5 + 0.4 * Math.sin(seconds * 0.7),
          y: 0.5 + 0.4 * Math.sin(seconds * 0.43),
        }
      }
      if (ready) renderer.render(type, pointer.current, time / 1000)
      const { x, y } = pointer.current
      wrapper.current?.style.setProperty(
        'transform',
        `perspective(800px) rotateX(${(0.5 - y) * 16}deg) rotateY(${(x - 0.5) * 16}deg)`,
      )
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [image, finish, foilType, autoTilt])

  const track = (event: PointerEvent<HTMLElement>) => {
    if (autoTilt) return
    const bounds = event.currentTarget.getBoundingClientRect()
    pointer.current = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }
  }

  return { canvas, wrapper, track, error }
}

// Dev prototype: the selected card drawn by CSS and by the WebGL foil shader, side by side.
export function FoilStage({
  card,
  notes,
  save,
}: {
  card: StageCard
  notes: FeedbackNote[]
  save: (note: FeedbackNote) => Promise<void>
}) {
  const foil = card.foilType ?? card.finish ?? 'nonfoil'
  const note = (side: 'css' | 'webgl') => notes.find(({ id }) => id === noteId(foil, side))
  const [autoTilt, setAutoTilt] = useState(true)
  const { canvas, wrapper, track, error } = useFoilCanvas(card, autoTilt)

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
          <NotePanel foil={foil} side="css" note={note('css')} save={save} />
        </figure>
        <figure>
          <div ref={wrapper} className="foil-stage-webgl" onPointerMove={track}>
            <canvas ref={canvas} width={488 * 2} height={680 * 2} />
          </div>
          <figcaption>{error || 'WebGL'}</figcaption>
          <NotePanel foil={foil} side="webgl" note={note('webgl')} save={save} />
        </figure>
      </div>
    </section>
  )
}
