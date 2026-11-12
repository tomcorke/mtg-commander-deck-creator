import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBuilderAction,
  createBuilderState,
  type BuilderAction,
  type BuilderState,
} from './builder-state.ts'
import { builderPoolKey } from './builder-settings.ts'
import { toCard, toDeckCard, type Card, type ScryfallCard } from './card-model.ts'
import { cardConstructionError } from './commander-construction.ts'
import { analyseDeck, rolesForCard } from '../deck-analysis.ts'
import { bulkAddStatus, bulkAddedNames, startingDeckSummary } from './bulk-add.ts'
import { deckPriceTotal } from './deck-price.ts'

const scryfall = (name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  oracle_id: `oracle-${name}`,
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
  mana_cost: '{2}',
  set: 'tst',
  collector_number: '1',
  oracle_text: '',
  game_changer: false,
  legalities: { commander: 'legal' },
  prices: { usd: '1.00' },
  ...overrides,
})
const card = (name: string, overrides: Partial<ScryfallCard> = {}): Card =>
  toCard(scryfall(name, overrides), 'Commander synergy')
const ramp = (name: string) => card(name, { oracle_text: '{T}: Add {G}.', produced_mana: ['G'] })
const draw = (name: string) => card(name, { type_line: 'Sorcery', oracle_text: 'Draw two cards.' })
const land = (name: string) =>
  card(name, {
    type_line: 'Land',
    cmc: 0,
    mana_cost: '',
    oracle_text: '{T}: Add {G}.',
    produced_mana: ['G'],
  })
const forest = toDeckCard(
  scryfall('Forest', {
    type_line: 'Basic Land — Forest',
    cmc: 0,
    mana_cost: '',
    oracle_text: '({T}: Add {G}.)',
    produced_mana: ['G'],
    prices: { usd: '0.20' },
  }),
)
const commander = toDeckCard(
  scryfall('Leader', {
    type_line: 'Legendary Creature — Elf',
    color_identity: ['G'],
    mana_cost: '{2}{G}',
    cmc: 3,
  }),
)

function builder(overrides: Partial<BuilderState> = {}): BuilderState {
  const state: BuilderState = {
    ...createBuilderState('2026-11-12', 'build-492'),
    commander: 'Leader',
    commanderDetails: { images: [], art: [], colours: ['G'], printings: [], selections: [] },
    deck: [commander],
    ...overrides,
  }
  return { ...state, committedPoolKey: builderPoolKey(state) }
}
const apply = (state: BuilderState, action: BuilderAction) => applyBuilderAction(state, action)
const names = (cards: { name: string }[]) => cards.map(({ name }) => name)

test('Add all adds every undecided batch card and one undo restores the batch', () => {
  const queue = [card('Alpha'), card('Beta'), card('Gamma'), card('Delta'), card('Epsilon')]
  const later = apply(builder({ queue }), {
    type: 'decide',
    card: queue[1],
    decision: 'later',
  }).state
  const result = apply(later, { type: 'addBatch' })
  assert.equal(result.error, undefined)
  assert.deepEqual(names(result.state.deck), ['Leader', 'Alpha', 'Gamma', 'Delta'])
  assert.equal(result.state.decisions.Beta, 'later')
  assert.match(result.notice ?? '', /Added 3 cards/)
  const undone = apply(result.state, { type: 'undoBulkAdd' }).state
  assert.deepEqual(undone.deck, later.deck)
  assert.deepEqual(undone.decisions, later.decisions)
  assert.equal(undone.queue, later.queue)
  assert.equal(undone.bulkAdd, null)
})

test('Add all skips cards that break construction rules and says why', () => {
  const offColour = card('Bolt', { color_identity: ['R'] })
  const result = apply(builder({ queue: [card('Alpha'), offColour] }), { type: 'addBatch' })
  assert.deepEqual(names(result.state.deck), ['Leader', 'Alpha'])
  assert.match(result.notice ?? '', /Skipped Bolt: Card is outside/)
  assert.deepEqual(result.state.bulkAdd?.added, { Alpha: 1 })
})

test('undo after the batch advanced removes the cards and offers them again', () => {
  const queue = Array.from({ length: 8 }, (_, index) => card(`Card ${index}`))
  const added = apply(builder({ queue }), { type: 'addBatch' }).state
  const advanced = apply(added, { type: 'nextBatch' }).state
  assert.equal(advanced.queue.length, 4)
  const undone = apply(advanced, { type: 'undoBulkAdd' }).state
  assert.deepEqual(names(undone.deck), ['Leader'])
  assert.equal(undone.queue.length, 8)
  assert.ok(names(undone.queue).includes('Card 0'))
})

function draftPool() {
  return [
    ...Array.from({ length: 12 }, (_, index) => ramp(`Rock ${index}`)),
    ...Array.from({ length: 12 }, (_, index) => draw(`Draw ${index}`)),
    ...Array.from({ length: 80 }, (_, index) => card(`Spell ${index}`)),
    ...Array.from({ length: 4 }, (_, index) => land(`Grove ${index}`)),
  ]
}

test('a starting deck fills role targets, then slots, then lands, to exactly 100 legal cards', () => {
  // Rank the role cards last, so only the role pass can reach them early.
  const pool = draftPool()
  const queue = [...pool.slice(24), ...pool.slice(0, 24)]
  const state = builder({ queue, deck: [commander, toDeckCard(scryfall('Sol Ring'))] })
  const result = apply(state, { type: 'buildStartingDeck', basics: [forest] })
  assert.equal(result.error, undefined)
  const { deck } = result.state
  assert.equal(deck.length, 100)
  deck.forEach((item, index) =>
    assert.equal(cardConstructionError(item, deck.slice(0, index), ['G']), '', item.name),
  )
  const counts = analyseDeck(deck).counts
  assert.equal(counts.lands, state.deckTargets.lands)
  assert.ok(counts.ramp >= state.deckTargets.ramp)
  assert.ok(counts.draw >= state.deckTargets.draw)
  assert.equal(result.state.bulkAdd?.extraBasics, 0)
  assert.match(result.notice ?? '', /added 98 cards/)
  // Drafted cards leave the queue and are marked for Deck review.
  assert.ok(
    !result.state.queue.some(({ name }) =>
      bulkAddedNames(result.state.bulkAdd, result.state).has(name),
    ),
  )
  assert.ok(bulkAddedNames(result.state.bulkAdd, result.state).has('Forest'))
  assert.ok(!bulkAddedNames(result.state.bulkAdd, result.state).has('Sol Ring'))

  const undone = apply(result.state, { type: 'undoBulkAdd' }).state
  assert.deepEqual(undone.deck, state.deck)
  assert.equal(undone.queue, state.queue)
  assert.equal(undone.bulkAdd, null)
})

test('a starting deck respects price, budget, Game Changer, ignore and Later choices', () => {
  const pool = draftPool()
  const pricey = card('Pricey', { prices: { usd: '30.00' } })
  const changer = card('Changer', { game_changer: true })
  const ignored = card('Ignored')
  const later = card('Later Card')
  const state = builder({
    queue: [pricey, changer, ignored, later, ...pool],
    ignoredCards: ['Ignored'],
    decisions: { 'Later Card': 'later' },
    maxPrice: 20,
  })
  const deck = apply(state, { type: 'buildStartingDeck', basics: [forest] }).state.deck
  for (const name of ['Pricey', 'Changer', 'Ignored', 'Later Card'])
    assert.ok(!names(deck).includes(name), name)

  const budget = builder({
    queue: [card('Costly', { prices: { usd: '45.00' } }), ...pool],
    deckBudget: 60,
  })
  const budgeted = apply(budget, { type: 'buildStartingDeck', basics: [forest] })
  assert.equal(budgeted.state.deck.length, 100)
  assert.ok(!names(budgeted.state.deck).includes('Costly'))
  // Spending stops at the budget; basics fill the rest.
  assert.ok(deckPriceTotal(budgeted.state.deck).total <= 60)
  assert.ok((budgeted.state.bulkAdd?.extraBasics ?? 0) > 0)
})

test('basics fill the gap when candidates run out, and the shortfall is reported', () => {
  const state = builder({ queue: [ramp('Rock'), draw('Draw')] })
  const result = apply(state, { type: 'buildStartingDeck', basics: [forest] })
  assert.equal(result.state.deck.length, 100)
  assert.equal(result.state.bulkAdd?.extraBasics, 97 - state.deckTargets.lands)
  assert.match(result.notice ?? '', /extra basic lands/)
  assert.ok(result.state.deck.slice(1).every((item) => rolesForCard(item).length))
})

test('a starting deck waits for committed settings and a deck under 100', () => {
  const pending = { ...builder({ queue: draftPool() }), recommendationOptionsChanged: true }
  const refused = apply(pending, { type: 'buildStartingDeck', basics: [forest] })
  assert.match(refused.error ?? '', /apply your new settings/)
  assert.equal(refused.state, pending)
  const missingBasic = apply(builder({ queue: [] }), { type: 'buildStartingDeck', basics: [] })
  assert.match(missingBasic.error ?? '', /Forest is unavailable/)
})

test('a new commander or start over clears the undo record', () => {
  const added = apply(builder({ queue: [card('Alpha')] }), { type: 'addBatch' }).state
  assert.ok(added.bulkAdd)
  const reset = apply(added, { type: 'startOver', today: '2026-11-12', signatureDeckKey: 'x' })
  assert.equal(reset.state.bulkAdd, null)
})

test('basics split by colour demand even when spells already make one colour', () => {
  const swamp = toDeckCard(
    scryfall('Swamp', {
      type_line: 'Basic Land — Swamp',
      cmc: 0,
      mana_cost: '',
      oracle_text: '({T}: Add {B}.)',
      produced_mana: ['B'],
      prices: { usd: '0.20' },
    }),
  )
  const golgari = { images: [], art: [], colours: ['B', 'G'], printings: [], selections: [] }
  const dorks = Array.from({ length: 20 }, (_, index) =>
    card(`Dork ${index}`, {
      type_line: 'Creature — Elf',
      color_identity: ['G'],
      mana_cost: '{G}',
      cmc: 1,
      oracle_text: '{T}: Add {G}.',
      produced_mana: ['G'],
    }),
  )
  const blackSpells = Array.from({ length: 60 }, (_, index) =>
    card(`Black ${index}`, { color_identity: ['B'], mana_cost: '{1}{B}', type_line: 'Sorcery' }),
  )
  const state = builder({ commanderDetails: golgari, queue: [...dorks, ...blackSpells] })
  const deck = apply(state, { type: 'buildStartingDeck', basics: [forest, swamp] }).state.deck
  assert.equal(deck.length, 100)
  assert.ok(deck.filter(({ name }) => name === 'Forest').length >= 5)
  assert.ok(deck.filter(({ name }) => name === 'Swamp').length >= 5)
})

test('Deck review summary lists drafted spells and only the basics the draft added', () => {
  const state = builder({ queue: draftPool(), deck: [commander, forest, forest] })
  const built = apply(state, { type: 'buildStartingDeck', basics: [forest] }).state
  const summary = startingDeckSummary(built.bulkAdd, built)
  assert.ok(summary)
  const forests = built.deck.filter(({ name }) => name === 'Forest').length
  assert.equal(summary.basics[0].count, forests - 2)
  assert.equal(summary.total, 97)
  assert.equal(startingDeckSummary(null, built), null)
})

test('undo never removes the player’s own copies, even after drafted copies were removed', () => {
  const state = builder({ queue: draftPool(), deck: [commander, forest, forest] })
  const built = apply(state, { type: 'buildStartingDeck', basics: [forest] }).state
  const forestIndexes = built.deck.flatMap((item, index) => (item.name === 'Forest' ? [index] : []))
  // The player removes five Forests, more than they owned before the draft.
  let edited = built
  for (const index of forestIndexes.slice(-5).reverse())
    edited = apply(edited, { type: 'removeCard', board: 'deck', index }).state
  const undone = apply(edited, { type: 'undoBulkAdd' }).state
  assert.deepEqual(names(undone.deck), ['Leader', 'Forest', 'Forest'])
})

test('undo also removes drafted cards the player moved to the sideboard', () => {
  const built = apply(builder({ queue: draftPool() }), {
    type: 'buildStartingDeck',
    basics: [forest],
  }).state
  const moved = apply(built, { type: 'moveCard', board: 'deck', index: 1 }).state
  assert.equal(moved.sideboard.length, 1)
  assert.equal(bulkAddStatus(moved.bulkAdd, moved)?.count, 99)
  const undone = apply(moved, { type: 'undoBulkAdd' }).state
  assert.deepEqual(names(undone.deck), ['Leader'])
  assert.deepEqual(undone.sideboard, [])
})

test('a starting deck is refused when the budget cannot cover a full deck', () => {
  const state = builder({ queue: draftPool(), deckBudget: 5 })
  const result = apply(state, { type: 'buildStartingDeck', basics: [forest] })
  assert.match(result.error ?? '', /budget can’t cover/)
  assert.equal(result.state, state)
})
