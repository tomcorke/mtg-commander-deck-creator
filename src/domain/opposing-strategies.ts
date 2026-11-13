import { isWipe } from '../deck-analysis.ts'
import { opposingStrategyTerms } from './glossary.ts'
import { shortQuote } from './recommendation-themes.ts'
import {
  opposingStrategies,
  recommendationScoreFactorMaximums,
  type OpposingStrategy,
  type RecommendationScoreContext,
} from './recommendation-types.ts'

/**
 * Expected opponents (#503): which selected opposing strategies a card's rules text answers.
 *
 * Heuristic: sentence-level wording clues, like the role classifiers in `deck-analysis.ts`. A match
 * means the text reads like an answer, not that the card stops the strategy; no match does not
 * prove a card is no answer. Limits are listed in docs/domain/heuristics.md.
 */

/**
 * Heuristic (#503): answers per selected strategy before its scoring boost eases. An app estimate,
 * not a community standard; Deck review shows it beside each strategy's count.
 */
export const opposingAnswerTarget = 3

// Oracle text uses typographic apostrophes; fixtures and older data may use straight ones.
const pattern = (source: string) => new RegExp(source.replaceAll("'", "[’']"), 'i')
const any = (...sources: string[]) => sources.map(pattern)

const yourOwn = pattern(String.raw`\byou (?:control|own)\b`)
const sizeLimited = pattern(String.raw`\b(?:power|toughness|mana value) \d+ or less\b`)
// Graveyard wording points at cards there (recursion, graveyard hate), not permanents in play.
const graveyardCard = pattern(String.raw`\bgraveyards?\b`)
// "Exile" as a verb; "from exile" and "into exile" name the zone.
const exileVerb = String.raw`(?<!(?:from|into|in) )\bexiles?\b`
const creaturesOrPermanents = pattern(String.raw`\b(?:creatures?|permanents?)\b`)
// Spells of one card type or colour ("Creature spells cost {2} more") are not a spellslinger tax.
const typedSpells = String.raw`(?<!\b(?:creature|artifact|enchantment|planeswalker|battle|kindred|legendary|aura|equipment|white|blue|black|red|green|multicolored|colorless) )`

/**
 * `matches` are sentence clues; `wipe` also counts sentences `isWipe` accepts that match `requires`
 * and not `rejects`. `excludes` vetoes either.
 */
type Clue = {
  matches: RegExp[]
  excludes?: RegExp[]
  wipe?: { requires: RegExp; rejects?: RegExp }
}

const clues: Record<OpposingStrategy, Clue> = {
  graveyard: {
    matches: any(
      String.raw`${exileVerb}[^.]*\b(?:graveyards|(?:a|target player's|target opponent's|an opponent's|each opponent's|each player's|that player's|their) graveyard)\b`,
      String.raw`\bif an? (?:[\w-]+ )*(?:card|token|permanent)s?\b[^.]*\bwould be put into (?:a|an opponent's) graveyard from anywhere`,
      String.raw`\bin graveyards\b[^.]*\b(?:can't|lose all abilities)`,
      String.raw`\bcan't\b[^.]*\bfrom graveyards\b`,
    ),
  },
  artifacts: {
    matches: any(
      String.raw`\b(?:destroy|exile)\b[^.]*\b(?:target|all|each)\b[^.]*\bartifacts?\b`,
      String.raw`\b(?:destroy|exile)\b[^.]*\b(?:target|all|each) (?:non(?!artifact)[\w-]+,? )*permanents?\b`,
      String.raw`\b(?:player|opponent)s? sacrifices? (?:an?|one|two) artifacts?\b`,
      String.raw`\bactivated abilities of artifacts\b`,
    ),
    excludes: [yourOwn, graveyardCard],
  },
  tokens: {
    matches: any(
      String.raw`\bcreatures? (?:your opponents control|target player controls|target opponent controls) gets? -(?:\d+|x)/-(?:[1-9]|x)`,
      String.raw`\beach (?:other )?creature (?:your opponents control )?gets? -(?:\d+|x)/-(?:[1-9]|x)`,
      String.raw`\b(?:destroy|exile) (?:all|each) [^.]*\btokens?\b`,
    ),
    excludes: [yourOwn, graveyardCard],
    // "-2/-0" shrinks power only.
    wipe: {
      requires: pattern(String.raw`\b(?:creatures?|permanents?|tokens?)\b`),
      rejects: pattern(String.raw`/-0\b`),
    },
  },
  combo: {
    matches: any(
      String.raw`\bcounter target (?:[\w-]+ )?(?:spell|activated|triggered|ability)`,
      String.raw`\bcan't cast more than one spell\b`,
      String.raw`\bactivated abilities\b[^.]*\bcan't be activated\b`,
      String.raw`\bdon't cause abilities to trigger\b`,
      String.raw`\b(?:players|opponents) can't search libraries\b`,
      String.raw`\bopponents? would search\b`,
      String.raw`\bopponents can't win the game\b`,
    ),
  },
  'big-creatures': {
    matches: any(
      String.raw`\b(?:destroy|exile)\b[^.]*\btarget\b[^.]*\b(?:creatures?|permanents?)\b(?! cards?)`,
      String.raw`\b(?:player|opponent)s? sacrifices? (?:an?|one|two|three|that many) (?:[\w-]+ )?(?:creatures?|permanents?)\b`,
      String.raw`\benchanted creature can't attack\b`,
      String.raw`^(?!.*\buntil end of turn\b).*\bgain control of target creature\b`,
    ),
    excludes: [yourOwn, sizeLimited, graveyardCard],
    // Damage, shrinking and token sweeps leave a big creature behind.
    wipe: {
      requires: creaturesOrPermanents,
      rejects: pattern(String.raw`\bdamage\b|-(?:\d+|x)/-(?:\d+|x)|\btokens?\b`),
    },
  },
  spellslinger: {
    matches: any(
      String.raw`\bcounter target (?:(?:instant|sorcery|noncreature|instant or sorcery) )?spell\b`,
      String.raw`${typedSpells}\bspells (?:your opponents cast |target player casts )?cost \{\d+\} more\b`,
      String.raw`\bcan't cast more than one spell\b`,
      String.raw`\bwhenever an opponent casts an? (?:noncreature|instant|sorcery|instant or sorcery) spell\b[^.]*\b(?:loses? \d+ life|damage)`,
    ),
  },
}

const answersIn = (sentence: string, { matches, excludes = [], wipe }: Clue) =>
  !excludes.some((exclude) => exclude.test(sentence)) &&
  (matches.some((match) => match.test(sentence)) ||
    (wipe !== undefined &&
      isWipe(sentence) &&
      wipe.requires.test(sentence) &&
      !wipe.rejects?.test(sentence)))

/** Rules-text sentences, without reminder text, in printed order. */
function sentences(detail: string) {
  return detail
    .split('\n')
    .flatMap((line) => line.replace(/\s*\([^)]*\)/g, '').split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

/** The first sentence that reads as an answer to `strategy`, shortened for display. */
export function opposingAnswerEvidence(card: { detail?: string }, strategy: OpposingStrategy) {
  const sentence = sentences(card.detail ?? '').find((text) => answersIn(text, clues[strategy]))
  return sentence ? shortQuote(sentence) : undefined
}

/** The strategies, in the order given, whose answers the card's text matches. */
export function opposingAnswers(
  card: { detail?: string },
  strategies: readonly OpposingStrategy[] = opposingStrategies,
) {
  if (!strategies.length || !card.detail) return []
  const text = sentences(card.detail)
  return strategies.filter((strategy) =>
    text.some((sentence) => answersIn(sentence, clues[strategy])),
  )
}

/** Main-deck cards that answer each selected strategy. Commanders count, as for roles. */
export function opposingAnswerCoverage<T extends { detail?: string }>(
  cards: T[],
  strategies: readonly OpposingStrategy[],
) {
  return strategies.map((strategy) => ({
    strategy,
    cards: cards.filter((card) => opposingAnswers(card, [strategy]).length > 0),
  }))
}

export const opposingAnswerCounts = (
  cards: { detail?: string }[],
  strategies: readonly OpposingStrategy[],
): Partial<Record<OpposingStrategy, number>> =>
  Object.fromEntries(
    opposingAnswerCoverage(cards, strategies).map(({ strategy, cards }) => [
      strategy,
      cards.length,
    ]),
  )

/**
 * Score for answering selected strategies: 6 for each one still below its target, 2 once met,
 * capped. Theme first halves it, so expected opponents never outrank the theme there.
 */
export function opposingAnswerScore(
  card: { detail?: string },
  {
    opposingStrategies: strategies = [],
    opposingAnswerCounts: counts = {},
    recommendationStyle: style = 'balanced',
  }: Pick<
    RecommendationScoreContext,
    'opposingStrategies' | 'opposingAnswerCounts' | 'recommendationStyle'
  >,
) {
  const answered = opposingAnswers(card, strategies)
  if (!answered.length) return 0
  const base = answered.reduce(
    (sum, strategy) => sum + ((counts[strategy] ?? 0) < opposingAnswerTarget ? 6 : 2),
    0,
  )
  return Math.min(
    recommendationScoreFactorMaximums.opposingAnswers,
    Math.round(base * (style === 'thematic' ? 0.5 : 1)),
  )
}

/** Saved selections, keeping known strategies once each in canonical order. */
export function normalizeOpposingStrategies(value: unknown): OpposingStrategy[] {
  const chosen = new Set(Array.isArray(value) ? value : [])
  return opposingStrategies.filter((strategy) => chosen.has(strategy))
}

export const opposingStrategyLabel = (strategy: OpposingStrategy) =>
  opposingStrategyTerms[strategy].term

/** "Answers graveyard decks", for offer labels. */
export const opposingAnswerLabel = (strategy: OpposingStrategy) =>
  `Answers ${opposingStrategyTerms[strategy].answers}`
