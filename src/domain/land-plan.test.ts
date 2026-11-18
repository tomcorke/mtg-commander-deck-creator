import assert from 'node:assert/strict'
import test from 'node:test'
import { analyseDeck, basicLandPlan, type AnalysisCard } from '../deck-analysis.ts'
import {
  bigManaCaveat,
  landSourceQuality,
  basicSplitReason,
  fetchesBasics,
  landPlanGroup,
  landPlanReason,
  planBasics,
  planLandFill,
  type LandPlanInput,
} from './land-plan.ts'
import type { PowerTarget } from './recommendation-types.ts'

// Synthetic cards modelled on common land and spell wording; they make no claims about real cards.
type TestCard = AnalysisCard & { price?: string; inclusion?: number }
const card = (name: string, overrides: Partial<TestCard> = {}): TestCard => ({
  name,
  layout: 'normal',
  typeLine: 'Land',
  manaCost: '',
  manaValue: 0,
  detail: '',
  producedMana: [],
  faces: [],
  ...overrides,
})
const spell = (name: string, manaCost: string, detail = '') =>
  card(name, { typeLine: 'Creature — Elf', manaCost, manaValue: 2, detail })
const basic = (type: string, colour: string) =>
  card(type, { typeLine: `Basic Land — ${type}`, producedMana: [colour] })
const copies = (item: TestCard, count: number) => Array.from({ length: count }, () => item)
const names = (picks: { card: { name: string } }[]) => picks.map(({ card }) => card.name)

const commander = (detail = '', manaCost = '{1}{G}') =>
  card('Test Commander', { typeLine: 'Legendary Creature — Elf', manaCost, manaValue: 2, detail })
const dual = (name: string, colours: string[], extra = '') =>
  card(name, {
    producedMana: colours,
    detail: `${extra}{T}: Add ${colours.map((colour) => `{${colour}}`).join(' or ')}.`,
  })
const utility = (name: string, overrides: Partial<TestCard> = {}) =>
  card(name, {
    producedMana: ['G'],
    detail: '{T}: Add {G}.\n{3}{G}, {T}: Draw a card.',
    ...overrides,
  })
const tappedUtility = (name: string) =>
  utility(name, { detail: `${name} enters tapped.\n{T}: Add {G}.\n{3}{G}, {T}: Draw a card.` })
const landRecursion = card('Recursion Grove', {
  producedMana: ['G'],
  detail: '{T}: Add {G}.\n{2}{G}, {T}: Return target land card from your graveyard to your hand.',
})
const rampant = (name: string) =>
  card(name, {
    typeLine: 'Sorcery',
    manaCost: '{1}{G}',
    manaValue: 2,
    detail:
      'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
  })

const plan = (
  deck: TestCard[],
  candidates: TestCard[],
  overrides: Partial<LandPlanInput<TestCard>> & { identity?: string[] } = {},
) =>
  planLandFill<TestCard>({
    deck,
    commanders: [{ name: deck[0].name, detail: deck[0].detail }],
    themes: [],
    identity: ['G'],
    landTarget: 38,
    power: 'upgraded',
    candidates,
    ...overrides,
  })

const greenDeck = (spells = 40, detail = '') => [
  commander(detail),
  ...copies(spell('Green spell', '{1}{G}'), spells),
]
const simicDeck = (detail = '') => [
  commander(detail, '{1}{G}{U}'),
  ...copies(spell('Green spell', '{1}{G}'), 20),
  ...copies(spell('Blue spell', '{1}{U}'), 20),
]

test('the nonbasic cap scales with colour count: mono 6, two 10, three or more 15', () => {
  const utilities = Array.from({ length: 12 }, (_, index) => utility(`Utility ${index}`))
  assert.equal(plan(greenDeck(), utilities).picks.length, 6)

  const duals = Array.from({ length: 14 }, (_, index) => dual(`Dual ${index}`, ['G', 'U']))
  const two = plan(simicDeck(), duals, { identity: ['G', 'U'] })
  assert.equal(two.cap, 10)
  assert.equal(two.picks.length, 10)

  // Cycling gives each tri-land a flexible role, so the cap binds after fixing gaps close.
  const tris = Array.from({ length: 20 }, (_, index) =>
    dual(`Tri ${index}`, ['W', 'U', 'G'], 'Cycling {3}\n'),
  )
  const bant = [
    commander('', '{G}{W}{U}'),
    ...copies(spell('Green spell', '{1}{G}'), 14),
    ...copies(spell('Blue spell', '{1}{U}'), 13),
    ...copies(spell('White spell', '{1}{W}'), 13),
  ]
  const three = plan(bant, tris, { identity: ['W', 'U', 'G'] })
  assert.equal(three.cap, 15)
  assert.equal(three.picks.length, 15)

  // Nonbasics already in the deck use the cap up.
  const held = [...greenDeck(), utility('Held 1'), utility('Held 2'), utility('Held 3')]
  assert.equal(plan(held, utilities).picks.length, 3)
})

test('basics keep a reserve: 1 per colour, or 2 per basic-fetching card', () => {
  const utilities = Array.from({ length: 8 }, (_, index) => utility(`Utility ${index}`))
  // Eight land slots: the cap allows 6, and the 1-basic reserve still leaves 7.
  const plain = plan(greenDeck(), utilities, { landTarget: 8 })
  assert.equal(plain.reserve, 1)
  assert.equal(plain.picks.length, 6)

  // Three fetchers keep 6 basics, so only 2 of the 8 slots can be nonbasic.
  const fetching = [...greenDeck(37), rampant('Ramp 1'), rampant('Ramp 2'), rampant('Ramp 3')]
  const reserved = plan(fetching, utilities, { landTarget: 8 })
  assert.equal(reserved.fetchers, 3)
  assert.equal(reserved.reserve, 6)
  assert.equal(reserved.picks.length, 2)
  assert.deepEqual(
    reserved.basics.map(({ name, count }) => [name, count]),
    [['Forest', 6]],
  )

  // Basics already in the deck count toward the reserve.
  const stocked = [...fetching.slice(0, -1), ...copies(basic('Forest', 'G'), 6)]
  assert.equal(plan(stocked, utilities, { landTarget: 14 }).picks.length, 6)
})

test('a planned land that fetches basics raises the reserve', () => {
  const wilds = card('Wilds', {
    detail:
      '{T}, Sacrifice Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
  })
  assert(fetchesBasics(wilds))
  assert(!fetchesBasics(basic('Forest', 'G')))
  assert(fetchesBasics(rampant('Ramp')))
  // A tutor for any card is not a basic search.
  assert(
    !fetchesBasics(
      card('Tutor', { typeLine: 'Sorcery', detail: 'Search your library for a card.' }),
    ),
  )
  const result = plan(
    greenDeck(40, 'Landfall — Whenever a land you control enters, draw a card.'),
    [wilds],
    {
      landTarget: 2,
    },
  )
  // Two slots: Wilds would need two basics kept, so it waits as an option.
  assert.deepEqual(names(result.picks), [])
  assert.deepEqual(names(result.alternatives), ['Wilds'])
  assert.equal(result.alternatives[0].held, 'reserve')
})

test('a search for any basic land fixes every identity colour', () => {
  const wilds = (name: string) =>
    card(name, {
      detail: `{T}, Sacrifice ${name}: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.`,
    })
  const result = plan(simicDeck(), [wilds('Wilds A'), wilds('Wilds B'), wilds('Wilds C')], {
    identity: ['G', 'U'],
  })
  // Not colourless-only: all three are planned as fixing, and each keeps two basics.
  assert.deepEqual(names(result.picks), ['Wilds A', 'Wilds B', 'Wilds C'])
  assert.deepEqual(
    result.picks.map(({ step }) => step),
    ['fixing', 'fixing', 'fixing'],
  )
  assert.equal(result.reserve, 6)
})

test('the caller’s Add check runs against the lands planned so far', () => {
  const lands = [utility('A changer'), utility('B changer'), utility('C plain')]
  const changers = new Set(['A changer', 'B changer'])
  // One Game Changer slot left: the second changer waits once the first is planned.
  const result = plan(greenDeck(), lands, {
    allowed: (land, picked) =>
      !changers.has(land.name) || !picked.some(({ name }) => changers.has(name)),
  })
  assert.deepEqual(names(result.picks), ['A changer', 'C plain'])
  assert.deepEqual(
    result.alternatives.map(({ card, held }) => [card.name, held]),
    [['B changer', 'rules']],
  )
})

test('a full cap is reported as the cap, not the reserve', () => {
  const utilities = Array.from({ length: 7 }, (_, index) => utility(`Utility ${index}`))
  const result = plan(greenDeck(), utilities)
  assert.equal(result.picks.length, 6)
  assert.equal(result.alternatives[0].held, 'cap')
})

test('fill order: fixing, then earned roles, then utility', () => {
  const deck = simicDeck(
    'Landfall — Whenever a land you control enters, put a +1/+1 counter on it.',
  )
  const candidates = [
    utility('Popular utility', { inclusion: 90 }),
    landRecursion,
    dual('Simic dual', ['G', 'U']),
  ]
  const result = plan(deck, candidates, { identity: ['G', 'U'] })
  assert.deepEqual(names(result.picks), ['Simic dual', 'Recursion Grove', 'Popular utility'])
  assert.deepEqual(
    result.picks.map(({ step }) => step),
    ['fixing', 'earned', 'utility'],
  )
  assert.equal(landPlanGroup(result.picks[1]), 'Landfall and land synergy')
  assert.match(landPlanReason(result.picks[0]), /green or blue source you lack/)
  assert.match(landPlanReason(result.picks[1]), /Return target land card/)
  assert.match(landPlanReason(result.picks[1]), /Your commander: “Landfall/)
})

test('earned roles need deck evidence; utility ranks by score, then inclusion, then name', () => {
  const plain = plan(greenDeck(), [landRecursion, utility('B utility'), utility('A utility')])
  // Without landfall the recursion land has no usable role, so it is not planned.
  assert.deepEqual(names(plain.picks), ['A utility', 'B utility'])
  const popular = plan(greenDeck(), [utility('B utility', { inclusion: 40 }), utility('A utility')])
  assert.deepEqual(names(popular.picks), ['B utility', 'A utility'])
})

test('direct duals retain coverage value when only one colour is short', () => {
  const deck = [
    ...simicDeck(),
    ...copies(basic('Forest', 'G'), 30),
    ...copies(basic('Island', 'U'), 4),
  ]
  const result = plan(deck, [dual('Simic dual', ['G', 'U'])], { identity: ['G', 'U'] })
  assert.deepEqual(names(result.picks), ['Simic dual'])
  assert.deepEqual(names(result.alternatives), [])
})

test('Power scales the always-tapped cap: Core tolerant, Upgraded moderate, High strict', () => {
  const tapped = Array.from({ length: 6 }, (_, index) => tappedUtility(`Tapped ${index}`))
  const count = (power: PowerTarget) => plan(greenDeck(), tapped, { power }).picks.length
  assert.equal(count('precon'), 6)
  assert.equal(count('upgraded'), 4)
  assert.equal(count('high'), 1)
  // Tapped lands already in the deck count toward the cap.
  assert.equal(
    plan([...greenDeck(), tappedUtility('Held')], tapped, { power: 'upgraded' }).picks.length,
    3,
  )
  // An untapped land with the same role outranks a tapped one.
  const ranked = plan(greenDeck(), [tappedUtility('A tapped'), utility('Z untapped')], {
    power: 'high',
  })
  assert.deepEqual(names(ranked.picks), ['Z untapped', 'A tapped'])
  assert.deepEqual(ranked.picks[1].drawbacks, ['Always enters tapped'])
})

test('colourless-only lands are capped by coloured demand', () => {
  const colourless = Array.from({ length: 5 }, (_, index) =>
    card(`Colourless ${index}`, {
      producedMana: ['C'],
      detail: '{T}: Add {C}.\n{4}, {T}: Target creature can’t be blocked this turn.',
    }),
  )
  assert.equal(plan(greenDeck(), colourless).picks.length, 3)
  assert.equal(plan(simicDeck(), colourless, { identity: ['G', 'U'] }).picks.length, 2)
  // A colourless identity has no coloured demand to protect.
  const wastes = [commander('', '{3}'), ...copies(spell('Colourless spell', '{3}'), 40)]
  assert.equal(plan(wastes, colourless, { identity: [] }).picks.length, 5)
})

test('budget: max price drops lands, over-budget lands wait last, basics stay affordable', () => {
  const lands = [
    utility('Budget utility', { price: '0.50' }),
    utility('Pricey utility', { price: '300.00', inclusion: 99 }),
    utility('Unpriced utility'),
  ]
  const capped = plan(greenDeck(), lands, { maxPrice: 5 })
  assert.deepEqual(names(capped.picks), ['Budget utility', 'Unpriced utility'])
  assert.deepEqual(capped.alternatives, [])

  const budget = plan(greenDeck(), lands, { remainingBudget: 10 })
  assert.deepEqual(names(budget.picks), ['Budget utility', 'Unpriced utility'])
  assert.deepEqual(
    budget.alternatives.map(({ card, overBudget }) => [card.name, overBudget]),
    [['Pricey utility', true]],
  )

  // With $1 basics, a 90-card deck must keep $9 for the slots after the first pick.
  const nearly = greenDeck(89)
  const tight = plan(nearly, [utility('Two dollar', { price: '2.00' })], {
    remainingBudget: 10,
    basicPrice: 1,
  })
  assert.deepEqual(names(tight.picks), [])
  assert.equal(tight.alternatives[0].overBudget, true)
  const enough = plan(nearly, [utility('One dollar', { price: '1.00' })], {
    remainingBudget: 10,
    basicPrice: 1,
  })
  assert.deepEqual(names(enough.picks), ['One dollar'])
})

test('a mono deck with no earned or utility candidates gets today’s basic plan', () => {
  const deck = [...greenDeck(), ...copies(basic('Forest', 'G'), 10)]
  const vanilla = card('Vanilla land', { producedMana: ['G'], detail: '{T}: Add {G}.' })
  const result = plan(deck, [vanilla, spell('Not a land', '{G}')])
  const analysis = analyseDeck(deck)
  assert.deepEqual(result.picks, [])
  assert.deepEqual(
    result.basics,
    basicLandPlan(
      ['G'],
      analysis.required,
      analysis.counts.lands,
      38,
      deck.length,
      analysis.produced,
    ),
  )
})

test('basics split by demand from land sources, with at least one per colour', () => {
  const deck = [commander('', '{G}{U}'), ...copies(spell('Green spell', '{G}{G}'), 40)]
  const analysis = analyseDeck(deck)
  // The plain split gives blue nothing; the planner keeps one Island.
  assert.deepEqual(
    basicLandPlan(['G', 'U'], analysis.required, 0, 38, deck.length).map(({ name }) => name),
    ['Forest'],
  )
  assert.deepEqual(
    planBasics(deck, ['G', 'U'], 38).map(({ name, count }) => [name, count]),
    [
      ['Island', 1],
      ['Forest', 37],
    ],
  )
})

test('candidates already in the deck, basics and duplicates are skipped', () => {
  const deck = [...greenDeck(), utility('In deck')]
  const result = plan(deck, [
    utility('In deck'),
    basic('Forest', 'G'),
    utility('Twice'),
    utility('Twice'),
  ])
  assert.deepEqual(names(result.picks), ['Twice'])
})

test('equal-scoring existing lands outrank weaker search evidence', () => {
  const searched = {
    ...utility('A Search Grove'),
    reason: 'Found by land search, not seen with this commander',
  }
  const existing = { ...utility('Z Commander Grove'), inclusion: 0 }
  const result = plan([commander()], [searched, existing])
  assert.equal(result.picks[0].card.name, existing.name)
  const searchPick = [...result.picks, ...result.alternatives].find(
    (pick) => pick.card.name === searched.name,
  )
  assert.ok(searchPick)
  assert.match(landPlanReason(searchPick), /Found by land search, not seen with this commander/)
})

// #596: big mana is a core role in the utility step, under the same cap and reserve.
const bigManaLand = (name: string, overrides: Partial<TestCard> = {}) =>
  card(name, {
    producedMana: ['G'],
    detail: '{2}, {T}: Add {G} for each Forest you control.',
    ...overrides,
  })

test('big mana fills in the utility step, after fixing and earned roles', () => {
  const deck = simicDeck(
    'Landfall — Whenever a land you control enters, put a +1/+1 counter on it.',
  )
  const candidates = [
    bigManaLand('Forest Coffers', { inclusion: 95 }),
    landRecursion,
    dual('Simic dual', ['G', 'U']),
  ]
  const result = plan(deck, candidates, { identity: ['G', 'U'] })
  assert.deepEqual(names(result.picks), ['Simic dual', 'Recursion Grove', 'Forest Coffers'])
  const pick = result.picks[2]
  assert.equal(pick.step, 'utility')
  assert.equal(pick.role, 'big-mana')
  assert.equal(landPlanGroup(pick), 'Big mana')
  // The reason quotes the ability, its restrictions and the heuristic caveat.
  assert.equal(
    landPlanReason(pick),
    [
      '“{2}, {T}: Add {G} for each Forest you control.”',
      'Activation cost: {2}',
      'Scales with each Forest you control',
      bigManaCaveat,
    ].join(' · '),
  )
})

test('big mana stays under the cap and reserve, with no deck-support threshold', () => {
  // A mono deck with no Forests or creatures still plans it: no board-support check.
  const lands = Array.from({ length: 8 }, (_, index) => bigManaLand(`Coffers ${index}`))
  const result = plan([commander()], lands)
  assert.equal(result.picks.length, 6)
  assert.ok(result.picks.every(({ role }) => role === 'big-mana'))
  assert.equal(result.alternatives[0].held, 'cap')
  // Utility and big mana share the step and the role weight; inclusion then name break ties.
  const mixed = plan(greenDeck(), [bigManaLand('B coffers'), utility('A utility')])
  assert.deepEqual(names(mixed.picks), ['A utility', 'B coffers'])
})

test('Kotis audit: direct Sultai fixing precedes costly and copy-only sources and keeps coloured basics', () => {
  const deck = [
    commander('', '{1}{B}{G}{U}'),
    ...copies(spell('Green', '{G}{G}'), 14),
    ...copies(spell('Blue', '{U}'), 6),
    ...copies(spell('Black', '{B}'), 6),
  ]
  const weak = [
    card('Paid rainbow', {
      producedMana: ['U', 'B', 'G'],
      detail: '{T}: Add {C}. {1}, {T}: Add one mana of any color.',
    }),
    card('Opponent rainbow', {
      producedMana: ['U', 'B', 'G'],
      detail: '{T}: Add one mana of any color that a land an opponent controls could produce.',
    }),
    card('Copy rainbow', {
      producedMana: ['U', 'B', 'G'],
      detail: '{T}: Add one mana of any type that a land you control could produce.',
    }),
  ]
  const direct = [
    dual('Sultai tri-land', ['U', 'B', 'G']),
    dual('Simic dual', ['U', 'G']),
    dual('Dimir dual', ['U', 'B']),
  ]
  const result = plan(deck, [...weak, ...direct], { identity: ['U', 'B', 'G'] })
  assert(direct.every((land) => names(result.picks).includes(land.name)))
  for (const land of weak) {
    const index = names(result.picks).indexOf(land.name)
    assert(index < 0 || direct.every((good) => names(result.picks).indexOf(good.name) < index))
  }
  assert(!result.alternatives.some((pick) => direct.includes(pick.card) && pick.held === 'basic'))
  const basics = planBasics(deck, ['U', 'B', 'G'], 38, [...weak, ...direct])
  assert(basics.find((entry) => entry.colour === 'U')!.count >= 2)
  assert(basics.find((entry) => entry.colour === 'B')!.count >= 2)
  assert.equal(
    basics.reduce((sum, entry) => sum + entry.count, 0),
    32,
  )
})

test('source quality distinguishes paid searches and rainbow output from direct and copy-only mana', () => {
  assert.equal(landSourceQuality(dual('Direct dual', ['U', 'G']), 'U'), 1)
  assert.equal(
    landSourceQuality(card('Paid', { detail: '{1}, {T}: Add one mana of any color.' }), 'U'),
    0.25,
  )
  assert.equal(
    landSourceQuality(
      card('Conditional search', {
        detail:
          '{2}, {T}, Sacrifice this land: Destroy target nonbasic land an opponent controls. Search your library for a basic land card.',
      }),
      'U',
    ),
    0.25,
  )
  assert.equal(
    landSourceQuality(
      card('Copy', {
        detail: '{T}: Add one mana of any type that a land you control could produce.',
      }),
      'U',
    ),
    0,
  )
  assert.match(
    basicSplitReason([
      { name: 'Forest', colour: 'G', count: 12 },
      { name: 'Island', colour: 'U', count: 4 },
    ]),
    /leans towards green.*coloured pips/,
  )
})

test('basic floors scale with pip share and respect held basics and scarce slots', () => {
  const deck = [
    commander('', '{U}{B}{G}'),
    ...copies(spell('Green', '{G}'), 20),
    ...copies(spell('Blue', '{U}'), 10),
    ...copies(spell('Black', '{B}'), 10),
  ]
  const rainbow = Array.from({ length: 15 }, (_, i) => dual(`Rainbow ${i}`, ['U', 'B', 'G']))
  const split = planBasics(deck, ['U', 'B', 'G'], 38, rainbow)
  for (const colour of ['U', 'B'])
    assert(split.find((entry) => entry.colour === colour)!.count >= 2)
  const held = [...deck, ...copies(basic('Island', 'U'), 5)]
  assert.equal(
    planBasics(held, ['U', 'B', 'G'], 6).reduce((sum, entry) => sum + entry.count, 0),
    1,
  )
  assert.deepEqual(planBasics(held, ['U', 'B', 'G'], 5), [])
})

test('specific limits replace soft hold labels and weak sources do not claim direct coverage', () => {
  const deck = simicDeck()
  const result = plan(
    deck,
    Array.from({ length: 15 }, (_, i) => dual(`Dual ${i}`, ['U', 'G'])),
    { identity: ['U', 'G'] },
  )
  assert(result.alternatives.length > 0)
  assert(result.alternatives.every((pick) => pick.held === 'cap'))
  const paid = card('Paid', {
    producedMana: ['U', 'G'],
    detail: '{1}, {T}: Add one mana of any color.',
  })
  const weak = plan(deck, [paid], { identity: ['U', 'G'] }).alternatives[0]
  assert.equal(weak.held, 'basic')
  assert.deepEqual(weak.helps, [])
  assert.doesNotMatch(landPlanReason(weak), /source you lack/)
})

test('restrictions survive sentence boundaries and free searches retain full credit', () => {
  assert.equal(
    landSourceQuality(
      card('Restricted', {
        detail: '{T}: Add one mana of any color. Spend this mana only to cast a creature spell.',
      }),
      'G',
    ),
    0.25,
  )
  assert.equal(
    landSourceQuality(
      card('Free fetch', {
        detail:
          '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped. Then if you control four or more lands, untap that land.',
      }),
      'G',
    ),
    1,
  )
  assert.equal(
    landSourceQuality(
      card('Opponent', {
        detail: '{T}: Add one mana of any color that a land an opponent controls could produce.',
      }),
      'G',
    ),
    0.25,
  )
  for (const colour of ['G', 'C'])
    assert.doesNotMatch(basicSplitReason([{ name: 'Basic', colour, count: 20 }]), /leans/)
})
