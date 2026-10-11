import { useEffect, useRef } from 'react'

import type { CardFinish } from '../domain/card-model.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { FinishFilters } from '../shared/FinishFilters.tsx'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'
import { createFoilRenderer, foilShaderTypes } from './foil-shader.ts'
import './foil-preview.css'

// Dev contact sheet (?foil-sheet&foil=ripplefoil,halofoil&card=cmm/410&css=0): one card with each
// listed finish at fixed tilts, WebGL rows with CSS rows below (unless css=0), for quick checks
// without the full preview page.
const tilts = [
  { x: 0.2, y: 0.2 },
  { x: 0.5, y: 0.5 },
  { x: 0.8, y: 0.75 },
]
const finishOf = (foil: string): CardFinish =>
  foil === 'nonfoil' || foil === 'etched' ? foil : 'foil'

export function FoilSheet() {
  const params = new URLSearchParams(location.search)
  const foils = (params.get('foil') ?? 'foil').split(',')
  const showCss = params.get('css') !== '0'
  const [set, number] = (params.get('card') ?? 'cmm/410').split('/')
  const image = `https://api.scryfall.com/cards/${set}/${number}?format=image&version=normal`
  const frames = useRef<(HTMLCanvasElement | null)[]>([])
  const foilList = foils.join(',')

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
      foilList.split(',').forEach((foil, row) => {
        const type = (foilShaderTypes as Record<string, number>)[foil] ?? 1
        tilts.forEach((tilt, column) => {
          renderer.render(type, tilt, 1)
          frames.current[row * tilts.length + column]?.getContext('2d')?.drawImage(canvas, 0, 0)
        })
      })
    }
    loader.src = image
    // The card element sets its own default tilt, so set the fixed tilts on it directly.
    document
      .querySelectorAll<HTMLElement>('.foil-sheet-css .finished-card')
      .forEach((card, index) => {
        const tilt = tilts[index % tilts.length]
        card.style.setProperty('--foil-x', `${tilt.x * 100}%`)
        card.style.setProperty('--foil-y', `${tilt.y * 100}%`)
      })
  }, [image, foilList])

  return (
    <VisualPreferencesContext.Provider
      value={{
        darkMode: true,
        setDarkMode: () => undefined,
        commanderStyling: false,
        setCommanderStyling: () => undefined,
        cardEffects: true,
        setCardEffects: () => undefined,
      }}
    >
      <div className="dark" style={{ colorScheme: 'dark' }}>
        <main className="foil-preview static-effects foil-sheet">
          {foils.map((foil, row) => (
            <section key={foil}>
              <h2>
                {foil} · {set}/{number}
              </h2>
              <div className="foil-sheet-row">
                {tilts.map((tilt, column) => (
                  <canvas
                    key={column}
                    ref={(element) => {
                      frames.current[row * tilts.length + column] = element
                    }}
                    width={366}
                    height={510}
                    aria-label={`${foil} WebGL at tilt ${tilt.x}, ${tilt.y}`}
                  />
                ))}
              </div>
              {showCss && (
                <div className="foil-sheet-row">
                  {tilts.map((_, column) => (
                    <div key={column} className="foil-sheet-css">
                      <FinishedCardImage
                        image={image}
                        alt={`${foil} CSS`}
                        finish={finishOf(foil)}
                        foilType={finishOf(foil) === 'foil' && foil !== 'foil' ? foil : undefined}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
          <FinishFilters />
        </main>
      </div>
    </VisualPreferencesContext.Provider>
  )
}
