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
export const signatureLimits = {
  seedsPerPass: 3,
  namesPerSeed: 24,
  seedsPerDeck: 8,
  postsPerDeck: 4,
  seedsPerTab: 24,
  postsPerTab: 12,
}

type Mechanic = {
  theme: string
  aliases: string[]
  participant: RegExp
  engine: RegExp
  multiplier?: RegExp
  types?: string[]
}
// ponytail: narrow rules-text profiles; add labeled engine/participant cases for other families.
const mechanics: Mechanic[] = [
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
  {
    theme: 'Tokens',
    aliases: ['Tokens', 'Populate'],
    participant:
      /\bcreate\b[^\n]*tokens?|tokens?[^\n]*created under your control|tokens? you control|\bpopulate\b/i,
    engine:
      /would[^\n]*tokens?[^\n]*instead|whenever[^\n]*(?:create|tokens? you control)|at the beginning[^\n]*create[^\n]*token|(?:at the beginning|:)[^\n]*\bpopulate\b/i,
    multiplier: /instead/i,
  },
  {
    theme: 'Enchantments',
    aliases: ['Enchantments', 'Sagas'],
    types: ['Enchantment'],
    participant:
      /enchantments? you control|enchantment spells? you cast|cast[^\n]*enchantment|\bconstellation\b/i,
    engine:
      /whenever[^\n]*enchantment[^\n]*(?:you control|under your control)|whenever you cast[^\n]*enchantment|enchantment spells you cast cost|\bconstellation\b/i,
  },
  {
    theme: 'Artifacts',
    aliases: ['Artifacts', 'Resource tokens'],
    types: ['Artifact'],
    participant:
      /artifacts? you control|artifact spells? you cast|cast[^\n]*artifact|create[^\n]*(?:Treasure|Clue|Food|Blood|Gold|Map|artifact) tokens?/i,
    engine:
      /whenever[^\n]*artifact[^\n]*(?:you control|under your control)|whenever you cast[^\n]*artifact|artifact spells you cast cost|sacrifice an? artifact:/i,
  },
  {
    theme: 'Lifegain',
    aliases: ['Lifegain'],
    participant: /you (?:would )?gain[^\n]*life|\blifelink\b/i,
    engine:
      /whenever[^\n]*you (?:would )?gain[^\n]*life|you would gain[^\n]*instead|:[^\n]*you gain[^\n]*life/i,
    multiplier: /instead/i,
  },
  {
    theme: 'Graveyard',
    aliases: ['Graveyard', 'Recursion', 'Mill'],
    participant:
      /your graveyard|return[^\n]*from a graveyard|(?:^|[,.]\s*)mill\b|you mill|\b(?:surveil|flashback|escape)\b/i,
    engine:
      /(?:cast|play)[^\n]*from your graveyard|(?:whenever|at the beginning|:)[^\n]*return[^\n]*graveyard/i,
  },
  {
    theme: 'Spellslinger',
    aliases: ['Spellslinger', 'Spell copying'],
    types: ['Instant', 'Sorcery'],
    participant:
      /instant (?:or|and) sorcery|noncreature spells?|copy[^\n]*(?:instant|sorcery|spell)|\bmagecraft\b/i,
    engine:
      /whenever you (?:cast|copy)|\bmagecraft\b|(?:instant|sorcery|noncreature) spells[^\n]*cost[^\n]*less/i,
  },
  {
    theme: 'Landfall',
    aliases: ['Landfall'],
    participant:
      /\blandfall\b|whenever[^\n]*lands? (?:you control enters?|enters?[^\n]*under your control)|play (?:an?|two|three) additional lands?/i,
    engine:
      /whenever[^\n]*lands? (?:you control enters?|enters?[^\n]*under your control)|play (?:an?|two|three) additional lands?/i,
  },
  {
    theme: 'Equipment',
    aliases: ['Equipment', 'Voltron'],
    types: ['Equipment'],
    participant:
      /equipped creatures?|equipment you control|equipment spells? you cast|equip (?:abilities|costs)|attach[^\n]*you control/i,
    engine:
      /whenever[^\n]*(?:equipment|equipped|attach)|equip[^\n]*(?:cost|pay)|equipment spells[^\n]*cost[^\n]*less/i,
  },
]
const participates = (card: Pick<Card, 'detail' | 'typeLine'>, mechanic: Mechanic) =>
  mechanic.types?.some((type) => card.typeLine.includes(type)) ||
  mechanic.participant.test(rulesText(card.detail))

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
    const participants = main.filter((card) => participates(card, mechanic))
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
        priority: Number(mechanic.multiplier?.test(rulesText(card.detail)) ?? false),
        fit: recommendationScore({ ...card, reason: 'Deck engine' }, context),
        selected: Math.max(
          0,
          ...[context.theme, ...context.activeSubThemes].map((theme) =>
            mechanic.aliases.includes(theme) ? 2 : Number(card.tags.includes(theme)),
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
    .slice(0, signatureLimits.seedsPerPass)
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
    if (unique.size === signatureLimits.namesPerSeed) break
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
  const mechanic = mechanics.find(({ theme }) => theme === seed.theme)
  if (!mechanic) return false
  if (participates(card, mechanic)) return true
  if (seed.theme === '+1/+1 counters' && findSynergyPair([card, { ...seed.card, reason: '' }]))
    return true
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
