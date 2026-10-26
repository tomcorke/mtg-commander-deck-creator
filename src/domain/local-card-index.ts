import { z } from 'zod'
import { isScryfallCard, type ScryfallCard } from './card-model.ts'

const coveredSetSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  released_at: z.iso.date(),
  card_count: z.number().int().nonnegative(),
  set_type: z.string().optional(),
  digital: z.boolean().optional(),
  parent_set_code: z.string().optional(),
})
const newestSetSchema = z.object({ code: z.string().min(1), releasedAt: z.iso.date() })
const postingsSchema = z.record(z.string().min(1), z.array(z.number().int().nonnegative()))
const indexSchema = z.object({
  metadata: z.object({
    bulkUpdatedAt: z.iso.datetime({ offset: true }),
    newestSet: newestSetSchema,
    sets: z.array(coveredSetSchema).min(1),
    creatureTypes: z.array(z.string().trim().min(1)).min(1),
  }),
  cards: z.array(z.custom<ScryfallCard>(isScryfallCard)).min(1),
  indexes: z.object({
    creatureTypes: postingsSchema,
    tags: postingsSchema,
    roles: postingsSchema,
    features: postingsSchema,
  }),
})

export type LocalCardIndex = z.infer<typeof indexSchema>

// Versioned wire rows omit repeated property names. String cells reference a shared
// dictionary; nested presentation data keeps its provider shape and URLs verbatim.
const cardColumns = [
  'name',
  'oracle_id',
  'layout',
  'type_line',
  'mana_cost',
  'cmc',
  'oracle_text',
  'power',
  'toughness',
  'produced_mana',
  'color_identity',
  'set',
  'set_name',
  'collector_number',
  'scryfall_uri',
  'prints_search_uri',
  'finishes',
  'promo_types',
  'released_at',
  'game_changer',
  'legalities',
  'image_uris',
  'card_faces',
] as const

export function serializeLocalCardIndex(index: LocalCardIndex): string {
  const strings: string[] = []
  const ids = new Map<string, number>()
  const cards = index.cards.map((card) =>
    cardColumns.map((key) => {
      const value = card[key]
      if (key === 'game_changer' && value === null) return [null]
      if (typeof value !== 'string') return value ?? null
      let id = ids.get(value)
      if (id === undefined) {
        id = strings.length
        ids.set(value, id)
        strings.push(value)
      }
      return id
    }),
  )
  return JSON.stringify({ ...index, version: 1, strings, cards })
}

function expandWireIndex(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('version' in value)) return value
  const wire = z
    .object({
      version: z.literal(1),
      strings: z.array(z.string()),
      // Only inspect the wire container here. The expanded cards pass the full
      // trust-boundary validator below; cloning every cell first adds avoidable work.
      cards: z.custom<unknown[][]>(
        (rows) =>
          Array.isArray(rows) &&
          rows.every((row) => Array.isArray(row) && row.length === cardColumns.length),
      ),
    })
    .parse(value)
  const cards = wire.cards.map((row) => {
    const card: Record<string, unknown> = {}
    for (let i = 0; i < cardColumns.length; i++) {
      const key = cardColumns[i]
      const cell = row[i]
      if (cell === null) continue
      if (key === 'game_changer' && Array.isArray(cell) && cell.length === 1 && cell[0] === null)
        card[key] = null
      else if (key === 'cmc' || key === 'game_changer' || typeof cell !== 'number') card[key] = cell
      else {
        if (!Number.isInteger(cell) || cell < 0 || cell >= wire.strings.length)
          throw new Error('Invalid local card string reference')
        card[key] = wire.strings[cell]
      }
    }
    return card
  })
  return { ...value, cards }
}

/** Validate downloaded/generated data before any numeric posting is used as a card offset. */
export function parseLocalCardIndex(value: unknown): LocalCardIndex {
  const index = indexSchema.parse(expandWireIndex(value))
  const identities = new Set<string>()
  for (const card of index.cards) {
    if (
      !card.oracle_id ||
      identities.has(card.oracle_id) ||
      card.legalities?.commander !== 'legal' ||
      !Number.isFinite(card.cmc)
    )
      throw new Error('Invalid local card identity, legality or mana value')
    identities.add(card.oracle_id)
  }
  for (const postings of Object.values(index.indexes))
    for (const offsets of Object.values(postings))
      if (
        offsets.some(
          (offset, position) =>
            offset >= index.cards.length || (position > 0 && offset <= offsets[position - 1]),
        )
      )
        throw new Error('Invalid local card index posting')
  const { sets, newestSet, creatureTypes } = index.metadata
  const representedSets = new Set(index.cards.map((card) => card.set))
  if (
    new Set(sets.map(({ code }) => code)).size !== sets.length ||
    new Set(creatureTypes).size !== creatureTypes.length ||
    !sets.some(
      ({ code, released_at }) => code === newestSet.code && released_at === newestSet.releasedAt,
    ) ||
    !representedSets.has(newestSet.code) ||
    sets.some(
      ({ code, released_at }) => representedSets.has(code) && released_at > newestSet.releasedAt,
    ) ||
    Object.keys(index.indexes.creatureTypes).some((type) => !creatureTypes.includes(type))
  )
    throw new Error('Invalid local card index coverage metadata')
  return index
}
