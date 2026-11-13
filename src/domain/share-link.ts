import type { ImportBoard, ImportedCard, ImportedDeck } from '../deck-import.ts'
import type { DeckCard, ExportFormat } from './card-model.ts'

/**
 * Share links carry the whole deck in the URL fragment, so the app stays client-only (#504).
 * The fragment never reaches a server. Decoding treats it as untrusted input: it bounds every
 * size before and after decompression and validates each field before the deck is resolved.
 */
export const shareLinkPrefix = '#share='
const formatVersion = '1.'
export const shareLimits = {
  /** Characters after `#share=`; a compressed 100-card deck with a sideboard is far smaller. */
  encodedLength: 32_000,
  /** Decompressed JSON bytes, which also stops a decompression bomb early. */
  decodedBytes: 200_000,
  entries: 300,
  mainDeckCards: 100,
  sideboardCards: 300,
  quantity: 100,
  nameLength: 150,
  deckNameLength: 100,
  collectorNumberLength: 20,
} as const

const boardCodes: Record<ImportBoard, string> = { commander: 'c', mainboard: 'm', sideboard: 's' }
const finishCodes = { foil: 'f', etched: 'e' } as const
type Entry = [string, number, string, string?, string?, string?]
type Payload = { n?: string; c: Entry[] }

export class SharedDeckError extends Error {}
const invalid = () => new SharedDeckError('This share link is damaged or incomplete.')
const isControl = (character: string) => {
  const code = character.codePointAt(0)!
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029
}
/** Fits a saved deck name, which has no length limit, to what decoding accepts. */
const shareableName = (name: string) =>
  [...name]
    .map((character) => (isControl(character) ? ' ' : character))
    .join('')
    .trim()
    .slice(0, shareLimits.deckNameLength)
    .trim()

/** The deck as a share-link list: commanders first, identical printings grouped. */
export function sharedDeckFromCards(
  commanderCount: number,
  deck: Pick<DeckCard, 'name' | 'set' | 'collectorNumber' | 'finish'>[],
  sideboard: Pick<DeckCard, 'name' | 'set' | 'collectorNumber' | 'finish'>[],
  name = '',
): ImportedDeck {
  const grouped = new Map<string, ImportedCard>()
  const add = (card: (typeof deck)[number], board: ImportBoard) => {
    const finish = card.finish === 'foil' || card.finish === 'etched' ? card.finish : undefined
    const key = JSON.stringify([board, card.name, card.set, card.collectorNumber, finish])
    const existing = grouped.get(key)
    if (existing) existing.quantity++
    else
      grouped.set(key, {
        board,
        name: card.name,
        quantity: 1,
        ...(card.set && card.collectorNumber
          ? { set: card.set.toLowerCase(), collectorNumber: card.collectorNumber }
          : {}),
        ...(finish ? { finish } : {}),
      })
  }
  deck.forEach((card, index) => add(card, index < commanderCount ? 'commander' : 'mainboard'))
  sideboard.forEach((card) => add(card, 'sideboard'))
  const sharedName = shareableName(name)
  return { ...(sharedName ? { name: sharedName } : {}), cards: [...grouped.values()] }
}

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw invalid()
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  limit = Infinity,
) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel().catch(() => undefined)
      throw new SharedDeckError('This share link holds more than one deck can.')
    }
    chunks.push(value)
  }
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

/** The URL-fragment payload for a deck: versioned, deflated JSON in base64url. */
export async function encodeSharedDeck(deck: ImportedDeck) {
  const payload: Payload = {
    ...(deck.name ? { n: deck.name } : {}),
    c: deck.cards.map((card) => {
      const entry: Entry = [boardCodes[card.board], card.quantity, card.name]
      const finish = card.finish ? finishCodes[card.finish] : ''
      if (card.set && card.collectorNumber) entry.push(card.set, card.collectorNumber)
      if (finish) {
        if (entry.length === 3) entry.push('', '')
        entry.push(finish)
      }
      return entry
    }),
  }
  const json = new TextEncoder().encode(JSON.stringify(payload))
  return `${formatVersion}${toBase64Url(await transform(json, new CompressionStream('deflate-raw')))}`
}

export const shareLinkFor = (base: string, payload: string) => {
  const url = new URL(base)
  url.hash = `${shareLinkPrefix.slice(1)}${payload}`
  return url.href
}

/** The payload of a `#share=` fragment, or null for any other fragment. */
export function sharePayloadFromHash(hash: string) {
  return hash.startsWith(shareLinkPrefix) ? hash.slice(shareLinkPrefix.length) : null
}

/** The payload of a pasted share link, from any origin, or null for other text. */
export function sharePayloadFromLink(text: string) {
  try {
    return sharePayloadFromHash(new URL(text.trim()).hash)
  } catch {
    return null
  }
}

// Printable text without control characters; card and deck names are shown as plain text.
const safeText = (value: unknown, max: number): value is string =>
  typeof value === 'string' &&
  value.length <= max &&
  value.trim().length > 0 &&
  ![...value].some(isControl)

function parseEntry(raw: unknown): ImportedCard {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 6) throw invalid()
  const [boardCode, quantity, name, set = '', collectorNumber = '', finishCode = ''] = raw
  const board = (Object.keys(boardCodes) as ImportBoard[]).find(
    (key) => boardCodes[key] === boardCode,
  )
  if (
    !board ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > shareLimits.quantity ||
    !safeText(name, shareLimits.nameLength) ||
    typeof set !== 'string' ||
    typeof collectorNumber !== 'string' ||
    Boolean(set) !== Boolean(collectorNumber) ||
    (set && !/^[a-z0-9]{2,8}$/.test(set)) ||
    (collectorNumber && !safeText(collectorNumber, shareLimits.collectorNumberLength)) ||
    !['', 'f', 'e'].includes(finishCode as string)
  )
    throw invalid()
  return {
    board,
    quantity,
    name: name.trim(),
    ...(set ? { set, collectorNumber } : {}),
    ...(finishCode ? { finish: finishCode === 'f' ? 'foil' : 'etched' } : {}),
  }
}

function parsePayload(value: unknown): ImportedDeck {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const { n: name, c: entries, ...rest } = value as Record<string, unknown>
  if (Object.keys(rest).length) throw invalid()
  if (name !== undefined && !safeText(name, shareLimits.deckNameLength)) throw invalid()
  if (!Array.isArray(entries) || !entries.length || entries.length > shareLimits.entries)
    throw invalid()
  const cards = entries.map(parseEntry)
  const count = (boards: ImportBoard[]) =>
    cards
      .filter((card) => boards.includes(card.board))
      .reduce((sum, card) => sum + card.quantity, 0)
  const commanders = count(['commander'])
  if (commanders < 1 || commanders > 2)
    throw new SharedDeckError('This share link has no valid commander.')
  if (
    count(['commander', 'mainboard']) > shareLimits.mainDeckCards ||
    count(['sideboard']) > shareLimits.sideboardCards
  )
    throw new SharedDeckError('This share link holds more than one deck can.')
  return { ...(name ? { name: name.trim() } : {}), cards }
}

/** Decodes an untrusted share payload into an import list, or throws `SharedDeckError`. */
export async function decodeSharedDeck(payload: string): Promise<ImportedDeck> {
  if (payload.length > shareLimits.encodedLength)
    throw new SharedDeckError('This share link holds more than one deck can.')
  if (!payload.startsWith(formatVersion))
    throw new SharedDeckError('This share link comes from a newer or unknown version of the app.')
  let json: string
  try {
    const bytes = await transform(
      fromBase64Url(payload.slice(formatVersion.length)),
      new DecompressionStream('deflate-raw'),
      shareLimits.decodedBytes,
    )
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw error instanceof SharedDeckError ? error : invalid()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw invalid()
  }
  return parsePayload(parsed)
}

/** A download name from the deck or commander name, such as `meren-of-clan-nel-toth-moxfield.txt`. */
export function deckListFile(name: string, format: ExportFormat, neededOnly: boolean) {
  const stem =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'deck'
  const suffix = `${neededOnly ? '-still-needed' : ''}${format === 'csv' ? '' : `-${format}`}`
  return format === 'csv'
    ? { fileName: `${stem}${suffix}.csv`, type: 'text/csv' }
    : { fileName: `${stem}${suffix}.txt`, type: 'text/plain' }
}
