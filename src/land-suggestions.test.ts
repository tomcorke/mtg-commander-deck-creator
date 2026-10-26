import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisCard } from './deck-analysis.ts'
import { rankLandSuggestions } from './land-suggestions.ts'

// Synthetic cards modelled on the named real lands; text is trimmed to the parts the ranking reads.
const card = (name: string, overrides: Partial<AnalysisCard> = {}): AnalysisCard => ({
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
const spell = (manaCost: string, manaValue: number, detail = '') =>
  card(`Spell ${manaCost}`, { typeLine: 'Creature', manaCost, manaValue, detail })
const basic = (type: string, colour: string) =>
  card(type, { typeLine: `Basic Land — ${type}`, producedMana: [colour] })
const deckOf = (...groups: [AnalysisCard, number][]) =>
  groups.flatMap(([item, count]) => Array.from({ length: count }, () => item))
const rank = (
  candidates: AnalysisCard[],
  deck: AnalysisCard[],
  identity: string[],
  excluded: string[] = [],
) => rankLandSuggestions(candidates, deck, { excluded, identity, landTarget: 35, limit: 6 })
const names = (result: { card: AnalysisCard }[]) => result.map(({ card }) => card.name)

const sacredFoundry = card('Sacred Foundry', {
  typeLine: 'Land — Mountain Plains',
  producedMana: ['R', 'W'],
  detail:
    'As Sacred Foundry enters, you may pay 2 life. If you don’t, it enters tapped.\n{T}: Add {R} or {W}.',
})
const tappedMountain = card('Tapped Mountain', {
  producedMana: ['R'],
  detail: 'Tapped Mountain enters tapped.\n{T}: Add {R}.',
})
const warRoom = card('War Room', {
  producedMana: ['C'],
  detail:
    '{T}: Add {C}.\n{3}, {T}, Pay life equal to the number of colors in your commanders’ color identity: Draw a card.',
})
const raffinesTower = card("Raffine's Tower", {
  typeLine: 'Land — Plains Island Swamp',
  producedMana: ['W', 'U', 'B'],
  detail: "Raffine's Tower enters tapped.\n{T}: Add {W}, {U}, or {B}.\nCycling {3}",
})
const woodedFoothills = card('Wooded Foothills', {
  detail:
    '{T}, Pay 1 life, Sacrifice Wooded Foothills: Search your library for a Mountain or Forest card, put it onto the battlefield, then shuffle.',
})
const floodedStrand = card('Flooded Strand', {
  detail:
    '{T}, Pay 1 life, Sacrifice Flooded Strand: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.',
})
const mdfc = card('Turntimber Symbiosis', {
  layout: 'modal_dfc',
  typeLine: 'Sorcery // Land',
  producedMana: ['G'],
  detail:
    'Look at the top seven cards of your library. // As Turntimber, Serpentine Wood enters, you may pay 3 life. If you don’t, it enters tapped.\n{T}: Add {G}.',
  faces: [
    { typeLine: 'Sorcery', manaCost: '{4}{G}{G}{G}' },
    { typeLine: 'Land', manaCost: '' },
  ],
})
const tappedGrove = card('Tapped Grove', {
  producedMana: ['G'],
  detail: 'Tapped Grove enters tapped.\n{T}: Add {G}.',
})

test('a land fixing two short colours beats a basic; a one-colour tapland does not', () => {
  const deck = deckOf(
    [basic('Mountain', 'R'), 4],
    [basic('Plains', 'W'), 4],
    [spell('{R}{W}', 2), 20],
  )
  const result = rank([tappedMountain, sacredFoundry, warRoom], deck, ['R', 'W'])
  assert.deepEqual(names(result), ['Sacred Foundry'])
  assert.match(result[0].benefit, /red or white source/)
  assert.match(result[0].drawback, /tapped unless/)
  assert.match(result[0].drawback, /life/)
})

test('early pip-heavy colours outrank late ones', () => {
  const early = card('Early dual', { producedMana: ['W', 'U'], detail: '{T}: Add {W} or {U}.' })
  const late = card('Late dual', { producedMana: ['U', 'B'], detail: '{T}: Add {U} or {B}.' })
  const deck = deckOf([spell('{W}{W}', 2), 10], [spell('{5}{B}{B}', 7), 10], [spell('{U}', 1), 5])
  assert.equal(names(rank([late, early], deck, ['W', 'U', 'B']))[0], 'Early dual')
})

test('colourless lands fill colourless needs but never a coloured gap', () => {
  const colourless = deckOf([spell('{C}{C}', 2), 10], [basic('Island', 'U'), 20])
  assert.deepEqual(names(rank([warRoom], colourless, ['U'])), ['War Room'])
  const coloured = deckOf([spell('{G}{G}', 2), 10])
  assert.deepEqual(rank([warRoom], coloured, ['G']), [])
})

test('utility and tapped lands win once coloured sources are met', () => {
  const tri = card('Tri source', { producedMana: ['W', 'U', 'B'] })
  const deck = deckOf([tri, 34], [spell('{W}{U}{B}', 3), 20])
  const result = rank([raffinesTower, warRoom], deck, ['W', 'U', 'B'])
  assert.deepEqual(names(result), ['War Room', "Raffine's Tower"])
  assert.match(result[0].benefit, /Draw a card/)
  assert.match(result[0].drawback, /costs mana/)
  assert.match(result[1].benefit, /cycle/)
  assert.match(result[1].drawback, /Always enters tapped/)
})

test('fetch lands need a remaining target and count landfall', () => {
  const deck = deckOf([spell('{G}', 1, 'Landfall — Whenever a land you control enters, draw.'), 20])
  const result = rank([woodedFoothills, floodedStrand], deck, ['G'])
  assert.deepEqual(names(result), ['Wooded Foothills'])
  assert.match(result[0].benefit, /Fetches a Forest/)
  assert.match(result[0].benefit, /landfall/)
  const plain = rank([woodedFoothills], deckOf([spell('{G}', 1), 20]), ['G'])[0]
  assert.doesNotMatch(plain.benefit, /landfall/)
})

test('an MDFC is one land-or-spell choice', () => {
  const [result] = rank([mdfc], deckOf([spell('{G}', 1), 20]), ['G'])
  assert.match(result.benefit, /spell instead/)
  assert.match(result.drawback, /land or a spell, not both/)
})

test('an untapped basic beats a tapped land for the same colour', () => {
  assert.deepEqual(rank([tappedGrove], deckOf([spell('{G}{G}', 2), 20]), ['G']), [])
})

test('excluded, basic and duplicate candidates are skipped and output is deterministic', () => {
  const deck = deckOf(
    [basic('Mountain', 'R'), 4],
    [basic('Plains', 'W'), 4],
    [spell('{R}{W}', 2), 20],
  )
  const pool = [sacredFoundry, basic('Plains', 'W'), sacredFoundry, warRoom]
  assert.deepEqual(rank(pool, deck, ['R', 'W'], ['Sacred Foundry']), [])
  assert.deepEqual(rank(pool, deck, ['R', 'W']), rank([...pool].reverse(), deck, ['R', 'W']))
})
