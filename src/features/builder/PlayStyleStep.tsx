import { useEffect, useRef } from 'react'
import {
  matchingPlayStyle,
  playStyles,
  type PlayStyle,
  type PlayStyleSettings,
} from '../../domain/play-style.ts'
import { priorityLabels } from '../../domain/recommendation-tuning.ts'

const powerLabels = { precon: 'Core', upgraded: 'Upgraded', high: 'High power' }

export function PlayStyleStep({
  settings,
  choose,
  chooseSets,
}: {
  settings: PlayStyleSettings
  choose: (style?: PlayStyle) => void
  chooseSets: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])
  const matching = playStyles.find(({ id }) => id === matchingPlayStyle(settings))?.label
  const current =
    matching ??
    `${powerLabels[settings.powerTarget]} · ${priorityLabels[settings.recommendationStyle]}`
  return (
    <section className="play-style-step" aria-labelledby="play-style-title">
      <h2 id="play-style-title" tabIndex={-1} ref={heading}>
        How do you want to play?
      </h2>
      <p>
        These presets change recommendation preferences, not deck legality or bracket verification.
        You can edit them later.
      </p>
      <div className="play-style-choices">
        {playStyles.map(({ id, label, summary, description }) => (
          <button
            className="export play-style-choice"
            type="button"
            key={id}
            onClick={() => choose(id)}
          >
            <strong>{label}</strong>
            <span>{summary}</span>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <div className="export-actions">
        <button className="export" type="button" onClick={chooseSets}>
          Choose sets to build from
        </button>
        <button className="export" type="button" onClick={() => choose()}>
          Keep current settings ({current})
        </button>
      </div>
    </section>
  )
}
