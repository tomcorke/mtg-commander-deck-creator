import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { recommend, recommendationScoringVersion } from '../../src/domain/recommender.ts'
import { digest, type Json } from './data.ts'

const name = z.string().trim().min(1)
const strings = z.array(z.string())
const nonnegative = z.number().finite().nonnegative()
export const cardSchema = z.strictObject({
  name,
  layout: z.string(),
  typeLine: z.string(),
  colorIdentity: strings.optional(),
  oracleId: name.optional(),
  commanderLegality: z.string().optional(),
  manaValueKnown: z.boolean().optional(),
  gameChanger: z.boolean().optional(),
  dataStatus: z.enum(['pending', 'unavailable']).optional(),
  dataWarnings: strings.optional(),
  manaCost: z.string(),
  manaValue: nonnegative,
  detail: z.string(),
  producedMana: strings,
  faces: z.array(
    z.strictObject({ typeLine: z.string(), manaCost: z.string(), detail: z.string().optional() }),
  ),
  power: z.string().optional(),
  toughness: z.string().optional(),
  reason: z.string(),
  undecidedSkips: nonnegative.int().optional(),
  source: z.enum(['edhrec', 'scryfall']).optional(),
  localIndexSnapshot: z.boolean().optional(),
  seedEvidence: z
    .array(
      z.strictObject({
        name,
        seed: name,
        page: z.enum(['cards', 'commanders']),
        theme: z.string(),
        tag: z.string(),
        lift: z.number().finite().optional(),
        decks: nonnegative.int().optional(),
      }),
    )
    .optional(),
  inclusion: z.number().finite().optional(),
  synergy: z.number().finite().optional(),
  image: z.string(),
  backImage: z.string().optional(),
  set: z.string(),
  setName: z.string().optional(),
  collectorNumber: z.string(),
  scryfallUri: z.string().optional(),
  printsUri: z.string(),
  price: z.string().optional(),
  priceUri: z.string().optional(),
  finish: z.enum(['nonfoil', 'foil', 'etched']).optional(),
  foilType: z.string().optional(),
  tags: strings,
  collectionMatch: z.boolean().optional(),
})
export const deckCardSchema = cardSchema.omit({ reason: true, printsUri: true }).extend({
  printsUri: z.string().optional(),
})
export const stateSchema = z.strictObject({
  commander: name,
  identity: strings,
  pool: z.array(cardSchema),
  deck: z.array(deckCardSchema),
  sideboard: z.array(deckCardSchema),
  ignoredCards: strings,
  deferredCards: z.array(
    z.strictObject({
      card: cardSchema,
      eligibleBatch: nonnegative.int(),
      available: z.boolean().optional(),
    }),
  ),
  batchNumber: nonnegative.int(),
  preferenceScores: z.record(z.string(), z.number().finite()),
  theme: z.string(),
  activeSubThemes: strings,
  recommendationStyle: z.enum(['thematic', 'fun', 'balanced', 'competitive']),
  powerTarget: z.enum(['precon', 'upgraded', 'high']).optional(),
  prioritizeDeckHealth: z.boolean(),
  includeCreature: z.boolean(),
  maxPrice: nonnegative.nullable(),
  collectionMode: z.enum(['none', 'prefer', 'only']),
  collectionSets: strings,
  deckTargets: z.strictObject({
    lands: nonnegative,
    ramp: nonnegative,
    draw: nonnegative,
    removal: nonnegative,
    wipes: nonnegative,
  }),
  focusedRole: z.string().nullable(),
})
const labelSchema = z.strictObject({
  name,
  grade: z.number().int().min(0).max(3),
  rationale: name,
  humanReview: z.enum(['pending', 'agreed', 'disagreed']),
  humanNote: z.string(),
})
const caseSchema = z.strictObject({
  id: name,
  specId: name,
  split: z.enum(['tuning', 'holdout']),
  state: stateSchema,
  labels: z.array(labelSchema).min(1),
  previouslyOffered: strings,
  forbiddenCards: strings,
})
export const suiteSchema = z.strictObject({
  version: z.literal(1),
  description: name,
  cases: z.array(caseSchema).min(1),
})
type BenchCase = z.infer<typeof caseSchema>
const key = (value: string) => value.trim().toLowerCase()
// Hash JSON as it will be written: optional undefined fields are absent.
const hash = (value: unknown) => digest(JSON.parse(JSON.stringify(value)) as Json)

function unique(values: string[], context: string) {
  if (new Set(values.map(key)).size !== values.length) throw new Error(`Duplicate ${context}`)
}

export function parseSuite(input: unknown) {
  const suite = suiteSchema.parse(input)
  unique(
    suite.cases.map(({ id }) => id),
    'case IDs',
  )
  for (const item of suite.cases) {
    unique(
      item.labels.map(({ name }) => name),
      `labels in ${item.id}`,
    )
    unique(
      item.state.pool.map(({ name }) => name),
      `pool names in ${item.id}`,
    )
    const labels = new Set(item.labels.map(({ name }) => key(name)))
    for (const card of item.state.pool)
      if (!labels.has(key(card.name)))
        throw new Error(`Unlabelled candidate in ${item.id}: ${card.name}`)
    for (const card of item.forbiddenCards)
      if (!labels.has(key(card)))
        throw new Error(`Unlabelled forbidden card in ${item.id}: ${card}`)
  }
  return suite
}

const ratio = z.number().finite().min(0).max(1)
const metricsSchema = z.strictObject({
  retrievalRecall: ratio.nullable(),
  ndcgAt4: ratio.nullable(),
  precisionAt4: ratio,
  goodOptionCoverage: ratio,
  redundantOffers: nonnegative.int(),
  constraintViolations: nonnegative.int(),
})
type Metrics = z.infer<typeof metricsSchema>
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const caseReportSchema = z.strictObject({
  id: name,
  specId: name,
  split: z.enum(['tuning', 'holdout']),
  evaluationHash: hashSchema,
  poolHash: hashSchema,
  poolNames: strings,
  labels: z.array(labelSchema).min(1),
  batch: strings.max(4),
  error: z.string().nullable(),
  metrics: metricsSchema,
})
export const reportSchema = z.strictObject({
  version: z.literal(1),
  suiteHash: hashSchema,
  recommenderVersion: name,
  scoringVersion: nonnegative.int(),
  cases: z.array(caseReportSchema).min(1),
})
type Report = z.infer<typeof reportSchema>

export function summarise(report: Report) {
  return Object.fromEntries(
    ['tuning', 'holdout'].map((split) => {
      const cases = report.cases.filter((item) => item.split === split)
      const metrics = Object.fromEntries(
        Object.keys(metricsSchema.shape).map((metric) => {
          const values = cases
            .map((item) => item.metrics[metric as keyof Metrics])
            .filter((value) => value !== null)
          return [
            metric,
            {
              mean: values.length
                ? values.reduce((sum, value) => sum + value, 0) / values.length
                : null,
              definedCases: values.length,
            },
          ]
        }),
      )
      return [
        split,
        {
          cases: cases.length,
          errors: cases.filter((item) => item.error !== null).length,
          metrics,
        },
      ]
    }),
  )
}
const dcg = (grades: number[]) =>
  grades.slice(0, 4).reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0)

/** Labels, never production scores, judge the visible batch. Missing slots earn zero. */
function measure(item: BenchCase, batch: z.infer<typeof cardSchema>[]): Metrics {
  const labels = new Map(item.labels.map((label) => [key(label.name), label.grade]))
  const pool = new Set(item.state.pool.map(({ name }) => key(name)))
  const relevant = item.labels.filter(({ grade }) => grade >= 2)
  const grades = batch.map(({ name }) => labels.get(key(name))!)
  const ideal = dcg(
    item.labels
      .filter(({ name }) => pool.has(key(name)))
      .map(({ grade }) => grade)
      .sort((a, b) => b - a),
  )
  const seen = new Set(item.previouslyOffered.map(key))
  const identities = new Set<string>()
  let redundantOffers = 0
  for (const card of batch) {
    const identity = card.oracleId ?? key(card.name)
    if (seen.has(key(card.name)) || identities.has(identity)) redundantOffers++
    identities.add(identity)
  }
  const forbidden = new Set(item.forbiddenCards.map(key))
  return {
    retrievalRecall: relevant.length
      ? relevant.filter(({ name }) => pool.has(key(name))).length / relevant.length
      : null,
    ndcgAt4: ideal ? dcg(grades) / ideal : null,
    precisionAt4: grades.filter((grade) => grade >= 2).length / 4,
    goodOptionCoverage: Number(grades.some((grade) => grade >= 2)),
    redundantOffers,
    constraintViolations: batch.filter(({ name }) => forbidden.has(key(name))).length,
  }
}

export function evaluate(input: unknown, recommenderVersion: string): Report {
  const suite = parseSuite(input)
  return reportSchema.parse({
    version: 1,
    suiteHash: hash(suite),
    recommenderVersion,
    scoringVersion: recommendationScoringVersion,
    cases: suite.cases.map((item) => {
      const { pool, ...state } = item.state
      const result = recommend(item.state)
      return {
        id: item.id,
        specId: item.specId,
        split: item.split,
        evaluationHash: hash({
          ...item,
          state,
          labels: [...item.labels].sort((a, b) => key(a.name).localeCompare(key(b.name))),
        }),
        poolHash: hash(pool),
        poolNames: pool.map(({ name }) => name),
        labels: item.labels,
        batch: result.batch.map(({ name }) => name),
        error: result.error ?? null,
        metrics: measure(item, result.batch),
      }
    }),
  })
}

function validateReport(input: unknown) {
  const report = reportSchema.parse(input)
  unique(
    report.cases.map(({ id }) => id),
    'report case IDs',
  )
  for (const item of report.cases) {
    unique(
      item.labels.map(({ name }) => name),
      `report labels in ${item.id}`,
    )
    unique(item.poolNames, `report pool names in ${item.id}`)
    const labels = new Set(item.labels.map(({ name }) => key(name)))
    for (const name of [...item.poolNames, ...item.batch])
      if (!labels.has(key(name))) throw new Error(`Unlabelled report candidate: ${name}`)
    for (const name of item.batch)
      if (!item.poolNames.some((card) => key(card) === key(name)))
        throw new Error(`Off-pool offer: ${name}`)
  }
  return report
}

/** Paired case deltas; callers retain individual cases and separate holdouts. */
export function compare(baselineInput: unknown, challengerInput: unknown) {
  const baseline = validateReport(baselineInput)
  const challenger = validateReport(challengerInput)
  if (baseline.cases.length !== challenger.cases.length) throw new Error('Different case sets')
  return {
    baseline: baseline.recommenderVersion,
    challenger: challenger.recommenderVersion,
    summaries: { baseline: summarise(baseline), challenger: summarise(challenger) },
    cases: baseline.cases.map((before) => {
      const after = challenger.cases.find(({ id }) => id === before.id)
      if (!after || after.evaluationHash !== before.evaluationHash)
        throw new Error(`Different evaluation inputs: ${before.id}`)
      if (hash(before.labels) !== hash(after.labels))
        throw new Error(`Different labels: ${before.id}`)
      const delta = Object.fromEntries(
        Object.entries(before.metrics).map(([metric, value]) => {
          const next = after.metrics[metric as keyof Metrics]
          return [metric, value === null || next === null ? null : next - value]
        }),
      )
      return {
        id: before.id,
        specId: before.specId,
        split: before.split,
        baseline: before,
        challenger: after,
        delta,
      }
    }),
  }
}

async function main(args: string[]) {
  const [command, first, second] = args
  if (args.length !== 3 || !first || !second || !['evaluate', 'compare'].includes(command))
    throw new Error(
      'Usage: rank-bench.ts evaluate <suite.json> <recommender-sha> | compare <baseline.json> <challenger.json>',
    )
  const input: unknown = JSON.parse(await readFile(first, 'utf8'))
  const output =
    command === 'evaluate'
      ? evaluate(input, second)
      : compare(input, JSON.parse(await readFile(second, 'utf8')))
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
