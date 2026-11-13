import type { PowerTarget, RecommendationStyle } from './recommendation-types.ts'

/**
 * The one source for the app's player-facing terms: role labels, Priority and Power options,
 * bracket terms and the Commander primer all read their names and definitions from here.
 * See CONTEXT.md for the kinds of domain claim.
 */
export type ClaimKind = 'rule' | 'policy' | 'heuristic' | 'app'

export type GlossaryEntry = {
  term: string
  definition: string
  kind: ClaimKind
  /** Shown to players beside rule and policy claims. */
  citation?: string
  /** The mtg-knowledge-base topic that supports a rule or policy claim. */
  source?: string
}

export const claimKindLabels: Record<ClaimKind, string> = {
  rule: 'Rule',
  policy: 'Policy',
  heuristic: 'Heuristic',
  app: 'App setting',
}

const rules = 'mtg-knowledge-base knowledge/topics/commander/rules.md (checked 2026-10-03)'
const policy = 'mtg-knowledge-base knowledge/topics/commander/format-policy.md (checked 2026-10-03)'
const policyCitation = 'Wizards Commander format page, checked 2026-10-03'

/** Commander rules and policy, for the primer. */
export const formatTerms = {
  commander: {
    term: 'Commander',
    definition:
      'The legendary creature, or other card the rules allow, that leads your deck. It starts in the command zone, so you can cast it every game.',
    kind: 'rule',
    citation: 'Comprehensive Rules 903.3, 903.6',
    source: rules,
  },
  deckSize: {
    term: '100 cards',
    definition:
      'A deck is exactly 100 cards, including the commander. With two partner commanders, 98 cards remain.',
    kind: 'rule',
    citation: 'Comprehensive Rules 903.5a, 702.124b',
    source: rules,
  },
  singleton: {
    term: 'Singleton',
    definition:
      'Only one copy of each card, apart from basic lands and cards whose text allows more.',
    kind: 'rule',
    citation: 'Comprehensive Rules 903.5b',
    source: rules,
  },
  colourIdentity: {
    term: 'Colour identity',
    definition:
      "The colours of the mana symbols in a card's cost and rules text (not reminder text), plus any colour indicator or colour-setting ability. Every card's colour identity must fit within your commander's.",
    kind: 'rule',
    citation: 'Comprehensive Rules 903.4, 903.5c',
    source: rules,
  },
  bracket: {
    term: 'Brackets',
    definition:
      "Wizards' five Commander Brackets, from 1 Exhibition to 5 cEDH, describe the game a deck aims for so players can match decks. They are an optional matchmaking tool, not a calculator; no setting here assigns a deck's bracket.",
    kind: 'policy',
    citation: policyCitation,
    source: policy,
  },
  gameChanger: {
    term: 'Game Changers',
    definition:
      "Cards on Wizards' list of cards that can warp games. Bracket guidance allows none in Brackets 1–2 (Bracket 1 exceptions need pregame agreement), up to three in Bracket 3, and no limit in Brackets 4–5.",
    kind: 'policy',
    citation: policyCitation,
    source: policy,
  },
} satisfies Record<string, GlossaryEntry>

/** Deck roles. Detection and default counts are heuristics; see docs/domain/heuristics.md. */
export const roleTerms = {
  lands: {
    term: 'Lands',
    definition: 'Your main source of mana, so you can cast a spell every turn.',
    kind: 'heuristic',
  },
  ramp: {
    term: 'Ramp',
    definition: 'Extra mana from mana rocks, mana creatures or spells that fetch lands.',
    kind: 'heuristic',
  },
  draw: {
    term: 'Card draw',
    definition: 'Cards that draw more cards, so you do not run out of things to do.',
    kind: 'heuristic',
  },
  removal: {
    term: 'Targeted removal',
    definition: 'Answers to one threat: destroy, exile, bounce or counter it.',
    kind: 'heuristic',
  },
  wipes: {
    term: 'Board wipes',
    definition: 'Cards that clear many creatures or permanents at once when you fall behind.',
    kind: 'heuristic',
  },
} satisfies Record<string, GlossaryEntry>

export const priorityTerms: Record<RecommendationStyle, GlossaryEntry> = {
  thematic: {
    term: 'Theme first',
    definition: 'Favours your theme and selected sets.',
    kind: 'app',
  },
  balanced: { term: 'Balanced', definition: 'Mixes theme and deck needs.', kind: 'app' },
  competitive: {
    term: 'Deck needs first',
    definition: 'Favours missing roles and mana fit.',
    kind: 'app',
  },
  fun: { term: 'Surprise me', definition: 'Boosts interesting new picks.', kind: 'app' },
}

export const powerTerms: Record<PowerTarget, GlossaryEntry & { bracketHint: string }> = {
  precon: {
    term: 'Core',
    definition: 'Excludes a short list of fast-mana cards as an app preference.',
    kind: 'app',
    bracketHint: 'Bracket 2',
  },
  upgraded: {
    term: 'Upgraded',
    definition: 'Allows fast mana and gently favours cheaper ramp, draw and removal.',
    kind: 'app',
    bracketHint: 'Bracket 3',
  },
  high: {
    term: 'High power',
    definition: 'Allows fast mana and favours cheaper ramp, draw and removal more strongly.',
    kind: 'app',
    bracketHint: 'Bracket 4',
  },
}

/** App concepts named in the builder. */
export const appTerms = {
  batch: {
    term: 'Batch',
    definition:
      'A group of up to four recommended cards. Add puts a card in your deck, Later saves it for a future batch, and Ignore stops recommending it.',
    kind: 'app',
  },
  theme: {
    term: 'Theme',
    definition:
      'Your deck’s main plan, such as Tokens or Dragons. Recommendations favour cards that fit it.',
    kind: 'app',
  },
  extraTheme: {
    term: 'Extra theme',
    definition:
      'Up to two more themes after the first, such as a creature type or mechanic. Recommendations mix them in.',
    kind: 'app',
  },
  suggestedTheme: {
    term: 'Suggested theme',
    definition:
      'A theme that several recently added cards share. Use adds it as a theme; Dismiss hides it until more cards match.',
    kind: 'heuristic',
  },
  themeCards: {
    term: 'Theme cards',
    definition:
      'Main-deck cards whose text or type line matches your theme. Text matching can miss or over-count cards, and the starting target is an app estimate, not a rule.',
    kind: 'heuristic',
  },
  priority: {
    term: 'Priority',
    definition:
      'How recommendations are ranked. It never changes what the deck may legally include.',
    kind: 'app',
  },
  power: {
    term: 'Power',
    definition:
      'Which strength filters and pace preferences recommendations use. It is not a bracket verdict.',
    kind: 'app',
  },
} satisfies Record<string, GlossaryEntry>

const labels = <K extends string>(entries: Record<K, GlossaryEntry>) =>
  Object.fromEntries(
    Object.entries<GlossaryEntry>(entries).map(([key, { term }]) => [key, term]),
  ) as Record<K, string>

export const priorityLabels = labels(priorityTerms)
export const powerLabels = labels(powerTerms)
export const roleLabels = labels(roleTerms)

/** "Theme first favours …; Balanced mixes …" for a setting's help popover. */
export const optionHelp = (entries: Record<string, GlossaryEntry>) =>
  Object.values(entries)
    .map(({ term, definition }) => `${term}: ${definition}`)
    .join(' ')
