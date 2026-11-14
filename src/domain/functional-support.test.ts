// #379 regression and comparison cases: functional mana support and creature-type support.
// Synthetic cards shaped like the pinned Rabbit/Upgraded recording (docs/evidence/379); names
// stand for card roles, and inclusion figures are illustrative rather than provider data.
import assert from 'node:assert/strict'
import test from 'node:test'

import { toDeckCardFromRecommendation, type Card, type ScryfallCard } from './card-model.ts'
import { buildEdhrecRecommendations } from './recommendation-sources.ts'
import { recommendationScoreBreakdown, roleQuality } from './recommendation-scoring.ts'
import { fallbackPool, recommend, type RecommendState } from './recommender.ts'
import { typalCounts, typalParts, typalScore } from './strategy-packages.ts'
import type { EdhrecEntry, RecommendationStyle } from './recommendation-types.ts'

type Spec = {
  name: string
  type: string
  text: string
  tag: string
  inclusion?: number
  synergy?: number
  cost?: string
  mv?: number
  price?: string
}
const scryfall = ({ name, type, text, cost = '', mv = 2, price = '1.00' }: Spec): ScryfallCard => ({
  name,
  type_line: type,
  oracle_text: text,
  mana_cost: cost,
  cmc: mv,
  color_identity: ['G', 'W'],
  set: 'tst',
  collector_number: name,
  legalities: { commander: 'legal' },
  released_at: '2020-01-01',
  game_changer: false,
  prices: { usd: price },
  ...(/Add \{/.test(text) && { produced_mana: type === 'Land' ? ['G', 'W'] : ['C'] }),
})

const lands: Spec[] = Array.from({ length: 30 }, (_, index) => ({
  name: `Rabbit Land ${index + 1}`,
  type: 'Land',
  text: '{T}: Add {G} or {W}. Rabbits you control get +0/+1 while attacking.',
  tag: 'lands',
  inclusion: 40,
}))
const rabbits: Spec[] = Array.from({ length: 40 }, (_, index) => ({
  name: `Rabbit ${index + 1}`,
  type: 'Creature — Rabbit Warrior',
  text: 'When this creature enters, create a 1/1 white Rabbit creature token.',
  tag: 'highsynergycards',
  inclusion: 30,
  synergy: 0.4,
  cost: '{1}{W}',
}))
const support: Spec[] = [
  // Sol Ring's text has "Add {", which used to route it into the land slot.
  {
    name: 'Sol Ring',
    type: 'Artifact',
    text: '{T}: Add {C}{C}.',
    tag: 'manaartifacts',
    inclusion: 79,
    cost: '{1}',
    mv: 1,
    price: '1.50',
  },
  {
    name: 'Low Rock',
    type: 'Artifact',
    text: '{T}: Add one mana of any color.',
    tag: 'manaartifacts',
    inclusion: 6,
    cost: '{3}',
    mv: 3,
  },
  {
    name: 'Patchwork Banner',
    type: 'Artifact',
    text: 'As Patchwork Banner enters, choose a creature type.\nCreatures you control of the chosen type get +1/+1.\n{T}: Add one mana of any color.',
    tag: 'manaartifacts',
    inclusion: 48,
    synergy: 0.4,
    cost: '{3}',
    mv: 3,
  },
  {
    name: "Herald's Horn",
    type: 'Artifact',
    text: "As Herald's Horn enters, choose a creature type.\nCreature spells you cast of the chosen type cost {1} less to cast.\nAt the beginning of your upkeep, look at the top card of your library. If it's a creature card of the chosen type, you may reveal it and put it into your hand.",
    tag: 'utilityartifacts',
    inclusion: 22,
    synergy: 0.15,
    cost: '{3}',
    mv: 3,
  },
]
const specs = [...lands, ...rabbits, ...support]
const entries: EdhrecEntry[] = specs.map(({ name, tag, inclusion, synergy }) => ({
  name,
  tag,
  header: tag,
  ...(inclusion !== undefined && { inclusion }),
  ...(synergy !== undefined && { synergy }),
}))
const options = {
  includeCreature: true,
  excludeGameChangers: true,
  excludeTutors: true,
  excludeExtraTurns: true,
  excludeUnreleased: true,
  powerTarget: 'upgraded' as const,
}
const pool = buildEdhrecRecommendations(entries, specs.map(scryfall), options)
const commander = toDeckCardFromRecommendation({
  ...pool.find(({ name }) => name === 'Rabbit 1')!,
  name: 'Rabbit Commander',
})

const start = (overrides: Partial<RecommendState> = {}): RecommendState => ({
  commander: 'Rabbit Commander',
  identity: ['G', 'W'],
  pool,
  deck: [commander],
  sideboard: [],
  ignoredCards: [],
  deferredCards: [],
  batchNumber: 1,
  preferenceScores: {},
  theme: 'Rabbits',
  activeSubThemes: [],
  recommendationStyle: 'balanced',
  powerTarget: 'upgraded',
  prioritizeDeckHealth: true,
  includeCreature: true,
  maxPrice: null,
  collectionMode: 'none',
  collectionSets: [],
  ...overrides,
})

/** An ordinary accept-all build: add every offer, then take the next batch. */
function build(state: RecommendState, batches = 20) {
  const offers: Card[][] = []
  for (let batch = 1; batch <= batches; batch++) {
    const result = recommend(state)
    if (!result.batch.length) break
    offers.push(result.batch)
    state = {
      ...state,
      deck: [...state.deck, ...result.batch.map(toDeckCardFromRecommendation)],
      batchNumber: batch + 1,
    }
  }
  return offers
}
const firstOffer = (offers: Card[][], name: string) => {
  const index = offers.findIndex((batch) => batch.some((card) => card.name === name))
  return index < 0 ? null : index + 1
}

test('Rabbit/Upgraded regression: Sol Ring leaves the land slot and is offered early', () => {
  const solRing = pool.find(({ name }) => name === 'Sol Ring')!
  assert.notEqual(solRing.reason, 'Land or mana')
  const offers = build(start())
  // Before #379 it shared the one land slot with 30 lands and was never offered.
  const batch = firstOffer(offers, 'Sol Ring')
  assert.ok(batch !== null && batch <= 6, `Sol Ring first offered in batch ${batch}`)
  assert.ok(firstOffer(offers, 'Patchwork Banner')! <= 6)
  assert.ok(firstOffer(offers, "Herald's Horn") !== null)
  // The mana slot still offers a land in every batch.
  for (const batch of offers)
    assert.ok(batch.some((card) => card.reason === 'Land or mana' && /Land/.test(card.typeLine)))
})

test('while ramp is short, commonly played ramp outranks rarely played ramp', () => {
  const score = (name: string) =>
    recommend(start()).scores.find((entry) => entry.name === name)!.breakdown.deckNeeds
  assert.ok(score('Sol Ring') > score('Low Rock'))
  assert.equal(roleQuality({ inclusion: 79 }), 1)
  assert.ok(roleQuality({ inclusion: 6 }) < roleQuality({ inclusion: 30 }))
  // A generic role-gap or local-index card ranks like 20% inclusion, below a 30% commander card;
  // other cards without commander data, such as the fallback pool, keep full credit.
  assert.ok(roleQuality({ reason: 'Fills a role gap' }) < roleQuality({ inclusion: 30 }))
  assert.equal(roleQuality({ reason: 'Fills a role gap' }), roleQuality({ inclusion: 20 }))
  assert.equal(roleQuality({ reason: 'Local card match', localIndexSnapshot: true }), 0.8)
  assert.equal(roleQuality({ reason: 'Popular inclusion' }), 1)
})

test('inclusion leaves land credit unchanged', () => {
  const land = { reason: 'Land or mana', tags: [], typeLine: 'Land' }
  const context = {
    theme: '',
    activeSubThemes: [],
    pickedTags: new Set<string>(),
    preferenceScores: {},
    neededRoles: new Set<string>(),
    cardRoles: ['lands'],
    roleBoosts: { lands: 10 },
    roleSupply: { lands: 20 },
  }
  const needs = (inclusion: number) =>
    recommendationScoreBreakdown({ ...land, inclusion }, context).deckNeeds
  assert.equal(needs(2), needs(80))
})

const comparison = (style: RecommendationStyle, overrides: Partial<RecommendState> = {}) =>
  build(
    start({ recommendationStyle: style, prioritizeDeckHealth: style !== 'thematic', ...overrides }),
  )

test('comparison: ignores and price caps still exclude the named cards', () => {
  assert.equal(firstOffer(comparison('balanced', { ignoredCards: ['Sol Ring'] }), 'Sol Ring'), null)
  const capped = comparison('balanced', { maxPrice: 1 })
  assert.equal(firstOffer(capped, 'Sol Ring'), null)
  assert.ok(capped.flat().every((card) => Number(card.price ?? 0) <= 1))
})

test('typal parts: members, chosen-type payoffs and type rewards; lands and hosers are neither', () => {
  const card = (typeLine: string, detail: string, tags: string[] = []) => ({
    typeLine,
    detail,
    tags,
  })
  assert.deepEqual(typalParts('Rabbits', card('Creature — Rabbit Warrior', '')), {
    member: true,
    payoff: false,
  })
  assert.deepEqual(typalParts('Rabbits', card('Artifact', '', ['Chosen type'])), {
    member: false,
    payoff: true,
  })
  assert.ok(
    typalParts('Rabbits', card('Creature — Rabbit', 'Other Rabbits you control get +1/+1.')).payoff,
  )
  assert.ok(
    typalParts('Rabbits', card('Enchantment', 'Whenever another Rabbit enters, draw a card.'))
      .payoff,
  )
  assert.ok(
    !typalParts('Rabbits', card('Land', 'Rabbits you control get +1/+0.', ['Chosen type'])).payoff,
  )
  assert.ok(
    !typalParts('Rabbits', card('Instant', 'Create a 1/1 white Rabbit creature token.')).payoff,
  )
  assert.ok(
    typalParts('Rabbits', card('Sorcery', 'Draw a card for each Rabbit you control.')).payoff,
  )
  assert.ok(
    typalParts('Rabbits', card('Creature — Elf', 'Add {G} for each Rabbit on the battlefield.'))
      .payoff,
  )
  assert.ok(
    !typalParts('Rabbits', card('Enchantment', 'Non-Rabbit creatures you control get -1/-1.'))
      .payoff,
  )
  assert.deepEqual(typalParts('Tokens', card('Creature — Rabbit', '')), {
    member: false,
    payoff: false,
  })
})

test('typal score: payoffs score while the deck has fewer than one per three members', () => {
  const member = { typeLine: 'Creature — Rabbit', detail: '', tags: [] }
  const payoff = { typeLine: 'Artifact', detail: '', tags: ['Chosen type'] }
  const deck = Array(9).fill(member)
  assert.deepEqual(typalCounts(deck, ['Rabbits']), [{ theme: 'Rabbits', members: 9, payoffs: 0 }])
  assert.equal(typalScore(payoff, typalCounts(deck, ['Rabbits'])), 6)
  assert.equal(typalScore(payoff, typalCounts([...deck, payoff, payoff, payoff], ['Rabbits'])), 0)
  assert.equal(typalScore(member, typalCounts([member, payoff, payoff], ['Rabbits'])), 2)
  // A deck without a creature-type theme has no typal plan.
  assert.deepEqual(typalCounts(deck, ['Landfall']), [])
})

test('the fallback pool keeps nonland mana sources out of the land slot', () => {
  const [rock, land] = [
    { ...pool.find(({ name }) => name === 'Sol Ring')!, reason: 'Land or mana' },
    pool.find(({ name }) => name === 'Rabbit Land 1')!,
  ]
  const result = fallbackPool([], [rock, land], false, 'seed')
  assert.equal(result.find(({ name }) => name === 'Sol Ring')!.reason, 'Mana support')
  assert.equal(result.find(({ name }) => name === 'Rabbit Land 1')!.reason, 'Land or mana')
})
