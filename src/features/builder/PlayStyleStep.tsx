import { useEffect, useRef } from 'react'
import {
  matchingPlayStyle,
  playStyles,
  type PlayStyle,
  type PlayStyleSettings,
} from '../../domain/play-style.ts'
import { priorityLabels } from '../../domain/recommendation-tuning.ts'

const powerLabels = { precon: 'Core', upgraded: 'Upgraded', high: 'High power' }

// Art crops of chosen printings that hint at each tier, served by Scryfall (never stored here).
// Cyclonic Rift is a Game Changer (checked against mtg-knowledge-base, 2026-10-25).
const presetArt: Record<PlayStyle, { card: string; art: string; tier: number }> = {
  casual: { card: 'Jumbo Cactuar', art: 'd/b/db01c222-8795-47e9-a789-e7f749a3ee7d', tier: 1 },
  upgraded: { card: 'Cyclonic Rift', art: 'd/f/dfb7c4b9-f2f4-4d4e-baf2-86551c8150fe', tier: 2 },
  high: { card: 'Black Lotus', art: 'b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd', tier: 3 },
}
const artCrop = (path: string) => `https://cards.scryfall.io/art_crop/front/${path}.jpg`

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
              src={artCrop(presetArt[id].art)}
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
