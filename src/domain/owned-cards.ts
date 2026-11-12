import { z } from 'zod'
import { cardNameKey } from './card-model.ts'

/**
 * Owned cards: a list of cards the player owns, imported into this browser only. Ownership is by
 * card name, never by printing, and unrelated to "Sets to build from" (set selection).
 */
export type OwnershipMode = 'ignore' | 'prefer' | 'only'
export const ownershipModes: OwnershipMode[] = ['ignore', 'prefer', 'only']
export const ownershipModeLabels: Record<OwnershipMode, string> = {
  ignore: 'Ignore owned cards',
  prefer: 'Prefer owned cards',
  only: 'Owned cards only',
}
export const isOwnershipMode = (value: unknown): value is OwnershipMode =>
  ownershipModes.includes(value as OwnershipMode)

/** Recommendation source for owned cards that Owned only adds to the pool. */
export const ownedCardReason = 'In your collection'

export type OwnedCard = { name: string; quantity: number }
/** Owned copies keyed by `cardNameKey`, so double-faced cards match by their front face. */
export type OwnedQuantities = Record<string, number>
export type OwnedCardList = { cards: OwnedCard[]; updatedAt: string }
export type SkippedOwnedLine = { line: number; text: string; reason: string }
export type ParsedOwnedCards = {
  format: 'csv' | 'text'
  cards: OwnedCard[]
  skipped: SkippedOwnedLine[]
}

export const ownedCardsStorageKey = 'commander-owned-cards'
const ownedCardListSchema = z.object({
  cards: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().positive() })),
  updatedAt: z.string(),
})

/** The stored list, or null when there is none or storage cannot be read. */
export function readOwnedCardList(storage: () => Pick<Storage, 'getItem'>): OwnedCardList | null {
  try {
    const stored = storage().getItem(ownedCardsStorageKey)
    if (!stored) return null
    const parsed = ownedCardListSchema.safeParse(JSON.parse(stored))
    return parsed.success && parsed.data.cards.length ? parsed.data : null
  } catch {
    return null
  }
}

export function ownedQuantities(list: OwnedCardList | null | undefined): OwnedQuantities {
  const quantities: OwnedQuantities = {}
  for (const { name, quantity } of list?.cards ?? []) {
    const key = cardNameKey(name)
    quantities[key] = (quantities[key] ?? 0) + quantity
  }
  return quantities
}

export const ownedQuantity = (owned: OwnedQuantities | undefined, name: string) =>
  owned?.[cardNameKey(name)] ?? 0
export const isOwned = (owned: OwnedQuantities | undefined, name: string) =>
  ownedQuantity(owned, name) > 0

/** A mode only applies while the player has owned cards; otherwise ownership is ignored. */
export function activeOwnershipMode(
  mode: OwnershipMode | undefined,
  owned: OwnedQuantities | undefined,
): OwnershipMode {
  return mode && mode !== 'ignore' && owned && Object.keys(owned).length ? mode : 'ignore'
}

/** Whether a recommendation may be offered under the ownership mode. Every card is allowed unless Only. */
export function allowedByOwnership(
  card: { name: string },
  owned: OwnedQuantities | undefined,
  mode: OwnershipMode | undefined,
) {
  return activeOwnershipMode(mode, owned) !== 'only' || isOwned(owned, card.name)
}

/** The reusable ownership filter: Only keeps owned cards; Prefer and Ignore keep every card. */
export function filterByOwnership<T extends { name: string }>(
  cards: T[],
  owned: OwnedQuantities | undefined,
  mode: OwnershipMode | undefined,
) {
  return activeOwnershipMode(mode, owned) === 'only'
    ? cards.filter((card) => isOwned(owned, card.name))
    : cards
}

/**
 * Cards the player still needs, in deck order. Each owned copy covers one entry with that name,
 * across printings, so 12 owned Forests leave 3 of 15 Forests needed.
 */
export function stillNeededCards<T extends { name: string }>(
  cards: T[],
  owned: OwnedQuantities | undefined,
  covered: Record<string, number> = {},
): T[] {
  return cards.filter((card) => {
    const key = cardNameKey(card.name)
    const used = covered[key] ?? 0
    if (used < (owned?.[key] ?? 0)) {
      covered[key] = used + 1
      return false
    }
    return true
  })
}

export function describeOwnedCards(list: OwnedCardList | null | undefined) {
  const cards = list?.cards ?? []
  const copies = cards.reduce((total, { quantity }) => total + quantity, 0)
  return `${cards.length.toLocaleString()} ${cards.length === 1 ? 'card' : 'cards'} (${copies.toLocaleString()} ${copies === 1 ? 'copy' : 'copies'})`
}

// Collection CSV headers from common exports. Exact labels only: "Tradelist Count" is not owned.
const nameHeaders = new Set(['name', 'card name', 'card', 'card_name', 'cardname'])
const quantityHeaders = new Set(['quantity', 'count', 'qty', 'amount', 'have'])
const sectionHeadings = new Set([
  'deck',
  'commander',
  'commanders',
  'mainboard',
  'main deck',
  'sideboard',
  'maybeboard',
  'companion',
  'collection',
])

/** RFC 4180 records: quoted fields may hold commas, doubled quotes and line breaks. */
export function readCsvRecords(text: string, delimiter = ','): { line: number; cells: string[] }[] {
  const d = delimiter === '\t' ? '\t' : delimiter
  // One cell and what ends it. A quoted cell must close right before a delimiter or line end;
  // anything else, such as an unclosed quote, reads as plain text.
  const cellPattern = new RegExp(
    `(?:"((?:[^"]|"")*)"(?=${d}|\r|\n|$)|([^${d}\r\n]*))(${d}|\r\n|\r|\n|$)`,
    'y',
  )
  const records: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let line = 1
  let start = 1
  for (;;) {
    const [, quoted, plain, end] = cellPattern.exec(text) ?? []
    cells.push(quoted === undefined ? (plain ?? '') : quoted.replaceAll('""', '"'))
    line += quoted ? quoted.split('\n').length - 1 : 0
    if (end === delimiter) continue
    if (cells.some((value) => value.trim())) records.push({ line: start, cells })
    cells = []
    if (!end) return records
    line++
    start = line
  }
}

const headerLabel = (cell: string) => cell.trim().toLowerCase().replace(/\s+/g, ' ')

function csvHeader(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  for (const delimiter of [',', '\t', ';']) {
    if (!firstLine.includes(delimiter)) continue
    const labels = (readCsvRecords(firstLine, delimiter)[0]?.cells ?? []).map(headerLabel)
    const name = labels.findIndex((label) => nameHeaders.has(label))
    if (name >= 0)
      return {
        delimiter,
        name,
        quantity: labels.findIndex((label) => quantityHeaders.has(label)),
      }
  }
  return null
}

function parseQuantity(value: string | undefined) {
  if (value === undefined || !value.trim()) return 1
  const quantity = Number(value.trim())
  return Number.isSafeInteger(quantity) ? quantity : NaN
}

function parseOwnedCsv(text: string, header: NonNullable<ReturnType<typeof csvHeader>>) {
  const cards: OwnedCard[] = []
  const skipped: SkippedOwnedLine[] = []
  const [, ...rows] = readCsvRecords(text, header.delimiter)
  for (const { line, cells } of rows) {
    const name = cells[header.name]?.trim() ?? ''
    const quantity = header.quantity < 0 ? 1 : parseQuantity(cells[header.quantity])
    const text = cells.join(header.delimiter)
    if (!name) skipped.push({ line, text, reason: 'No card name' })
    else if (!(quantity > 0)) skipped.push({ line, text, reason: 'No owned copies' })
    else cards.push({ name, quantity })
  }
  return { cards, skipped }
}

function parseOwnedText(text: string) {
  const cards: OwnedCard[] = []
  const skipped: SkippedOwnedLine[] = []
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) return
    if (sectionHeadings.has(line.replace(/:$/, '').toLowerCase()) || /^[A-Z ]+:$/.test(line)) return
    // "4 Name", "4x Name", or a bare name; printing and finish suffixes are dropped.
    const match = line.match(
      /^(?:(\d+)\s*x?\s+)?(.+?)(?:\s+\([A-Za-z0-9]+\)(?:\s+\S+)?|\s+\[[A-Za-z0-9]+(?::[^\]]+)?\])?(?:\s+\*[^*]+\*)?$/i,
    )
    const quantity = match?.[1] === undefined ? 1 : Number(match[1])
    const name = match?.[2]?.trim() ?? ''
    if (!name) skipped.push({ line: index + 1, text: line, reason: 'No card name' })
    else if (!(quantity > 0))
      skipped.push({ line: index + 1, text: line, reason: 'No owned copies' })
    else cards.push({ name, quantity })
  })
  return { cards, skipped }
}

/** Add a newly imported list to the owned cards, summing copies of the same card. */
export const combineOwnedCards = (owned: OwnedCard[], added: OwnedCard[]) =>
  mergeOwnedCards([...owned, ...added])

/** Merge repeated names (several printings, binders or finishes) into one owned entry. */
function mergeOwnedCards(cards: OwnedCard[]) {
  const merged = new Map<string, OwnedCard>()
  for (const card of cards) {
    const key = cardNameKey(card.name)
    const existing = merged.get(key)
    if (existing) existing.quantity += card.quantity
    else merged.set(key, { ...card })
  }
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Parse a pasted or uploaded collection: a CSV with a Name column (and optional Quantity or
 * Count), or one card per line such as "4 Lightning Bolt", "1x Sol Ring (C21) 263" or "Forest".
 */
export function parseOwnedCards(source: string): ParsedOwnedCards {
  const text = source.replace(/^﻿/, '')
  const header = csvHeader(text)
  const { cards, skipped } = header ? parseOwnedCsv(text, header) : parseOwnedText(text)
  return { format: header ? 'csv' : 'text', cards: mergeOwnedCards(cards), skipped }
}
