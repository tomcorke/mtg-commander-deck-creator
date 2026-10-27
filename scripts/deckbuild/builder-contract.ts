import { z } from 'zod'
import { isScryfallCard, type ScryfallCard } from '../../src/domain/card-model.ts'
import { ignoreReasons } from '../../src/domain/recommendation-tuning.ts'
import { targetKeys } from '../../src/deck-analysis.ts'
import { cardSchema, deckCardSchema, stateSchema } from './rank-bench.ts'

const name = z.string().trim().min(1)
const strings = z.array(z.string())
const count = z.number().int().nonnegative()
const role = z.enum(targetKeys).nullable()
const zone = z.enum(['deck', 'sideboard'])
const printing = z.strictObject({
  image: z.string(),
  backImage: z.string().optional(),
  art: z.string().optional(),
  set: z.string(),
  setName: z.string().optional(),
  collectorNumber: z.string(),
  scryfallUri: z.string().optional(),
  price: z.string().optional(),
  priceUri: z.string().optional(),
  finish: z.enum(['nonfoil', 'foil', 'etched']).optional(),
  foilType: z.string().optional(),
})
const printingFields = {
  printings: z.array(printing).optional(),
  printing: count.optional(),
  printingManuallySelected: z.boolean().optional(),
}
const card = cardSchema.extend(printingFields)
const deckCard = deckCardSchema.extend(printingFields)
const details = z.strictObject({
  images: strings,
  art: strings,
  colours: strings,
  printings: z.array(z.array(printing)),
  selections: z.array(count),
})
const targets = stateSchema.shape.deckTargets
export const settingsSchema = z.strictObject({
  recommendationStyle: stateSchema.shape.recommendationStyle,
  powerTarget: z.enum(['precon', 'upgraded', 'high']),
  maxPrice: stateSchema.shape.maxPrice,
  includeCreature: z.boolean(),
  excludeGameChangers: z.boolean(),
  limitGameChangers: z.boolean(),
  excludeTutors: z.boolean(),
  excludeExtraTurns: z.boolean(),
  excludeUnreleased: z.boolean(),
  deckTargets: targets,
})

/** Prepared fixed point only: transport reservations and undo history need future provider wiring. */
export const initialStateSchema = stateSchema
  .omit({
    pool: true,
    identity: true,
    prioritizeDeckHealth: true,
  })
  .extend({
    ...settingsSchema.shape,
    today: z.iso.date(),
    signatureDeckKey: name,
    commanderDetails: details.nullable(),
    addZoneChoice: z.strictObject({ zone, full: z.boolean() }).nullable(),
    queue: z.array(card),
    deck: z.array(deckCard),
    sideboard: z.array(deckCard),
    deferredCards: z.array(
      z.strictObject({ card, eligibleBatch: count, available: z.boolean().optional() }),
    ),
    focusedRole: role,
    batchNumber: count.min(1),
    decisions: z.record(z.string(), z.enum(['add', 'later', 'ignore'])),
    ignoreReasons: z.record(z.string(), z.enum(ignoreReasons)),
    liked: strings,
    dismissedSubThemes: strings,
    commanderSubThemes: strings,
    collectionGroups: strings,
    preferredPrintSet: z.string(),
    recommendationOptionsChanged: z.boolean(),
    committedPoolKey: z.string(),
    deckDoctorHistory: z.array(z.never()).length(0),
    signatureQuota: z.strictObject({ pages: count, cards: count }),
    fetchEpoch: count,
    hydrationBoundary: count,
    fetchSequence: count,
    fetchBoundary: z.null(),
    pendingFetches: z.array(z.never()).length(0),
    completedFetches: z.array(z.never()).length(0),
    localCandidateBuffer: z.array(z.never()).length(0),
  })

const rawCard = z.custom<ScryfallCard>(isScryfallCard, 'Expected a validated Scryfall card')
// Transport/state replacement actions are deliberately absent from the command boundary.
export const actionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('decide'), name, decision: z.enum(['add', 'later', 'ignore']) }),
  z.strictObject({ type: z.literal('like'), name }),
  z.strictObject({
    type: z.literal('ignoreReason'),
    name,
    reason: z.enum(ignoreReasons).nullable(),
  }),
  z.strictObject({ type: z.literal('chooseZone'), zone }),
  z.strictObject({ type: z.literal('theme'), theme: z.string() }),
  z.strictObject({ type: z.literal('selectSubTheme'), name }),
  z.strictObject({ type: z.literal('removeSubTheme'), name }),
  z.strictObject({ type: z.literal('dismissSubTheme'), name, evidenceCount: count }),
  z.strictObject({ type: z.literal('settings'), settings: settingsSchema.partial() }),
  z.strictObject({ type: z.literal('targets'), targets: targets.partial() }),
  z.strictObject({ type: z.literal('focus'), role }),
  z.strictObject({ type: z.literal('completeFocus') }),
  z.strictObject({ type: z.literal('collectionMode'), mode: stateSchema.shape.collectionMode }),
  z.strictObject({ type: z.literal('toggleSet'), code: name }),
  z.strictObject({ type: z.literal('commitSettings') }),
  z.strictObject({ type: z.literal('nextBatch'), extraSubTheme: z.string().optional() }),
  z.strictObject({ type: z.literal('removeCard'), board: zone, index: count }),
  z.strictObject({ type: z.literal('moveCard'), board: zone, index: count }),
  z.strictObject({ type: z.literal('discoverDoctor') }),
  z.strictObject({ type: z.literal('addGuidance'), card }),
  z.strictObject({ type: z.literal('addCollection'), card: rawCard }),
  z.strictObject({ type: z.literal('addSearch'), cards: z.array(rawCard) }),
  z.strictObject({
    type: z.literal('addBasics'),
    cards: z.array(z.strictObject({ card: deckCard, count: count.max(100) })),
  }),
  z.strictObject({ type: z.literal('addOneBasic'), card: deckCard }),
  z.strictObject({
    type: z.literal('printing'),
    board: z.enum(['queue', 'deck', 'sideboard']),
    index: count,
    name,
    printings: z.array(printing),
    selection: count,
    automatic: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('promote'),
    candidate: deckCard,
    outgoingNames: strings,
    keepOutgoing: z.boolean(),
    details: details.nullable(),
  }),
  z.strictObject({
    type: z.literal('doctorApply'),
    id: name,
    cuts: z.array(z.strictObject({ cutIndex: count, cutCard: deckCard })),
    additions: z.array(card),
    moveCutToSideboard: z.boolean(),
  }),
  z.strictObject({ type: z.literal('doctorUndo'), id: name, refreshedCut: deckCard.optional() }),
])
export const commandSchema = z.strictObject({
  reason: name,
  action: z.union([
    actionSchema,
    z.strictObject({
      type: z.literal('addRetrieved'),
      commandIndex: count.max(9999),
      names: z
        .array(name.max(200))
        .min(1)
        .max(75)
        .refine((names) => new Set(names).size === names.length, 'Duplicate retrieved names'),
    }),
    z.strictObject({ type: z.literal('view') }),
    z.strictObject({
      type: z.literal('search'),
      query: name.max(1000),
      order: z.enum([
        'name',
        'cmc',
        'price',
        'released',
        'set',
        'rarity',
        'color',
        'power',
        'toughness',
        'edhrec',
        'artist',
        'review',
        'usd',
        'tix',
        'eur',
      ]),
      page: count.min(1).max(100),
    }),
    z.strictObject({ type: z.literal('explain'), name }),
    z.strictObject({
      type: z.literal('lookup'),
      names: z
        .array(name.max(200))
        .min(1)
        .max(75)
        .refine(
          (names) => new Set(names.map((value) => value.toLowerCase())).size === names.length,
          'Duplicate lookup names',
        ),
    }),
  ]),
})
export type Command = z.infer<typeof commandSchema>
export const limitsSchema = z.strictObject({
  commands: count.min(1).max(10000),
  batches: count.min(1).max(1000),
  runtimeMs: count.min(1).max(600000),
})
export const defaultLimits = { commands: 500, batches: 100, runtimeMs: 60000 }
