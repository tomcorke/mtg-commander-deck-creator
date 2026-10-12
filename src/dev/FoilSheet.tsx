import { useEffect, useRef, useState } from 'react'

import type { CardFinish, ScryfallCard } from '../domain/card-model.ts'
import { foilTypeNames } from '../domain/printing.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { FinishFilters } from '../shared/FinishFilters.tsx'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'
import { createFoilRenderer, foilShaderTypes, loadFacetMask } from './foil-shader.ts'
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

type Printing = { card: string; label: string }

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
    <label className="foil-sheet-printings">
      {foilTypeNames[foil]} printings ({printings.length}
      {done ? '' : ', loading'})
      <select size={10} value={card} onChange={(event) => onSelect(event.target.value)}>
        {printings.map((printing) => (
          <option key={printing.card} value={printing.card}>
            {printing.label}
          </option>
        ))}
      </select>
    </label>
  )
}

const sheetPreferences = {
  darkMode: true,
  setDarkMode: () => undefined,
  commanderStyling: false,
  setCommanderStyling: () => undefined,
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
  }
  const image = `https://api.scryfall.com/cards/${set}/${number}?format=image&version=normal`
  const frames = useRef<(HTMLCanvasElement | null)[]>([])
  const foilList = foils.join(',')

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 366
    canvas.height = 510
    const renderer = createFoilRenderer(canvas)
    const mask = foilList.split(',').includes('facetfoil')
      ? fetch(`https://api.scryfall.com/cards/${set}/${number}`)
          .then((response) => response.json() as Promise<{ name: string }>)
          .then((card) => loadFacetMask(card.name))
      : Promise.resolve(null)
    const loader = new Image()
    loader.crossOrigin = 'anonymous'
    loader.onload = () => {
      if (!renderer) return
      renderer.setImage(loader)
      void mask.then((maskImage) => {
        renderer.setMask(maskImage)
        foilList.split(',').forEach(drawRow)
      })
    }
    const drawRow = (foil: string, row: number) => {
      const type = (foilShaderTypes as Record<string, number>)[foil] ?? 1
      tilts.forEach((tilt, column) => {
        renderer?.render(type, tilt, 1)
        frames.current[row * tilts.length + column]?.getContext('2d')?.drawImage(canvas, 0, 0)
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
  }, [image, foilList, set, number])

  return (
    <VisualPreferencesContext.Provider value={sheetPreferences}>
      <div className="dark" style={{ colorScheme: 'dark' }}>
        <main className="foil-preview static-effects foil-sheet">
          {foils.length === 1 && Object.hasOwn(foilTypeNames, foils[0]) && (
            <PrintingList foil={foils[0]} card={card} onSelect={selectCard} />
          )}
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
