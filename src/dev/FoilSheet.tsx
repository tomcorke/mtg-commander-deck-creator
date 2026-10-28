import { useEffect, useRef, useState } from 'react'

import { scryfallImage, type CardFinish, type ScryfallCard } from '../domain/card-model.ts'
import { foilTypeNames } from '../domain/printing.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { FinishFilters } from '../shared/FinishFilters.tsx'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'
import { createFoilRenderer, foilShaderTypes } from '../shared/foil/foil-shader.ts'
import './foil-preview.css'

// Dev contact sheet (?foil-sheet&foil=ripplefoil,halofoil&card=cmm/410&css=0): one card with each
// listed finish at fixed tilts, each WebGL frame beside its CSS version (unless css=0), for quick
// checks without the full preview page.
const tilts = [
  { x: 0.2, y: 0.2 },
  { x: 0.5, y: 0.5 },
  { x: 0.8, y: 0.75 },
]
const finishOf = (foil: string): CardFinish =>
  foil === 'nonfoil' || foil === 'etched' ? foil : 'foil'

type Tilt = { x: number; y: number }
type DrawFrame = (foil: string, frame: number, tilt: Tilt) => void
type Printing = { card: string; label: string; image: string }

// Every printing with a foil type, cached on globalThis like the preview samples, so hot updates
// and card changes don't fetch again.
const printingCache: Map<string, Printing[]> = ((
  globalThis as { foilPrintingCache?: Map<string, Printing[]> }
).foilPrintingCache ??= new Map())

async function fetchPrintings(foil: string, onPage: (printings: Printing[]) => void) {
  const cached = printingCache.get(foil)
  if (cached) return onPage(cached)
  const printings: Printing[] = []
  let url: string | undefined =
    `https://api.scryfall.com/cards/search?unique=prints&order=released&q=${encodeURIComponent(`is:${foil}`)}`
  while (url) {
    const response = await fetch(url)
    if (!response.ok) break
    const page = (await response.json()) as { data: ScryfallCard[]; next_page?: string }
    for (const card of page.data) {
      // Foil-only printings are scanned as foil, so the scan may show the effect baked in.
      const marker = card.finishes?.includes('nonfoil')
        ? 'non-foil scan'
        : 'foil only: scan may show foil'
      printings.push({
        card: `${card.set}/${card.collector_number}`,
        label: `${card.name} · ${card.set.toUpperCase()} #${card.collector_number} · ${marker}`,
        // The CDN image, not the API's image redirect, which counts against the rate limit.
        image: scryfallImage(card),
      })
    }
    onPage([...printings])
    url = page.next_page
    // Scryfall asks for 50-100 ms between requests.
    if (url) await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!url) printingCache.set(foil, printings)
}

function PrintingList({
  foil,
  card,
  onSelect,
}: {
  foil: string
  card: string
  onSelect: (card: string) => void
}) {
  const [printings, setPrintings] = useState<Printing[]>([])
  const [done, setDone] = useState(false)
  useEffect(() => {
    let cancelled = false
    void fetchPrintings(foil, (next) => !cancelled && setPrintings(next)).finally(
      () => !cancelled && setDone(true),
    )
    return () => {
      cancelled = true
    }
  }, [foil])
  return (
    // Every printing as a thumbnail with the CSS effect; click one to compare it above.
    <section className="foil-sheet-printings">
      <h2>
        All {foilTypeNames[foil]} printings ({printings.length}
        {done ? '' : ', loading'})
      </h2>
      <div>
        {printings.map((printing) => (
          <button
            key={printing.card}
            type="button"
            title={printing.label}
            aria-pressed={printing.card === card}
            onClick={() => onSelect(printing.card)}
          >
            <FinishedCardImage
              cssOnly
              image={printing.image}
              alt={printing.label}
              finish="foil"
              foilType={foil}
            />
          </button>
        ))}
      </div>
    </section>
  )
}

// Follows and tilts with the mouse like the CSS card, then returns to its fixed tilt (onTilt(undefined)).
function WebglFrame({
  label,
  canvasRef,
  onTilt,
}: {
  label: string
  canvasRef: (element: HTMLCanvasElement | null) => void
  onTilt: (tilt?: Tilt) => void
}) {
  return (
    <canvas
      ref={canvasRef}
      width={366}
      height={510}
      aria-label={label}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
        const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))
        // Same tilt as the CSS card (CardArt moveFoil).
        event.currentTarget.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 16}deg) rotateY(${(x - 0.5) * 16}deg)`
        onTilt({ x, y })
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.transform = ''
        onTilt()
      }}
    />
  )
}

// The card element sets its own default tilt, so set the fixed tilts on it directly.
function setCssTilts() {
  document
    .querySelectorAll<HTMLElement>('.foil-sheet-css .finished-card')
    .forEach((card, index) => {
      const tilt = tilts[index % tilts.length]
      card.style.setProperty('--foil-x', `${tilt.x * 100}%`)
      card.style.setProperty('--foil-y', `${tilt.y * 100}%`)
    })
}

const sheetPreferences = {
  darkMode: true,
  setDarkMode: () => undefined,
  commanderStyling: false,
  setCommanderStyling: () => undefined,
  cardReveals: false,
  setCardReveals: () => undefined,
  cardEffects: true,
  setCardEffects: () => undefined,
}

export function FoilSheet() {
  const params = new URLSearchParams(location.search)
  const foils = (params.get('foil') ?? 'foil').split(',')
  const showCss = params.get('css') !== '0'
  const [card, setCard] = useState(params.get('card') ?? 'cmm/410')
  const [set, number] = card.split('/')
  const selectCard = (next: string) => {
    // Rebuilt by hand so the URL stays readable (?foil-sheet&card=snc/327, not foil-sheet=&card=snc%2F327).
    const search = location.search.replace(/&card=[^&]*/, '')
    history.replaceState(null, '', `${search}&card=${next}`)
    setCard(next)
    scrollTo({ top: 0 })
  }
  const image = `https://api.scryfall.com/cards/${set}/${number}?format=image&version=normal`
  const frames = useRef<(HTMLCanvasElement | null)[]>([])
  const drawFrame = useRef<DrawFrame>(() => undefined)
  const foilList = foils.join(',')

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 366
    canvas.height = 510
    const renderer = createFoilRenderer(canvas)
    const loader = new Image()
    loader.crossOrigin = 'anonymous'
    let name: string | undefined
    loader.onload = () => {
      if (!renderer) return
      renderer.setImage(loader, { set, collectorNumber: number, name })
      loaded = true
      foilList.split(',').forEach(drawRow)
    }
    let loaded = false
    const draw: DrawFrame = (foil, frame, tilt) => {
      if (!loaded) return
      renderer?.render((foilShaderTypes as Record<string, number>)[foil] ?? 1, tilt, 1)
      frames.current[frame]?.getContext('2d')?.drawImage(canvas, 0, 0)
    }
    drawFrame.current = draw
    const drawRow = (foil: string, row: number) => {
      tilts.forEach((tilt, column) => draw(foil, row * tilts.length + column, tilt))
    }
    // The name lets a nonfoil Shattered Mirror twin borrow its facet printing's shards.
    void fetch(`https://api.scryfall.com/cards/${set}/${number}`)
      .then((response) => response.json() as Promise<ScryfallCard>)
      .then((found) => (name = found.name))
      .catch(() => undefined)
      .finally(() => (loader.src = image))
    setCssTilts()
  }, [image, foilList, set, number])

  return (
    <VisualPreferencesContext.Provider value={sheetPreferences}>
      <div className="dark" style={{ colorScheme: 'dark' }}>
        <main className="foil-preview static-effects foil-sheet">
          {foils.map((foil, row) => (
            <section key={foil}>
              <h2>
                {foil} · {set}/{number}
              </h2>
              <div className="foil-sheet-row">
                {tilts.map((tilt, column) => (
                  <div key={column} className="foil-sheet-pair">
                    <figure>
                      <WebglFrame
                        label={`${foil} WebGL at tilt ${tilt.x}, ${tilt.y}`}
                        canvasRef={(element) => {
                          frames.current[row * tilts.length + column] = element
                        }}
                        onTilt={(next) =>
                          drawFrame.current(foil, row * tilts.length + column, next ?? tilt)
                        }
                      />
                      <figcaption>WebGL</figcaption>
                    </figure>
                    {showCss && (
                      <figure className="foil-sheet-css">
                        <FinishedCardImage
                          cssOnly
                          image={image}
                          alt={`${foil} CSS at tilt ${tilt.x}, ${tilt.y}`}
                          finish={finishOf(foil)}
                          foilType={finishOf(foil) === 'foil' && foil !== 'foil' ? foil : undefined}
                        />
                        <figcaption>CSS</figcaption>
                      </figure>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
          {foils.length === 1 && Object.hasOwn(foilTypeNames, foils[0]) && (
            <PrintingList foil={foils[0]} card={card} onSelect={selectCard} />
          )}
          <FinishFilters />
        </main>
      </div>
    </VisualPreferencesContext.Provider>
  )
}
