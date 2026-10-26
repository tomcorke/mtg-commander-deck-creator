import type { ScryfallCard } from './card-model.ts'
import { hasBackFace } from './card-layout.ts'
import { defaultFinish, foilTypeFor } from './printing.ts'
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

// Strongest EDHREC list first, so a card in several lists keeps the same reason whatever their order.
const listStrength = (tag: string) =>
  ['highsynergycards', 'highliftcards', 'topcards'].includes(tag)
    ? 3 - ['highsynergycards', 'highliftcards', 'topcards'].indexOf(tag)
    : ['lands', 'utilitylands', 'manafixing'].includes(tag)
      ? -1
      : 0
const strongerList = (left: string, right: string) =>
  listStrength(left) - listStrength(right) || (left < right ? 1 : left > right ? -1 : 0)

/** One entry per card, merged across every list it appears in. */
export function parseEdhrecEntries(
  lists: {
    header: string
    tag: string
    cardviews: { name: string; num_decks?: number; potential_decks?: number; synergy?: number }[]
  }[],
) {
  const entries = new Map<string, EdhrecEntry>()
  for (const list of lists)
    for (const card of list.cardviews) {
      const tag = list.tag.toLowerCase()
      const { num_decks: decks, potential_decks: potential, synergy } = card
      const inclusion = decks !== undefined && potential ? (decks / potential) * 100 : undefined
      const previous = entries.get(card.name)
      const keepPrevious = previous && strongerList(previous.tag, tag) >= 0
      const best = (left?: number, right?: number) =>
        left === undefined ? right : right === undefined ? left : Math.max(left, right)
      const merged = {
        name: card.name,
        tag: keepPrevious ? previous.tag : tag,
        header: keepPrevious ? previous.header : list.header,
        inclusion: best(previous?.inclusion, inclusion),
        synergy: best(previous?.synergy, synergy),
      }
      entries.set(
        card.name,
        Object.fromEntries(
          Object.entries(merged).filter(([, value]) => value !== undefined),
        ) as EdhrecEntry,
      )
    }
  return [...entries.values()]
}

export function toRecommendationCard(card: ScryfallCard, reason: string): RecommendationCard {
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
    finish: defaultFinish(card.finishes),
    foilType: foilTypeFor(card, defaultFinish(card.finishes)),
    // Tags come only from gameplay text, never from the query or list that found the card.
    tags: tagsFor(`${card.type_line}\n${cardText(card)}`, card.type_line),
  }
}

// Preference heuristics, not Tagger equivalence or bracket validation. Keep remote queries broader
// so EDHREC, Scryfall, signature results and Doctor all use this same local policy.
const searchesForNonland = (text: string) =>
  [...text.matchAll(/search your library for ([^.,\n]+)/gi)].some(
    ([, object]) =>
      !/\b(?:lands?|Plains|Island|Swamp|Mountain|Forest) cards?\b/i.test(object) ||
      /\b(?:nonland|artifact|creature|enchantment|instant|sorcery)\b/i.test(object),
  )
const grantsExtraTurn = (text: string) =>
  text
    .split(/[.\n]/)
    .some(
      (effect) =>
        !/can't|cannot|can’t|skip|instead/i.test(effect) &&
        /\b(?:takes?|gets?) (?:an?|one|two|three|\d+|x) extra turns?\b/i.test(effect),
    )

/** Scryfall release filter: a fixed date when supplied, otherwise the provider's own today. */
export const releasedBy = (today?: string) => `date<=${today ?? 'today'}`

/** Shared recommendation eligibility, independent of the source that returned the card. */
export function excludedByOptions(
  card: ScryfallCard,
  options: Omit<RecommendationOptions, 'includeCreature' | 'maxPrice'>,
) {
  const text = cardText(card)
  return (
    card.legalities?.commander !== 'legal' ||
    (options.excludeGameChangers && card.game_changer !== false) ||
    (options.excludeTutors && searchesForNonland(text)) ||
    (options.excludeExtraTurns && grantsExtraTurn(text)) ||
    (options.excludeUnreleased && (!card.released_at || !isReleased(card, options.today))) ||
    (options.powerTarget === 'precon' && preconFastMana.has(card.name))
  )
}

export function buildEdhrecRecommendations(
  entries: EdhrecEntry[],
  responseCards: ScryfallCard[],
  options: RecommendationOptions,
) {
  const cards = new Map(responseCards.map((card) => [card.name, card]))
  const allowed = entries.filter((entry) => {
    const card = cards.get(entry.name)
    return (
      card &&
      !(options.excludeGameChangers && entry.tag === 'gamechangers') &&
      !excludedByOptions(card, options)
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
        ),
        source: 'edhrec' as const,
        ...(entry.inclusion !== undefined ? { inclusion: entry.inclusion } : {}),
        ...(entry.synergy !== undefined ? { synergy: entry.synergy } : {}),
      }
    }),
    options.includeCreature,
  )
}
