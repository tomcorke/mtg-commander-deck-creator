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
    description: 'Core · Theme first. Exclude Game Changers, tutors and extra turns.',
  },
  {
    id: 'upgraded',
    label: 'Upgraded',
    description:
      'Upgraded · Balanced. Allow Game Changers; keep your tutor and extra-turn preferences.',
  },
  {
    id: 'high',
    label: 'High power',
    description: 'High power · Deck needs first. Allow Game Changers, tutors and extra turns.',
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
