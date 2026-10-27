import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import {
  cardConstructionError,
  commanderConstructionError,
} from '../../src/domain/commander-construction.ts'
import type { DeckCard } from '../../src/domain/card-model.ts'
import { digest, type Json } from './data.ts'

const name = z
  .string()
  .trim()
  .min(1)
  .refine((s) => !/[\r\n]/.test(s), 'Use one line')
const names = z.array(name)
const amount = z.number().finite().nonnegative()
export const specSchema = z.strictObject({
  commander: names.min(1).max(2),
  bracket: z.number().int().min(1).max(5),
  pace: name,
  experience: name,
  theme: name,
  idea: name,
  constraints: z.strictObject({
    totalBudget: amount.nullable(),
    perCardCap: amount.nullable(),
    currency: z.literal('USD'),
    allowedSets: names,
    mustInclude: names,
    mustExclude: names,
  }),
})
// Allowlist provider fields at every level; recommendation metadata never enters the bundle.
const face = z.object({
  type_line: name,
  mana_cost: z.string(),
  oracle_text: z.string(),
  power: z.string().optional(),
  toughness: z.string().optional(),
})
export const oracleSchema = z.object({
  name,
  oracle_id: name.optional(),
  type_line: name.optional(),
  mana_cost: z.string().optional(),
  oracle_text: z.string().optional(),
  cmc: amount.optional(),
  color_identity: z.array(z.enum(['W', 'U', 'B', 'R', 'G'])).optional(),
  legalities: z.object({ commander: name.optional() }).optional(),
  card_faces: z.array(face).min(1).optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  game_changer: z.boolean().optional(),
  set: name.optional(),
  prices: z
    .object({
      usd: z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .nullable(),
    })
    .optional(),
})
const inputSchema = z.object({ spec: specSchema, cards: z.array(oracleSchema).min(1).max(1000) })
type Oracle = z.infer<typeof oracleSchema>
type Spec = z.infer<typeof specSchema>
const key = (s: string) => s.trim().toLowerCase()
function normalized(card: Oracle): DeckCard {
  return {
    name: card.name,
    oracleId: card.oracle_id,
    typeLine: card.type_line ?? '',
    manaCost: card.mana_cost ?? '',
    detail: card.oracle_text ?? card.card_faces?.map((f) => f.oracle_text).join('\n') ?? '',
    manaValue: card.cmc ?? 0,
    manaValueKnown: card.cmc !== undefined,
    colorIdentity: card.color_identity,
    commanderLegality: card.legalities?.commander,
    faces:
      card.card_faces?.map((f) => ({
        typeLine: f.type_line,
        manaCost: f.mana_cost,
        detail: f.oracle_text,
      })) ?? [],
    power: card.power ?? card.card_faces?.[0]?.power,
    toughness: card.toughness ?? card.card_faces?.[0]?.toughness,
    layout: 'normal',
    producedMana: [],
    image: '',
    set: card.set ?? '',
    collectorNumber: '',
    tags: [],
  }
}
function missing(card: Oracle) {
  return (
    !card.type_line ||
    (card.oracle_text === undefined && !card.card_faces) ||
    card.cmc === undefined ||
    !card.color_identity ||
    !card.legalities?.commander ||
    (card.type_line.includes(' // ') && !card.card_faces)
  )
}
function printingConstraints(spec: Spec, card: Oracle) {
  const errors: string[] = [],
    unresolved: string[] = []
  let total = 0
  if (spec.constraints.allowedSets.length) {
    if (!card.set) unresolved.push(card.name + ': missing selected printing set')
    else if (!spec.constraints.allowedSets.map(key).includes(key(card.set)))
      errors.push(card.name + ': selected printing outside allowed sets')
  }
  if (spec.constraints.totalBudget !== null || spec.constraints.perCardCap !== null) {
    const price = card.prices?.usd
    if (price == null) unresolved.push(card.name + ': missing selected printing USD price')
    else {
      total = Number(price)
      if (spec.constraints.perCardCap !== null && total > spec.constraints.perCardCap)
        errors.push(card.name + ': exceeds per-card cap')
    }
  }
  return { errors, unresolved, total }
}
function constraints(spec: Spec, cards: Oracle[]) {
  const errors: string[] = [],
    unresolved: string[] = []
  const present = new Set(cards.map((c) => key(c.name)))
  for (const n of spec.constraints.mustInclude)
    if (!present.has(key(n))) errors.push('Missing required card: ' + n)
  for (const n of spec.constraints.mustExclude)
    if (present.has(key(n))) errors.push('Excluded card: ' + n)
  let total = 0
  for (const card of cards) {
    const result = printingConstraints(spec, card)
    errors.push(...result.errors)
    unresolved.push(...result.unresolved)
    total += result.total
  }
  if (spec.constraints.totalBudget !== null && total > spec.constraints.totalBudget)
    errors.push('Exceeds total budget')
  return { errors, unresolved }
}
function checkIdentities(cards: Oracle[], errors: string[]) {
  const identities = new Map<string, string>()
  for (const card of cards) {
    const identity = JSON.stringify({ ...card, set: undefined, prices: undefined })
    const previous = identities.get(key(card.name))
    if (previous && previous !== identity)
      errors.push(card.name + ': inconsistent Oracle metadata across copies')
    identities.set(key(card.name), identity)
  }
}
function checkConstruction(commanders: Oracle[], cards: Oracle[], errors: string[]) {
  if (commanders.length && commanders.every((card) => !missing(card))) {
    const error = commanderConstructionError(commanders.map(normalized))
    if (error) errors.push(error)
  }
  // Unknown commander identity cannot establish an outside-identity violation.
  const colours =
    commanders.length && commanders.every((card) => card.color_identity)
      ? [...new Set(commanders.flatMap((card) => card.color_identity ?? []))]
      : ['W', 'U', 'B', 'R', 'G']
  const seen: DeckCard[] = []
  for (const source of cards) {
    const card = normalized(source)
    // Missing evidence is reported separately. Neutral values let the shared validator
    // still report known bans, colour violations and copy limits on other evidence.
    const check = {
      ...card,
      commanderLegality: source.legalities?.commander ?? 'legal',
      colorIdentity: source.color_identity ?? [],
      manaValueKnown: true,
    }
    const copyEvidence = source.type_line && (source.oracle_text !== undefined || source.card_faces)
    const error = cardConstructionError(check, copyEvidence ? seen : [], colours)
    if (error) errors.push(card.name + ': ' + error)
    seen.push(card)
  }
}
export function prepareReview(value: unknown) {
  const { spec, cards } = inputSchema.parse(value)
  const errors: string[] = [],
    unresolved: string[] = []
  if (cards.length !== 100)
    errors.push(`Expected exactly 100 cards including commanders; got ${cards.length}`)
  checkIdentities(cards, errors)
  const commanders: Oracle[] = []
  for (const n of spec.commander) {
    const found = cards.filter((c) => key(c.name) === key(n))
    if (found.length !== 1) errors.push(`Expected exactly one designated commander: ${n}`)
    else commanders.push(found[0])
  }
  if (new Set(spec.commander.map(key)).size !== spec.commander.length)
    errors.push('Duplicate designated commanders')
  for (const card of cards)
    if (missing(card)) unresolved.push(`${card.name}: essential Oracle metadata missing`)
  checkConstruction(commanders.length === spec.commander.length ? commanders : [], cards, errors)
  const limits = constraints(spec, cards)
  errors.push(...limits.errors)
  unresolved.push(...limits.unresolved)
  if (errors.length || unresolved.length)
    return { status: errors.length ? 'rejected' : 'unresolved', errors, unresolved } as const
  // Sort away builder ordering, retaining one entry per copy and designated commanders in the spec.
  cards.sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en') ||
      JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'),
  )
  const deck = cards.map((c) => `1 ${c.name}`).join('\n') + '\n'
  const bundle = JSON.parse(JSON.stringify({ spec, deck, oracle: cards })) as {
    spec: Spec
    deck: string
    oracle: Oracle[]
  }
  return { status: 'ready', bundle, bundleHash: digest(bundle as Json) } as const
}

const assessment = z.strictObject({
  score: z.number().int().min(1).max(5),
  justification: name,
  confidence: z.enum(['low', 'medium', 'high']),
})
const cardComment = z.strictObject({ card: name, reason: name, sources: names.min(1) })
export const reviewSchema = z.strictObject({
  version: z.literal(1),
  bundleHash: z.string().regex(/^[a-f0-9]{64}$/),
  criteria: z.strictObject({
    bracketFit: assessment.extend({ fit: z.enum(['under', 'appropriate', 'over', 'unresolved']) }),
    effectiveness: assessment,
    themeFit: assessment,
    ideaFit: assessment,
    fun: assessment,
    synergy: assessment,
  }),
  strongest: z.array(cardComment).min(1),
  weakest: z.array(cardComment).min(1),
  swaps: z.array(z.strictObject({ cut: name, add: name, reason: name, sources: names.min(1) })),
  knowledgeGaps: z.array(
    z.strictObject({
      subject: name,
      claim: name,
      consulted: names,
      uncertainty: name,
      effect: name,
      researchRequest: name,
    }),
  ),
  limitations: names.min(1),
})
export function validateReview(input: unknown, value: unknown) {
  const prepared = prepareReview(input)
  if (prepared.status !== 'ready') throw new Error('Review requires a ready deck')
  const review = reviewSchema.parse(value)
  if (review.bundleHash !== prepared.bundleHash) throw new Error('Review bundle hash mismatch')
  const present = new Set(prepared.bundle.oracle.map((c) => key(c.name)))
  for (const c of [...review.strongest, ...review.weakest])
    if (!present.has(key(c.card))) throw new Error(`Review names absent deck card: ${c.card}`)
  for (const s of review.swaps)
    if (!present.has(key(s.cut))) throw new Error(`Swap cut absent from deck: ${s.cut}`)
  const markdown = [
    '# Completed-deck desk review',
    '',
    ...Object.entries(review.criteria).map(
      ([criterion, a]) =>
        `- ${criterion}: ${a.score}/5 (${a.confidence}${'fit' in a ? `, ${a.fit}` : ''}). ${a.justification}`,
    ),
    '',
    '## Strongest cards',
    ...review.strongest.map((c) => `- ${c.card}: ${c.reason} Sources: ${c.sources.join('; ')}`),
    '',
    '## Weakest cards',
    ...review.weakest.map((c) => `- ${c.card}: ${c.reason} Sources: ${c.sources.join('; ')}`),
    '',
    '## Suggested swaps',
    ...review.swaps.map(
      (s) => `- ${s.cut} ? ${s.add}: ${s.reason} Sources: ${s.sources.join('; ')}`,
    ),
    '',
    '## Knowledge gaps',
    ...review.knowledgeGaps.map(
      (g) =>
        `- ${g.subject}: ${g.claim}. Consulted: ${g.consulted.join('; ')}. Uncertainty: ${g.uncertainty}. Effect: ${g.effect}. Research: ${g.researchRequest}`,
    ),
    '',
    '## Limitations',
    ...review.limitations.map((s) => `- ${s}`),
    '',
  ].join('\n')
  return { review, markdown }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, inputPath, reviewPath] = process.argv.slice(2)
    if (
      !inputPath ||
      !['prepare', 'validate'].includes(command) ||
      (command === 'validate' && !reviewPath)
    )
      throw new Error(
        'Usage: completed-review.ts prepare input.json | validate input.json review.json',
      )
    const input: unknown = JSON.parse(await readFile(inputPath, 'utf8'))
    const result =
      command === 'prepare'
        ? prepareReview(input)
        : validateReview(input, JSON.parse(await readFile(reviewPath, 'utf8')))
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    if ('status' in result && result.status !== 'ready') process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
