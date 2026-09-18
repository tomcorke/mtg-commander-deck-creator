import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { advanceRecommendationQueue, buildEdhrecRecommendations, parseEdhrecEntries, type PowerTarget, type RecommendationCard, type RecommendationDecision, type ScryfallCard } from '../src/recommendations.ts'

const fixtures = [
  ['23426916', 'Wakanda Forever'],
  ['20105223', 'Turtle Power!'],
  ['13106990', 'Limit Break'],
  ['12124776', 'Abzan Armor'],
] as const
const headers = { Accept: 'application/json', 'User-Agent': 'commander-creator-audit/1.0' }
type Policy = 'accept-all' | 'balanced' | 'precon-match'
type SourceCard = { card: { oracleCard: { name: string } }; categories: string[]; quantity: number }
type SourceDeck = { name: string; cards: SourceCard[] }
type Commander = ScryfallCard & { related_uris?: { edhrec?: string } }
type Result = { policy: Policy; complete: boolean; deckSize: number; batches: number; offers: number; accepted: number; rejected: number; deferred: number; repeats: number; overlap: number; manualCardsNeeded: number; types: Record<string, number> }

async function json<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.json() as Promise<T>
}

function slug(card: Commander) {
  return card.related_uris?.edhrec?.match(/\/commanders\/([^/?#]+)/)?.[1]
    ?? card.name.toLowerCase().normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function productionRecommendations(commander: Commander, powerTarget: PowerTarget) {
  const page = await json<{ container?: { json_dict?: { cardlists?: { header: string; tag: string; cardviews: { name: string }[] }[] } } }>(`https://json.edhrec.com/pages/commanders/${slug(commander)}.json`)
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
  let deferred = 0

  while ((queue.length || deferredCards.length) && accepted.length < 99 && batchNumber < 500) {
    const batch = queue.slice(0, 4)
    const counts = Object.fromEntries(['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Other'].map((type) => [type, accepted.filter((card) => cardType(card) === type).length]))
    const decisions: Record<string, RecommendationDecision> = {}
    for (const card of batch) {
      offers += 1
      if (seen.has(card.name)) repeats += 1
      seen.add(card.name)
      const type = cardType(card)
      const shouldAdd = policy === 'accept-all' || policy === 'balanced' && counts[type] < targets[type] || policy === 'precon-match' && sourceNames.has(card.name) && counts[type] < targets[type]
      decisions[card.name] = shouldAdd ? 'add' : 'ignore'
      if (shouldAdd) { accepted.push(card); counts[type] += 1 } else rejected += 1
      if (accepted.length === 99) break
    }
    if (accepted.length === 99) break
    const next = advanceRecommendationQueue({ queue, deferredCards, batchNumber, decisions, liked: [], preferenceScores, activeSubThemes: [], theme: '', includeCreature: true })
    queue = next.queue
    deferredCards = next.deferredCards
    batchNumber = next.batchNumber
    preferenceScores = next.preferenceScores
  }

  const overlap = accepted.filter((card) => sourceNames.has(card.name)).length + 1
  const types = Object.fromEntries([...new Set(accepted.map(cardType))].map((type) => [type, accepted.filter((card) => cardType(card) === type).length]))
  return { policy, complete: accepted.length === 99, deckSize: accepted.length + 1, batches: batchNumber, offers, accepted: accepted.length, rejected, deferred, repeats, overlap, manualCardsNeeded: 99 - accepted.length, types }
}

function markdown(rows: { label: string; source: SourceDeck; commander: string; candidates: number; runs: Result[] }[]) {
  const lines = [`# Recommendation audit ${new Date().toISOString().slice(0, 10)}`, '', 'Uses production `buildEdhrecRecommendations()` and `advanceRecommendationQueue()` exports. Live Archidekt, EDHREC, and Scryfall data.', '', '| Deck | Policy | Result | Batches | Offers | Rejects | Repeats | Precon overlap |', '|---|---|---:|---:|---:|---:|---:|---:|']
  for (const row of rows) for (const run of row.runs) lines.push(`| ${row.label} | ${run.policy} | ${run.deckSize}/100 | ${run.batches} | ${run.offers} | ${run.rejected} | ${run.repeats} | ${run.overlap}/100 |`)
  lines.push('', '## Details')
  for (const row of rows) {
    lines.push('', `### ${row.label}`, '', `Commander: ${row.commander}. Candidate pool: ${row.candidates}.`)
    for (const run of row.runs) lines.push(`- ${run.policy}: ${run.complete ? 'complete' : `${run.manualCardsNeeded} cards short`}; ${Object.entries(run.types).map(([type, count]) => `${count} ${type.toLowerCase()}`).join(', ')}.`)
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
  rows.push({ label, source, commander: commanderName, candidates: recommendations.length, runs: (['accept-all', 'balanced', 'precon-match'] as Policy[]).map((policy) => simulate(recommendations, source, policy)) })
}
const report = markdown(rows)
if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, report) }
console.log(report)
