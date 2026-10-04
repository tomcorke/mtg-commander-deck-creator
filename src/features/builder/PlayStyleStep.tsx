import { useEffect, useRef } from 'react'
import {
  matchingPlayStyle,
  playStyles,
  type PlayStyle,
  type PlayStyleSettings,
} from '../../domain/play-style.ts'

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
    heading.current?.focus()
  }, [])
  const matching = matchingPlayStyle(settings)
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
        {playStyles.map(({ id, label, description }) => (
          <button
            className="export play-style-choice"
            type="button"
            key={id}
            aria-pressed={matching === id}
            onClick={() => choose(id)}
          >
            <strong>{label}</strong>
            <span>{description}</span>
            {matching === id && <span>Matches current settings</span>}
          </button>
        ))}
      </div>
      <div className="export-actions">
        <button className="export" type="button" onClick={chooseSets}>
          Choose sets to build from
        </button>
        <button className="primary" type="button" onClick={() => choose()}>
          Skip — use current settings
        </button>
      </div>
    </section>
  )
}
