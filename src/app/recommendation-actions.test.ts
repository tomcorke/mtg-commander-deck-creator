import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets, rolesForCard } from '../deck-analysis.ts'
import { rankRecommendationCards, recommendationScore } from '../recommendations.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import { fetchScryfallCardsByIdentifiers, fetchScryfallPrintings } from '../adapters/scryfall.ts'
import { toCard } from '../domain/card-model.ts'
import { loadPrintings } from './printing-actions.ts'
import {
  addCommanderCards,
  edhrecRecommendations,
  fetchDeckDoctorCandidates,
  fetchDeckDoctorCommanders,
  start,
} from './recommendation-actions.ts'

const names = ["Kraum, Ludevic's Opus", 'Tymna the Weaver']
const recommendationNames = ['Sol Ring', 'Arcane Signet', 'Rhystic Study', 'Smothering Tithe']

const card = (name: string, typeLine = 'Artifact', colourIdentity: string[] = []) => ({
  name,
  type_line: typeLine,
  cmc: 2,
  legalities: { commander: 'legal' },
  oracle_text: 'Partner',
  color_identity: colourIdentity,
  set: 'tst',
  collector_number: '1',
  prints_search_uri: 'https://scryfall.com/search?q=test',
  finishes: ['nonfoil'],
})

test('partner retry preserves commander sources and Scryfall rate-limit guidance', async (t) => {
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

  let message = ''
  const rateLimited = t.mock.fn(
    async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }),
  )
  assert.equal(
    await start(
      {
        ...deps,
        fetchCards: (identifiers: { name: string }[]) =>
          fetchScryfallCardsByIdentifiers(identifiers, rateLimited),
        setCollectionError: (error: string) => (message = error),
        setDeck: () => assert.fail('Retry must preserve the deck'),
      },
      'Kraum & Tymna',
      true,
    ),
    false,
  )
  assert.match(message, /Scryfall.*rate limit.*2 minutes/i)
  assert.equal(rateLimited.mock.callCount(), 1)
  assert.deepEqual(fallbackQueries, [])
})

test('optional printing enrichment stops on rate limits without discarding suggestions', async () => {
  const offered = toCard(card('Existing suggestion'), 'Popular inclusion')
  let requests = 0
  await loadPrintings(
    {
      queue: [offered],
      deck: [],
      collectionSets: [],
      collectionMode: 'none',
      fetchPrintings: (uri: string) =>
        fetchScryfallPrintings(uri, async () => {
          requests++
          return new Response('', { status: 429, headers: { 'Retry-After': '120' } })
        }),
      setQueue: () => assert.fail('Keep the current suggestions'),
    },
    [offered, { ...offered, name: 'Another suggestion' }],
  )
  assert.equal(requests, 1)
})

test('fetches extra candidates only on demand and filters deck, sideboard, and colour identity', async () => {
  const slugs: string[] = []
  const searched: string[] = []
  const hydrated: string[] = []
  const candidateNames = [
    'New Candidate',
    'In Main',
    'In Sideboard',
    'Wrong Colours',
    'Ignored',
    'Banned',
    ...Array.from({ length: 85 }, (_, index) => `Candidate ${index}`),
  ]
  const deps = {
    activeSubThemes: [],
    collectionMode: 'none',
    collectionSets: [],
    commander: 'Test Commander',
    commanderDetails: { colours: ['G'] },
    deck: [{ name: 'In Main' }],
    sideboard: [{ name: 'In Sideboard' }],
    ignoredCards: ['Ignored'],
    theme: 'Tokens',
    excludeExtraTurns: false,
    excludeGameChangers: false,
    excludeTutors: false,
    excludeUnreleased: false,
    fetchCard: async (name: string) => ({
      ...card(name, 'Legendary Creature'),
      related_uris: { edhrec: 'https://edhrec.com/commanders/test-commander' },
    }),
    fetchCards: async (identifiers: { name: string }[]) => {
      hydrated.push(...identifiers.map(({ name }) => name))
      return identifiers.map(({ name }) =>
        name === 'Wrong Colours'
          ? card(name, 'Artifact', ['U'])
          : { ...card(name), legalities: { commander: name === 'Banned' ? 'banned' : 'legal' } },
      )
    },
    fetchEdhrec: async (slug: string) => {
      slugs.push(slug)
      return {
        container: {
          json_dict: {
            cardlists: [
              {
                header: 'High Synergy Cards',
                tag: 'highsynergycards',
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
      return [card('New Candidate')]
    },
    setCommanderSubThemes: () => {},
    setLimitedRecommendations: () => {},
  }

  const candidates = await fetchDeckDoctorCandidates(deps)
  assert.deepEqual(slugs, ['test-commander'])
  assert.match(searched[0], /\(o:token\)/)
  assert.deepEqual(
    candidates.map(({ name }) => name),
    ['New Candidate', ...candidateNames.slice(6)],
  )
  assert.equal(candidates[0].reason, 'Commander synergy')
  assert.ok(['In Main', 'In Sideboard', 'Ignored'].every((name) => !hydrated.includes(name)))
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

test('warm EDHREC hydration reuses raw records while current safety, collection, and goal rules apply', async () => {
  const records = [
    { ...card('Tokens'), oracle_text: 'Create a token.' },
    card('Off Collection'),
    { ...card('Game Changer'), game_changer: true },
    { ...card('Tutor'), oracle_text: 'Search your library for a card.' },
    { ...card('Extra Turn'), oracle_text: 'Take an extra turn.' },
    { ...card('Future'), released_at: '2999-01-01' },
    card('Mana Vault'),
    { ...card('Banned'), legalities: { commander: 'banned' } },
  ].map((item) => ({ ...item, set: item.name === 'Off Collection' ? 'other' : 'tst' }))
  let requests = 0
  const fetcher: typeof fetch = async (_, init) => {
    requests++
    const { identifiers } = JSON.parse(String(init?.body))
    return Response.json({
      data: records.filter(({ name }) => identifiers.some((id) => id.name === name)),
    })
  }
  const deps = {
    deck: [],
    sideboard: [],
    activeSubThemes: [],
    preferenceScores: {},
    includeCreature: false,
    powerTarget: 'high',
    excludeGameChangers: false,
    excludeTutors: false,
    excludeExtraTurns: false,
    excludeUnreleased: false,
    fetchCards: (identifiers: { name: string }[]) =>
      fetchScryfallCardsByIdentifiers(identifiers, fetcher),
    fetchEdhrec: async () => ({
      container: {
        json_dict: {
          cardlists: [
            {
              header: 'High Synergy Cards',
              tag: 'highsynergycards',
              cardviews: records.map(({ name }) => ({ name })),
            },
          ],
        },
      },
    }),
    setCommanderSubThemes: () => {},
  }
  const cold = await edhrecRecommendations(deps, 'commander')
  const warm = await edhrecRecommendations(deps, 'commander')
  assert.deepEqual(warm, cold)
  assert.equal(requests, 1)
  assert.ok(!warm.some(({ name }) => name === 'Banned'))
  const safe = await edhrecRecommendations(
    {
      ...deps,
      powerTarget: 'precon',
      excludeGameChangers: true,
      excludeTutors: true,
      excludeExtraTurns: true,
      excludeUnreleased: true,
    },
    'commander',
  )
  assert.deepEqual(new Set(safe.map(({ name }) => name)), new Set(['Tokens', 'Off Collection']))
  const settings = {
    ...deps,
    commander: '',
    theme: 'Tokens',
    collectionSets: ['tst'],
    collectionMode: 'only' as const,
  }
  const thematic = buildRecommendationContext(
    { ...settings, recommendationStyle: 'thematic' },
    safe,
  )
  const competitive = buildRecommendationContext(
    { ...settings, recommendationStyle: 'competitive' },
    safe,
  )
  const ranked = rankRecommendationCards(safe, competitive, false, rolesForCard)
  assert.deepEqual(
    ranked.map(({ name }) => name),
    ['Tokens'],
  )
  assert.notEqual(
    recommendationScore(ranked[0], thematic),
    recommendationScore(ranked[0], competitive),
  )
  assert.equal(requests, 1, 'Safety and ranking changes must not refetch cached card records')
})

test('recommendation refresh and printing enrichment preserve manual printing selections', async () => {
  const commanderDetails = {
    images: ['chosen-art'],
    printings: [[{ finish: 'foil' }]],
    selections: [0],
  }
  let details = commanderDetails
  addCommanderCards(
    {
      commanderDetails,
      deck: [{ name: 'Commander' }],
      setCommanderDetails: (value: typeof details) => {
        details = value
      },
      setDeck: () => assert.fail('Refresh must not replace deck cards'),
    },
    {
      commanders: [card('Commander')],
      images: ['default-art'],
      art: [],
      identityColours: [],
      printings: [[{ image: 'default-art', finish: 'nonfoil' }]],
    },
    true,
  )
  assert.equal(details, commanderDetails)
  let queued = {
    ...toCard(card('Manual'), 'Popular inclusion'),
    image: 'chosen-art',
    set: 'chosen',
    collectorNumber: '42',
    finish: 'foil' as const,
    printingManuallySelected: true,
  }
  const before = queued
  await loadPrintings(
    {
      deck: [],
      queue: [queued],
      collectionSets: [],
      collectionMode: 'none',
      fetchPrintings: async () => [{ ...card('Manual'), image_uris: { normal: 'default-art' } }],
      setQueue: (update) => {
        queued = update([queued])[0]
      },
    },
    [queued],
  )
  assert.equal(queued, before)
})
