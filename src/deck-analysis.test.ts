import assert from 'node:assert/strict'
import test from 'node:test'
import { analyseDeck, basicLandPlan, curveBucket, deckGuidance, deckRoleBoosts, deckSection, defaultDeckTargets, type AnalysisCard } from './deck-analysis.ts'

const card = (overrides: Partial<AnalysisCard> = {}): AnalysisCard => ({ name: 'Card', layout: 'normal', typeLine: 'Creature', manaCost: '{2}{G}', manaValue: 3, detail: '', producedMana: [], faces: [], ...overrides })

test('analyses curve, coloured requirements, production, roles, and land range', () => {
  const analysis = analyseDeck([
    card(),
    card({ name: 'Growth', typeLine: 'Sorcery', manaCost: '{1}{G}', manaValue: 2, detail: 'Search your library for a basic land card.' }),
    card({ name: 'Dual', typeLine: 'Land', manaCost: '', manaValue: 0, detail: '{T}: Add {G} or {W}.', producedMana: ['G', 'W'] }),
    card({ name: 'Draw', detail: 'Draw cards equal to the number of creatures you control.' }),
    card({ name: 'Removal', typeLine: 'Instant', detail: 'Return target permanent to its owner’s hand.' }),
    card({ name: 'Wipe', typeLine: 'Sorcery', detail: 'Destroy all creatures.' }),
  ])
  assert.deepEqual(analysis.curve[2], { manaValue: 2, permanents: 0, nonPermanents: 1 })
  assert.equal(analysis.required.G, 5)
  assert.deepEqual(analysis.produced, { W: 1, U: 0, B: 0, R: 0, G: 1 })
  assert.deepEqual(analysis.counts, { lands: 1, ramp: 1, draw: 1, removal: 1, wipes: 1 })
  assert.deepEqual(analysis.typeCounts, { Creature: 2, Artifact: 0, Enchantment: 0, Instant: 1, Sorcery: 2, Planeswalker: 0, Battle: 0 })
  assert.equal(analysis.landRange.length, 2)
})

test('classifies common removal without treating one sacrifice as a wipe', () => {
  const analysis = analyseDeck([
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
    card({ detail: 'Search your library for a Forest card, put that card onto the battlefield, then shuffle.' }),
    card({ detail: 'Return all nonland permanents to their owners’ hands.' }),
    card({ detail: 'Return each nonland permanent you don’t control to its owner’s hand.' }),
    card({ detail: 'This spell deals 3 damage to each creature.' }),
    card({ detail: 'All creatures get -4/-4 until end of turn.' }),
  ])
  assert.equal(analysis.counts.ramp, 4)
  assert.equal(analysis.counts.wipes, 4)
})

test('modal spell-land counts as a land source and front spell in curve', () => {
  const analysis = analyseDeck([card({
    layout: 'modal_dfc', typeLine: 'Sorcery // Land', manaCost: '{1}{U}', manaValue: 2, producedMana: ['U'],
    faces: [{ typeLine: 'Sorcery', manaCost: '{1}{U}' }, { typeLine: 'Land', manaCost: '' }],
  })])
  assert.equal(analysis.counts.lands, 1)
  assert.deepEqual(analysis.curve[2], { manaValue: 2, permanents: 0, nonPermanents: 1 })
  assert.equal(analysis.required.U, 1)
  assert.equal(analysis.produced.U, 1)
})

test('counts castable multiface colour pips', () => {
  const analysis = analyseDeck([card({ layout: 'split', manaCost: '{1}{R} // {1}{U}', faces: [{ typeLine: 'Instant', manaCost: '{1}{R}' }, { typeLine: 'Instant', manaCost: '{1}{U}' }] })])
  assert.equal(analysis.required.R, 1)
  assert.equal(analysis.required.U, 1)
})

test('uses front face for adventure curve and excludes all-land modal cards', () => {
  const adventure = card({ layout: 'adventure', typeLine: 'Creature // Instant', manaValue: 3, faces: [{ typeLine: 'Creature', manaCost: '{2}{G}' }, { typeLine: 'Instant — Adventure', manaCost: '{G}' }] })
  const pathway = card({ layout: 'modal_dfc', typeLine: 'Land // Land', manaCost: '', manaValue: 0, faces: [{ typeLine: 'Land', manaCost: '' }, { typeLine: 'Land', manaCost: '' }] })
  const analysis = analyseDeck([adventure, pathway])
  assert.deepEqual(analysis.curve[3], { manaValue: 3, permanents: 1, nonPermanents: 0 })
  assert.equal(curveBucket(pathway), null)
})

test('groups deck cards by requested type order', () => {
  assert.deepEqual(['Creature', 'Enchantment', 'Artifact', 'Sorcery', 'Instant', 'Planeswalker', 'Land'].map(deckSection), ['Creatures', 'Enchantments', 'Artifacts', 'Sorceries', 'Instants', 'Other', 'Lands'])
})

test('splits basic lands by demand, falls back evenly, and respects open slots', () => {
  const demand = { W: 1, U: 0, B: 0, R: 0, G: 3 }
  assert.deepEqual(basicLandPlan(['W'], demand, 30, 35, 90), [{ name: 'Plains', colour: 'W', count: 5 }])
  assert.deepEqual(basicLandPlan(['W', 'G'], demand, 30, 35, 90), [{ name: 'Plains', colour: 'W', count: 1 }, { name: 'Forest', colour: 'G', count: 4 }])
  assert.deepEqual(basicLandPlan(['W', 'U'], { W: 0, U: 0, B: 0, R: 0, G: 0 }, 30, 35, 90), [{ name: 'Plains', colour: 'W', count: 3 }, { name: 'Island', colour: 'U', count: 2 }])
  assert.deepEqual(basicLandPlan([], demand, 30, 35, 98), [{ name: 'Wastes', colour: 'C', count: 2 }])
})

test('role boosts stay modest early and strengthen late', () => {
  const counts = { ...defaultDeckTargets, ramp: 5, wipes: 0 }
  assert.deepEqual(deckRoleBoosts(40, counts, defaultDeckTargets), { lands: 0, ramp: 3, draw: 0, removal: 0, wipes: 6 })
  assert.deepEqual(deckRoleBoosts(90, counts, defaultDeckTargets), { lands: 0, ramp: 9, draw: 0, removal: 0, wipes: 18 })
})

test('guidance starts at 70 and strengthens aggregate impossible late gaps', () => {
  assert.deepEqual(deckGuidance(69, { ...defaultDeckTargets }, defaultDeckTargets), [])
  const quiet = deckGuidance(70, { ...defaultDeckTargets, lands: 30 }, defaultDeckTargets)
  assert.equal(quiet[0].strong, false)
  const strong = deckGuidance(95, { lands: 33, ramp: 8, draw: 8, removal: 8, wipes: 3 }, defaultDeckTargets)
  assert.equal(strong.every((item) => item.strong), true)
})
