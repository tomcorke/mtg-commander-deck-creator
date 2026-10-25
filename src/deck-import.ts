import type { ScryfallIdentifier } from './adapters/scryfall.ts'

export { fetchScryfallCollection } from './adapters/scryfall.ts'

export type ImportBoard = 'commander' | 'mainboard' | 'sideboard'
export type ImportedCard = {
  name: string
  quantity: number
  set?: string
  collectorNumber?: string
  finish?: 'foil' | 'etched'
  board: ImportBoard
}
export type ImportedDeck = { name?: string; cards: ImportedCard[] }
type MissingIdentifier = ScryfallIdentifier

export function mainDeckCardCount(deck: ImportedDeck) {
  return deck.cards
    .filter(({ board }) => board !== 'sideboard')
    .reduce((total, { quantity }) => total + quantity, 0)
}

export const shouldOpenReviewAfterImport = (deck: ImportedDeck, requested: boolean) =>
  requested && mainDeckCardCount(deck) === 100

export function missingCardNames(missing: MissingIdentifier[], cards: ImportedCard[]) {
  return missing.map(
    (identifier) =>
      identifier.name ??
      cards.find(
        (card) =>
          card.set === identifier.set && card.collectorNumber === identifier.collector_number,
      )?.name ??
      `${identifier.set?.toUpperCase() ?? 'Unknown set'} ${identifier.collector_number ?? ''}`.trim(),
  )
}

export function matchImportedCard<
  T extends { name: string; set: string; collector_number: string },
>(entry: ImportedCard, cards: T[]) {
  return (
    cards.find(
      (card) =>
        entry.set &&
        entry.collectorNumber &&
        card.set === entry.set &&
        card.collector_number === entry.collectorNumber,
    ) ??
    cards.find((card) => {
      // Lists often name double-faced, split and adventure cards by their front face only.
      const name = entry.name.toLowerCase()
      const full = card.name.toLowerCase()
      return full === name || full.split(' // ')[0] === name
    })
  )
}

/** Thrown when some cards are missing, so the player can import the cards that matched. */
export class ImportMissingCardsError extends Error {
  readonly missing: string[]
  readonly foundCount: number
  constructor(missing: string[], foundCount: number) {
    super(`Not found: ${missing.join(', ')}. Check spelling, set, and collector number.`)
    this.missing = missing
    this.foundCount = foundCount
  }
}

const sectionBoard = (line: string): ImportBoard | null => {
  const section = line.trim().replace(/:$/, '').toLowerCase()
  if (section === 'commander' || section === 'commanders') return 'commander'
  if (section === 'sideboard' || section === 'maybeboard') return 'sideboard'
  if (section === 'deck' || section === 'mainboard' || section === 'main deck') return 'mainboard'
  return null
}

export function parseDeckList(text: string): ImportedDeck {
  if (/^s*quantity,name,/i.test(text)) return parseDeckCsv(text)
  let board: ImportBoard = 'mainboard'
  const cards: ImportedCard[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) continue
    const section = sectionBoard(line)
    if (section) {
      board = section
      continue
    }
    const match = line.match(
      /^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)\s+([^\s]+)|\s+\[([A-Za-z0-9]+):([^\]]+)\])?(?:\s+\*([^*]+)\*)?$/,
    )
    if (!match) continue
    cards.push({
      name: match[2].trim(),
      quantity: Number(match[1]),
      set: (match[3] ?? match[5])?.toLowerCase(),
      collectorNumber: (match[4] ?? match[6])?.trim(),
      board,
      ...importedFinish(match[7]),
    })
  }
  return { cards }
}

const importedFinish = (value = ''): Pick<ImportedCard, 'finish'> =>
  /^(f|foil)$/i.test(value.trim())
    ? { finish: 'foil' }
    : /^(e|etched)$/i.test(value.trim())
      ? { finish: 'etched' }
      : {}

// Reads the app's own CSV export: Quantity,Name,Set,Collector Number,Foil,Board.
function parseDeckCsv(text: string): ImportedDeck {
  const [header, ...rows] = text
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(([, cell]) =>
        cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell.trim(),
      ),
    )
  const column = (name: string) => header.findIndex((cell) => cell.toLowerCase() === name)
  const [quantity, name, set, collectorNumber, finish, board] = [
    'quantity',
    'name',
    'set',
    'collector number',
    'foil',
    'board',
  ].map(column)
  const cards = rows.flatMap((row): ImportedCard[] =>
    row[name]?.trim()
      ? [
          {
            name: row[name].trim(),
            quantity: Number(row[quantity]) || 1,
            set: row[set]?.toLowerCase() || undefined,
            collectorNumber: row[collectorNumber] || undefined,
            board: sectionBoard(row[board] ?? '') ?? 'mainboard',
            ...importedFinish(row[finish]),
          },
        ]
      : [],
  )
  return { cards }
}

export function parseDeckImportSource(source: string) {
  if (/^https?:\/\//i.test(source.trim()))
    throw new Error(
      'URL import is unavailable in this client-only app. Paste the exported deck list instead.',
    )
  return parseDeckList(source)
}
