import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { analyseDeck, cardFeatures, rolesForCard, type CardFeatures } from './deck-analysis.ts'
import { toCard, toDeckCard, type ScryfallCard } from './domain/card-model.ts'
import { analyzeDeckDoctor } from './deck-doctor.ts'
import { suggestDeckDoctorChanges } from './deck-doctor-suggestions.ts'
import { buildEdhrecRecommendations } from './domain/recommendation-sources.ts'

type ReviewedCard = {
  input: ScryfallCard
  expected: {
    roles: Record<string, boolean>
    mana: CardFeatures['mana']
    draw: CardFeatures['draw']
    interaction: CardFeatures['interaction']
    wipe: boolean
  }
}
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/real-deck-roles.json', import.meta.url), 'utf8'),
) as {
  cards: Record<string, ReviewedCard>
  decks: { name: string; cards: { oracle_id: string; quantity: number }[] }[]
}
const record = (name: string): ScryfallCard => {
  const entry = Object.values(fixture.cards).find(({ input }) => input.name === name)!
  // Integration metadata is synthetic; the dated audit does not assert present legality.
  return {
    ...entry.input,
    set: 'audit',
    collector_number: entry.input.oracle_id!,
    prints_search_uri: '',
    released_at: '2020-01-01',
    legalities: { commander: 'legal' },
  }
}
const roleKeys = {
  land: 'lands',
  ramp: 'ramp',
  draw: 'draw',
  removal: 'removal',
  wipe: 'wipes',
} as const
const expectedRoles = (entry: ReviewedCard) =>
  Object.entries(roleKeys).flatMap(([key, role]) => (entry.expected.roles[key] ? [role] : []))

for (const entry of Object.values(fixture.cards)) {
  test(`reviewed roles and features: ${entry.input.name}`, () => {
    const card = toDeckCard(entry.input)
    assert.deepEqual(rolesForCard(card), expectedRoles(entry))
    const features = cardFeatures(card)
    for (const key of ['mana', 'draw', 'interaction'] as const) {
      const expected = entry.expected[key]
      // Both states withhold role credit; the audit does not require guessing unfamiliar wording.
      if (expected === null || expected === 'unknown')
        assert.ok(features[key] === null || features[key] === 'unknown', `${key}: ${features[key]}`)
      else assert.equal(features[key], expected, key)
    }
    assert.equal(features.wipe === true, entry.expected.wipe)
  })
}

test('real death payoffs stay linked and six/seven-mana top end is not a curve warning', () => {
  const deck = [
    'Teysa Karlov',
    'Liesa, Forgotten Archangel',
    'Requiem Angel',
    'Butcher of Malakir',
    'Sun Titan',
  ].map((name) => toDeckCard(record(name)))
  const expensive = {
    ...deck[4],
    name: 'Eight-mana audit outlier',
    manaCost: '{6}{W}{W}',
    manaValue: 8,
  }
  deck.push(
    expensive,
    ...Array.from({ length: 20 }, () => toDeckCard(record('Carrier Thrall'))),
    ...Array.from({ length: 18 }, () => toDeckCard(record('Plains'))),
    ...Array.from({ length: 17 }, () => toDeckCard(record('Swamp'))),
  )
  const findings = analyzeDeckDoctor({
    deck,
    sideboard: [],
    commanderCount: 1,
    theme: 'Sacrifice',
    activeSubThemes: [],
    deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
  })
  assert.ok(
    !findings
      .find(({ kind }) => kind === 'weak-connection')
      ?.cardNames.includes('Liesa, Forgotten Archangel'),
  )
  assert.deepEqual(findings.find(({ kind }) => kind === 'mana-outlier')?.cardNames, [
    expensive.name,
  ])
})

test('instant provider categories do not claim interaction and true overlapping roles remain available', () => {
  const records = ['Rally the Ancestors', 'Fountainport', 'Carrier Thrall'].map(record)
  const cards = buildEdhrecRecommendations(
    records.map((card) => ({ name: card.name, tag: 'instants', header: 'Instants' })),
    records,
    {
      includeCreature: false,
      excludeGameChangers: false,
      excludeTutors: false,
      excludeExtraTurns: false,
      excludeUnreleased: false,
      powerTarget: 'high',
    },
  )
  assert.equal(cards.find(({ name }) => name === 'Rally the Ancestors')?.reason, 'Instant support')
  assert.deepEqual(rolesForCard(cards.find(({ name }) => name === 'Fountainport')!), [
    'lands',
    'draw',
  ])
  assert.deepEqual(rolesForCard(cards.find(({ name }) => name === 'Carrier Thrall')!), ['ramp'])
})

test('a Sun Titan to Rally swap invents no removal or wipe delta', () => {
  const commander = toDeckCard(record('Teysa Karlov'))
  const cut = toDeckCard(record('Sun Titan'))
  const addCard = toCard(record('Rally the Ancestors'), 'Instant support')
  const deck = [
    commander,
    cut,
    ...Array.from({ length: 98 }, () => toDeckCard(record('Carrier Thrall'))),
  ]
  const findings = [
    {
      id: 'weak-connections',
      kind: 'weak-connection' as const,
      title: '',
      summary: '',
      evidence: [],
      cardNames: [cut.name],
    },
  ]
  const suggestions = suggestDeckDoctorChanges({
    deck,
    commanderCount: 1,
    commanderColours: ['W', 'B'],
    deckTargets: { lands: 0, ramp: 0, draw: 0, removal: 0, wipes: 0 },
    theme: 'Graveyard',
    activeSubThemes: [],
    findings,
    rankedCandidates: [{ card: addCard, fit: 90 }],
    ratedCuts: deck.slice(1).map((card) => ({ card, fit: card === cut ? 0 : 100 })),
  })['weak-connections']
  assert.ok(suggestions.some((suggestion) => suggestion.cut?.cutCard.name === cut.name))
  for (const { impact } of suggestions) assert.doesNotMatch(impact, /Targeted removal|Board wipes/)
})

for (const deck of fixture.decks) {
  test(`reviewed sidebar totals: ${deck.name}`, () => {
    assert.equal(
      deck.cards.reduce((sum, { quantity }) => sum + quantity, 0),
      100,
    )
    const expected = { lands: 0, ramp: 0, draw: 0, removal: 0, wipes: 0 }
    const cards = deck.cards.flatMap(({ oracle_id, quantity }) => {
      const entry = fixture.cards[oracle_id]
      for (const role of expectedRoles(entry)) expected[role] += quantity
      return Array.from({ length: quantity }, () => toDeckCard(entry.input))
    })
    assert.deepEqual(analyseDeck(cards).counts, expected)
  })
}
