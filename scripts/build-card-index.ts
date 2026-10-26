import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { z } from 'zod'
import { cardFeatures, rolesForCard } from '../src/deck-analysis.ts'
import { isScryfallCard, toCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { creatureTypePlural } from '../src/domain/creature-types.ts'
import { parseLocalCardIndex, type LocalCardIndex } from '../src/domain/local-card-index.ts'

const day = 24 * 60 * 60 * 1000
const sourceSetSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  released_at: z.iso.date(),
  card_count: z.number().int().nonnegative(),
  set_type: z.string().optional(),
  digital: z.boolean().optional(),
  parent_set_code: z.string().optional(),
})
const sourceMetadataSchema = z.object({
  fetchedAt: z.iso.datetime(),
  bulkUpdatedAt: z.iso.datetime({ offset: true }),
  bulkFile: z.string().regex(/^oracle-cards-[\d-]+\.json$/),
  cardCount: z.number().int().positive(),
  sets: z.array(sourceSetSchema).min(1),
  creatureTypes: z.array(z.string().trim().min(1)).min(1),
})
type SourceMetadata = z.infer<typeof sourceMetadataSchema>
export type LocalCardIndexSource = Pick<
  SourceMetadata,
  'bulkUpdatedAt' | 'sets' | 'creatureTypes'
> & {
  cards: unknown
}

const cardFields = [
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
] as const
const faceFields = ['type_line', 'mana_cost', 'oracle_text', 'power', 'toughness'] as const
function pick(value: object, keys: readonly string[]) {
  return Object.fromEntries(
    keys.filter((key) => key in value).map((key) => [key, value[key as keyof typeof value]]),
  )
}
function compactCard(card: ScryfallCard): ScryfallCard {
  return {
    ...pick(card, cardFields),
    legalities: { commander: card.legalities!.commander },
    ...(card.image_uris && { image_uris: pick(card.image_uris, ['normal', 'art_crop']) }),
    ...(card.card_faces && {
      card_faces: card.card_faces.map((face) => ({
        ...pick(face, faceFields),
        ...(face.image_uris && { image_uris: pick(face.image_uris, ['normal', 'art_crop']) }),
      })),
    }),
  } as ScryfallCard
}
function featureLabels(card: ReturnType<typeof toCard>) {
  const { costs: _costs, evidence: _evidence, ...labels } = cardFeatures(card)
  return Object.entries(labels).flatMap(([category, value]) =>
    (Array.isArray(value) ? value : value === null ? [] : [value]).map(
      (label) => `${category}:${label}`,
    ),
  )
}
function addPostings(index: Record<string, number[]>, labels: string[], offset: number) {
  for (const label of new Set(labels)) (index[label] ??= []).push(offset)
}
// Printed subtypes only; every-type cards join creature-type queries through the Changeling tag.
function actualCreatureTypes(card: ScryfallCard, types: string[]) {
  const lines = card.card_faces?.map((face) => face.type_line ?? '') ?? [card.type_line]
  const subtypes = lines.flatMap((line) =>
    line.split(' // ').map((part) => part.split(' — ')[1] ?? ''),
  )
  return types.filter((type) => subtypes.some((line) => ` ${line} `.includes(` ${type} `)))
}
function validateBulkCards(value: unknown): ScryfallCard[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error('Bulk card source must be a nonempty array')
  for (const [position, card] of value.entries()) {
    if (
      !isScryfallCard(card) ||
      !['legal', 'not_legal', 'banned', 'restricted'].includes(card.legalities?.commander ?? '')
    )
      throw new Error(`Invalid bulk card at offset ${position}`)
    if (
      card.legalities?.commander === 'legal' &&
      (!card.oracle_id ||
        !Number.isFinite(card.cmc) ||
        (typeof card.oracle_text !== 'string' &&
          !(
            card.card_faces?.length &&
            card.card_faces.every((face) => typeof face.oracle_text === 'string')
          )))
    )
      throw new Error(`Incomplete gameplay data at offset ${position}: ${card.name}`)
  }
  return value
}

/** Build from a complete provider bulk dump; classifiers remain shared with live candidates. */
export function buildLocalCardIndex(source: LocalCardIndexSource): LocalCardIndex {
  const metadata = sourceMetadataSchema
    .omit({ fetchedAt: true, bulkFile: true, cardCount: true })
    .parse(source)
  const cards = validateBulkCards(source.cards)
    .filter((card) => card.legalities?.commander === 'legal')
    .map(compactCard)
    .sort((left, right) => left.oracle_id!.localeCompare(right.oracle_id!))
  const sets = metadata.sets.sort(
    (left, right) =>
      left.released_at.localeCompare(right.released_at) || left.code.localeCompare(right.code),
  )
  const representedSets = new Set(cards.map((card) => card.set))
  const latest = sets.filter(({ code }) => representedSets.has(code)).at(-1)
  if (!latest) throw new Error('No represented card set has release coverage metadata')
  const indexes: LocalCardIndex['indexes'] = {
    creatureTypes: {},
    tags: {},
    roles: {},
    features: {},
  }
  const knownTypes = new Set(metadata.creatureTypes)
  if (knownTypes.size !== metadata.creatureTypes.length)
    throw new Error('Duplicate creature catalog values')
  const typeMatchers = metadata.creatureTypes.map((type) => ({
    plural: creatureTypePlural(type),
    matcher: new RegExp(`\\b(?:${type}|${creatureTypePlural(type)})\\b`),
  }))
  for (const [offset, card] of cards.entries()) {
    const normalized = toCard(card, '')
    const sourceText = `${card.type_line}\n${normalized.detail}`
    const catalogTags = typeMatchers
      .filter(({ matcher }) => matcher.test(sourceText))
      .map(({ plural }) => plural)
    addPostings(indexes.creatureTypes, actualCreatureTypes(card, metadata.creatureTypes), offset)
    addPostings(indexes.tags, [...normalized.tags, ...catalogTags], offset)
    addPostings(indexes.roles, rolesForCard(normalized), offset)
    addPostings(indexes.features, featureLabels(normalized), offset)
  }
  return parseLocalCardIndex({
    metadata: {
      bulkUpdatedAt: metadata.bulkUpdatedAt,
      newestSet: { code: latest.code, releasedAt: latest.released_at },
      sets,
      creatureTypes: metadata.creatureTypes,
    },
    cards,
    indexes,
  })
}

async function atomicWrite(path: string, data: string) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  await writeFile(temporary, data)
  await rename(temporary, path)
}
async function fetchJson(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CommanderCreator/1.0 (local card index build)',
    },
    signal: AbortSignal.timeout(300_000),
  })
  if (!response.ok) throw new Error(`Scryfall download failed: ${response.status} ${url}`)
  return response.json() as Promise<unknown>
}
async function downloadBulk(
  bulk: { download_uri?: string; jsonl_download_uri?: string; compressed_size?: number },
  fetcher: typeof fetch,
) {
  if (!bulk.jsonl_download_uri) {
    if (!bulk.download_uri) throw new Error('Bulk manifest has no download URL')
    return fetchJson(bulk.download_uri, fetcher)
  }
  const response = await fetcher(bulk.jsonl_download_uri, { signal: AbortSignal.timeout(300_000) })
  if (!response.ok) throw new Error(`Bulk download failed: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bulk.compressed_size !== undefined && bytes.byteLength !== bulk.compressed_size)
    throw new Error('Incomplete compressed bulk download')
  return gunzipSync(bytes)
    .toString('utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
}
async function downloadSource(
  cacheDir: string,
  fetcher: typeof fetch,
  now: Date,
): Promise<LocalCardIndexSource> {
  const bulk = z
    .object({
      type: z.literal('oracle_cards'),
      updated_at: z.iso.datetime({ offset: true }),
      download_uri: z.url().optional(),
      jsonl_download_uri: z.url().optional(),
      compressed_size: z.number().int().positive().optional(),
    })
    .parse(await fetchJson('https://api.scryfall.com/bulk-data/oracle-cards', fetcher))
  // Other API methods require 100 ms spacing; bulk downloads use a separate host.
  await new Promise((done) => setTimeout(done, 100))
  const sets = z
    .object({ has_more: z.literal(false), data: z.array(sourceSetSchema).min(1) })
    .parse(await fetchJson('https://api.scryfall.com/sets', fetcher)).data
  await new Promise((done) => setTimeout(done, 100))
  const catalog = z
    .object({
      total_values: z.number().int().positive(),
      data: z.array(z.string().regex(/^[A-Za-z][A-Za-z '-]*$/)).min(1),
    })
    .parse(await fetchJson('https://api.scryfall.com/catalog/creature-types', fetcher))
  if (catalog.total_values !== catalog.data.length)
    throw new Error('Incomplete creature type catalog')
  const cards = validateBulkCards(await downloadBulk(bulk, fetcher))
  if (cards.length < 20_000) throw new Error('Bulk card corpus is unexpectedly small')
  const metadata: SourceMetadata = {
    fetchedAt: now.toISOString(),
    bulkUpdatedAt: bulk.updated_at,
    bulkFile: `oracle-cards-${bulk.updated_at.replace(/\D/g, '')}.json`,
    cardCount: cards.length,
    sets,
    creatureTypes: catalog.data,
  }
  await atomicWrite(join(cacheDir, metadata.bulkFile), JSON.stringify(cards))
  await atomicWrite(join(cacheDir, 'source.json'), JSON.stringify(metadata))
  return { ...metadata, cards }
}
async function loadSource(cacheDir: string, fetcher: typeof fetch, now: Date) {
  try {
    const metadata = sourceMetadataSchema.parse(
      JSON.parse(await readFile(join(cacheDir, 'source.json'), 'utf8')),
    )
    const age = now.getTime() - Date.parse(metadata.fetchedAt)
    if (age >= 0 && age < day) {
      const cards = JSON.parse(await readFile(join(cacheDir, metadata.bulkFile), 'utf8'))
      if (!Array.isArray(cards) || cards.length !== metadata.cardCount)
        throw new Error('Incomplete cached bulk card corpus')
      return { ...metadata, cards }
    }
  } catch {
    // An absent or interrupted source cache needs a fresh complete download.
  }
  return downloadSource(cacheDir, fetcher, now)
}
async function previousIndex(paths: string[]) {
  for (const path of paths) {
    try {
      return parseLocalCardIndex(JSON.parse(await readFile(path, 'utf8')))
    } catch {
      /* Try the next persisted artifact. */
    }
  }
  throw new Error('No valid previous local card index is available')
}

export async function generateLocalCardIndex({
  outputPath = resolve('public/local-card-index.json'),
  cacheDir = join(
    process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || join(homedir(), '.cache'),
    'commander-creator',
    'card-index',
  ),
  fetcher = fetch,
  now = new Date(),
} = {}) {
  const previousPath = join(cacheDir, 'local-card-index.json')
  let index: LocalCardIndex
  try {
    index = buildLocalCardIndex(await loadSource(cacheDir, fetcher, now))
  } catch (error) {
    console.warn('Local card index generation failed; trying a previous validated artifact.', error)
    index = await previousIndex([outputPath, previousPath])
  }
  const json = JSON.stringify(index)
  await atomicWrite(outputPath, json)
  await atomicWrite(previousPath, json)
  const sizes = {
    cards: index.cards.length,
    rawBytes: Buffer.byteLength(json),
    gzipBytes: gzipSync(json).byteLength,
  }
  console.log('Local card index:', { ...sizes, bulkUpdatedAt: index.metadata.bulkUpdatedAt })
  return { index, ...sizes }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await generateLocalCardIndex()
