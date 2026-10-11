import { useEffect, useState } from 'react'
import './foil-preview.css'

import type { ScryfallCard } from '../domain/card-model.ts'
import { finishLabel, foilTypeNames, printingOptions } from '../domain/printing.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { FinishFilters } from '../shared/FinishFilters.tsx'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'

type Sample = ReturnType<typeof printingOptions>[number] & { name: string }

// Dev-only page (?foil-preview): one real printing per finish and foil type, for effect review.
const queries: [string, string][] = [
  ['nonfoil', '!"Sol Ring" set:cmm'],
  ['foil', '!"Sol Ring" set:cmm'],
  ['etched', 'is:etched game:paper'],
  ...Object.keys(foilTypeNames).map((type): [string, string] => [
    type,
    `is:${type} is:foil game:paper`,
  ]),
]

async function loadSample([key, query]: [string, string]): Promise<Sample | string> {
  const url = `https://api.scryfall.com/cards/search?order=released&dir=desc&q=${encodeURIComponent(query)}`
  const response = await fetch(url)
  if (!response.ok) return `${key}: no results`
  const card = ((await response.json()) as { data: ScryfallCard[] }).data[0]
  const finish = key === 'nonfoil' ? 'nonfoil' : key === 'etched' ? 'etched' : 'foil'
  const option = printingOptions([card]).find((printing) => printing.finish === finish)
  return option ? { ...option, name: card.name } : `${key}: printing has no ${finish} finish`
}

export function FoilPreview() {
  const [samples, setSamples] = useState<(Sample | string)[]>([])
  const [darkMode, setDarkMode] = useState(false)
  const [cardEffects, setCardEffects] = useState(true)
  const [staticEffects, setStaticEffects] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      for (const query of queries) {
        const sample = await loadSample(query).catch(() => `${query[0]}: request failed`)
        if (cancelled) return
        setSamples((current) => [...current, sample])
        await new Promise((resolve) => setTimeout(resolve, 600)) // Scryfall search allows about 2 requests a second.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <VisualPreferencesContext.Provider
      value={{
        darkMode,
        setDarkMode,
        commanderStyling: false,
        setCommanderStyling: () => undefined,
        cardEffects,
        setCardEffects,
      }}
    >
      <div className={darkMode ? 'dark' : ''} style={{ colorScheme: darkMode ? 'dark' : 'light' }}>
        <main className={`foil-preview ${staticEffects ? 'static-effects' : ''}`}>
          <h1>Foil preview</h1>
          <p>
            Hover a card to see its effect. Types without their own effect use the standard foil
            effect. Loaded {samples.length} of {queries.length}.
          </p>
          <p>
            <label>
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(event) => setDarkMode(event.target.checked)}
              />{' '}
              Dark mode
            </label>{' '}
            <label>
              <input
                type="checkbox"
                checked={cardEffects}
                onChange={(event) => setCardEffects(event.target.checked)}
              />{' '}
              Motion and finishes
            </label>{' '}
            <label>
              <input
                type="checkbox"
                checked={staticEffects}
                onChange={(event) => setStaticEffects(event.target.checked)}
              />{' '}
              Show effects without hover
            </label>
          </p>
          <ul>
            {samples.map((sample) =>
              typeof sample === 'string' ? (
                <li key={sample}>{sample}</li>
              ) : (
                <li key={`${sample.set}-${sample.collectorNumber}-${sample.finish}`}>
                  <FinishedCardImage
                    image={sample.image}
                    alt={`${sample.name} card`}
                    finish={sample.finish}
                    foilType={sample.foilType}
                  />
                  <b>{finishLabel(sample) ?? 'Nonfoil'}</b>
                  <small>
                    {sample.name} · {sample.set.toUpperCase()} #{sample.collectorNumber}
                    {sample.foilType ? ` · ${sample.foilType}` : ''}
                  </small>
                </li>
              ),
            )}
          </ul>
          <FinishFilters />
        </main>
      </div>
    </VisualPreferencesContext.Provider>
  )
}
