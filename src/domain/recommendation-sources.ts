import type { ScryfallCard } from './card-model.ts'
import { hasBackFace } from './card-layout.ts'
import {
  cardText,
  isManaCard,
  isReleased,
  preconFastMana,
  recommendationReasons,
} from './recommendation-scoring.ts'
import { batchRecommendations } from './recommendation-queue.ts'
import { tagsFor } from './recommendation-themes.ts'
import type {
  EdhrecEntry,
  RecommendationCard,
  RecommendationOptions,
} from './recommendation-types.ts'

export function parseEdhrecEntries(
  lists: {
    header: string
    tag: string
    cardviews: { name: string; num_decks?: number; potential_decks?: number }[]
  }[],
) {
  const entries: EdhrecEntry[] = []
  const seen = new Set<string>()
  for (const list of lists)
    for (const card of list.cardviews)
      if (!seen.has(card.name)) {
        seen.add(card.name)
        const { num_decks: decks, potential_decks: potential } = card
        entries.push({
          name: card.name,
          tag: list.tag.toLowerCase(),
          header: list.header,
          ...(decks !== undefined && potential ? { inclusion: (decks / potential) * 100 } : {}),
        })
      }
  return entries
}

export function toRecommendationCard(
  card: ScryfallCard,
  reason: string,
  category = '',
): RecommendationCard {
  return {
    name: card.name,
    layout: card.layout ?? 'normal',
    typeLine: card.type_line,
    colorIdentity: card.color_identity,
    oracleId: card.oracle_id,
    commanderLegality: card.legalities?.commander,
    manaValueKnown: Number.isFinite(card.cmc),
    gameChanger: card.game_changer ?? undefined,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '',
    manaValue: card.cmc ?? 0,
    detail: cardText(card),
    producedMana: card.produced_mana ?? [],
    faces:
      card.card_faces?.map((face) => ({
        typeLine: face.type_line ?? '',
        manaCost: face.mana_cost ?? '',
        detail: face.oracle_text,
      })) ?? [],
    power: card.power ?? card.card_faces?.[0]?.power,
    toughness: card.toughness ?? card.card_faces?.[0]?.toughness,
    reason,
    image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '',
    backImage: hasBackFace(card.layout) ? card.card_faces?.[1]?.image_uris?.normal : undefined,
    set: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    scryfallUri: card.scryfall_uri,
    printsUri: card.prints_search_uri,
    price: card.prices?.usd ?? undefined,
    priceUri: card.purchase_uris?.tcgplayer,
    finish: card.finishes?.includes('nonfoil') ? 'nonfoil' : card.finishes?.[0],
    tags: tagsFor(`${card.type_line}\n${cardText(card)}\n${category}`, card.type_line),
  }
}

export function buildEdhrecRecommendations(
  entries: EdhrecEntry[],
  responseCards: ScryfallCard[],
  options: RecommendationOptions,
) {
  const cards = new Map(responseCards.map((card) => [card.name, card]))
  const allowed = entries.filter((entry) => {
    const card = cards.get(entry.name)
    const text = card ? cardText(card) : ''
    return (
      card &&
      card.legalities?.commander === 'legal' &&
      !(
        options.excludeGameChangers &&
        (entry.tag === 'gamechangers' || card.game_changer !== false)
      ) &&
      !(options.excludeTutors && /search your library/i.test(text)) &&
      !(options.excludeExtraTurns && /extra turn/i.test(text)) &&
      !(options.excludeUnreleased && !isReleased(card)) &&
      !(options.powerTarget === 'precon' && preconFastMana.has(card.name))
    )
  })
  return batchRecommendations(
    allowed.map((entry) => {
      const card = cards.get(entry.name)!
      return {
        ...toRecommendationCard(
          card,
          isManaCard(card)
            ? 'Land or mana'
            : (recommendationReasons[entry.tag] ?? entry.header.replace(/ Cards$/, '')),
          `${entry.tag} ${entry.header}`,
        ),
        source: 'edhrec' as const,
        ...(entry.inclusion !== undefined ? { inclusion: entry.inclusion } : {}),
      }
    }),
    options.includeCreature,
  )
}
