import { useEffect, useRef, useState } from 'react'
import { createFoilRenderer } from '../shared/foil/foil-shader.ts'
import '../styles/flip-preview.css'

const backImage = '/images/mtg-card-back.png'
const samples = ['Single-faced', 'Double-faced']
const frontImage = (doubleFaced: boolean) =>
  `https://api.scryfall.com/cards/named?exact=${doubleFaced ? 'Delver%20of%20Secrets' : 'Sol%20Ring'}&format=image&version=normal`

function RevealCard({
  duration,
  hold,
  stagger,
  replay,
  doubleFaced,
  foil,
  progress,
}: {
  duration: number
  hold: number
  stagger: number
  replay: number
  doubleFaced: boolean
  foil: boolean
  progress: number | null
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('Loading images...')
  useEffect(() => {
    const renderer = createFoilRenderer(canvas.current!)
    if (!renderer) {
      setStatus('WebGL is unavailable.')
      return
    }
    let cancelled = false
    let frame = 0
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Could not load the card image. Replay to retry.'))
        image.src = src
      })
    setStatus('Loading images...')
    // Display the local back as soon as it loads, even while the front is still downloading.
    const back = load(backImage).then((image) => {
      if (!cancelled) {
        renderer.setImage(image)
        renderer.render(0, { x: 0.5, y: 0.5 }, 0, Math.PI, 0.8)
      }
      return image
    })
    void Promise.all([back, load(frontImage(doubleFaced))])
      .then(([back, front]) => {
        if (cancelled) return
        const start = performance.now() + hold + stagger
        let previousSide = ''
        const draw = (now: number) => {
          const raw = progress ?? Math.max(0, Math.min(1, (now - start) / duration))
          const eased = raw * raw * (3 - 2 * raw)
          const side = eased < 0.5 ? 'back' : 'front'
          if (side !== previousSide) {
            renderer.setImage(side === 'back' ? back : front)
            previousSide = side
          }
          renderer.render(
            side === 'front' && foil ? 1 : 0,
            { x: 0.5 + Math.sin(eased * Math.PI) * 0.35, y: 0.4 },
            now / 1000,
            Math.PI * (1 - eased),
            0.8,
          )
          setStatus(raw === 0 ? 'Hidden' : raw === 1 ? 'Revealed' : 'Flipping')
          if (progress === null && raw < 1) frame = requestAnimationFrame(draw)
        }
        frame = requestAnimationFrame(draw)
      })
      .catch((error: Error) => {
        if (!cancelled) setStatus(error.message)
      })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      renderer.dispose()
    }
  }, [duration, hold, stagger, replay, doubleFaced, foil, progress])
  return (
    <figure>
      <canvas
        ref={canvas}
        width={600}
        height={836}
        role="img"
        aria-label={`${doubleFaced ? 'Double' : 'Single'}-faced card reveal`}
      />
      <figcaption>
        {doubleFaced ? samples[1] : samples[0]} / {status}
      </figcaption>
    </figure>
  )
}

// Temporary dev-only playground. Rotation and perspective are applied in the WebGL vertex shader.
export function FlipPreview() {
  const [duration, setDuration] = useState(1100)
  const [hold, setHold] = useState(600)
  const [stagger, setStagger] = useState(180)
  const [replay, setReplay] = useState(0)
  const [dark, setDark] = useState(true)
  const [foil, setFoil] = useState(true)
  const [progress, setProgress] = useState<number | null>(null)
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <main className={`flip-preview ${dark ? 'dark' : ''}`}>
      <h1>Card reveal playground</h1>
      <p>Temporary WebGL experiment. Every card starts with the same local card back.</p>
      <div className="flip-controls">
        <button
          type="button"
          className="primary"
          onClick={() => {
            setProgress(null)
            setReplay(replay + 1)
          }}
        >
          Replay reveal
        </button>
        <button type="button" className="export" onClick={() => setProgress(0)}>
          Hold card backs
        </button>
        <label>
          <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark
          mode
        </label>
        <label>
          <input type="checkbox" checked={foil} onChange={(e) => setFoil(e.target.checked)} /> Foil
          fronts
        </label>
        {(
          [
            ['Flip duration', duration, setDuration, 200, 3000],
            ['Back hold', hold, setHold, 0, 2000],
            ['Stagger', stagger, setStagger, 0, 800],
          ] as const
        ).map(([label, value, set, min, max]) => (
          <label key={label}>
            {label}: {value} ms
            <input
              type="range"
              min={min}
              max={max}
              step={50}
              value={value}
              onChange={(e) => set(Number(e.target.value))}
            />
          </label>
        ))}
        <label>
          Scrub reveal: {progress === null ? 'playing' : `${Math.round(progress * 100)}%`}
          <input
            aria-label="Scrub reveal"
            type="range"
            min="0"
            max="100"
            value={(progress ?? 0) * 100}
            onChange={(e) => setProgress(Number(e.target.value) / 100)}
          />
        </label>
      </div>
      {reducedMotion && (
        <p>Reduced motion is enabled. Use the scrubber, or explicitly replay to animate.</p>
      )}
      <div className="flip-cards">
        {samples.map((sample, index) => (
          <RevealCard
            key={sample}
            duration={duration}
            hold={hold}
            stagger={index * stagger}
            replay={replay}
            doubleFaced={index === 1}
            foil={foil}
            progress={reducedMotion && replay === 0 && progress === null ? 0 : progress}
          />
        ))}
      </div>
      <p>
        Changes hot reload through Vite. Scrubbing pauses playback; replay starts both cards again.
      </p>
    </main>
  )
}
