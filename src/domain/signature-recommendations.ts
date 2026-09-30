import type { Card, DeckCard, ScryfallCard } from './card-model.ts'
import { cardNameKey, toCard } from './card-model.ts'
import { isCommanderCandidate } from './commander-promotion.ts'
import { commanderNames } from './commander-catalog.ts'
import { recommendationScore } from './recommendation-scoring.ts'
import { buildEdhrecRecommendations } from './recommendation-sources.ts'
import { findSynergyPair } from './recommendation-themes.ts'
import type {
  RecommendationOptions,
  RecommendationScoreContext,
  SeedEvidence,
} from './recommendation-types.ts'
import type { EdhrecCommanderPage } from '../adapters/edhrec.ts'

export { cardNameKey } from './card-model.ts'
const rulesText = (text: string) => text.replace(/\([^)]*\)/g, '')
// ponytail: only three validated mechanics; add families with labeled decks, not generic popularity.
const mechanics = [
  {
    theme: '+1/+1 counters',
    aliases: ['+1/+1 counters', 'Counters'],
    participant: /\+1\/\+1 counter/i,
    engine:
      /instead|:\s*put .*\+1\/\+1 counter|(?:whenever|at the beginning)[\s\S]*put [^\n]*\+1\/\+1 counter/i,
    multiplier: /instead/i,
  },
  {
    theme: 'ETB',
    aliases: ['ETB', 'Blink'],
    participant:
      /when(?:ever)? (?![^\n,.]*\blands?\b)[^\n,.]*enter|exile .*return|entering causes a triggered ability/i,
    engine: /triggers an additional time|(?:whenever|at the beginning).*exile .*return/i,
    multiplier: /triggers an additional time/i,
  },
  {
    theme: 'Sacrifice',
    aliases: ['Sacrifice', 'Death triggers'],
    participant: /creature.*dies|sacrifice (?:a|another|one or more) .*creature/i,
    engine: /whenever .*creature.*dies|^sacrifice (?:a|another) creature:/i,
    multiplier: /whenever .*creature.*dies/i,
  },
]
export type SignatureSeed = { card: DeckCard; theme: string; page: 'cards' | 'commanders' }

export function selectSignatureSeeds(
  commander: string,
  deck: DeckCard[],
  context: RecommendationScoreContext,
): SignatureSeed[] {
  const names = new Set(commanderNames(commander).map(cardNameKey))
  const main = deck.filter(
    (card) => !names.has(cardNameKey(card.name)) && !card.typeLine.includes('Land'),
  )
  const choices = mechanics.flatMap((mechanic) => {
    const participants = main.filter((card) => mechanic.participant.test(rulesText(card.detail)))
    if (participants.length < 3) return []
    return participants
      .filter((card) => mechanic.engine.test(rulesText(card.detail)))
      .map((card) => ({
        card,
        theme: mechanic.theme,
        page:
          mechanic.theme === 'ETB' && isCommanderCandidate(card)
            ? ('commanders' as const)
            : ('cards' as const),
        priority: Number(mechanic.multiplier.test(rulesText(card.detail))),
        fit: recommendationScore({ ...card, reason: 'Deck engine' }, context),
        selected: Number(
          [context.theme, ...context.activeSubThemes].some(
            (theme) => mechanic.aliases.includes(theme) || card.tags.includes(theme),
          ),
        ),
      }))
  })
  const seen = new Set<string>()
  return choices
    .sort((a, b) => b.selected - a.selected || b.priority - a.priority || b.fit - a.fit)
    .filter(({ card }) => {
      const key = cardNameKey(card.name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 2)
}

const ordinaryLists = new Set([
  'creatures',
  'instants',
  'sorceries',
  'utilityartifacts',
  'enchantments',
  'planeswalkers',
  'battles',
])
export function signatureEntries(
  page: EdhrecCommanderPage,
  seed: SignatureSeed,
  excluded: Set<string>,
): SeedEvidence[] {
  const entries = page.container.json_dict.cardlists
    .filter(({ tag }) => ordinaryLists.has(tag))
    .flatMap(({ tag, cardviews }) => cardviews.map((card) => ({ ...card, tag })))
    .filter((card) => !excluded.has(cardNameKey(card.name)) && (card.num_decks ?? 0) >= 100)
    .filter((card) => (seed.page === 'cards' ? (card.lift ?? 0) >= 1.5 : (card.synergy ?? 0) > 0))
    .sort((a, b) =>
      seed.page === 'cards'
        ? (b.num_decks ?? 0) - (a.num_decks ?? 0)
        : (b.synergy ?? 0) - (a.synergy ?? 0),
    )
  const unique = new Map<string, SeedEvidence>()
  for (const entry of entries) {
    const key = cardNameKey(entry.name)
    if (!unique.has(key))
      unique.set(key, {
        name: entry.name,
        seed: seed.card.name,
        page: seed.page,
        theme: seed.theme,
        tag: entry.tag,
        lift: entry.lift,
        decks: entry.num_decks,
      })
    if (unique.size === 24) break
  }
  return [...unique.values()]
}

export function supportsSignature(card: Card, seed: SignatureSeed, main: DeckCard[]) {
  if (
    card.tags.includes('Energy') &&
    main.filter((peer) => peer.tags.includes('Energy')).length < 2
  )
    return false
  if (/choose a creature type|(?:angel|zombie)s? you control/i.test(card.detail)) return false
  if (
    /whenever (?:a|one or more) tokens?/i.test(card.detail) &&
    main.filter((peer) => peer.tags.includes('Tokens')).length < 2
  )
    return false
  const mechanic = mechanics.find(({ theme }) => theme === seed.theme)!
  if (mechanic.participant.test(rulesText(card.detail))) return true
  if (seed.theme === 'ETB') return false
  if (findSynergyPair([card, { ...seed.card, reason: '' }])) return true
  return (
    seed.theme === 'Sacrifice' &&
    (/create[^\n]*creature tokens?/i.test(card.detail) ||
      (/create[^\n]*tokens?/i.test(seed.card.detail) &&
        /whenever you (?:create|sacrifice)[^\n]*tokens?/i.test(card.detail)))
  )
}

export type SignatureSettings = RecommendationOptions & {
  commander: string
  deck: DeckCard[]
  sideboard: DeckCard[]
  ignoredCards: string[]
  deferredCards: { card: Card; eligibleBatch: number }[]
  commanderDetails: { colours: string[] } | null
  collectionMode: 'none' | 'prefer' | 'only'
  collectionSets: string[]
}
export type SignatureResult = {
  raw: ScryfallCard
  evidence: SeedEvidence[]
  seeds: SignatureSeed[]
}

function allowedResult(raw: ScryfallCard, settings: SignatureSettings) {
  if (!settings.commanderDetails) return false
  if (raw.legalities?.commander !== 'legal' || raw.type_line.includes('Land')) return false
  if (settings.excludeGameChangers && raw.game_changer !== false) return false
  if (settings.excludeUnreleased && !raw.released_at) return false
  if (!raw.color_identity.every((colour) => settings.commanderDetails?.colours.includes(colour)))
    return false
  // ponytail: collection-only accepts the hydrated printing; resolve allowed printings if wider coverage is needed.
  if (settings.collectionMode === 'only' && !settings.collectionSets.includes(raw.set)) return false
  return (
    buildEdhrecRecommendations([{ name: raw.name, tag: '', header: '' }], [raw], settings).length >
    0
  )
}

export function mergeSignatureResults(
  queue: Card[],
  results: SignatureResult[],
  settings: SignatureSettings,
) {
  if (queue.length < 4) return queue
  const blocked = new Set(
    [
      ...commanderNames(settings.commander),
      ...settings.ignoredCards,
      ...[
        ...settings.deck,
        ...settings.sideboard,
        ...settings.deferredCards.map(({ card }) => card),
        ...queue.slice(0, 4),
      ].map(({ name }) => name),
    ].map(cardNameKey),
  )
  const next = [...queue]
  let changed = false
  for (const result of results) {
    if (blocked.has(cardNameKey(result.raw.name)) || !allowedResult(result.raw, settings)) continue
    const seeds = result.seeds.filter((seed) =>
      settings.deck.some((card) => cardNameKey(card.name) === cardNameKey(seed.card.name)),
    )
    const card = toCard(result.raw, `Seen with ${seeds[0]?.card.name ?? ''}`)
    const relevant = seeds.filter((seed) => supportsSignature(card, seed, settings.deck))
    const evidence = result.evidence.filter((entry) =>
      relevant.some((seed) => seed.card.name === entry.seed),
    )
    if (!evidence.length) continue
    card.reason = `Seen with ${evidence[0].seed}`
    card.source = 'edhrec'
    card.seedEvidence = evidence
    card.collectionMatch =
      settings.collectionMode !== 'none' && settings.collectionSets.includes(card.set)
    const index = next.findIndex((pending) => cardNameKey(pending.name) === cardNameKey(card.name))
    if (index < 0) {
      next.push(card)
      changed = true
      continue
    }
    const previous = next[index]
    const merged = new Map(
      [...(previous.seedEvidence ?? []), ...evidence].map((entry) => [
        `${entry.seed}:${entry.page}:${entry.tag}`,
        entry,
      ]),
    )
    if (merged.size === (previous.seedEvidence?.length ?? 0)) continue
    next[index] = { ...previous, seedEvidence: [...merged.values()] }
    changed = true
  }
  return changed ? next : queue
}
