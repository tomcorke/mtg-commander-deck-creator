import assert from 'node:assert/strict'
import test from 'node:test'
import { toCard, toDeckCard, type Card, type ScryfallCard } from './card-model.ts'
import { themeFavouriteHolds } from './favourite-holds.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import { rankRecommendationCards } from './recommendation-queue.ts'
import type { RecommendationStyle } from './recommendation-types.ts'
import { recommend, type RecommendState } from './recommender.ts'
import { favouriteHoldSentences } from '../features/builder/favourite-hold-copy.ts'
import { rolesForCard } from '../deck-analysis.ts'

const tokens = 'When this enters, create two 1/1 green Elf creature tokens.'
const record = (name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  oracle_id: `oracle-${name}`,
  type_line: 'Creature — Elf',
  color_identity: ['G'],
  cmc: 2,
  mana_cost: '{1}{G}',
  set: 'tst',
  collector_number: '1',
  oracle_text: tokens,
  game_changer: false,
  legalities: { commander: 'legal' },
  prices: { usd: '1.00' },
  ...overrides,
})
const favourite = (name: string, inclusion: number, overrides: Partial<ScryfallCard> = {}) =>
  ({
    ...toCard(record(name, overrides), 'Commander favourite'),
    source: 'edhrec',
    inclusion,
  }) as Card
const seven = { cmc: 7, mana_cost: '{5}{G}{G}' }
const offers = Array.from({ length: 6 }, (_, index) =>
  toCard(record(`Offer ${index}`), 'Commander synergy'),
)
const big = favourite('Big favourite', 62, seven)
const pricey = favourite('Pricey favourite', 55, {
  type_line: 'Enchantment',
  prices: { usd: '30.00' },
})
const offTheme = favourite('Off-theme favourite', 70, { ...seven, oracle_text: 'Trample' })
const minority = favourite('Minority favourite', 40, seven)
const cheapBig = favourite('Cheap favourite', 58, { prices: { usd: '12.00' } })
const commander = toDeckCard(record('Commander', { type_line: 'Legendary Creature — Elf' }))
const basic = toDeckCard(
  record('Forest', {
    type_line: 'Basic Land — Forest',
    cmc: 0,
    mana_cost: '',
    oracle_text: '',
    produced_mana: ['G'],
  }),
)
const deck = [commander, ...Array.from({ length: 10 }, () => basic)]

const holdsFor = (
  style: RecommendationStyle,
  queue: Card[],
  settings: { deckBudget?: number | null; maxPrice?: number | null } = {},
  priceCapped: Card[] = [],
) => {
  const context = buildRecommendationContext(
    { theme: 'Tokens', recommendationStyle: style, deck, ...settings },
    queue,
  )
  return themeFavouriteHolds({
    queue,
    shown: queue.slice(0, 4),
    priceCapped,
    inDeck: new Set(deck.map(({ name }) => name)),
    context,
    cardRoles: rolesForCard,
    limit: Infinity,
  })
}

test('Theme first and Balanced name the gate holding each strong theme favourite (#632)', () => {
  const queue = [...offers, minority, offTheme, pricey, big]
  for (const style of ['thematic', 'balanced'] as const) {
    const holds = holdsFor(style, queue, { deckBudget: 20 })
    // Strongest inclusion first; off-theme and minority favourites are never explained.
    assert.deepEqual(
      holds.map(({ card, reasons }) => [card.name, reasons]),
      [
        ['Big favourite', ['mana-support']],
        ['Pricey favourite', ['deck-budget']],
      ],
      style,
    )
    assert.deepEqual(holds[0].manaFit, { penalty: -8, cause: 'sources' })
  }
  // Power first and Fun have no favourite reservation to explain.
  for (const style of ['competitive', 'fun'] as const)
    assert.deepEqual(holdsFor(style, queue, { deckBudget: 20 }), [])
})

test('Favourites on screen, in the deck, or passing every gate are not on hold', () => {
  // On screen: the visible batch already offers it.
  assert.deepEqual(holdsFor('thematic', [big, ...offers]), [])
  // Within budget and castable: nothing holds it back.
  assert.deepEqual(holdsFor('thematic', [...offers, cheapBig], { deckBudget: 100 }), [])
  const context = buildRecommendationContext({ theme: 'Tokens', deck }, [])
  assert.deepEqual(
    themeFavouriteHolds({
      queue: [...offers, big],
      shown: [],
      inDeck: new Set(['Big favourite']),
      context,
    }),
    [],
  )
})

test('A creature waiting for mana support is the one ranking keeps out of early batches', () => {
  const queue = [...offers, big]
  const context = buildRecommendationContext({ theme: 'Tokens', deck }, queue)
  const ranked = rankRecommendationCards(queue, context, true, rolesForCard)
  assert.ok(ranked.indexOf(big) >= 4, 'held past the first batch')
  assert.equal(holdsFor('balanced', ranked)[0].card, big)
})

test('Price-capped favourites the other filters allow are on hold; recommend reports them', () => {
  const pool = [...offers, pricey, offTheme, favourite('Capped favourite', 66, seven)].map(
    (card) => ({ ...card, price: card.name === 'Capped favourite' ? '9.00' : card.price }),
  )
  const input: RecommendState = {
    commander: 'Commander',
    identity: ['G'],
    pool,
    deck,
    sideboard: [],
    ignoredCards: [],
    deferredCards: [],
    batchNumber: 1,
    preferenceScores: {},
    theme: 'Tokens',
    activeSubThemes: [],
    recommendationStyle: 'thematic',
    prioritizeDeckHealth: false,
    includeCreature: true,
    maxPrice: 5,
    collectionMode: 'none',
    collectionSets: [],
  }
  const result = recommend(input)
  // Off-theme cards over the cap are not theme favourites, so they are not carried.
  assert.deepEqual(
    result.priceCappedFavourites.map(({ name }) => name),
    ['Pricey favourite', 'Capped favourite'],
  )
  const holds = holdsFor('thematic', result.queue, { maxPrice: 5 }, result.priceCappedFavourites)
  assert.deepEqual(
    holds.map(({ card, reasons }) => [card.name, reasons]),
    [
      ['Capped favourite', ['price-cap']],
      ['Pricey favourite', ['price-cap']],
    ],
  )
  // Set filters still apply: a capped card outside Only-mode sets is not explained by price.
  const context = buildRecommendationContext(
    {
      theme: 'Tokens',
      deck,
      maxPrice: 5,
      collectionMode: 'only',
      collectionSets: ['other'],
    },
    [],
  )
  assert.deepEqual(
    themeFavouriteHolds({
      queue: [],
      shown: [],
      priceCapped: result.priceCappedFavourites,
      inDeck: new Set(),
      context,
    }),
    [],
  )
})

test('Hold sentences quote the gate evidence and never judge the card', () => {
  const facts = {
    manaSupport: {
      landCount: 10,
      rampCount: 0,
      landTarget: 35,
      rampTarget: 10,
      averageManaValue: 0,
      producedMana: { G: 10 },
    },
    remainingBudget: 9,
    maxPrice: 5,
  }
  const sentences = favouriteHoldSentences(
    { card: big, reasons: ['mana-support'], manaFit: { penalty: -8, cause: 'sources' } },
    facts,
  )
  assert.deepEqual(sentences, [
    'Mana-fit penalty -8 / 10: mana value 7 against 10 of 45 land and ramp sources so far. Creatures this far behind stay out of early batches.',
  ])
  assert.match(
    favouriteHoldSentences(
      { card: big, reasons: ['mana-support'], manaFit: { penalty: -6, cause: 'colours' } },
      facts,
    )[0],
    /the deck has few sources of its colours so far/,
  )
  assert.deepEqual(favouriteHoldSentences({ card: pricey, reasons: ['deck-budget'] }, facts), [
    '$30.00 is more than the $9.00 left in your deck budget, so it queues after cards that fit.',
  ])
  assert.deepEqual(
    favouriteHoldSentences(
      { card: pricey, reasons: ['deck-budget'] },
      { ...facts, remainingBudget: -2 },
    ),
    ['Your deck budget is spent, so its $30.00 queues after cards that fit.'],
  )
  assert.deepEqual(favouriteHoldSentences({ card: pricey, reasons: ['price-cap'] }, facts), [
    '$30.00 is above your $5.00 price limit, so recommendations leave it out.',
  ])
  for (const reason of ['mana-support', 'deck-budget', 'price-cap'] as const)
    for (const sentence of favouriteHoldSentences({ card: big, reasons: [reason] }, facts))
      assert.doesNotMatch(sentence, /\b(best|strong|good|great|proven|quality)\b/i)
})
