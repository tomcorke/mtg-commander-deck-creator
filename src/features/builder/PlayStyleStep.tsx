import { useEffect, useRef } from 'react'
import {
  matchingPlayStyle,
  playStyles,
  type PlayStyle,
  type PlayStyleSettings,
} from '../../domain/play-style.ts'
import { priorityLabels } from '../../domain/recommendation-tuning.ts'

const powerLabels = { precon: 'Core', upgraded: 'Upgraded', high: 'High power' }

// Art crops of familiar cards that hint at each tier, served by Scryfall (never stored here).
const presetArt: Record<PlayStyle, { card: string; tier: number }> = {
  casual: { card: 'Llanowar Elves', tier: 1 },
  upgraded: { card: 'Rhystic Study', tier: 2 },
  high: { card: 'Demonic Tutor', tier: 3 },
}
const artCrop = (card: string) =>
  `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card)}&format=image&version=art_crop`

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
            className={`export play-style-choice play-style-choice--${id}`}
            type="button"
            key={id}
            onClick={() => choose(id)}
          >
            <img
              className="play-style-art"
              src={artCrop(presetArt[id].card)}
              alt=""
              loading="lazy"
              title={presetArt[id].card}
            />
            <span className="play-style-body">
              <span className="play-style-title">
                <strong>{label}</strong>
                <span
                  className="play-style-meter"
                  aria-label={`Power ${presetArt[id].tier} of 3`}
                  role="img"
                >
                  {[1, 2, 3].map((step) => (
                    <i key={step} className={step <= presetArt[id].tier ? 'on' : ''} />
                  ))}
                </span>
              </span>
              <span className="play-style-summary">{summary}</span>
              <span className="play-style-chips">
                {description.split(' · ').map((part) => (
                  <small key={part}>{part}</small>
                ))}
              </span>
            </span>
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
