import { cardText } from './recommendation-scoring.ts'
import { tagsFor } from './recommendation-themes.ts'
import { toRecommendationCard } from './recommendation-sources.ts'
import type { RecommendationCard, RecommendationSource } from './recommendation-types.ts'

export type CardFinish = 'nonfoil' | 'foil' | 'etched'

export type Printing = {
  image: string
  art?: string
  set: string
  setName?: string
  collectorNumber: string
  scryfallUri?: string
  price?: string
  priceUri?: string
  finish?: CardFinish
}

export type PrintingLike = Pick<Printing, 'image' | 'set' | 'collectorNumber' | 'finish'>

export type ScryfallCardFace = {
  type_line?: string
  mana_cost?: string
  oracle_text?: string
  power?: string
  toughness?: string
  image_uris?: { normal: string; art_crop?: string }
}

export type ScryfallCard = {
  name: string
  layout?: string
  type_line: string
  mana_cost?: string
  cmc?: number
  oracle_text?: string
  power?: string
  toughness?: string
  produced_mana?: string[]
  color_identity: string[]
  set: string
  set_name?: string
  collector_number: string
  scryfall_uri?: string
  prints_search_uri: string
  purchase_uris?: { tcgplayer?: string; cardmarket?: string; cardhoarder?: string }
  finishes?: CardFinish[]
  released_at?: string
  game_changer?: boolean
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null }
  image_uris?: { normal: string; art_crop?: string }
  card_faces?: ScryfallCardFace[]
}

export type CommanderCard = ScryfallCard & {
  related_uris?: { edhrec?: string }
}

export type ScryfallSet = {
  code: string
  name: string
  set_type?: string
  released_at?: string
  card_count?: number
}

export type Card = RecommendationCard & {
  printings?: Printing[]
  printing?: number
  printingManuallySelected?: boolean
}

export type DeckCard = Omit<RecommendationCard, 'reason' | 'source' | 'printsUri'> & {
  printsUri?: string
  printings?: Printing[]
  printing?: number
  printingManuallySelected?: boolean
  source?: RecommendationSource
}

export type DeckCardLocation = { board: 'deck' | 'sideboard'; index: number }

export type CommanderDetails = {
  images: string[]
  art: string[]
  colours: string[]
  printings: Printing[][]
  selections: number[]
}

export type ExportFormat = 'moxfield' | 'plain' | 'csv'

export const scryfallImage = (card: ScryfallCard) =>
  card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? ''

export const cardTags = (card: ScryfallCard, category = '') =>
  tagsFor(`${card.type_line}\n${cardText(card)}\n${category}`, card.type_line)

export const toCard = (card: ScryfallCard, reason: string, category = ''): Card => ({
  ...toRecommendationCard(card, reason, category),
  source: 'scryfall',
})

export const toDeckCardFromRecommendation = (card: Card): DeckCard => ({
  name: card.name,
  layout: card.layout,
  typeLine: card.typeLine,
  manaCost: card.manaCost,
  manaValue: card.manaValue,
  detail: card.detail,
  producedMana: card.producedMana,
  faces: card.faces,
  power: card.power,
  toughness: card.toughness,
  set: card.set,
  setName: card.setName,
  collectorNumber: card.collectorNumber,
  scryfallUri: card.scryfallUri,
  printsUri: card.printsUri,
  image: card.image,
  price: card.price,
  priceUri: card.priceUri,
  tags: card.tags,
  printings: card.printings,
  printing: card.printing ?? 0,
  printingManuallySelected: card.printingManuallySelected,
  finish: card.finish,
})

export const toDeckCard = (card: ScryfallCard): DeckCard => ({
  name: card.name,
  layout: card.layout ?? 'normal',
  typeLine: card.type_line,
  manaCost: card.mana_cost ?? '',
  manaValue: card.cmc ?? 0,
  detail: cardText(card),
  producedMana: card.produced_mana ?? [],
  faces:
    card.card_faces?.map((face) => ({
      typeLine: face.type_line ?? '',
      manaCost: face.mana_cost ?? '',
    })) ?? [],
  power: card.power ?? card.card_faces?.[0]?.power,
  toughness: card.toughness ?? card.card_faces?.[0]?.toughness,
  set: card.set,
  setName: card.set_name,
  collectorNumber: card.collector_number,
  scryfallUri: card.scryfall_uri,
  printsUri: card.prints_search_uri,
  image: scryfallImage(card),
  price: card.prices?.usd ?? undefined,
  priceUri: card.purchase_uris?.tcgplayer,
  tags: cardTags(card),
  printing: 0,
})

export const cardTypeLine = (card: Pick<DeckCard, 'typeLine' | 'power' | 'toughness'>) =>
  card.power && card.toughness ? `${card.power}/${card.toughness} ${card.typeLine}` : card.typeLine

export const cardScryfallUri = (card: Pick<DeckCard, 'scryfallUri' | 'set' | 'collectorNumber'>) =>
  card.scryfallUri ??
  `https://scryfall.com/card/${card.set}/${encodeURIComponent(card.collectorNumber)}`

export const cardPrintingsUri = (card: Pick<Card, 'name'>) =>
  `https://scryfall.com/search?q=${encodeURIComponent(`!"${card.name}"`)}&unique=prints`

export const edhrecSlug = (url: string | undefined, name: string) =>
  url?.match(/\/commanders\/([^/?#]+)/)?.[1] ??
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
