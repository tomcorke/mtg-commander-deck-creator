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

/** Validate downloaded/generated data before any numeric posting is used as a card offset. */
export function parseLocalCardIndex(value: unknown): LocalCardIndex {
  const index = indexSchema.parse(value)
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
