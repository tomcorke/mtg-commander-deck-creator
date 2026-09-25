import {
  recommendationScoreFactorMaximums,
  type RecommendationScoreBreakdown,
} from '../../domain/recommendation-types'

const recommendationScoreFactors = [
  {
    key: 'evidence',
    label: 'Evidence',
    max: recommendationScoreFactorMaximums.evidence,
    description: 'Strength of the commander and source evidence supporting this card.',
  },
  {
    key: 'theme',
    label: 'Theme',
    max: recommendationScoreFactorMaximums.theme,
    description: 'Whether the card directly matches your primary theme.',
  },
  {
    key: 'subThemes',
    label: 'Sub-themes',
    max: recommendationScoreFactorMaximums.subThemes,
    description: 'Support for the sub-themes you selected or the app inferred from your deck.',
  },
  {
    key: 'collection',
    label: 'Collection',
    max: recommendationScoreFactorMaximums.collection,
    description:
      'Affinity with the set or sets you selected. Only mode filters; Prefer mode boosts matches.',
  },
  {
    key: 'deckFit',
    label: 'Deck fit',
    max: recommendationScoreFactorMaximums.deckFit,
    description: 'How closely this card matches patterns and tags from cards already in your deck.',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    max: recommendationScoreFactorMaximums.preferences,
    description: 'Learned affinity from cards you liked, ignored, or selected from a collection.',
  },
  {
    key: 'deckNeeds',
    label: 'Deck needs',
    max: recommendationScoreFactorMaximums.deckNeeds,
    description: 'Urgency of roles your deck is missing, such as ramp, draw, lands, or removal.',
  },
  {
    key: 'manaFitPenalty',
    label: 'Mana-fit penalty',
    max: recommendationScoreFactorMaximums.manaFitPenalty,
    description:
      'Deducts up to 10 points when a creature’s mana value or colored pips exceed the deck’s current land, ramp, or color support. This is a heuristic, not a casting probability.',
  },
  {
    key: 'popularityPenalty',
    label: 'Popularity penalty',
    max: recommendationScoreFactorMaximums.popularityPenalty,
    description:
      'Story mode deduction for heavily played staples so more distinctive picks can surface.',
  },
] as const

type RecommendationScoreFactor = (typeof recommendationScoreFactors)[number]['key']
type RecommendationRadarFactor = (typeof recommendationScoreFactors)[number]

function radarPoint(
  index: number,
  value: number,
  max: number,
  factorCount: number = recommendationScoreFactors.length,
  radius = 38,
) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / factorCount
  const distance = radius * Math.min(1, Math.max(0, value / max))
  return { x: 50 + Math.cos(angle) * distance, y: 50 + Math.sin(angle) * distance }
}

function radarPoints(
  score: RecommendationScoreBreakdown,
  factors: readonly RecommendationRadarFactor[] = recommendationScoreFactors,
  scale = 1,
) {
  return factors
    .map(({ key, max }, index) => {
      const point = radarPoint(index, score[key] * scale, max, factors.length)
      return `${point.x},${point.y}`
    })
    .join(' ')
}

export function ScoreBreakdown({
  score,
  showPopularityPenalty,
  showCollection,
  showTheme,
  showSubThemes,
}: {
  score: RecommendationScoreBreakdown
  showPopularityPenalty: boolean
  showCollection: boolean
  showTheme: boolean
  showSubThemes: boolean
}) {
  const visibleFactors = recommendationScoreFactors.filter(
    ({ key }) =>
      (showPopularityPenalty || key !== 'popularityPenalty') &&
      (showCollection || key !== 'collection') &&
      (showTheme || key !== 'theme') &&
      (showSubThemes || key !== 'subThemes'),
  )
  return (
    <section className="score-breakdown" aria-label={`Score breakdown: ${score.total} out of 100`}>
      <div className="score-breakdown-heading">
        <h4>Score breakdown</h4>
        <strong>{score.total}/100</strong>
      </div>
      <div className="score-breakdown-content">
        <svg
          className="score-radar"
          viewBox="0 0 100 100"
          role="img"
          aria-label={`Radar chart showing score breakdown for ${score.total} out of 100`}
        >
          <title>Score breakdown: {score.total} out of 100</title>
          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <polygon
              className="score-radar-grid"
              points={radarPoints(
                { total: 0, ...recommendationScoreFactorMaximums },
                visibleFactors,
                scale,
              )}
              key={scale}
            />
          ))}
          {visibleFactors.map(({ key, max }, index) => {
            const point = radarPoint(index, max, max, visibleFactors.length)
            return (
              <line
                className="score-radar-axis"
                x1="50"
                y1="50"
                x2={point.x}
                y2={point.y}
                key={key}
              />
            )
          })}
          <polygon className="score-radar-area" points={radarPoints(score, visibleFactors)} />
        </svg>
        <dl className="score-factors">
          {visibleFactors.map(({ key, label, max, description }) => (
            <div
              className="score-factor-row"
              tabIndex={0}
              aria-describedby={`score-factor-${key}`}
              key={key}
            >
              <dt>{label}</dt>
              <dd>
                {score[key as RecommendationScoreFactor]} / {max}
              </dd>
              <span className="score-factor-tooltip" id={`score-factor-${key}`} role="tooltip">
                {description}
              </span>
            </div>
          ))}
        </dl>
      </div>
      <p className="score-note">
        Positive factors total 100 points. Mana-fit and popularity penalties reduce the total.
      </p>
    </section>
  )
}
