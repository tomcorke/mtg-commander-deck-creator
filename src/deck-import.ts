export type ImportBoard = 'commander' | 'mainboard' | 'sideboard'
export type ImportedCard = { name: string; quantity: number; set?: string; collectorNumber?: string; board: ImportBoard }
export type ImportedDeck = { name?: string; cards: ImportedCard[] }
type MissingIdentifier = { name?: string; set?: string; collector_number?: string }

export function missingCardNames(missing: MissingIdentifier[], cards: ImportedCard[]) {
  return missing.map((identifier) => identifier.name ?? cards.find((card) => card.set === identifier.set && card.collectorNumber === identifier.collector_number)?.name ?? `${identifier.set?.toUpperCase() ?? 'Unknown set'} ${identifier.collector_number ?? ''}`.trim())
}

const sectionBoard = (line: string): ImportBoard | null => {
  const section = line.trim().replace(/:$/, '').toLowerCase()
  if (section === 'commander' || section === 'commanders') return 'commander'
  if (section === 'sideboard' || section === 'maybeboard') return 'sideboard'
  if (section === 'deck' || section === 'mainboard' || section === 'main deck') return 'mainboard'
  return null
}

export function parseDeckList(text: string): ImportedDeck {
  let board: ImportBoard = 'mainboard'
  const cards: ImportedCard[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) continue
    const section = sectionBoard(line)
    if (section) { board = section; continue }
    const match = line.match(/^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)\s+([^\s]+)|\s+\[([A-Za-z0-9]+):([^\]]+)\])?(?:\s+\*[^*]+\*)?$/)
    if (!match) continue
    cards.push({ name: match[2].trim(), quantity: Number(match[1]), set: (match[3] ?? match[5])?.toLowerCase(), collectorNumber: (match[4] ?? match[6])?.trim(), board })
  }
  return { cards }
}

