// Bounded #154 evaluation: live-only vs local-plus-live retrieval on fixed partial decks.
// Record once with `--record`, then replay offline from the same provider fixture file.
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseLocalCardIndex } from '../src/domain/local-card-index.ts'
import { queryLocalCardIndex } from '../src/adapters/local-card-index.ts'
import {
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  searchScryfall,
} from '../src/adapters/scryfall.ts'
import { fetchEdhrecCommander } from '../src/adapters/edhrec.ts'
import {
  appendBackgroundCandidates,
  fetchDeckDoctorCandidates,
  rankInitialRecommendations,
} from '../src/app/recommendation-actions.ts'
import { defaultDeckTargets, rolesForCard, targetKeys } from '../src/deck-analysis.ts'
import { toDeckCard, type Card, type ScryfallCard } from '../src/domain/card-model.ts'
import { rankRecommendationCards } from '../src/domain/recommendation-queue.ts'
import { focusedRecommendations } from '../src/domain/recommendation-tuning.ts'
import { withBuilderFixture } from '../src/app/builder-test-fixture.ts'

type Spec = {
  label: string
  kind: 'narrow typal' | 'non-typal' | 'role gap' | 'EDHREC well served'
  commander: string
  theme: string
  deck: string[]
  // Written before any run: strong fits a good pool should contain. Retrieval recall is measured against these.
  labels: string[]
}

const specs: Spec[] = [
  {
    label: 'Ayula bears',
    kind: 'narrow typal',
    commander: 'Ayula, Queen Among Bears',
    theme: 'Bears',
    deck: ['Forest', 'Sol Ring', 'Grizzly Bears', 'Runeclaw Bear', 'Kodama Bear', 'Rampant Growth'],
    labels: [
      'Guardian Gorilla',
      'Bearscape',
      'Goreclaw, Terror of Qal Sisma',
      'Owlbear',
      'Surrak and Goreclaw',
      'Savage Swipe',
      'Bear Umbra',
      'Webweaver Changeling',
    ],
  },
  {
    label: 'Arahbo cats',
    kind: 'narrow typal',
    commander: 'Arahbo, Roar of the World',
    theme: 'Cats',
    deck: ['Plains', 'Forest', 'Sol Ring', 'Qasali Pridemage', 'Leonin Warleader', 'Arcane Signet'],
    labels: [
      'Jetmir, Nexus of Revels',
      'Regal Caracal',
      'Brimaz, King of Oreskos',
      'Pride of the Perfect',
      'Kaheera, the Orphanguard',
      'Adaptive Automaton',
      'Metallic Mimic',
      'Kemba, Kha Regent',
    ],
  },
  {
    label: 'Teysa aristocrats',
    kind: 'non-typal',
    commander: 'Teysa Karlov',
    theme: 'Sacrifice',
    deck: ['Plains', 'Swamp', 'Sol Ring', 'Blood Artist', 'Viscera Seer', 'Orzhov Signet'],
    labels: [
      'Zulaport Cutthroat',
      'Cruel Celebrant',
      'Carrion Feeder',
      'Bastion of Remembrance',
      "Ashnod's Altar",
      'Pitiless Plunderer',
      'Grim Haruspex',
      'Skullclamp',
    ],
  },
  {
    label: 'Sythis enchantress',
    kind: 'non-typal',
    commander: "Sythis, Harvest's Hand",
    theme: 'Enchantments',
    deck: ['Plains', 'Forest', 'Sol Ring', "Enchantress's Presence", 'Utopia Sprawl'],
    labels: [
      'Argothian Enchantress',
      'Setessan Champion',
      'Sanctum Weaver',
      'Eidolon of Blossoms',
      'Mesa Enchantress',
      'Sigil of the Empty Throne',
      'Starfield of Nyx',
      'Destiny Spinner',
    ],
  },
  {
    label: 'Krenko goblins, creatures only',
    kind: 'role gap',
    commander: 'Krenko, Mob Boss',
    theme: 'Goblins',
    deck: [
      'Mountain',
      'Goblin Chieftain',
      'Goblin King',
      'Goblin Warchief',
      'Skirk Prospector',
      'Mogg War Marshal',
      'Goblin Matron',
      'Beetleback Chief',
      'Legion Loyalist',
      'Goblin Instigator',
    ],
    labels: [
      'Chaos Warp',
      'Blasphemous Act',
      'Thrill of Possibility',
      'Arcane Signet',
      'Fellwar Stone',
      'Wheel of Misfortune',
      'Reckless Endeavor',
      'Goblin Bombardment',
    ],
  },
  {
    label: 'Ghalta stompy, creatures only',
    kind: 'role gap',
    commander: 'Ghalta, Primal Hunger',
    theme: '',
    deck: [
      'Forest',
      'Craterhoof Behemoth',
      'Pathbreaker Ibex',
      'Thragtusk',
      'Terastodon',
      'End-Raze Forerunners',
      'Pelakka Wurm',
      'Woodfall Primus',
      'Avenger of Zendikar',
      'Worldspine Wurm',
    ],
    labels: [
      'Beast Within',
      'Return of the Wildspeaker',
      "Rishkar's Expertise",
      "Kodama's Reach",
      'Cultivate',
      'Pest Infestation',
      "Garruk's Uprising",
      'Season of the Burrow',
    ],
  },
  {
    label: 'Atraxa counters',
    kind: 'EDHREC well served',
    commander: "Atraxa, Praetors' Voice",
    theme: '+1/+1 counters',
    deck: ['Plains', 'Island', 'Swamp', 'Forest', 'Sol Ring', 'Doubling Season', 'Arcane Signet'],
    labels: [
      'Hardened Scales',
      'Corpsejack Menace',
      'Inexorable Tide',
      'Evolution Sage',
      'Flux Channeler',
      'Vorinclex, Monstrous Raider',
      'Deepglow Skate',
      'Branching Evolution',
    ],
  },
  {
    label: 'Ur-Dragon dragons',
    kind: 'EDHREC well served',
    commander: 'The Ur-Dragon',
    theme: 'Dragons',
    deck: ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Sol Ring', 'Dragonlord Ojutai'],
    labels: [
      'Dragon Tempest',
      'Scourge of Valkas',
      'Dragonspeaker Shaman',
      'Crucible of the Spirit Dragon',
      'Old Gnawbone',
      'Sarkhan, Fireblood',
      'Lathliss, Dragon Queen',
      'Leyline Tyrant',
    ],
  },
]

const arg = (name: string) => {
  const at = process.argv.indexOf(name)
  return at >= 0 ? process.argv[at + 1] : undefined
}
const record = process.argv.includes('--record')
const fixturePath = arg('--fixtures') ?? 'provider-fixtures.json'
const indexPath = arg('--local-index') ?? 'public/local-card-index.json'
const outputDir = arg('--output') ?? 'local-retrieval-eval'

// Provider fixtures: one stored response per method, URL and body. Replay never reaches the network.
type Stored = { status: number; body: string }
const fixtures: Record<string, Stored> = existsSync(fixturePath)
  ? JSON.parse(await readFile(fixturePath, 'utf8'))
  : {}
const used = new Set<string>()
const liveFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const key = `${init?.method ?? 'GET'} ${url} ${typeof init?.body === 'string' ? init.body : ''}`
  used.add(key)
  if (!fixtures[key]) {
    if (!record) throw new Error(`Replay incomplete, no fixture for ${key}`)
    const headers = { Accept: 'application/json', 'User-Agent': 'commander-creator-eval/1.0' }
    const response = await liveFetch(input, { ...init, headers: { ...init?.headers, ...headers } })
    if (response.status >= 500 || response.status === 429)
      throw new Error(`${response.status}: ${key}`)
    fixtures[key] = { status: response.status, body: await response.text() }
  }
  const { status, body } = fixtures[key]
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

const index = parseLocalCardIndex(JSON.parse(await readFile(indexPath, 'utf8')))
const settings = {
  excludeGameChangers: true,
  excludeTutors: true,
  excludeExtraTurns: true,
  excludeUnreleased: true,
  powerTarget: 'precon',
  includeCreature: true,
  prioritizeDeckHealth: true,
  recommendationStyle: 'balanced',
  collectionMode: 'none',
  collectionSets: [],
  deckTargets: defaultDeckTargets,
  maxPrice: null,
}

async function run(spec: Spec, commander: ScryfallCard, deckCards: ScryfallCard[], local: boolean) {
  const deck = [commander, ...deckCards].map(toDeckCard)
  const searches: string[] = []
  const deps = {
    ...settings,
    commander: spec.commander,
    commanderDetails: { colours: commander.color_identity },
    theme: spec.theme,
    activeSubThemes: [],
    deck,
    sideboard: [],
    ignoredCards: [],
    preferenceScores: {},
    setLimitedRecommendations: () => {},
    setCommanderSubThemes: () => {},
    fetchCard: (name: string) => fetchScryfallCard(name),
    fetchCards: fetchScryfallCardsByIdentifiers,
    fetchEdhrec: fetchEdhrecCommander,
    searchCards: (query: string, signal?: AbortSignal, order?: string) => {
      searches.push(query)
      return searchScryfall(query, fetch, signal, order)
    },
    fetchLocalCards: local
      ? async (query: Parameters<typeof queryLocalCardIndex>[1]) =>
          queryLocalCardIndex(index, query)
      : undefined,
  }
  const pool: Card[] = await withBuilderFixture(fetchDeckDoctorCandidates)({ ...deps })
  let queue: Card[] = []
  withBuilderFixture(rankInitialRecommendations)(
    {
      ...deps,
      rankRecommendationCards,
      setQueue: (ranked: Card[] | ((previous: Card[]) => Card[])) =>
        (queue = typeof ranked === 'function' ? ranked(queue) : ranked),
      setRecommendationState: () => {},
      loadPrintings: () => {},
    },
    pool,
    spec.commander,
    true,
    [],
    'none',
  )
  return { pool, queue, deck, searches }
}

const key = (card: Card) => card.oracleId ?? card.name.toLowerCase()
const roleCounts = (cards: Card[]) =>
  Object.fromEntries(
    targetKeys
      .filter((role) => role !== 'lands')
      .map((role) => [role, cards.filter((card) => rolesForCard(card).includes(role)).length]),
  )

// Seeded shuffle so the blind sheet is reproducible but carries no arm or rank order.
function shuffle<T>(items: T[], seed: number) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    const j = seed % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const report: string[] = []
const blind: string[] = [
  '# Blind spot-check sheet',
  '',
  'Rate each card U (useful now), M (marginal) or N (not useful) for the deck as described.',
]
const blindKey: Record<string, { deck: string; name: string; arms: string[] }> = {}
const summary = []
let blindId = 0
for (const [deckIndex, spec] of specs.entries()) {
  const commander = await fetchScryfallCard(spec.commander)
  const deckCards = await fetchScryfallCardsByIdentifiers(spec.deck.map((name) => ({ name })))
  const live = await run(spec, commander, deckCards, false)
  const both = await run(spec, commander, deckCards, true)
  const liveKeys = new Set(live.pool.map(key))
  const additional = both.queue.filter((card) => !liveKeys.has(key(card)))
  const has = (cards: Card[], name: string) => cards.some((card) => card.name === name)
  const top4 = (cards: Card[]) => cards.slice(0, 4).map(({ name }) => name)
  const ranks = additional.map((card) => both.queue.indexOf(card) + 1)
  // #151 ceiling: with each role focused, which local additions would the background merge drop?
  const ceiling = targetKeys
    .filter((role) => role !== 'lands')
    .map((role) => {
      const visible = focusedRecommendations(live.queue, role, rolesForCard).slice(0, 4).length
      const merged = appendBackgroundCandidates(live.queue, additional, [], role)
      const dropped = additional.filter(
        (card) => rolesForCard(card).includes(role) && !merged.includes(card),
      )
      return { role, visible, dropped: dropped.map(({ name }) => name) }
    })
  summary.push({
    label: spec.label,
    kind: spec.kind,
    livePool: live.pool.length,
    bothPool: both.pool.length,
    additional: additional.length,
    liveRecall: spec.labels.filter(
      (name) => has(live.pool, name) || live.deck.some((c) => c.name === name),
    ).length,
    bothRecall: spec.labels.filter(
      (name) => has(both.pool, name) || both.deck.some((c) => c.name === name),
    ).length,
    labels: spec.labels.length,
    liveTop4: top4(live.queue),
    bothTop4: top4(both.queue),
    additionalInTop20: ranks.filter((rank) => rank <= 20).length,
    bestAdditionalRank: ranks.length ? Math.min(...ranks) : null,
    liveRoles: roleCounts(live.pool),
    bothRoles: roleCounts(both.pool),
    additionalWithEvidence: additional.filter((card) => card.inclusion || card.synergy).length,
    ceiling,
    liveSearches: live.searches,
    bothSearches: both.searches,
  })
  report.push(
    `## ${spec.label} (${spec.kind})`,
    '',
    `Commander ${spec.commander}; theme ${spec.theme || 'none'}; deck ${spec.deck.join(', ')}.`,
    '',
    `Labels found — live: ${spec.labels.filter((n) => has(live.pool, n)).join(', ') || 'none'}; local+live: ${spec.labels.filter((n) => has(both.pool, n)).join(', ') || 'none'}.`,
    '',
    `Live top 20: ${live.queue
      .slice(0, 20)
      .map(({ name }) => name)
      .join(', ')}.`,
    '',
    `Local+live top 20: ${both.queue
      .slice(0, 20)
      .map((card) => (liveKeys.has(key(card)) ? card.name : `${card.name}*`))
      .join(', ')} (* local-only).`,
    '',
    `Highest-ranked local-only additions: ${additional
      .slice(0, 15)
      .map((card) => `${card.name} (#${both.queue.indexOf(card) + 1})`)
      .join(', ')}.`,
    '',
  )
  // Blind sheet: both arms' top fours, the best local-only additions and an equal live sample.
  const liveSample = shuffle(live.queue.slice(4, 40), deckIndex + 1).slice(0, 6)
  const entries = new Map<string, string[]>()
  const tag = (cards: Card[], arm: string) =>
    cards.forEach(({ name }) => entries.set(name, [...(entries.get(name) ?? []), arm]))
  tag(live.queue.slice(0, 4), 'live-top4')
  tag(both.queue.slice(0, 4), 'both-top4')
  tag(additional.slice(0, 6), 'local-only')
  tag(liveSample, 'live-sample')
  blind.push(
    '',
    `## Deck ${deckIndex + 1}: ${spec.commander}, theme ${spec.theme || 'none'}, ${spec.kind === 'role gap' ? 'creature-heavy start with no ramp, draw or removal' : 'early build'}`,
    '',
  )
  for (const [name, arms] of shuffle([...entries], deckIndex + 101)) {
    const id = `c${++blindId}`
    blindKey[id] = { deck: spec.label, name, arms }
    blind.push(`- ${id}: ${name} — `)
  }
}

const commit = execSync('git rev-parse HEAD').toString().trim()
const fixtureHash = createHash('sha256').update(JSON.stringify(fixtures)).digest('hex')
const header = [
  '# Local retrieval quality evaluation (#154)',
  '',
  `Source commit ${commit}. Corpus bulk ${index.metadata.bulkUpdatedAt}, newest set ${index.metadata.newestSet.code}.`,
  `Provider fixtures: ${used.size} responses, sha256 ${fixtureHash}. Mode: ${record ? 'record' : 'replay'}.`,
  `Settings: ${JSON.stringify(settings)}. Local status not supplied, so no stale-index release refresh runs.`,
  '',
]
if (record) await writeFile(fixturePath, JSON.stringify(fixtures))
await mkdir(outputDir, { recursive: true })
await writeFile(`${outputDir}/report.md`, [...header, ...report].join('\n'))
await writeFile(`${outputDir}/summary.json`, JSON.stringify(summary, null, 2))
await writeFile(`${outputDir}/blind.md`, blind.join('\n') + '\n')
await writeFile(`${outputDir}/blind-key.json`, JSON.stringify(blindKey, null, 2))
console.log(header.join('\n'))
console.table(
  summary.map(
    ({
      label,
      livePool,
      bothPool,
      additional,
      liveRecall,
      bothRecall,
      labels,
      additionalInTop20,
      bestAdditionalRank,
    }) => ({
      label,
      livePool,
      bothPool,
      additional,
      recall: `${liveRecall}/${labels} -> ${bothRecall}/${labels}`,
      additionalInTop20,
      bestAdditionalRank,
    }),
  ),
)
