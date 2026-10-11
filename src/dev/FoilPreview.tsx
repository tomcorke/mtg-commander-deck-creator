import { useEffect, useState } from 'react'

import { useStoredState } from './stored-state.ts'
import './foil-preview.css'

import type { ScryfallCard } from '../domain/card-model.ts'
import { finishLabel, foilTypeNames, printingOptions } from '../domain/printing.ts'
import { FinishedCardImage } from '../shared/CardArt.tsx'
import { FinishFilters } from '../shared/FinishFilters.tsx'
import { FoilStage } from './FoilStage.tsx'
import { noteSummary, useFeedback } from './FoilFeedback.tsx'
import { VisualPreferencesContext } from '../shared/VisualPreferencesContext.tsx'

type Sample = ReturnType<typeof printingOptions>[number] & { name: string }

// Dev-only page (?foil-preview): one real printing per finish and foil type, for effect review.
const queries: [string, string][] = [
  ['nonfoil', '!"Sol Ring" set:cmm'],
  ['foil', '!"Sol Ring" set:cmm'],
  ['etched', 'is:etched game:paper'],
  ...Object.keys(foilTypeNames).map((type): [string, string] => [
    type,
    `is:${type} is:foil game:paper${type === 'halofoil' ? ' set:mul' : ''}`,
  ]),
]

// Plain nonfoil scans to show every effect on the same, quieter image.
const plainCards: [string, string][] = [
  ['Each type’s own printing', ''],
  ['Sol Ring (CMM)', 'Sol Ring&set=cmm'],
  ['Plains (M21)', 'Plains&set=m21'],
  ['Llanowar Elves (M19)', 'Llanowar Elves&set=m19'],
  ['Counterspell (MH2)', 'Counterspell&set=mh2'],
]
const plainCardImage = (query: string) =>
  `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${query
    .split('&')
    .map((part, index) => (index ? part : encodeURIComponent(part)))
    .join('&')}`

// Foil types whose own scans already show the foil (step-and-compleat prints the symbols into
// the image) preview on a plain printing with the foil type applied by the app.
const sampleOverrides: Record<string, string> = {
  stepandcompleat: '!"Glissa, the Traitor" -is:stepandcompleat',
}

async function loadSample([key, defaultQuery]: [string, string]): Promise<Sample | string> {
  const query = sampleOverrides[key] ?? defaultQuery
  const url = `https://api.scryfall.com/cards/search?order=released&dir=desc&q=${encodeURIComponent(query)}`
  const response = await fetch(url)
  if (!response.ok) return `${key}: no results`
  const card = ((await response.json()) as { data: ScryfallCard[] }).data[0]
  const finish = key === 'nonfoil' ? 'nonfoil' : key === 'etched' ? 'etched' : 'foil'
  const option = printingOptions([card]).find((printing) => printing.finish === finish)
  if (!option) return `${key}: printing has no ${finish} finish`
  return { ...option, name: card.name, ...(sampleOverrides[key] ? { foilType: key } : {}) }
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />{' '}
      {label}{' '}
    </label>
  )
}

function SampleCard({
  sample,
  image,
  onCompare,
  summary,
}: {
  sample: Sample
  image: string
  onCompare: () => void
  summary: string
}) {
  return (
    <li onClick={onCompare}>
      <FinishedCardImage
        image={image}
        alt={`${sample.name} card`}
        finish={sample.finish}
        foilType={sample.foilType}
      />
      <b>{finishLabel(sample) ?? 'Nonfoil'}</b>
      <small>
        {sample.name} · {sample.set.toUpperCase()} #{sample.collectorNumber}
        {sample.foilType ? ` · ${sample.foilType}` : ''}
      </small>
      <button type="button" onClick={onCompare}>
        Compare CSS and WebGL
      </button>
      {summary && <small className="foil-note-summary">{summary}</small>}
    </li>
  )
}

export function FoilPreview() {
  const [samples, setSamples] = useState<(Sample | string)[]>([])
  const [darkMode, setDarkMode] = useStoredState('dark-mode', true)
  const [cardEffects, setCardEffects] = useStoredState('card-effects', true)
  const [staticEffects, setStaticEffects] = useStoredState('static-effects', true)
  const [plainCard, setPlainCard] = useStoredState('card-image', '')
  // Remember the compared card by key, and pick it again once its sample has loaded.
  const [comparedKey, setComparedKey] = useStoredState('compared', '')
  const sampleKey = (sample: Sample) =>
    `${sample.set}-${sample.collectorNumber}-${sample.finish}-${sample.foilType ?? ''}`
  const compared = samples.find(
    (sample): sample is Sample => typeof sample !== 'string' && sampleKey(sample) === comparedKey,
  )
  const setCompared = (sample: Sample) => setComparedKey(sampleKey(sample))
  const { notes, save } = useFeedback()
  const imageFor = (sample: Sample) => (plainCard ? plainCardImage(plainCard) : sample.image)

  useEffect(() => {
    let cancelled = false
    // Hot reloads re-run this effect; start from an empty list rather than appending duplicates.
    setSamples([])
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
            <Toggle label="Dark mode" checked={darkMode} onChange={setDarkMode} />
            <Toggle label="Motion and finishes" checked={cardEffects} onChange={setCardEffects} />
            <Toggle
              label="Show effects without hover"
              checked={staticEffects}
              onChange={setStaticEffects}
            />
            <label>
              Card image{' '}
              <select value={plainCard} onChange={(event) => setPlainCard(event.target.value)}>
                {plainCards.map(([label, query]) => (
                  <option key={label} value={query}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </p>
          {compared && (
            <FoilStage
              card={{ ...compared, image: imageFor(compared) }}
              notes={notes}
              save={save}
            />
          )}
          <ul>
            {samples.map((sample) =>
              typeof sample === 'string' ? (
                <li key={sample}>{sample}</li>
              ) : (
                <SampleCard
                  key={`${sample.set}-${sample.collectorNumber}-${sample.finish}`}
                  sample={sample}
                  image={imageFor(sample)}
                  onCompare={() => setCompared(sample)}
                  summary={noteSummary(notes, sample.foilType ?? sample.finish ?? 'nonfoil')}
                />
              ),
            )}
          </ul>
          <FinishFilters />
        </main>
      </div>
    </VisualPreferencesContext.Provider>
  )
}
