import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets, rolesForCard } from './deck-analysis.ts'
import {
  analyzeDeckDoctor,
  applyDeckDoctorSwapPlan,
  undoDeckDoctorSwap,
  type DeckDoctorFinding,
} from './deck-doctor.ts'
import {
  addDoctorSuggestionToPlan,
  doctorSuggestionIsInPlan,
  suggestDeckDoctorChanges,
  toggleDoctorSuggestionInPlan,
} from './deck-doctor-suggestions.ts'
import type { Card, DeckCard } from './domain/card-model.ts'

const card = (name: string, overrides: Partial<DeckCard> = {}): DeckCard => ({
  name,
  layout: 'normal',
  typeLine: 'Creature',
  commanderLegality: 'legal',
  colorIdentity: ['G'],
  manaCost: '{1}{G}',
  manaValue: 2,
  detail: '',
  producedMana: [],
  faces: [],
  image: '',
  set: 'tst',
  collectorNumber: '1',
  tags: [],
  ...overrides,
})
const addition = (name: string, overrides: Partial<Card> = {}): Card => ({
  ...card(name),
  reason: 'Commander synergy',
  printsUri: '',
  producedMana: ['G'],
  ...overrides,
})
const finding = (id = 'role-gap:ramp', names: string[] = []): DeckDoctorFinding => ({
  id,
  kind: id.startsWith('role-gap:')
    ? 'role-gap'
    : id.startsWith('theme-support:')
      ? 'theme-support'
      : id === 'mana-outliers'
        ? 'mana-outlier'
        : 'weak-connection',
  title: id,
  summary: '',
  evidence: [],
  cardNames: names,
})
function input(cuts: DeckCard[], candidates: Card[] = [addition('Ramp')]) {
  const deck = [card('Commander'), ...cuts]
  while (deck.length < 100) deck.push(card(`Strong fit ${deck.length}`, { tags: ['Tokens'] }))
  return {
    deck,
    commanderCount: 1,
    commanderColours: ['G'],
    deckTargets: defaultDeckTargets,
    theme: 'Tokens',
    activeSubThemes: [],
    findings: [finding()],
    rankedCandidates: candidates.map((card) => ({ card, fit: 50 })),
    ratedCuts: deck.slice(1).map((card) => ({ card, fit: cuts.includes(card) ? 5 : 75 })),
  }
}
const rampSuggestions = (options: Parameters<typeof suggestDeckDoctorChanges>[0]) =>
  suggestDeckDoctorChanges(options)['role-gap:ramp']

// Pairing contract: flagged or lowest-fit non-role cuts, role-filling ranked additions;
// commanders, scarce lands and the last scarce role are never cuts. Build mode adds only.
test('a real ramp shortfall offers up to three distinct, role-filling swaps with accurate impact', () => {
  const options = input(
    [
      card('Low A'),
      card('Low B'),
      card('Low C'),
      card('Low D'),
      card('Existing ramp A', { producedMana: ['G'] }),
      card('Existing ramp B', { producedMana: ['G'] }),
    ],
    [
      addition('Ramp + draw', { detail: 'Draw a card.' }),
      addition('Ramp B'),
      addition('Ramp C'),
      addition('Ramp D'),
      addition('Not ramp', { producedMana: [] }),
    ],
  )
  options.findings = analyzeDeckDoctor({ ...options, sideboard: [] })
  const suggestions = rampSuggestions(options)
  assert.equal(suggestions.length, 3)
  assert.equal(new Set(suggestions.map(({ cut }) => cut?.cutIndex)).size, 3)
  assert.equal(new Set(suggestions.map(({ addCard }) => addCard.name)).size, 3)
  assert(
    suggestions.every(
      ({ cut, addCard }) =>
        cut &&
        cut.cutIndex > 0 &&
        !rolesForCard(cut.cutCard).includes('ramp') &&
        rolesForCard(addCard).includes('ramp'),
    ),
  )
  assert.equal(suggestions[0].impact, 'Ramp 2 → 3 · Card draw 0 → 1')
})

test('flagged cuts remain available even when fit is high; strong unflagged cards are not cuts', () => {
  const options = input([card('Flagged'), card('Strong')])
  options.ratedCuts.forEach((rated) => {
    rated.fit = 80
  })
  options.findings.push(finding('weak-connections', ['Flagged']))
  assert.deepEqual(
    rampSuggestions(options).map(({ cut }) => cut?.cutCard.name),
    ['Flagged'],
  )
  options.findings.pop()
  assert.deepEqual(rampSuggestions(options), [])
})

test('low-fit fallback is restricted to the bottom quartile and never includes recommended-fit cards', () => {
  const options = input(Array.from({ length: 30 }, (_, i) => card(`Cut ${i}`)))
  options.ratedCuts.forEach((rated, i) => {
    rated.fit = i < 25 ? 5 : 30
  })
  options.ratedCuts[0].fit = 45
  const suggestions = rampSuggestions(options)
  assert(
    suggestions.every(
      ({ cut }) =>
        (options.ratedCuts.find(({ card }) => card === cut?.cutCard)?.fit ?? Infinity) === 5,
    ),
  )
  options.ratedCuts.forEach((rated) => {
    rated.fit = 45
  })
  assert.deepEqual(rampSuggestions(options), [])
})

test('neither commander in a partner pair nor an existing ramp card can be a ramp cut', () => {
  const partner = card('Partner')
  const ramp = card('Existing ramp', { producedMana: ['G'] })
  const options = input([partner, ramp, card('Safe')])
  options.commanderCount = 2
  options.findings.push(finding('weak-connections', ['Commander', 'Partner', ramp.name]))
  assert.deepEqual(
    rampSuggestions(options).map(({ cut }) => cut?.cutCard.name),
    ['Safe'],
  )
})

test('lands at or below their target are protected, but surplus lands can be cuts', () => {
  const options = input([
    card('Forest', {
      typeLine: 'Basic Land — Forest',
      manaCost: '',
      manaValue: 0,
      producedMana: ['G'],
    }),
  ])
  for (const target of [1, 35]) {
    options.deckTargets = { ...defaultDeckTargets, lands: target }
    assert.deepEqual(rampSuggestions(options), [])
  }
  options.deckTargets = { ...defaultDeckTargets, lands: 0 }
  assert.equal(
    rampSuggestions(options)[0].impact,
    'Lands 1 → 0 · Ramp 0 → 1 · Mana value: land → 2',
  )
})

test('the last scarce role is protected even when the addition would replace that role', () => {
  const options = input(
    [card('Last draw', { detail: 'Draw a card.' })],
    [addition('Ramp + draw', { detail: 'Draw a card.' })],
  )
  assert.deepEqual(rampSuggestions(options), [])
  options.deckTargets = { ...defaultDeckTargets, draw: 0 }
  assert.equal(rampSuggestions(options)[0].cut?.cutCard.name, 'Last draw')
})

test('multi-role cuts cannot reduce another role already at or below its target', () => {
  const options = input([
    card('Draw A', { detail: 'Draw a card.' }),
    card('Draw B', { detail: 'Draw a card.' }),
  ])
  assert.deepEqual(rampSuggestions(options), [])
  options.rankedCandidates = [
    { card: addition('Ramp + draw', { detail: 'Draw a card.' }), fit: 50 },
  ]
  assert.equal(rampSuggestions(options)[0].impact, 'Ramp 0 → 1')
})

test('equal-fit pairs prefer the same curve bucket and nearby coloured-pip requirements', () => {
  const options = input(
    [card('Low')],
    [addition('Far curve', { manaCost: '{4}{G}', manaValue: 5 }), addition('Close')],
  )
  assert.equal(rampSuggestions(options)[0].addCard.name, 'Close')
  options.deck[0].producedMana = ['G']
  options.deck[5].producedMana = ['G']
  options.rankedCandidates = [
    { card: addition('More green', { manaCost: '{G}{G}', producedMana: ['G'] }), fit: 50 },
    { card: addition('Close'), fit: 50 },
  ]
  assert.equal(rampSuggestions(options)[0].addCard.name, 'Close')
})

test('curve impact uses fixed buckets, omits same-bucket changes, and groups 7+ spells', () => {
  const options = input([card('Fractional', { manaValue: 2.5 })])
  assert.equal(rampSuggestions(options)[0].impact, 'Ramp 0 → 1')
  options.rankedCandidates[0].card.manaValue = 3
  assert.match(rampSuggestions(options)[0].impact, /Mana value: 2 → 3/)
  options.deck[1].manaValue = 9
  options.rankedCandidates[0].card.manaValue = 8
  assert.equal(rampSuggestions(options)[0].impact, 'Ramp 0 → 1')
  options.rankedCandidates[0].card.manaValue = 2
  assert.match(rampSuggestions(options)[0].impact, /Mana value: 7\+ → 2/)
})

test('construction rejects wrong identity, bans, duplicates by oracle ID, unknown mana, and typed lands', () => {
  const options = input(
    [card('Cut')],
    [
      addition('Wrong colour', { colorIdentity: ['U'] }),
      addition('Banned', { commanderLegality: 'banned' }),
      addition('Unknown mana', { manaValueKnown: false }),
      addition('Unknown identity', { colorIdentity: undefined }),
      addition('Same oracle', { oracleId: 'existing' }),
      addition('Typed land', { typeLine: 'Land — Island', colorIdentity: [] }),
    ],
  )
  options.deck[3].oracleId = 'existing'
  assert.deepEqual(rampSuggestions(options), [])
  options.findings = [finding('role-gap:lands')]
  options.rankedCandidates = [
    { card: addition('Typed land', { typeLine: 'Land — Island', colorIdentity: [] }), fit: 50 },
  ]
  assert.deepEqual(suggestDeckDoctorChanges(options)['role-gap:lands'], [])
})

test('no good pair yields no suggestion instead of a weak or harder-to-cast replacement', () => {
  assert.deepEqual(
    rampSuggestions(input([card('Cut')], [addition('Not ramp', { producedMana: [] })])),
    [],
  )
  assert.deepEqual(
    rampSuggestions(input([card('Cut')], [addition('Too many pips', { manaCost: '{G}{G}' })])),
    [],
  )
  assert.deepEqual(
    rampSuggestions(input([card('Cut')], [addition('New high-cost outlier', { manaValue: 8 })])),
    [],
  )
})

test('build mode suggests additions only at 89 cards, and review pairs at 90', () => {
  const options = input([card('Cut')])
  options.deck = options.deck.slice(0, 89)
  const suggestions = rampSuggestions(options)
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].cut, undefined)
  assert.equal(suggestions[0].impact, 'Ramp 0 → 1 · Curve: +1 at 2')
  options.deck.push(card('Ninetieth'))
  assert.equal(rampSuggestions(options)[0].cut?.cutCard.name, 'Cut')
})

test('theme findings preserve existing support and add a matching theme or sub-theme', () => {
  const options = input(
    [card('Cut'), card('Only support', { tags: ['Tokens'] })],
    [addition('Token support', { tags: ['Tokens'] }), addition('Unrelated')],
  )
  options.findings = [finding('theme-support:Tokens')]
  const suggestions = suggestDeckDoctorChanges(options)['theme-support:Tokens']
  assert.equal(suggestions[0].cut?.cutCard.name, 'Cut')
  assert.equal(suggestions[0].addCard.name, 'Token support')
  assert.match(suggestions[0].impact, /Tokens support 98 → 99/)
})

test('weak-connection additions must connect to the deck that remains, not only to the cut', () => {
  const options = input(
    [card('Token maker', { detail: 'Create a token creature.' })],
    [addition('Payoff', { detail: 'Tokens you control get +1/+1.', producedMana: [] })],
  )
  options.theme = ''
  options.findings = [finding('weak-connections', ['Token maker'])]
  assert.deepEqual(suggestDeckDoctorChanges(options)['weak-connections'], [])
  options.deck[0].detail = 'Create a token creature.'
  assert.equal(suggestDeckDoctorChanges(options)['weak-connections'][0].addCard.name, 'Payoff')
})

test('mana-outlier suggestions improve cost or source gaps and never replace a spell with a land', () => {
  const options = input(
    [card('Expensive', { manaCost: '{5}{G}', manaValue: 6 })],
    [
      addition('Same cost', { manaValue: 6 }),
      addition('Worse cost', { manaValue: 7 }),
      addition('Land', { typeLine: 'Land', manaCost: '', manaValue: 0 }),
      addition('Cheaper'),
    ],
  )
  options.findings = [finding('mana-outliers', ['Expensive'])]
  assert.deepEqual(
    suggestDeckDoctorChanges(options)['mana-outliers'].map(({ addCard }) => addCard.name),
    ['Cheaper'],
  )
  options.deck = options.deck.slice(0, 89)
  assert.deepEqual(suggestDeckDoctorChanges(options)['mana-outliers'], [])
})

test('a suggested swap applies atomically, recomputes findings, records history, and undoes', () => {
  const options = input([card('Cut')])
  options.deckTargets = { ...defaultDeckTargets, ramp: 1 }
  options.findings = analyzeDeckDoctor({ ...options, sideboard: [] })
  const suggestion = rampSuggestions(options)[0]
  const applied = applyDeckDoctorSwapPlan({
    ...options,
    id: 'suggested',
    sideboard: [],
    cuts: [suggestion.cut!],
    additions: [suggestion.addCard],
    moveCutToSideboard: false,
  })
  assert.equal(applied.deck.length, 100)
  assert.equal(applied.records.length, 1)
  assert.equal(applied.records[0].cutCard?.name, 'Cut')
  const findings = analyzeDeckDoctor({ ...options, deck: applied.deck, sideboard: [] })
  assert(!findings.some(({ id }) => id === 'role-gap:ramp'))
  assert.deepEqual(
    undoDeckDoctorSwap({ ...options, ...applied, record: applied.records[0] }).deck,
    options.deck,
  )
})

test('plan staging keeps manual pairs, inserts both halves together, and rejects conflicting picks', () => {
  const suggestion = rampSuggestions(input([card('Cut')]))[0]
  const draft = { cutIndexes: [5, 6, 7], additionNames: ['Manual'] }
  const next = addDoctorSuggestionToPlan(draft, suggestion)
  assert.deepEqual(next, { cutIndexes: [5, 1, 6, 7], additionNames: ['Manual', 'Ramp'] })
  assert.deepEqual(draft, { cutIndexes: [5, 6, 7], additionNames: ['Manual'] })
  assert.equal(addDoctorSuggestionToPlan(next, suggestion), next)
  const cutConflict = { cutIndexes: [1], additionNames: [] }
  assert.equal(addDoctorSuggestionToPlan(cutConflict, suggestion), cutConflict)
  const extraAdditions = { cutIndexes: [5], additionNames: ['Manual', 'Extra'] }
  assert.deepEqual(addDoctorSuggestionToPlan(extraAdditions, suggestion), {
    cutIndexes: [5, 1],
    additionNames: ['Manual', 'Ramp', 'Extra'],
  })
  assert.deepEqual(
    addDoctorSuggestionToPlan(
      { cutIndexes: [], additionNames: ['Manual'] },
      { addCard: addition('Build add'), impact: '' },
    ),
    { cutIndexes: [], additionNames: ['Manual', 'Build add'] },
  )
})

test('suggestion toggles remove only the exact pair, including additions-only plans', () => {
  const suggestion = rampSuggestions(input([card('Cut')]))[0]
  const draft = { cutIndexes: [5, 6, 7], additionNames: ['Manual'] }
  const picked = toggleDoctorSuggestionInPlan(draft, suggestion)
  assert(doctorSuggestionIsInPlan(picked, suggestion))
  assert.deepEqual(toggleDoctorSuggestionInPlan(picked, suggestion), draft)
  assert.deepEqual(picked, { cutIndexes: [5, 1, 6, 7], additionNames: ['Manual', 'Ramp'] })
  for (const overlap of [
    { cutIndexes: [1], additionNames: ['Other'] },
    { cutIndexes: [5], additionNames: ['Ramp'] },
    { cutIndexes: [5, 1], additionNames: ['Ramp', 'Other'] },
    { cutIndexes: [1], additionNames: [] },
  ]) {
    assert(!doctorSuggestionIsInPlan(overlap, suggestion))
    assert.equal(toggleDoctorSuggestionInPlan(overlap, suggestion), overlap)
  }
  const build = { addCard: addition('Build add'), impact: '' }
  const unpaired = { cutIndexes: [5], additionNames: ['Manual', 'Build add'] }
  assert(doctorSuggestionIsInPlan(unpaired, build))
  assert.deepEqual(toggleDoctorSuggestionInPlan(unpaired, build), {
    cutIndexes: [5],
    additionNames: ['Manual'],
  })
  const paired = { cutIndexes: [5], additionNames: ['Build add'] }
  assert(!doctorSuggestionIsInPlan(paired, build))
  assert.equal(toggleDoctorSuggestionInPlan(paired, build), paired)
})
