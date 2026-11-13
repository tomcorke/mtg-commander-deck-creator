// Builds public/combo-index.json from Commander Spellbook's bulk variant export. Spellbook asks
// consumers to read this export on their own schedule rather than page through its API, and its
// API only accepts browser requests from its own site, so the app ships a compacted copy.
import { get } from 'node:https'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { createGunzip, gzipSync } from 'node:zlib'
import {
  comboIndexVersion,
  parseComboIndex,
  type ComboCardRow,
  type ComboIndex,
  type ComboRow,
} from '../src/domain/combo-index.ts'

const day = 24 * 60 * 60 * 1000
export const comboExportUrl = 'https://json.commanderspellbook.com/variants.json.gz'
const publicStatuses = new Set(['OK', 'E'])
// Feature statuses from Spellbook's backend: S standalone, C contextual, H helper, PU public
// utility, HU hidden utility. Hidden utilities are generation internals, not results.
const featureOrder: Record<string, number> = { S: 0, C: 1, H: 2, PU: 3 }

type SpellbookCard = { name: string; oracleId?: string | null; imageUriFrontNormal?: string | null }
export type SpellbookVariant = {
  id: string
  status: string
  spoiler?: boolean
  uses: { card: SpellbookCard; quantity: number; mustBeCommander: boolean }[]
  requires: unknown[]
  produces: { feature: { name: string; status: string } }[]
  identity: string
  popularity?: number | null
  legalities?: { commander?: boolean }
}

// Cuts the elements of the top-level `variants` array out of streamed JSON text by brace depth,
// tracking strings so braces inside card names and descriptions are ignored.
class VariantSplitter {
  depth = 0
  private inString = false
  private escaped = false
  private key = ''
  private lastKey = ''
  private arrayDepth = -1
  pending: string[] | undefined
  private start = -1
  private readonly onVariant: (variant: SpellbookVariant) => void
  constructor(onVariant: (variant: SpellbookVariant) => void) {
    this.onVariant = onVariant
  }

  push(text: string) {
    this.start = this.pending ? 0 : -1
    for (let position = 0; position < text.length; position++) {
      if (this.inString) this.stringCharacter(text[position])
      else this.structureCharacter(text, position)
    }
    this.pending?.push(text.slice(this.start))
  }

  private stringCharacter(character: string) {
    if (this.escaped) this.escaped = false
    else if (character === '\\') this.escaped = true
    else if (character === '"') {
      this.inString = false
      if (this.depth === 1) this.lastKey = this.key
    } else if (this.depth === 1) this.key += character
  }

  private structureCharacter(text: string, position: number) {
    switch (text[position]) {
      case '"':
        this.inString = true
        this.key = ''
        return
      case '[':
        this.depth += 1
        if (this.depth === 2 && this.lastKey === 'variants') this.arrayDepth = this.depth
        return
      case ']':
        if (this.depth === this.arrayDepth) this.arrayDepth = -1
        this.depth -= 1
        return
      case '{':
        this.depth += 1
        if (this.arrayDepth > 0 && this.depth === this.arrayDepth + 1) {
          this.pending = []
          this.start = position
        }
        return
      case '}':
        if (this.pending && this.depth === this.arrayDepth + 1) this.emit(text, position)
        this.depth -= 1
    }
  }

  private emit(text: string, position: number) {
    this.pending!.push(text.slice(this.start, position + 1))
    this.onVariant(JSON.parse(this.pending!.join('')) as SpellbookVariant)
    this.pending = undefined
    this.start = -1
  }
}

/**
 * Calls `onVariant` for each element of the export's top-level `variants` array. The export is
 * ~700 MB decompressed, beyond one JavaScript string, so elements are cut from the stream and
 * parsed one at a time. Returns the export's timestamp and version.
 */
export async function readSpellbookExport(
  source: Readable,
  onVariant: (variant: SpellbookVariant) => void,
) {
  const splitter = new VariantSplitter(onVariant)
  let head = ''
  source.setEncoding('utf8')
  for await (const text of source as AsyncIterable<string>) {
    if (head.length < 400) head += text.slice(0, 400)
    splitter.push(text)
  }
  if (splitter.depth !== 0 || splitter.pending)
    throw new Error('Truncated Commander Spellbook export')
  const timestamp = /"timestamp":\s*"([^"]+)"/.exec(head)?.[1]
  const version = /"version":\s*"([^"]+)"/.exec(head)?.[1]
  if (!timestamp || !version) throw new Error('Commander Spellbook export has no timestamp')
  return { timestamp, version }
}

// Spellbook's normal image is a Scryfall URL; keep only its `id?version` tail.
function imageKey(url: string | null | undefined) {
  const match = /\/front\/[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})\.\w+(\?\d+)?$/.exec(url ?? '')
  return match ? match[1] + (match[2] ?? '') : null
}

/** Keeps public, Commander-legal combos of named single cards; see docs/domain/combo-data.md. */
export function includeVariant(variant: SpellbookVariant) {
  return (
    publicStatuses.has(variant.status) &&
    !variant.spoiler &&
    variant.legalities?.commander === true &&
    variant.requires.length === 0 &&
    variant.uses.length > 0 &&
    variant.uses.every(({ quantity }) => quantity === 1)
  )
}

export async function buildComboIndex(source: Readable, now = new Date()): Promise<ComboIndex> {
  const cards: ComboCardRow[] = []
  const cardIds = new Map<string, number>()
  const results: string[] = []
  const resultIds = new Map<string, number>()
  const combos: ComboRow[] = []
  const cardRef = ({ name, oracleId, imageUriFrontNormal }: SpellbookCard) => {
    const key = oracleId ?? name
    let id = cardIds.get(key)
    if (id === undefined) {
      id = cards.push([name, oracleId ?? null, imageKey(imageUriFrontNormal)]) - 1
      cardIds.set(key, id)
    }
    return id
  }
  const resultRef = (name: string) => {
    let id = resultIds.get(name)
    if (id === undefined) {
      id = results.push(name) - 1
      resultIds.set(name, id)
    }
    return id
  }
  const { timestamp, version } = await readSpellbookExport(source, (variant) => {
    if (!includeVariant(variant)) return
    const refs = variant.uses.map(({ card, mustBeCommander }) => {
      const id = cardRef(card)
      return mustBeCommander ? ~id : id
    })
    const produced = variant.produces
      .filter(({ feature }) => feature.status !== 'HU')
      .sort(
        (left, right) =>
          (featureOrder[left.feature.status] ?? 9) - (featureOrder[right.feature.status] ?? 9),
      )
      .map(({ feature }) => resultRef(feature.name))
    combos.push([variant.id, refs, produced, variant.identity, variant.popularity ?? 0])
  })
  if (combos.length < 1000) throw new Error('Commander Spellbook export is unexpectedly small')
  return parseComboIndex({
    version: comboIndexVersion,
    metadata: { exportedAt: timestamp, exportVersion: version, generatedAt: now.toISOString() },
    cards,
    results,
    combos,
  })
}

async function atomicWrite(path: string, data: string | Buffer) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  await writeFile(temporary, data)
  await rename(temporary, path)
}

// Raw HTTPS keeps the gzip body as sent: fetch would inflate it to ~700 MB in memory, because
// the export is served with `Content-Encoding: gzip`.
function download(url: string) {
  return new Promise<Buffer>((done, fail) => {
    const request = get(
      url,
      { headers: { 'User-Agent': 'CommanderCreator/1.0 (combo index build)' }, timeout: 300_000 },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume()
          return fail(new Error(`Commander Spellbook download failed: ${response.statusCode}`))
        }
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('error', fail)
        response.on('end', () => {
          const bytes = Buffer.concat(chunks)
          const length = Number(response.headers['content-length'])
          if (length && bytes.byteLength !== length)
            fail(new Error('Incomplete Commander Spellbook download'))
          else done(bytes)
        })
      },
    )
    request.on('timeout', () =>
      request.destroy(new Error('Commander Spellbook download timed out')),
    )
    request.on('error', fail)
  })
}

async function loadExport(cacheDir: string, now: Date, fetchExport: typeof download) {
  const path = join(cacheDir, 'variants.json.gz')
  try {
    if (now.getTime() - (await stat(path)).mtimeMs < day) return await readFile(path)
  } catch {
    // No usable cached export; download a fresh one.
  }
  const bytes = await fetchExport(comboExportUrl)
  await atomicWrite(path, bytes)
  return bytes
}

async function previousIndex(paths: string[]) {
  for (const path of paths) {
    try {
      return parseComboIndex(JSON.parse(await readFile(path, 'utf8')))
    } catch {
      /* Try the next persisted artifact. */
    }
  }
  throw new Error('No valid previous combo index is available')
}

export async function generateComboIndex({
  outputPath = resolve('public/combo-index.json'),
  cacheDir = join(
    process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || join(homedir(), '.cache'),
    'commander-creator',
    'combo-index',
  ),
  fetchExport = download,
  now = new Date(),
} = {}) {
  const previousPath = join(cacheDir, 'combo-index.json')
  let index: ComboIndex
  try {
    const bytes = await loadExport(cacheDir, now, fetchExport)
    index = await buildComboIndex(Readable.from([bytes]).pipe(createGunzip()), now)
  } catch (error) {
    console.warn('Combo index generation failed; trying a previous validated artifact.', error)
    index = await previousIndex([outputPath, previousPath])
  }
  const json = JSON.stringify(index)
  await atomicWrite(outputPath, json)
  await atomicWrite(previousPath, json)
  const sizes = {
    combos: index.combos.length,
    cards: index.cards.length,
    rawBytes: Buffer.byteLength(json),
    gzipBytes: gzipSync(json).byteLength,
  }
  console.log('Combo index:', { ...sizes, exportedAt: index.metadata.exportedAt })
  return { index, ...sizes }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await generateComboIndex()
