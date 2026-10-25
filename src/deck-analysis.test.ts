import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addsToSideboard,
  analyseDeck,
  basicLandPlan,
  landFillReady,
  nonbasicLandSuggestions,
  curveBucket,
  deckBecameComplete,
  shouldAutoOpenDeckReview,
  deckGuidance,
  deckRoleBoosts,
  deckSection,
  defaultDeckTargets,
  requiredPipsForCard,
  rolesForCard,
  cardFeatures,
  manaGuidanceSymbols,
  type AnalysisCard,
} from './deck-analysis.ts'

const card = (overrides: Partial<AnalysisCard> = {}): AnalysisCard => ({
  name: 'Card',
  layout: 'normal',
  typeLine: 'Creature',
  manaCost: '{2}{G}',
  manaValue: 3,
  detail: '',
  producedMana: [],
  faces: [],
  ...overrides,
})

test('detects only the transition into a complete main deck', () => {
  assert.equal(deckBecameComplete(99, 100), true)
  assert.equal(deckBecameComplete(100, 100), false)
  assert.equal(deckBecameComplete(100, 99), false)
})

test('manual completion opens review, while imported completion can suppress it', () => {
  assert.equal(shouldAutoOpenDeckReview(99, 100), true)
  assert.equal(shouldAutoOpenDeckReview(99, 100, true), false)
  assert.equal(shouldAutoOpenDeckReview(100, 100, true), false)
})

test('analyses curve, coloured requirements, production, roles, and land range', () => {
  const analysis = analyseDeck([
    card(),
    card({
      name: 'Growth',
      typeLine: 'Sorcery',
      manaCost: '{1}{G}',
      manaValue: 2,
      detail: 'Search your library for a basic land card, put it onto the battlefield tapped.',
    }),
    card({
      name: 'Dual',
      typeLine: 'Land',
      manaCost: '',
      manaValue: 0,
      detail: '{T}: Add {G} or {W}.',
      producedMana: ['G', 'W'],
    }),
    card({ name: 'Draw', detail: 'Draw cards equal to the number of creatures you control.' }),
    card({
      name: 'Removal',
      typeLine: 'Instant',
      detail: 'Return target permanent to its owner’s hand.',
    }),
    card({ name: 'Wipe', typeLine: 'Sorcery', detail: 'Destroy all creatures.' }),
  ])
  assert.deepEqual(analysis.curve[2], { manaValue: 2, permanents: 0, nonPermanents: 1 })
  assert.equal(analysis.required.G, 5)
  assert.deepEqual(analysis.produced, { W: 1, U: 0, B: 0, R: 0, G: 1, C: 0, S: 0 })
  assert.deepEqual(analysis.counts, { lands: 1, ramp: 1, draw: 1, removal: 1, wipes: 1 })
  assert.deepEqual(analysis.typeCounts, {
    Creature: 2,
    Artifact: 0,
    Enchantment: 0,
    Instant: 1,
    Sorcery: 2,
    Planeswalker: 0,
    Battle: 0,
  })
  assert.equal(analysis.landRange.length, 2)
})

test('classifies common removal without treating one sacrifice or mass untap as a wipe', () => {
  const analysis = analyseDeck([
    card({
      name: 'Village Bell-Ringer',
      detail: 'When this creature enters, untap all creatures you control.',
    }),
    card({ detail: 'Each player sacrifices a creature.' }),
    card({ detail: 'This creature fights target creature you don’t control.' }),
    card({ detail: 'It deals 3 damage to target creature.' }),
    card({ detail: 'Target creature gets -X/-X until end of turn.' }),
  ])
  assert.equal(analysis.counts.wipes, 0)
  assert.equal(analysis.counts.removal, 3)
})

test('recognises common ramp and board-wipe wording', () => {
  const analysis = analyseDeck([
    card({ detail: 'Create two Treasure tokens.' }),
    card({ detail: 'Whenever a Forest enters, lands you control produce an additional {G}.' }),
    card({ detail: 'Put a land card from your hand onto the battlefield tapped.' }),
    card({
      detail:
        'Search your library for a Forest card, put that card onto the battlefield, then shuffle.',
    }),
    card({ detail: 'Return all nonland permanents to their owners’ hands.' }),
    card({ detail: 'Return each nonland permanent you don’t control to its owner’s hand.' }),
    card({ detail: 'This spell deals 3 damage to each creature.' }),
    card({ detail: 'All creatures get -4/-4 until end of turn.' }),
  ])
  assert.equal(analysis.counts.ramp, 4)
  assert.equal(analysis.counts.wipes, 4)
})

test('modal spell-land counts as an optional land drop, not a spell in curve or type counts', () => {
  const analysis = analyseDeck([
    card({
      layout: 'modal_dfc',
      typeLine: 'Sorcery // Land',
      manaCost: '{1}{U}',
      manaValue: 2,
      producedMana: ['U'],
      faces: [
        { typeLine: 'Sorcery', manaCost: '{1}{U}' },
        { typeLine: 'Land', manaCost: '' },
      ],
    }),
  ])
  assert.equal(analysis.counts.lands, 1)
  assert.deepEqual(analysis.curve[2], { manaValue: 2, permanents: 0, nonPermanents: 0 })
  assert.equal(analysis.typeCounts.Sorcery, 0)
  assert.equal(analysis.required.U, 1)
  assert.equal(analysis.produced.U, 1)
})

test('counts castable multiface colour pips', () => {
  const splitCard = card({
    layout: 'split',
    manaCost: '{1}{R} // {1}{U}',
    faces: [
      { typeLine: 'Instant', manaCost: '{1}{R}' },
      { typeLine: 'Instant', manaCost: '{1}{U}' },
    ],
  })
  const analysis = analyseDeck([splitCard])
  assert.equal(analysis.required.R, 1)
  assert.equal(analysis.required.U, 1)
  assert.equal(requiredPipsForCard(splitCard, 'R'), 1)
  assert.equal(requiredPipsForCard(splitCard, 'U'), 1)
})

test('uses front face for transforming lands and excludes land-back transforming cards', () => {
  const adventure = card({
    layout: 'adventure',
    typeLine: 'Creature // Instant',
    manaValue: 3,
    faces: [
      { typeLine: 'Creature', manaCost: '{2}{G}' },
      { typeLine: 'Instant — Adventure', manaCost: '{G}' },
    ],
  })
  const pathway = card({
    layout: 'modal_dfc',
    typeLine: 'Land // Land',
    manaCost: '',
    manaValue: 0,
    faces: [
      { typeLine: 'Land', manaCost: '' },
      { typeLine: 'Land', manaCost: '' },
    ],
  })
  const frontLand = card({
    name: 'Westvale Abbey',
    layout: 'transform',
    typeLine: 'Land // Creature',
    manaCost: '',
    manaValue: 0,
    faces: [
      { typeLine: 'Land', manaCost: '' },
      { typeLine: 'Creature', manaCost: '' },
    ],
  })
  const backLand = card({
    layout: 'transform',
    typeLine: 'Creature // Land',
  })
  const analysis = analyseDeck([adventure, pathway, frontLand, backLand])
  assert.deepEqual(analysis.curve[3], { manaValue: 3, permanents: 2, nonPermanents: 0 })
  assert.equal(analysis.counts.lands, 2)
  assert.equal(curveBucket(pathway), null)
  assert.equal(curveBucket(frontLand), null)
  assert.equal(curveBucket(backLand), 3)
})

test('includes colourless and snow costs and sources in mana guidance', () => {
  const analysis = analyseDeck([
    card({ typeLine: 'Snow Land', manaCost: '', producedMana: ['C'] }),
    card({ typeLine: 'Artifact', manaCost: '{C/W}{S}' }),
  ])
  assert.equal(analysis.required.C, 1)
  assert.equal(analysis.required.W, 1)
  assert.equal(analysis.required.S, 1)
  assert.equal(analysis.produced.C, 1)
  assert.equal(analysis.produced.S, 1)
  assert.deepEqual(manaGuidanceSymbols([]), ['C', 'S'])
})

test('groups deck cards by requested type order', () => {
  assert.deepEqual(
    ['Creature', 'Enchantment', 'Artifact', 'Sorcery', 'Instant', 'Planeswalker', 'Land'].map(
      deckSection,
    ),
    ['Creatures', 'Enchantments', 'Artifacts', 'Sorceries', 'Instants', 'Other', 'Lands'],
  )
})

test('splits basic lands by demand, falls back evenly, and respects open slots', () => {
  const demand = { W: 1, U: 0, B: 0, R: 0, G: 3 }
  assert.deepEqual(basicLandPlan(['W'], demand, 30, 35, 90), [
    { name: 'Plains', colour: 'W', count: 5 },
  ])
  assert.deepEqual(basicLandPlan(['W', 'G'], demand, 30, 35, 90), [
    { name: 'Plains', colour: 'W', count: 1 },
    { name: 'Forest', colour: 'G', count: 4 },
  ])
  assert.deepEqual(basicLandPlan(['W', 'U'], { W: 0, U: 0, B: 0, R: 0, G: 0 }, 30, 35, 90), [
    { name: 'Plains', colour: 'W', count: 3 },
    { name: 'Island', colour: 'U', count: 2 },
  ])
  assert.deepEqual(basicLandPlan([], demand, 30, 35, 98), [
    { name: 'Wastes', colour: 'C', count: 2 },
  ])
  assert.deepEqual(basicLandPlan(['W'], demand, 35, 35, 90), [])
  assert.deepEqual(basicLandPlan(['W'], demand, 36, 35, 90), [])
  assert.deepEqual(basicLandPlan(['W'], demand, 30, 35, 100), [])
})

test('promotes the land fill only once most non-land slots are filled', () => {
  assert.equal(landFillReady(4, 0, 35), false)
  assert.equal(landFillReady(64, 10, 35), false)
  assert.equal(landFillReady(65, 10, 35), true)
  assert.equal(landFillReady(50, 0, 40), true)
})

test('suggests owned-free nonbasic lands before basics', () => {
  const card = (name: string, typeLine: string) => ({
    name,
    layout: 'normal',
    typeLine,
    manaCost: '',
    manaValue: 0,
    detail: '',
    producedMana: [],
    faces: [],
  })
  const candidates = [
    card('Forest', 'Basic Land — Forest'),
    card('Snow-Covered Forest', 'Basic Snow Land — Forest'),
    card('Llanowar Elves', 'Creature — Elf Druid'),
    card('Command Tower', 'Land'),
    card('Woodland Cemetery', 'Land'),
    card('Overgrown Tomb', 'Land — Swamp Forest'),
  ]
  assert.deepEqual(
    nonbasicLandSuggestions(candidates, ['Command Tower'], 5).map(({ name }) => name),
    ['Woodland Cemetery', 'Overgrown Tomb'],
  )
  assert.deepEqual(
    nonbasicLandSuggestions(candidates, [], 1).map(({ name }) => name),
    ['Command Tower'],
  )
  assert.deepEqual(nonbasicLandSuggestions(candidates, [], 0), [])
})

test('role boosts stay modest early and strengthen late', () => {
  const counts = { ...defaultDeckTargets, ramp: 5, wipes: 0 }
  assert.deepEqual(deckRoleBoosts(40, counts, defaultDeckTargets), {
    lands: 0,
    ramp: 5,
    draw: 0,
    removal: 0,
    wipes: 6,
  })
  assert.deepEqual(deckRoleBoosts(90, counts, defaultDeckTargets), {
    lands: 0,
    ramp: 14,
    draw: 0,
    removal: 0,
    wipes: 18,
  })
})

test('land and ramp gaps get stronger health boosts than other roles', () => {
  const counts = { lands: 0, ramp: 0, draw: 0, removal: 0, wipes: 0 }
  assert.deepEqual(deckRoleBoosts(40, counts, defaultDeckTargets), {
    lands: 9,
    ramp: 9,
    draw: 6,
    removal: 6,
    wipes: 6,
  })
  assert.deepEqual(deckRoleBoosts(90, counts, defaultDeckTargets), {
    lands: 24,
    ramp: 24,
    draw: 18,
    removal: 18,
    wipes: 18,
  })
})

test('guidance starts at 70 and strengthens aggregate impossible late gaps', () => {
  assert.deepEqual(deckGuidance(69, { ...defaultDeckTargets }, defaultDeckTargets), [])
  const quiet = deckGuidance(70, { ...defaultDeckTargets, lands: 30 }, defaultDeckTargets)
  assert.equal(quiet[0].strong, false)
  const strong = deckGuidance(
    95,
    { lands: 33, ramp: 8, draw: 8, removal: 8, wipes: 3 },
    defaultDeckTargets,
  )
  assert.equal(
    strong.every((item) => item.strong),
    true,
  )
  assert.equal(strong.filter((item) => item.text.includes('slots left')).length, 1)
})

test('role rules reject land-to-hand ramp, opponent-only draw, self-blink and recursion', () => {
  const roles = (detail: string, typeLine = 'Sorcery') => rolesForCard(card({ detail, typeLine }))
  // Ramp: land onto the battlefield, mana abilities and Treasure count; land to hand is fixing.
  assert.ok(
    roles(
      'Search your library for up to two basic land cards, put them onto the battlefield tapped.',
    ).includes('ramp'),
  )
  assert.ok(
    !roles('Search your library for a basic land card, reveal it, put it into your hand.').includes(
      'ramp',
    ),
  )
  // Ambiguous: no destination named, so no ramp credit.
  assert.ok(!roles('Search your library for a land card.').includes('ramp'))
  // Draw: yours counts; opponent-only draw doesn't.
  assert.ok(roles('Draw two cards.').includes('draw'))
  assert.ok(!roles('Target opponent draws a card.').includes('draw'))
  assert.ok(!roles('Each opponent may draw a card.').includes('draw'))
  assert.ok(roles('You and target opponent each draw a card.').includes('draw'))
  // Removal: opposing targets count; self-blink, own permanents and recursion don't.
  assert.ok(roles('Exile target creature an opponent controls.').includes('removal'))
  assert.ok(roles('Destroy target creature you don’t control.').includes('removal'))
  assert.ok(
    !roles('Exile target creature you control, then return it to the battlefield.').includes(
      'removal',
    ),
  )
  assert.ok(
    !roles('Return target creature card from your graveyard to your hand.').includes('removal'),
  )
  // Ambiguous: "return target creature" can bounce either side, so it still counts.
  assert.ok(roles('Return target creature to its owner’s hand.').includes('removal'))
})

test('basic lands go to colours that existing fixing does not already cover', () => {
  const demand = { W: 1, U: 0, B: 0, R: 0, G: 1 }
  // Even demand, but 10 existing lands already make white.
  assert.deepEqual(basicLandPlan(['W', 'G'], demand, 25, 35, 90, { W: 10, G: 0 }), [
    { name: 'Plains', colour: 'W', count: 3 },
    { name: 'Forest', colour: 'G', count: 7 },
  ])
  // Without existing sources the split follows demand, as before.
  assert.deepEqual(basicLandPlan(['W', 'G'], demand, 25, 35, 90), [
    { name: 'Plains', colour: 'W', count: 5 },
    { name: 'Forest', colour: 'G', count: 5 },
  ])
})

test('new cards go to the sideboard from 100 unless the player keeps adding to main', () => {
  const deck = (length: number) => Array.from({ length }, () => ({}))
  assert.equal(addsToSideboard({ deck: deck(99) }), false)
  assert.equal(addsToSideboard({ deck: deck(100) }), true)
  assert.equal(addsToSideboard({ deck: deck(100), keepAddingToMain: true }), false)
  assert.equal(addsToSideboard({ deck: deck(104), keepAddingToMain: true }), false)
})

test('card features separate ramp, fixing and burst; draw from cantrips; and removal from self-targeting', () => {
  const features = (detail: string, typeLine = 'Sorcery', extra: Partial<AnalysisCard> = {}) =>
    cardFeatures(card({ detail, typeLine, ...extra }))
  // Mana: positive, negative and ambiguous.
  const mana = (detail: string, typeLine?: string, extra?: Partial<AnalysisCard>) =>
    features(detail, typeLine, extra).mana
  assert.equal(
    mana('Search your library for a basic land card, put it onto the battlefield tapped.'),
    'land-ramp',
  )
  assert.equal(mana('{T}: Add {C}{C}.', 'Artifact', { producedMana: ['C'] }), 'repeatable')
  assert.equal(
    mana('Whenever an opponent casts a spell, create a Treasure token.', 'Enchantment'),
    'repeatable',
  )
  assert.equal(mana('Add {B}{B}{B}.', 'Instant'), 'burst')
  assert.equal(
    mana('{T}, Sacrifice Lotus Petal: Add one mana of any color.', 'Artifact', {
      name: 'Lotus Petal',
      producedMana: ['W', 'U', 'B', 'R', 'G'],
    }),
    'burst',
  )
  assert.equal(
    mana('Search your library for a basic land card, reveal it, put it into your hand.'),
    'fixing',
  )
  assert.equal(mana('Search your library for a land card.'), 'unknown')
  assert.equal(mana('Draw two cards.'), null)
  // Draw.
  const draw = (detail: string, typeLine?: string) => features(detail, typeLine).draw
  assert.equal(draw('Draw two cards.'), 'net')
  assert.equal(draw('At the beginning of your upkeep, you draw a card.', 'Enchantment'), 'net')
  assert.equal(draw('Destroy target artifact. Draw a card.', 'Instant'), 'cantrip')
  assert.equal(
    draw('Exile the top two cards of your library. Until end of turn, you may play them.'),
    'impulse',
  )
  assert.equal(draw('Return target creature card from your graveyard to your hand.'), 'recursion')
  assert.equal(draw('Target opponent draws a card.'), null)
  // Interaction.
  const interaction = (detail: string) => features(detail).interaction
  assert.equal(interaction('Exile target creature an opponent controls.'), 'opposing')
  assert.equal(
    interaction('Exile target creature you control, then return it to the battlefield.'),
    'self',
  )
  assert.equal(interaction('Target creature you control gains hexproof until end of turn.'), 'self')
  assert.equal(interaction('Draw two cards.'), null)
  // Card selection isn't card advantage.
  assert.equal(draw('Draw two cards, then discard two cards.'), 'cantrip')
  assert.equal(
    draw(
      'Draw three cards, then put two cards from your hand on top of your library in any order.',
    ),
    'cantrip',
  )
  // Treasure reminder text isn't self-sacrifice.
  assert.equal(
    mana(
      'Whenever an opponent draws a card, create a Treasure token. (It’s an artifact with “{T}, Sacrifice this artifact: Add one mana of any color.”)',
      'Enchantment',
    ),
    'repeatable',
  )
  assert.equal(
    mana('Sacrifice a creature: Add {C}{C}.', 'Artifact', { producedMana: ['C'] }),
    'repeatable',
  )
  // Reviewed override by Oracle ID: Arcane Denial's delayed draw reads as repeating.
  const arcaneDenial = card({
    detail:
      "Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep.\nYou draw a card at the beginning of the next turn's upkeep.",
    typeLine: 'Instant',
  })
  assert.equal(cardFeatures(arcaneDenial).draw, 'net')
  const overridden = cardFeatures({
    ...arcaneDenial,
    oracleId: 'ab1cc360-b9de-48d9-9983-4dfe4a7d2a37',
  })
  assert.equal(overridden.draw, 'cantrip')
  assert.equal(overridden.source, 'override')
  // Roles stay a projection: it still fills the draw and removal roles.
  assert.deepEqual(
    rolesForCard({ ...arcaneDenial, oracleId: 'ab1cc360-b9de-48d9-9983-4dfe4a7d2a37' }),
    ['draw', 'removal'],
  )
})
