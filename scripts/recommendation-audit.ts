import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  analyseDeck,
  deckRoleBoosts,
  defaultDeckTargets,
  rolesForCard,
} from '../src/deck-analysis.ts'
import {
  advanceRecommendationQueue,
  buildEdhrecRecommendations,
  edhrecSlug,
  parseEdhrecEntries,
  recommendationScore,
  type PowerTarget,
  type RecommendationCard,
  type RecommendationDecision,
  type ScryfallCard,
} from '../src/recommendations.ts'

const fixtures = [
  ['23426916', 'Wakanda Forever'],
  ['20105223', 'Turtle Power!'],
  ['13106990', 'Limit Break'],
  ['12124776', 'Abzan Armor'],
] as const
const headers = { Accept: 'application/json', 'User-Agent': 'commander-creator-audit/1.0' }
type Policy = 'accept-all' | 'balanced' | 'precon-match' | 'all-ignore'
type SourceCard = { card: { oracleCard: { name: string } }; categories: string[]; quantity: number }
type SourceDeck = { name: string; cards: SourceCard[] }
type Commander = ScryfallCard & { related_uris?: { edhrec?: string } }
type Result = {
  policy: Policy
  complete: boolean
  deckSize: number
  batches: number
  offers: number
  accepted: number
  rejected: number
  repeats: number
  ignoredReoffers: number
  overlap: number
  manualCardsNeeded: number
  usefulPickRate: number
  oneOrTwoPickBatches: number
  noPickBatches: number
  averageScore: number
  phaseOffers: Record<string, number>
  roleSupply: Record<string, number>
  firstRoleOffer: Record<string, number | null>
  types: Record<string, number>
}

async function json<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.json() as Promise<T>
}

async function productionRecommendations(commander: Commander, powerTarget: PowerTarget) {
  const page = await json<{
    container?: {
      json_dict?: { cardlists?: { header: string; tag: string; cardviews: { name: string }[] }[] }
    }
  }>(
    `https://json.edhrec.com/pages/commanders/${edhrecSlug(commander.related_uris?.edhrec, commander.name)}.json`,
  )
  const entries = parseEdhrecEntries(page.container?.json_dict?.cardlists ?? [])
  const cards: ScryfallCard[] = []
  for (let index = 0; index < entries.length; index += 75) {
    const result = await json<{ data: ScryfallCard[] }>(
      'https://api.scryfall.com/cards/collection',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: entries.slice(index, index + 75).map(({ name }) => ({ name })),
        }),
      },
    )
    cards.push(...result.data)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return buildEdhrecRecommendations(entries, cards, {
    includeCreature: true,
    excludeGameChangers: true,
    excludeTutors: true,
    excludeExtraTurns: true,
    powerTarget,
  })
}

function cardType(card: { typeLine: string }) {
  return (
    ['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery'].find((type) =>
      card.typeLine.includes(type),
    ) ?? 'Other'
  )
}

function sourceType(card: SourceCard) {
  return (
    ['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery'].find((type) =>
      card.categories.includes(type),
    ) ?? 'Other'
  )
}

type Simulation = {
  policy: Policy
  sourceNames: Set<string>
  targets: Record<string, number>
  queue: RecommendationCard[]
  deferredCards: { card: RecommendationCard; eligibleBatch: number }[]
  batchNumber: number
  preferenceScores: Record<string, number>
  accepted: RecommendationCard[]
  seen: Set<string>
  ignored: Set<string>
  offers: number
  repeats: number
  rejected: number
  ignoredReoffers: number
  oneOrTwoPickBatches: number
  noPickBatches: number
  scoreTotal: number
  phaseOffers: Record<'early' | 'mid' | 'late', number>
  roleSupply: Record<string, number>
  firstRoleOffer: Record<string, number | null>
}

function simulationCounts(state: Simulation) {
  return Object.fromEntries(
    ['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Other'].map((type) => [
      type,
      state.accepted.filter((card) => cardType(card) === type).length,
    ]),
  ) as Record<string, number>
}

function simulationRoleSupply(queue: RecommendationCard[], roles: string[]) {
  return Object.fromEntries(
    roles.map((role) => [
      role,
      queue.filter((card) => rolesForCard(card).includes(role as keyof typeof defaultDeckTargets))
        .length,
    ]),
  )
}

function createSimulation(initialQueue: RecommendationCard[], source: SourceDeck, policy: Policy) {
  const sourceNames = new Set(source.cards.map(({ card }) => card.oracleCard.name))
  const targets = Object.fromEntries(
    ['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Other'].map((type) => [
      type,
      source.cards
        .filter((card) => sourceType(card) === type && !card.categories.includes('Commander'))
        .reduce((sum, card) => sum + card.quantity, 0),
    ]),
  ) as Record<string, number>
  const roles = ['ramp', 'draw', 'removal', 'wipes']
  return {
    policy,
    sourceNames,
    targets,
    queue: initialQueue,
    deferredCards: [],
    batchNumber: 1,
    preferenceScores: {},
    accepted: [],
    seen: new Set<string>(),
    ignored: new Set<string>(),
    offers: 0,
    repeats: 0,
    rejected: 0,
    ignoredReoffers: 0,
    oneOrTwoPickBatches: 0,
    noPickBatches: 0,
    scoreTotal: 0,
    phaseOffers: { early: 0, mid: 0, late: 0 },
    roleSupply: simulationRoleSupply(initialQueue, roles),
    firstRoleOffer: Object.fromEntries(roles.map((role) => [role, null])) as Record<
      string,
      number | null
    >,
  } satisfies Simulation
}

function scoreSimulationCard(
  card: RecommendationCard,
  state: Simulation,
  roleBoosts: Record<string, number>,
) {
  return recommendationScore(card, {
    theme: '',
    activeSubThemes: [],
    pickedTags: new Set(state.accepted.flatMap(({ tags }) => tags)),
    preferenceScores: state.preferenceScores,
    neededRoles: new Set(
      Object.entries(roleBoosts)
        .filter(([, boost]) => boost > 0)
        .map(([role]) => role),
    ),
    cardRoles: rolesForCard(card),
    recommendationStyle: 'balanced',
    roleBoosts,
    roleSupply: simulationRoleSupply(state.queue, Object.keys(roleBoosts)),
    batchNumber: state.batchNumber,
  })
}

function processSimulationCard(
  card: RecommendationCard,
  state: Simulation,
  counts: Record<string, number>,
  roleBoosts: Record<string, number>,
  decisions: Record<string, RecommendationDecision>,
) {
  state.offers += 1
  const phase =
    state.accepted.length + 1 >= 85 ? 'late' : state.accepted.length + 1 >= 70 ? 'mid' : 'early'
  state.phaseOffers[phase] += 1
  if (state.seen.has(card.name)) state.repeats += 1
  if (state.ignored.has(card.name)) state.ignoredReoffers += 1
  state.seen.add(card.name)
  for (const role of rolesForCard(card))
    if (role !== 'lands' && state.firstRoleOffer[role] === null)
      state.firstRoleOffer[role] = state.batchNumber
  state.scoreTotal += scoreSimulationCard(card, state, roleBoosts)
  const type = cardType(card)
  const shouldAdd =
    state.policy === 'accept-all' ||
    (state.policy === 'balanced' && counts[type] < state.targets[type]) ||
    (state.policy === 'precon-match' &&
      state.sourceNames.has(card.name) &&
      counts[type] < state.targets[type])
  decisions[card.name] = shouldAdd ? 'add' : 'ignore'
  if (shouldAdd) {
    state.accepted.push(card)
    counts[type] += 1
    return true
  }
  state.rejected += 1
  state.ignored.add(card.name)
  return false
}

function simulateBatch(state: Simulation) {
  const batch = state.queue.slice(0, 4)
  const counts = simulationCounts(state)
  const analysis = analyseDeck(state.accepted)
  const roleBoosts = deckRoleBoosts(state.accepted.length + 1, analysis.counts, defaultDeckTargets)
  roleBoosts.lands = 0
  const decisions: Record<string, RecommendationDecision> = {}
  let batchPicks = 0
  for (const card of batch) {
    if (processSimulationCard(card, state, counts, roleBoosts, decisions)) batchPicks += 1
    if (state.accepted.length === 99) break
  }
  if (batchPicks === 0) state.noPickBatches += 1
  if (batchPicks === 1 || batchPicks === 2) state.oneOrTwoPickBatches += 1
  if (state.accepted.length === 99) return
  const next = advanceRecommendationQueue({
    queue: state.queue,
    deferredCards: state.deferredCards,
    batchNumber: state.batchNumber,
    decisions,
    liked: [],
    preferenceScores: state.preferenceScores,
    activeSubThemes: [],
    theme: '',
    includeCreature: true,
    roleBoosts,
    cardRoles: rolesForCard,
    recommendationStyle: 'balanced',
  })
  state.queue = next.queue
  state.deferredCards = next.deferredCards
  state.batchNumber = next.batchNumber
  state.preferenceScores = next.preferenceScores
}

function simulate(initialQueue: RecommendationCard[], source: SourceDeck, policy: Policy): Result {
  const state = createSimulation(initialQueue, source, policy)
  while (
    (state.queue.length || state.deferredCards.length) &&
    state.accepted.length < 99 &&
    state.batchNumber < 500
  )
    simulateBatch(state)
  const overlap = state.accepted.filter((card) => state.sourceNames.has(card.name)).length + 1
  const types = Object.fromEntries(
    [...new Set(state.accepted.map(cardType))].map((type) => [
      type,
      state.accepted.filter((card) => cardType(card) === type).length,
    ]),
  )
  return {
    policy,
    complete: state.accepted.length === 99,
    deckSize: state.accepted.length + 1,
    batches: state.batchNumber,
    offers: state.offers,
    accepted: state.accepted.length,
    rejected: state.rejected,
    repeats: state.repeats,
    ignoredReoffers: state.ignoredReoffers,
    overlap,
    manualCardsNeeded: 99 - state.accepted.length,
    usefulPickRate: state.offers ? state.accepted.length / state.offers : 0,
    oneOrTwoPickBatches: state.oneOrTwoPickBatches,
    noPickBatches: state.noPickBatches,
    averageScore: state.offers ? state.scoreTotal / state.offers : 0,
    phaseOffers: state.phaseOffers,
    roleSupply: state.roleSupply,
    firstRoleOffer: state.firstRoleOffer,
    types,
  }
}

function markdown(
  rows: {
    label: string
    source: SourceDeck
    commander: string
    candidates: number
    runs: Result[]
  }[],
) {
  const lines = [
    `# Recommendation audit ${new Date().toISOString().slice(0, 10)}`,
    '',
    'Uses production `buildEdhrecRecommendations()`, role detection, scoring, and `advanceRecommendationQueue()`. Live Archidekt, EDHREC, and Scryfall data.',
    '',
    '| Deck | Policy | Result | Batches | Offers | Rejects | Repeats | Ignored reoffers | Useful picks | 1-2 pick batches | No-pick batches | Avg score | Precon overlap |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ]
  for (const row of rows)
    for (const run of row.runs)
      lines.push(
        `| ${row.label} | ${run.policy} | ${run.deckSize}/100 | ${run.batches} | ${run.offers} | ${run.rejected} | ${run.repeats} | ${run.ignoredReoffers} | ${(run.usefulPickRate * 100).toFixed(0)}% | ${run.oneOrTwoPickBatches} | ${run.noPickBatches} | ${run.averageScore.toFixed(1)} | ${run.overlap}/100 |`,
      )
  lines.push('', '## Details')
  for (const row of rows) {
    lines.push(
      '',
      `### ${row.label}`,
      '',
      `Commander: ${row.commander}. Candidate pool: ${row.candidates}.`,
    )
    for (const run of row.runs)
      lines.push(
        `- ${run.policy}: ${run.complete ? 'complete' : `${run.manualCardsNeeded} cards short`}; roles ${Object.entries(
          run.roleSupply,
        )
          .map(
            ([role, count]) =>
              `${role} ${count}, first batch ${run.firstRoleOffer[role] ?? 'never'}`,
          )
          .join('; ')}; phase offers ${Object.entries(run.phaseOffers)
          .map(([phase, count]) => `${phase} ${count}`)
          .join(', ')}; ${Object.entries(run.types)
          .map(([type, count]) => `${count} ${type.toLowerCase()}`)
          .join(', ')}.`,
      )
  }
  return lines.join('\n') + '\n'
}

const outputArg = process.argv.indexOf('--output')
const output = outputArg >= 0 ? process.argv[outputArg + 1] : ''
const rows = []
for (const [id, label] of fixtures) {
  const source = await json<SourceDeck>(`https://archidekt.com/api/decks/${id}/`)
  const commanderName = source.cards.find((card) => card.categories.includes('Commander'))?.card
    .oracleCard.name
  if (!commanderName) throw new Error(`No commander in Archidekt deck ${id}`)
  const commander = await json<Commander>(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(commanderName)}`,
  )
  const recommendations = await productionRecommendations(commander, 'precon')
  rows.push({
    label,
    source,
    commander: commanderName,
    candidates: recommendations.length,
    runs: (['accept-all', 'balanced', 'precon-match', 'all-ignore'] as Policy[]).map((policy) =>
      simulate(recommendations, source, policy),
    ),
  })
}
const report = markdown(rows)
if (output) {
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, report)
}
console.log(report)
