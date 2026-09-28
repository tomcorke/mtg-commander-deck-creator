import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets } from '../deck-analysis.ts'
import {
  fetchDeckDoctorCandidates,
  fetchDeckDoctorCommanders,
  start,
} from './recommendation-actions.ts'

const names = ["Kraum, Ludevic's Opus", 'Tymna the Weaver']
const recommendationNames = ['Sol Ring', 'Arcane Signet', 'Rhystic Study', 'Smothering Tithe']

const card = (name: string, typeLine = 'Artifact', colourIdentity: string[] = []) => ({
  name,
  type_line: typeLine,
  color_identity: colourIdentity,
  set: 'tst',
  collector_number: '1',
  prints_search_uri: 'https://scryfall.com/search?q=test',
  finishes: ['nonfoil'],
})

test('partner retry requests combined EDHREC recommendations', async () => {
  const edhrecSlugs: string[] = []
  const fallbackQueries: string[] = []
  const noop = () => {}
  const deps = {
    activeModal: null,
    activeSubThemes: [],
    collectionMode: 'none',
    collectionSets: [],
    deck: [],
    deckTargets: defaultDeckTargets,
    deferredCards: [],
    edhrecRetryInFlight: { current: false },
    excludeExtraTurns: false,
    excludeGameChangers: false,
    excludeTutors: false,
    excludeUnreleased: false,
    freshRecommendationCycle: () => ({ deferredCards: [], batchNumber: 1 }),
    includeCreature: false,
    ignoredCards: [],
    navigateView: noop,
    powerTarget: 'upgraded',
    preferenceScores: {},
    prioritizeDeckHealth: false,
    recommendationStyle: 'balanced',
    searchCards: async (query: string) => {
      fallbackQueries.push(query)
      return []
    },
    setBatchAnnouncement: noop,
    setBatchNumber: noop,
    setCollectionError: noop,
    setCollectionState: noop,
    setCommander: noop,
    setCommanderDetails: noop,
    setCommanderSubThemes: noop,
    setDecisions: noop,
    setDeferredCards: noop,
    setLiked: noop,
    setLimitedRecommendations: noop,
    setQueue: noop,
    setRecommendationLoadingStep: noop,
    setRecommendationLoadingTitle: noop,
    setRecommendationState: noop,
    sideboard: [],
    theme: '',
    fetchCard: async (name: string) => ({
      ...card(name, 'Legendary Creature — Human'),
      related_uris: {
        edhrec: `https://edhrec.com/commanders/${name === names[0] ? 'kraum-ludevics-opus' : 'tymna-the-weaver'}`,
      },
    }),
    fetchCards: async (identifiers: { name: string }[]) =>
      identifiers.map(({ name }) => card(name)),
    fetchEdhrec: async (slug: string) => {
      edhrecSlugs.push(slug)
      return {
        container: {
          json_dict: {
            cardlists: [
              {
                header: 'High Synergy Cards',
                tag: 'highsynergy',
                cardviews: recommendationNames.map((name) => ({ name })),
              },
            ],
          },
        },
      }
    },
    fetchPrintings: async () => [],
    loadPrintings: noop,
    rankRecommendationCards: (cards: unknown[]) => cards,
  }

  const result = await start(deps, 'Kraum & Tymna', true)
  assert.deepEqual(edhrecSlugs, ['kraum-ludevics-opus-tymna-the-weaver'])
  assert.equal(result, true)
  assert.deepEqual(fallbackQueries, [])
})

test('fetches extra candidates only on demand and filters deck, sideboard, and colour identity', async () => {
  const slugs: string[] = []
  const searched: string[] = []
  const candidateNames = ['New Candidate', 'In Main', 'In Sideboard', 'Wrong Colours']
  const deps = {
    activeSubThemes: [],
    collectionMode: 'none',
    collectionSets: [],
    commander: 'Test Commander',
    commanderDetails: { colours: ['G'] },
    deck: [{ name: 'In Main' }],
    sideboard: [{ name: 'In Sideboard' }],
    excludeExtraTurns: false,
    excludeGameChangers: false,
    excludeTutors: false,
    excludeUnreleased: false,
    fetchCard: async (name: string) => ({
      ...card(name, 'Legendary Creature'),
      related_uris: { edhrec: 'https://edhrec.com/commanders/test-commander' },
    }),
    fetchCards: async (identifiers: { name: string }[]) =>
      identifiers.map(({ name }) =>
        name === 'Wrong Colours' ? card(name, 'Artifact', ['U']) : card(name),
      ),
    fetchEdhrec: async (slug: string) => {
      slugs.push(slug)
      return {
        container: {
          json_dict: {
            cardlists: [
              {
                header: 'High Synergy Cards',
                tag: 'highsynergy',
                cardviews: candidateNames.map((name) => ({ name })),
              },
            ],
          },
        },
      }
    },
    includeCreature: true,
    powerTarget: 'upgraded',
    searchCards: async (query: string) => {
      searched.push(query)
      return []
    },
    setCommanderSubThemes: () => {},
    setLimitedRecommendations: () => {},
  }

  const candidates = await fetchDeckDoctorCandidates(deps)
  assert.deepEqual(slugs, ['test-commander'])
  assert.deepEqual(searched, [])
  assert.deepEqual(
    candidates.map(({ name }) => name),
    ['New Candidate'],
  )
})

test('commander exploration returns only theme matches that preserve every card colour', async () => {
  const queries: string[] = []
  const deps = {
    activeSubThemes: [],
    commander: 'Test Commander',
    deck: [{ name: 'Test Commander' }, { name: 'Main Card', colorIdentity: ['G', 'U'] }],
    sideboard: [{ name: 'Sideboard Card', colorIdentity: ['G'] }],
    excludeUnreleased: true,
    theme: 'Tokens',
    searchCards: async (query: string) => {
      queries.push(query)
      return [
        {
          ...card('Compatible Commander', 'Legendary Creature', ['G', 'U']),
          oracle_text: 'Create a token.',
        },
        { ...card('Missing Blue', 'Legendary Creature', ['G']), oracle_text: 'Create a token.' },
        {
          ...card('Test Commander', 'Legendary Creature', ['G', 'U']),
          oracle_text: 'Create a token.',
        },
      ]
    },
  }

  const commanders = await fetchDeckDoctorCommanders(deps)
  assert.deepEqual(
    commanders.map(({ name }) => name),
    ['Compatible Commander'],
  )
  assert.match(queries[0], /is:commander legal:commander \(o:token\) date<=today/)
  assert.deepEqual(
    await fetchDeckDoctorCommanders({
      ...deps,
      commander: 'Thrasios & Tymna',
      searchCards: async () => {
        throw new Error('partner commanders should skip search')
      },
    }),
    [],
  )
})
