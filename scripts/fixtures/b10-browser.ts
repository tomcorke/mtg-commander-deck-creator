import assert from 'node:assert/strict'
import { setTimeout as pause } from 'node:timers/promises'
import {
  isScryfallCard,
  toCard,
  toDeckCard,
  type ScryfallCard,
} from '../../src/domain/card-model.ts'
import { persistedDeckStateSchema, type PersistedDeckState } from '../../src/deck-state.ts'

// Synthetic provider records exercise app heuristics; they make no claims about real cards.
export function fixtureCard(name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  const record: ScryfallCard = {
    name,
    oracle_id: `b10:${name}`,
    layout: 'normal',
    type_line: 'Artifact',
    cmc: 2,
    mana_cost: '{2}',
    oracle_text: '',
    color_identity: [],
    legalities: { commander: 'legal' },
    game_changer: false,
    released_at: '2020-01-01',
    set: 'tst',
    set_name: 'B10 Fixture Alpha',
    collector_number: name,
    prints_search_uri: `https://api.scryfall.com/cards/search?q=oracleid:${encodeURIComponent(`b10:${name}`)}`,
    scryfall_uri: `https://scryfall.com/card/tst/${encodeURIComponent(name)}`,
    finishes: ['nonfoil'],
    image_uris: {
      normal: `https://cards.scryfall.io/normal/front/${encodeURIComponent(name)}.jpg`,
    },
    prices: { usd: '1.00' },
    ...overrides,
  }
  assert(isScryfallCard(record), `valid Scryfall fixture: ${name}`)
  return record
}
export const commander = fixtureCard('B10 Commander', {
  type_line: 'Legendary Creature — Human',
  cmc: 3,
  mana_cost: '{2}{G}',
  color_identity: ['G'],
  power: '2',
  toughness: '2',
  oracle_text: 'Create two 1/1 green Elf creature tokens.',
})
export const basic = fixtureCard('B10 Basic', {
  type_line: 'Basic Land — Forest',
  cmc: 0,
  mana_cost: '',
  color_identity: ['G'],
  produced_mana: ['G'],
})
const ramp = (name: string, overrides: Partial<ScryfallCard> = {}) =>
  fixtureCard(name, {
    oracle_text: '{T}: Add {G}.',
    color_identity: ['G'],
    produced_mana: ['G'],
    ...overrides,
  })
export const baseCandidates = [
  ramp('B10 Ramp draw', { oracle_text: '{T}: Add {G}. Draw a card.' }),
  ramp('B10 Ramp two'),
  ramp('B10 Ramp three'),
  ramp('B10 Ramp curve', { cmc: 3, mana_cost: '{3}' }),
  ...Array.from({ length: 8 }, (_, index) => fixtureCard(`B10 Spare ${index}`)),
]
export const preferenceCandidates = [
  ramp('B10 Expensive', { prices: { usd: '25.00' } }),
  ramp('B10 Game Changer', { game_changer: true }),
  ramp('B10 Tutor', { oracle_text: '{T}: Add {G}. Search your library for a card.' }),
  ramp('B10 Extra turn', { oracle_text: '{T}: Add {G}. Take an extra turn after this one.' }),
  ramp('B10 Future', { released_at: '2999-01-01' }),
  // Only the name exercises the app's explicit Core filter, not this card's real Oracle data.
  ramp('Lotus Petal'),
  ramp('B10 Other set', { set: 'oth', set_name: 'B10 Fixture Beta' }),
  ramp('B10 Selected set'),
  ramp('B10 Backup'),
  ramp('B10 Backup two'),
]
export const goalCandidates = [
  ramp('B10 Nearby ramp'),
  ramp('B10 Theme ramp', {
    cmc: 5,
    mana_cost: '{5}',
    oracle_text: '{T}: Add {G}. Create two 1/1 green Elf creature tokens.',
  }),
  fixtureCard('B10 Goal spare A'),
  fixtureCard('B10 Goal spare B'),
]
export const deckRecords = [
  commander,
  ramp('B10 Existing ramp A'),
  ramp('B10 Existing ramp B'),
  fixtureCard('B10 Last draw', { cmc: 7, mana_cost: '{7}', oracle_text: 'Draw a card.' }),
  ...Array.from({ length: 35 }, () => basic),
  ...['A', 'B', 'C'].map((suffix) =>
    fixtureCard(`B10 Cut ${suffix}`, { type_line: 'Creature — Human', power: '2', toughness: '2' }),
  ),
  ...Array.from({ length: 58 }, (_, index) =>
    fixtureCard(`B10 Theme ${index}`, {
      type_line: 'Creature — Elf',
      power: '2',
      toughness: '2',
      oracle_text: 'Create two 1/1 green Elf creature tokens.',
    }),
  ),
]
export const allRecords = [
  ...new Map(
    [...deckRecords, ...baseCandidates, ...preferenceCandidates, ...goalCandidates].map(
      (record) => [record.name, record],
    ),
  ).values(),
]

/** Optional live-data fixture for appearance review; never used by the functional gate. */
export async function prepareAppearanceState(): Promise<PersistedDeckState> {
  const records: ScryfallCard[] = []
  // Reuse the existing check-deck-review.ts source cards; fetch their current facts and art.
  for (const name of ['Meren of Clan Nel Toth', 'Forest', 'Sol Ring', 'Arcane Signet']) {
    const response = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CommanderCreatorAppearanceFixture/1.0',
        },
      },
    )
    assert.equal(response.status, 200, `appearance fixture response: ${name}`)
    const record = await response.json()
    assert(isScryfallCard(record), `valid appearance fixture: ${name}`)
    assert.equal(record.legalities?.commander, 'legal')
    records.push(record)
    await pause(500)
  }
  const [leader, land, ...candidates] = records
  return makeState({
    commander: leader.name,
    commanderDetails: {
      images: [leader.image_uris!.normal],
      art: [leader.image_uris!.art_crop ?? leader.image_uris!.normal],
      colours: leader.color_identity,
      printings: [[]],
      selections: [0],
    },
    theme: 'Graveyard',
    queue: candidates.map((record) => toCard(record, 'Commander synergy')),
    deck: [toDeckCard(leader), ...Array.from({ length: 99 }, () => toDeckCard(land))],
  })
}

export function makeState(overrides: Partial<PersistedDeckState> = {}): PersistedDeckState {
  return persistedDeckStateSchema.parse({
    commander: commander.name,
    commanderDetails: {
      images: [commander.image_uris!.normal],
      art: [commander.image_uris!.normal],
      colours: ['G'],
      printings: [[]],
      selections: [0],
    },
    theme: 'Tokens',
    recommendationStyle: 'balanced',
    prioritizeDeckHealth: true,
    queue: baseCandidates.map((record) => toCard(record, 'Commander synergy')),
    limitedRecommendations: false,
    decisions: {},
    ignoredCards: [],
    liked: [],
    activeSubThemes: [],
    dismissedSubThemes: [],
    preferenceScores: {},
    commanderSubThemes: [],
    deferredCards: [],
    batchNumber: 1,
    deck: deckRecords.map(toDeckCard),
    sideboard: [],
    preferredPrintSet: '',
    deckTargets: { lands: 35, ramp: 10, draw: 1, removal: 0, wipes: 0 },
    ...overrides,
  })
}
