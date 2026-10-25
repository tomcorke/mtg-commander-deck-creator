import type { PowerTarget, RecommendationStyle } from '../recommendations.ts'

export type PlayStyle = 'casual' | 'upgraded' | 'high'
export type PlayStyleSettings = {
  powerTarget: PowerTarget
  recommendationStyle: RecommendationStyle
  excludeGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
}
export const playStyles = [
  {
    id: 'casual',
    label: 'Casual',
    summary:
      'Theme-first picks for relaxed games, without the strongest cards, tutors or extra turns.',
    description: 'Core · Theme first · Excludes Game Changers, tutors and extra turns',
  },
  {
    id: 'upgraded',
    label: 'Upgraded',
    summary:
      'A balance of theme and strength. Strong cards and tutors are in; extra turns stay out.',
    description: 'Upgraded · Balanced · Allows Game Changers and tutors · Excludes extra turns',
  },
  {
    id: 'high',
    label: 'High power',
    summary: 'The strongest picks for what the deck needs, with nothing held back.',
    description: 'High power · Deck needs first · Allows Game Changers, tutors and extra turns',
  },
] as const

/** App preference presets, never a bracket verdict. Unreleased and other settings are untouched. */
export function playStyleSettings(current: PlayStyleSettings, style: PlayStyle): PlayStyleSettings {
  if (style === 'upgraded')
    return {
      ...current,
      powerTarget: 'upgraded',
      recommendationStyle: 'balanced',
      excludeGameChangers: false,
      excludeTutors: false,
      excludeExtraTurns: true,
    }
  const casual = style === 'casual'
  return {
    ...current,
    powerTarget: casual ? 'precon' : 'high',
    recommendationStyle: casual ? 'thematic' : 'competitive',
    excludeGameChangers: casual,
    excludeTutors: casual,
    excludeExtraTurns: casual,
  }
}
export function matchingPlayStyle(current: PlayStyleSettings) {
  return playStyles.find(({ id }) => {
    const preset = playStyleSettings(current, id)
    return Object.keys(preset).every(
      (key) => preset[key as keyof PlayStyleSettings] === current[key as keyof PlayStyleSettings],
    )
  })?.id
}
