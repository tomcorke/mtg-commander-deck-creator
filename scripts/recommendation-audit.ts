import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { analyseDeck, deckRoleBoosts, defaultDeckTargets, rolesForCard } from '../src/deck-analysis.ts'
import { advanceRecommendationQueue, buildEdhrecRecommendations, edhrecSlug, parseEdhrecEntries, recommendationScore, type PowerTarget, type RecommendationCard, type RecommendationDecision, type ScryfallCard } from '../src/recommendations.ts'

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
type Result = { policy: Policy; complete: boolean; deckSize: number; batches: number; offers: number; accepted: number; rejected: number; repeats: number; ignoredReoffers: number; overlap: number; manualCardsNeeded: number; usefulPickRate: number; oneOrTwoPickBatches: number; noPickBatches: number; averageScore: number; phaseOffers: Record<string, number>; roleSupply: Record<string, number>; firstRoleOffer: Record<string, number | null>; types: Record<string, number> }

async function json<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.json() as Promise<T>
}

async function productionRecommendations(commander: Commander, powerTarget: PowerTarget) {
  const page = await json<{ container?: { json_dict?: { cardlists?: { header: string; tag: string; cardviews: { name: string }[] }[] } } }>(`https://json.edhrec.com/pages/commanders/${edhrecSlug(commander.related_uris?.edhrec, commander.name)}.json`)
  const entries = parseEdhrecEntries(page.container?.json_dict?.cardlists ?? [])
  const cards: ScryfallCard[] = []
  for (let index = 0; index < entries.length; index += 75) {
    const result = await json<{ data: ScryfallCard[] }>('https://api.scryfall.com/cards/collection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: entries.slice(index, index + 75).map(({ name }) => ({ name })) }),
    })
    cards.push(...result.data)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return buildEdhrecRecommendations(entries, cards, { includeCreature: true, excludeGameChangers: true, excludeTutors: true, excludeExtraTurns: true, powerTarget })
}

function cardType(card: { typeLine: string }) {
  return ['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery'].find((type) => card.typeLine.includes(type)) ?? 'Other'
}

function sourceType(card: SourceCard) {
  return ['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery'].find((type) => card.categories.includes(type)) ?? 'Other'
}

function simulate(initialQueue: RecommendationCard[], source: SourceDeck, policy: Policy): Result {
  const sourceNames = new Set(source.cards.map(({ card }) => card.oracleCard.name))
  const targets = Object.fromEntries(['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Other'].map((type) => [type, source.cards.filter((card) => sourceType(card) === type && !card.categories.includes('Commander')).reduce((sum, card) => sum + card.quantity, 0)]))
  let queue = initialQueue
  let deferredCards: { card: RecommendationCard; eligibleBatch: number }[] = []
  let batchNumber = 1
  let preferenceScores: Record<string, number> = {}
  const accepted: RecommendationCard[] = []
  const seen = new Set<string>()
  let offers = 0
  let repeats = 0
  let rejected = 0
  const ignored = new Set<string>()
  const roleSupply = Object.fromEntries(['ramp', 'draw', 'removal', 'wipes'].map((role) => [role, initialQueue.filter((card) => rolesForCard(card).includes(role as keyof typeof defaultDeckTargets)).length]))
  const firstRoleOffer = Object.fromEntries(['ramp', 'draw', 'removal', 'wipes'].map((role) => [role, null])) as Record<string, number | null>
  const phaseOffers = { early: 0, mid: 0, late: 0 }
  let ignoredReoffers = 0
  let oneOrTwoPickBatches = 0
  let noPickBatches = 0
  let scoreTotal = 0

  while ((queue.length || deferredCards.length) && accepted.length < 99 && batchNumber < 500) {
    const batch = queue.slice(0, 4)
    const counts = Object.fromEntries(['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Other'].map((type) => [type, accepted.filter((card) => cardType(card) === type).length]))
    const decisions: Record<string, RecommendationDecision> = {}
    let batchPicks = 0
    const analysis = analyseDeck(accepted)
    const roleBoosts = deckRoleBoosts(accepted.length + 1, analysis.counts, defaultDeckTargets)
    roleBoosts.lands = 0
    for (const card of batch) {
      offers += 1
      phaseOffers[accepted.length + 1 >= 85 ? 'late' : accepted.length + 1 >= 70 ? 'mid' : 'early'] += 1
      if (seen.has(card.name)) repeats += 1
      if (ignored.has(card.name)) ignoredReoffers += 1
      seen.add(card.name)
      for (const role of rolesForCard(card)) if (role !== 'lands' && firstRoleOffer[role] === null) firstRoleOffer[role] = batchNumber
      scoreTotal += recommendationScore(card, { theme: '', activeSubThemes: [], pickedTags: new Set(accepted.flatMap(({ tags }) => tags)), preferenceScores, neededRoles: new Set(Object.entries(roleBoosts).filter(([, boost]) => boost > 0).map(([role]) => role)), cardRoles: rolesForCard(card), recommendationStyle: 'balanced', roleBoosts, roleSupply: Object.fromEntries(Object.keys(roleBoosts).map((role) => [role, queue.filter((candidate) => rolesForCard(candidate).includes(role)).length])), batchNumber })
      const type = cardType(card)
      const shouldAdd = policy === 'accept-all' || policy === 'balanced' && counts[type] < targets[type] || policy === 'precon-match' && sourceNames.has(card.name) && counts[type] < targets[type]
      decisions[card.name] = shouldAdd ? 'add' : 'ignore'
      if (shouldAdd) { accepted.push(card); counts[type] += 1; batchPicks += 1 } else { rejected += 1; ignored.add(card.name) }
      if (accepted.length === 99) break
    }
    if (batchPicks === 0) noPickBatches += 1
    if (batchPicks === 1 || batchPicks === 2) oneOrTwoPickBatches += 1
    if (accepted.length === 99) break
    const next = advanceRecommendationQueue({ queue, deferredCards, batchNumber, decisions, liked: [], preferenceScores, activeSubThemes: [], theme: '', includeCreature: true, roleBoosts, cardRoles: rolesForCard, recommendationStyle: 'balanced' })
    queue = next.queue
    deferredCards = next.deferredCards
    batchNumber = next.batchNumber
    preferenceScores = next.preferenceScores
  }

  const overlap = accepted.filter((card) => sourceNames.has(card.name)).length + 1
  const types = Object.fromEntries([...new Set(accepted.map(cardType))].map((type) => [type, accepted.filter((card) => cardType(card) === type).length]))
  return { policy, complete: accepted.length === 99, deckSize: accepted.length + 1, batches: batchNumber, offers, accepted: accepted.length, rejected, repeats, ignoredReoffers, overlap, manualCardsNeeded: 99 - accepted.length, usefulPickRate: offers ? accepted.length / offers : 0, oneOrTwoPickBatches, noPickBatches, averageScore: offers ? scoreTotal / offers : 0, phaseOffers, roleSupply, firstRoleOffer, types }
}

function markdown(rows: { label: string; source: SourceDeck; commander: string; candidates: number; runs: Result[] }[]) {
  const lines = [`# Recommendation audit ${new Date().toISOString().slice(0, 10)}`, '', 'Uses production `buildEdhrecRecommendations()`, role detection, scoring, and `advanceRecommendationQueue()`. Live Archidekt, EDHREC, and Scryfall data.', '', '| Deck | Policy | Result | Batches | Offers | Rejects | Repeats | Ignored reoffers | Useful picks | 1-2 pick batches | No-pick batches | Avg score | Precon overlap |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
  for (const row of rows) for (const run of row.runs) lines.push(`| ${row.label} | ${run.policy} | ${run.deckSize}/100 | ${run.batches} | ${run.offers} | ${run.rejected} | ${run.repeats} | ${run.ignoredReoffers} | ${(run.usefulPickRate * 100).toFixed(0)}% | ${run.oneOrTwoPickBatches} | ${run.noPickBatches} | ${run.averageScore.toFixed(1)} | ${run.overlap}/100 |`)
  lines.push('', '## Details')
  for (const row of rows) {
    lines.push('', `### ${row.label}`, '', `Commander: ${row.commander}. Candidate pool: ${row.candidates}.`)
    for (const run of row.runs) lines.push(`- ${run.policy}: ${run.complete ? 'complete' : `${run.manualCardsNeeded} cards short`}; roles ${Object.entries(run.roleSupply).map(([role, count]) => `${role} ${count}, first batch ${run.firstRoleOffer[role] ?? 'never'}`).join('; ')}; phase offers ${Object.entries(run.phaseOffers).map(([phase, count]) => `${phase} ${count}`).join(', ')}; ${Object.entries(run.types).map(([type, count]) => `${count} ${type.toLowerCase()}`).join(', ')}.`)
  }
  return lines.join('\n') + '\n'
}

const outputArg = process.argv.indexOf('--output')
const output = outputArg >= 0 ? process.argv[outputArg + 1] : ''
const rows=[]
for (const [id, label] of fixtures) {
  const source = await json<SourceDeck>(`https://archidekt.com/api/decks/${id}/`)
  const commanderName = source.cards.find((card) => card.categories.includes('Commander'))?.card.oracleCard.name
  if (!commanderName) throw new Error(`No commander in Archidekt deck ${id}`)
  const commander = await json<Commander>(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(commanderName)}`)
  const recommendations = await productionRecommendations(commander, 'precon')
  rows.push({ label, source, commander: commanderName, candidates: recommendations.length, runs: (['accept-all', 'balanced', 'precon-match', 'all-ignore'] as Policy[]).map((policy) => simulate(recommendations, source, policy)) })
}
const report = markdown(rows)
if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, report) }
console.log(report)
