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
    key: 'package',
    label: 'Strategy package',
    max: recommendationScoreFactorMaximums.package,
    description:
      'Fills the side of a sacrifice or tokens plan your deck lacks: an enabler when payoffs outnumber enablers, a payoff when enablers outnumber payoffs, or the first protection. A heuristic, not a measure of card quality.',
  },
  {
    key: 'manaFitPenalty',
    label: 'Mana-fit penalty',
    max: recommendationScoreFactorMaximums.manaFitPenalty,
    description:
      'Deducts up to 10 points when a spell’s mana value or coloured pips exceed the deck’s current land, ramp, or colour support. This is a heuristic, not a casting probability.',
  },
  {
    key: 'powerFitPenalty',
    label: 'Power-target penalty',
    max: recommendationScoreFactorMaximums.powerFitPenalty,
    description:
      'Upgraded gently favours lower-cost ramp, draw and interaction; High favours them more strongly. Core adds no deduction. Mana value is a pace heuristic, not a bracket verdict or a win-turn prediction.',
  },
  {
    key: 'popularityPenalty',
    label: 'Popularity penalty',
    max: recommendationScoreFactorMaximums.popularityPenalty,
    description:
      'Thematic goal deduction for heavily played staples so more distinctive picks can surface.',
  },
] as const

type RecommendationScoreFactor = (typeof recommendationScoreFactors)[number]['key']
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
    <details className="score-breakdown">
      <summary className="score-breakdown-heading">Why this card</summary>
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
              {Math.round(score[key as RecommendationScoreFactor] * 10) / 10} / {max}
            </dd>
            <span className="score-factor-tooltip" id={`score-factor-${key}`} role="tooltip">
              {description}
            </span>
          </div>
        ))}
      </dl>
      <p className="score-note">
        Positive factors total 108 points. Mana-fit, power-target and popularity penalties reduce
        the total.
      </p>
    </details>
  )
}
