import type { ScryfallCard } from './card-model.ts'

/** Provider fallback for layouts whose type lines live only on their faces. */
export const scryfallTypeLine = (card: Pick<ScryfallCard, 'card_faces'> & { type_line?: string }) =>
  card.type_line ??
  [...new Set(card.card_faces?.map((face) => face.type_line).filter(Boolean))].join(' // ')
