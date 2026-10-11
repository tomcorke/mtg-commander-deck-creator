import { useEffect, useRef } from 'react'

import type { CardFinish } from '../domain/card-model.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { FinishFilters } from '../shared/FinishFilters.tsx'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'
import { createFoilRenderer, foilShaderTypes } from './foil-shader.ts'
import './foil-preview.css'

// Dev contact sheet (?foil-sheet&foil=ripplefoil&card=cmm/410): one card and one finish at fixed
// tilts, WebGL above and CSS below, for quick side-by-side checks without the full preview page.
const tilts = [
  { x: 0.2, y: 0.2 },
  { x: 0.5, y: 0.5 },
  { x: 0.8, y: 0.75 },
]

export function FoilSheet() {
  const params = new URLSearchParams(location.search)
  const foil = params.get('foil') ?? 'foil'
  const [set, number] = (params.get('card') ?? 'cmm/410').split('/')
  const image = `https://api.scryfall.com/cards/${set}/${number}?format=image&version=normal`
  const finish: CardFinish = foil === 'nonfoil' || foil === 'etched' ? foil : 'foil'
  const foilType = finish === 'foil' && foil !== 'foil' ? foil : undefined
  const type = (foilShaderTypes as Record<string, number>)[foil] ?? 1
  const frames = useRef<(HTMLCanvasElement | null)[]>([])

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 366
    canvas.height = 510
    const renderer = createFoilRenderer(canvas)
    const loader = new Image()
    loader.crossOrigin = 'anonymous'
    loader.onload = () => {
      if (!renderer) return
      renderer.setImage(loader)
      tilts.forEach((tilt, index) => {
        renderer.render(type, tilt, 1)
        frames.current[index]?.getContext('2d')?.drawImage(canvas, 0, 0)
      })
    }
    loader.src = image
    // The card element sets its own default tilt, so set the fixed tilts on it directly.
    document
      .querySelectorAll<HTMLElement>('.foil-sheet-css .finished-card')
      .forEach((card, index) => {
        card.style.setProperty('--foil-x', `${tilts[index].x * 100}%`)
        card.style.setProperty('--foil-y', `${tilts[index].y * 100}%`)
      })
  }, [image, type])

  return (
    <VisualPreferencesContext.Provider
      value={{
        darkMode: false,
        setDarkMode: () => undefined,
        commanderStyling: false,
        setCommanderStyling: () => undefined,
        cardEffects: true,
        setCardEffects: () => undefined,
      }}
    >
      <main className="foil-preview static-effects foil-sheet">
        <h1>
          {foil} · {set}/{number}
        </h1>
        <div className="foil-sheet-row">
          {tilts.map((tilt, index) => (
            <canvas
              key={index}
              ref={(element) => {
                frames.current[index] = element
              }}
              width={366}
              height={510}
              aria-label={`WebGL at tilt ${tilt.x}, ${tilt.y}`}
            />
          ))}
        </div>
        <div className="foil-sheet-row">
          {tilts.map((_, index) => (
            <div key={index} className="foil-sheet-css">
              <FinishedCardImage image={image} alt="CSS" finish={finish} foilType={foilType} />
            </div>
          ))}
        </div>
        <FinishFilters />
      </main>
    </VisualPreferencesContext.Provider>
  )
}
