import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { cardFeatures, rolesForCard } from '../src/deck-analysis.ts'
import { toCard, type ScryfallCard } from '../src/domain/card-model.ts'
import { parseLocalCardIndex } from '../src/domain/local-card-index.ts'
import {
  buildLocalCardIndex,
  generateLocalCardIndex,
  type LocalCardIndexSource,
} from './build-card-index.ts'
import { generatedCreatureCatalog } from './generated-creature-catalog.ts'

function card(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    name: 'Test Cat',
    oracle_id: 'a',
    type_line: 'Creature — Cat Druid',
    layout: 'normal',
    mana_cost: '{G}',
    cmc: 1,
    oracle_text: '{T}: Add {G}.',
    color_identity: ['G'],
    produced_mana: ['G'],
    power: '1',
    toughness: '1',
    legalities: { commander: 'legal' },
    set: 'tst',
    set_name: 'Test Set',
    collector_number: '1',
    prints_search_uri: 'https://api.scryfall.com/cards/search?q=test',
    released_at: '2026-10-25',
    game_changer: false,
    finishes: ['nonfoil'],
    image_uris: {
      normal: 'https://cards.scryfall.io/normal/test.jpg',
      art_crop: 'https://cards.scryfall.io/art_crop/test.jpg',
    },
    prices: { usd: '1.25' },
    purchase_uris: { tcgplayer: 'https://www.tcgplayer.com/test' },
    ...overrides,
  }
}
function source(cards: unknown = [card()]): LocalCardIndexSource {
  return {
    bulkUpdatedAt: '2026-10-25T10:00:00Z',
    sets: [{ code: 'tst', name: 'Test Set', released_at: '2026-10-25', card_count: 300 }],
    creatureTypes: ['Cat', 'Druid', 'Dog', 'Time Lord', 'Newtype'],
    cards,
  }
}
const namesAt = (index: ReturnType<typeof buildLocalCardIndex>, offsets: number[] = []) =>
  offsets.map((offset) => index.cards[offset].name)

test('builds deterministic legal Oracle table, real subtype membership and existing classifier postings', () => {
  const cards = [
    card({
      oracle_id: 'b',
      name: 'Cat Support',
      type_line: 'Enchantment',
      oracle_text: 'Cats you control get +1/+1.',
    }),
    card({ oracle_id: 'c', name: 'Forbidden Cat', legalities: { commander: 'banned' } }),
    card(),
  ]
  const index = buildLocalCardIndex(source(cards))
  assert.deepEqual(
    index.cards.map(({ oracle_id }) => oracle_id),
    ['a', 'b'],
  )
  assert.deepEqual(namesAt(index, index.indexes.creatureTypes.Cat), ['Test Cat'])
  assert.deepEqual(namesAt(index, index.indexes.tags.Cats), ['Test Cat', 'Cat Support'])
  assert.deepEqual(namesAt(index, index.indexes.roles.ramp), ['Test Cat'])
  assert.deepEqual(namesAt(index, index.indexes.features['mana:repeatable']), ['Test Cat'])
  assert.equal(cardFeatures(toCard(index.cards[0], '')).mana, 'repeatable')
  assert.deepEqual(rolesForCard(toCard(index.cards[0], '')), ['ramp'])
  assert.deepEqual(buildLocalCardIndex(source([...cards].reverse())), index)
  assert.deepEqual(index.metadata.sets, source().sets)
})

test('newestSet is the newest represented printing, not an empty announced set', () => {
  const input = source()
  input.sets.push({
    code: 'future',
    name: 'Announced Set',
    released_at: '2027-01-01',
    card_count: 0,
  })
  const index = buildLocalCardIndex(input)
  assert.deepEqual(index.metadata.newestSet, { code: 'tst', releasedAt: '2026-10-25' })
  assert.equal(index.metadata.sets.length, 2)
})

test('whitelists provider fields without changing offline gameplay or presentation', () => {
  const original = {
    ...card(),
    flavor_text: 'Do not ship',
    artist: 'Do not ship',
    rulings_uri: 'Do not ship',
    legalities: { commander: 'legal', vintage: 'legal' },
    image_uris: { ...card().image_uris!, png: 'Do not ship' },
  }
  const indexed = buildLocalCardIndex(source([original])).cards[0]
  assert.deepEqual(
    toCard(indexed, 'offline'),
    toCard({ ...original, prices: undefined, purchase_uris: undefined }, 'offline'),
  )
  assert.equal(indexed.prices, undefined)
  assert.equal(indexed.purchase_uris, undefined)
  assert.equal('flavor_text' in indexed, false)
  assert.equal('vintage' in indexed.legalities!, false)
  assert.equal('png' in indexed.image_uris!, false)
})

test('retains all MDFC gameplay faces and images; type membership excludes Oracle mentions', () => {
  const original = card({
    name: 'Front // Back',
    layout: 'modal_dfc',
    type_line: 'Creature — Cat // Land',
    oracle_text: undefined,
    mana_cost: undefined,
    image_uris: undefined,
    card_faces: [
      {
        type_line: 'Creature — Cat',
        mana_cost: '{G}',
        oracle_text: 'Create a Dog token.',
        power: '2',
        toughness: '3',
        image_uris: { normal: 'https://cards.scryfall.io/front.jpg' },
      },
      {
        type_line: 'Land',
        mana_cost: '',
        oracle_text: '{T}: Add {G}.',
        image_uris: { normal: 'https://cards.scryfall.io/back.jpg' },
      },
    ],
  })
  const index = buildLocalCardIndex(source([original]))
  assert.deepEqual(
    toCard(index.cards[0], ''),
    toCard({ ...original, prices: undefined, purchase_uris: undefined }, ''),
  )
  assert.deepEqual(index.indexes.creatureTypes.Cat, [0])
  assert.equal(index.indexes.creatureTypes.Dog, undefined)
  assert.deepEqual(index.indexes.tags.Dogs, [0])
  assert.deepEqual(index.indexes.roles.lands, [0])
})

test('indexes multiword and newly downloaded creature catalog types, without modifying tracked snapshot', () => {
  const index = buildLocalCardIndex(
    source([
      card({
        type_line: 'Creature — Time Lord Newtype',
        oracle_text: 'Newtypes you control have flying.',
      }),
    ]),
  )
  assert.deepEqual(index.indexes.creatureTypes['Time Lord'], [0])
  assert.deepEqual(index.indexes.creatureTypes.Newtype, [0])
  assert.deepEqual(index.indexes.tags.Newtypes, [0])
  assert.deepEqual(index.metadata.creatureTypes, source().creatureTypes)
})

test('rejects malformed cards instead of silently omitting an incomplete corpus', () => {
  for (const cards of [
    [],
    {},
    [card(), { name: 'broken' }],
    [card({ cmc: undefined })],
    [card({ oracle_id: undefined })],
    [card({ oracle_text: undefined })],
    [card(), card()],
  ])
    assert.throws(() => buildLocalCardIndex(source(cards)))
})

async function withPaths(
  run: (paths: { root: string; cacheDir: string; outputPath: string }) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), 'local-card-index-'))
  try {
    await run({
      root,
      cacheDir: join(root, 'cache'),
      outputPath: join(root, 'public', 'local-card-index.json'),
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
const offline = async () => {
  throw new Error('offline')
}
const now = new Date('2026-10-25T12:00:00Z')
async function cacheSource(cacheDir: string, fetchedAt: string, cards: unknown = source().cards) {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(
    join(cacheDir, 'source.json'),
    JSON.stringify({
      ...source(),
      cards: undefined,
      fetchedAt,
      cardCount: (cards as unknown[]).length,
      bulkFile: 'oracle-cards-20261025100000.json',
    }),
  )
  await writeFile(join(cacheDir, 'oracle-cards-20261025100000.json'), JSON.stringify(cards))
}

test('reuses a daily persistent source cache and reports actual raw/gzip sizes', async () => {
  await withPaths(async ({ cacheDir, outputPath }) => {
    await cacheSource(cacheDir, now.toISOString())
    const result = await generateLocalCardIndex({ cacheDir, outputPath, now, fetcher: offline })
    const json = await readFile(outputPath, 'utf8')
    assert.equal(result.rawBytes, Buffer.byteLength(json))
    assert.equal(result.gzipBytes, gzipSync(json).byteLength)
    assert.deepEqual(parseLocalCardIndex(JSON.parse(json)), result.index)
    assert.deepEqual(
      JSON.parse(await readFile(join(cacheDir, 'local-card-index.json'), 'utf8')),
      result.index,
    )
  })
})

test('first generation fails without network/cache and never writes an empty index', async () => {
  await withPaths(async ({ cacheDir, outputPath }) => {
    await assert.rejects(
      generateLocalCardIndex({ cacheDir, outputPath, now, fetcher: offline }),
      /No valid previous/,
    )
    await assert.rejects(readFile(outputPath), { code: 'ENOENT' })
  })
})

test('expired source cache uses only a previous valid index, including persistent fallback after clean build', async () => {
  await withPaths(async ({ cacheDir, outputPath }) => {
    await cacheSource(cacheDir, '2026-10-24T12:00:00Z')
    await writeFile(
      join(cacheDir, 'local-card-index.json'),
      JSON.stringify(buildLocalCardIndex(source())),
    )
    const result = await generateLocalCardIndex({ cacheDir, outputPath, now, fetcher: offline })
    assert.equal(result.index.cards[0].name, 'Test Cat')
    await writeFile(outputPath, '{"broken":true}')
    await writeFile(join(cacheDir, 'local-card-index.json'), '{"broken":true}')
    await assert.rejects(
      generateLocalCardIndex({ cacheDir, outputPath, now, fetcher: offline }),
      /No valid previous/,
    )
  })
})

test('corrupt cached source falls back without overwriting the previous valid artifact', async () => {
  await withPaths(async ({ cacheDir, outputPath }) => {
    await cacheSource(cacheDir, now.toISOString(), [card(), { name: 'broken' }])
    await mkdir(join(outputPath, '..'), { recursive: true })
    const previous = buildLocalCardIndex(source())
    await writeFile(outputPath, JSON.stringify(previous))
    const result = await generateLocalCardIndex({ cacheDir, outputPath, now, fetcher: offline })
    assert.deepEqual(result.index, previous)
  })
})

function networkSource(bulkBytes: Buffer, compressedSize = bulkBytes.length) {
  const urls: string[] = []
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input)
    urls.push(url)
    if (url.endsWith('/bulk-data/oracle-cards'))
      return Response.json({
        type: 'oracle_cards',
        updated_at: source().bulkUpdatedAt,
        jsonl_download_uri: 'https://data.scryfall.io/cards.jsonl.gz',
        compressed_size: compressedSize,
      })
    if (url.endsWith('/sets')) return Response.json({ has_more: false, data: source().sets })
    if (url.endsWith('/catalog/creature-types'))
      return Response.json({
        total_values: source().creatureTypes.length,
        data: source().creatureTypes,
      })
    if (url.endsWith('.jsonl.gz')) return new Response(new Uint8Array(bulkBytes))
    throw new Error(`Unexpected URL ${url}`)
  }
  return { urls, fetcher: fetcher as typeof fetch }
}

test('downloads current gzip JSONL bulk, validates full source, and persists reusable source cache', async () => {
  await withPaths(async ({ cacheDir, outputPath }) => {
    const banned = card({ legalities: { commander: 'not_legal' } })
    const records = [
      card(),
      ...Array.from({ length: 19_999 }, (_, position) => ({
        ...banned,
        oracle_id: `excluded-${position}`,
      })),
    ]
    const network = networkSource(
      gzipSync(records.map((record) => JSON.stringify(record)).join('\n')),
    )
    const result = await generateLocalCardIndex({
      cacheDir,
      outputPath,
      now,
      fetcher: network.fetcher,
    })
    assert.equal(result.cards, 1)
    assert.equal(network.urls.length, 4)
    const cached = await generateLocalCardIndex({ cacheDir, outputPath, now, fetcher: offline })
    assert.deepEqual(cached.index, result.index)
  })
})

test('rejects incomplete gzip bulk bytes and implausibly small downloaded corpora', async () => {
  for (const wrongSize of [false, true])
    await withPaths(async ({ cacheDir, outputPath }) => {
      const bytes = gzipSync(JSON.stringify(card()))
      const network = networkSource(bytes, wrongSize ? bytes.length + 1 : bytes.length)
      await assert.rejects(
        generateLocalCardIndex({ cacheDir, outputPath, now, fetcher: network.fetcher }),
        /No valid previous/,
      )
    })
})

test('build-only plugin replaces only the catalog declaration and leaves source fallback untouched', async () => {
  await withPaths(async ({ root, outputPath }) => {
    const plugin = generatedCreatureCatalog()
    assert.equal(plugin.apply, 'build')
    assert.equal(plugin.enforce, 'pre')
    const transform = plugin.transform as (code: string, id: string) => { code: string } | undefined
    assert.equal(transform('unrelated', '/src/other.ts'), undefined)
    await mkdir(join(root, 'public'))
    const index = buildLocalCardIndex(source())
    await writeFile(outputPath, JSON.stringify(index))
    const original = 'export const creatureTypes = [\n  "Cat",\n]\nexport const unrelated = 42\n'
    const cwd = process.cwd()
    try {
      process.chdir(root)
      const transformed = transform(original, 'E:/project/src/domain/creature-types.ts')!
      assert.equal(
        transformed.code,
        `export const creatureTypes = ${JSON.stringify(index.metadata.creatureTypes)}\nexport const unrelated = 42\n`,
      )
      assert.throws(
        () => transform('unexpected declaration', '/src/domain/creature-types.ts'),
        /declaration not found/,
      )
    } finally {
      process.chdir(cwd)
    }
  })
})
