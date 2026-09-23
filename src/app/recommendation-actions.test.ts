import assert from 'node:assert/strict'
import test from 'node:test'

import { start } from './recommendation-actions.ts'

const names = ["Kraum, Ludevic's Opus", 'Tymna the Weaver']
const recommendationNames = ['Sol Ring', 'Arcane Signet', 'Rhystic Study', 'Smothering Tithe']

const card = (name: string, typeLine = 'Artifact') => ({
  name,
  type_line: typeLine,
  color_identity: [],
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
