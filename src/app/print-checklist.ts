import { commanderNames, deckSections } from '../domain/commander-catalog.ts'
import type { DeckCard } from '../domain/card-model.ts'
import { stillNeededCards, type OwnedQuantities } from '../domain/owned-cards.ts'
import { displayDeckSection } from '../deck-analysis.ts'

export type PrintingGroup = { card: DeckCard; quantity: number }
export type ChecklistGroup = { section: string; count: number; lines: PrintingGroup[] }

/** Identical printings (name, set, collector number and finish) as one line, in first-seen order. */
export function printingGroups(cards: DeckCard[]): PrintingGroup[] {
  const grouped = new Map<string, PrintingGroup>()
  for (const card of cards) {
    const key = JSON.stringify([card.name, card.set, card.collectorNumber, card.finish])
    const existing = grouped.get(key)
    if (existing) existing.quantity++
    else grouped.set(key, { card, quantity: 1 })
  }
  return [...grouped.values()]
}

/**
 * The printable card-gathering checklist (#547): the deck board's type groups, then the
 * sideboard, one line per printing sorted by name. Still needed lists the main-deck cards,
 * commanders included, that owned cards do not cover, as the Still needed export does.
 */
export function checklistGroups({
  commander,
  deck,
  sideboard,
  ownedCards,
  neededOnly,
}: {
  commander: string
  deck: DeckCard[]
  sideboard: DeckCard[]
  ownedCards: OwnedQuantities
  neededOnly: boolean
}): ChecklistGroup[] {
  const commanderCount = commanderNames(commander).length
  const covered = {}
  const unowned = (cards: DeckCard[]) =>
    neededOnly ? stillNeededCards(cards, ownedCards, covered) : cards
  const sections = new Map<string, DeckCard[]>()
  const place = (section: string, cards: DeckCard[]) =>
    sections.set(section, [...(sections.get(section) ?? []), ...cards])
  place('Commander', unowned(deck.slice(0, commanderCount)))
  for (const card of unowned(deck.slice(commanderCount))) place(displayDeckSection(card), [card])
  if (!neededOnly) place('Sideboard', sideboard)
  return [...deckSections, 'Sideboard']
    .map((section) => {
      const cards = sections.get(section) ?? []
      const lines = printingGroups(cards).sort(
        (left, right) =>
          left.card.name.localeCompare(right.card.name) ||
          left.card.set.localeCompare(right.card.set) ||
          left.card.collectorNumber.localeCompare(right.card.collectorNumber, undefined, {
            numeric: true,
          }),
      )
      return { section, count: cards.length, lines }
    })
    .filter(({ count }) => count > 0)
}
