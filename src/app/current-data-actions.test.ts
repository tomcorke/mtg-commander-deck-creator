import assert from 'node:assert/strict'
import test from 'node:test'
import { a14BaseState } from '../../scripts/fixtures/a14.ts'
import { toCard, toDeckCard, type DeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { parseDeckImportSource, type ImportedDeck } from '../deck-import.ts'
import {
  addBasicLands,
  addOneBasic,
  applyImportedDeck,
  cycleDeckPrinting,
  decide,
  deckList,
  hydrateDeckCardDetails,
  loadSavedDeck,
  promoteToCommander,
  undoDeckDoctorSwap,
} from './deck-actions.ts'
import { loadPrintings } from './printing-actions.ts'
import type { ActionDeps } from './recommendation-actions.ts'

const raw = (name: string): ScryfallCard => ({
  name,
  type_line: name === 'Commander' ? 'Legendary Creature' : 'Artifact',
  oracle_id: name,
  color_identity: ['G'],
  cmc: 2,
  game_changer: false,
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
  image_uris: { normal: 'https://example.test/card.jpg', art_crop: 'https://example.test/art.jpg' },
})

function fixture() {
  let workspaceId = 'first'
  const state: ActionDeps = {
    ...a14BaseState,
    commander: 'Commander',
    commanderDetails: { images: [], art: [], colours: ['G'], printings: [], selections: [] },
    deck: [toDeckCard(raw('Commander')), toDeckCard(raw('Added'))],
    sideboard: [],
    queue: [toCard(raw('Queued'), 'Popular inclusion')],
    deckDoctorHistory: [],
    activeModal: null,
    activeSavedDeckId: '',
    deckName: '',
    recommendationState: 'idle',
    recommendationOptionsChanged: false,
    includeCreature: false,
    powerTarget: 'high',
    excludeGameChangers: true,
    excludeTutors: false,
    excludeExtraTurns: false,
    excludeUnreleased: false,
    collectionError: '',
    basicLandState: 'idle',
    loadingArt: '',
    deckDoctorError: '',
    importSource: 'recovery data',
    liked: ['Queued'],
    decisions: { Queued: 'later' },
    preferenceScores: { Tokens: 3 },
    skipCompletionReviewDecks: { current: new WeakSet() },
    workspace: { getSnapshot: () => ({ id: workspaceId }) },
    beginWorkspace: async () => {
      workspaceId = 'imported'
      return true
    },
    switchWorkspace: () => {
      workspaceId = 'second'
    },
    navigateView: () => undefined,
    loadPrintings: async () => undefined,
    freshRecommendationCycle: () => ({ deferredCards: [], batchNumber: 1 }),
    rankRecommendationCards: (cards) => cards,
    fetchCard: async (name) => raw(name),
    fetchPrintings: async () => [],
    fetchCards: async () => Array.from({ length: 8 }, (_, index) => raw(`Candidate ${index}`)),
    fetchEdhrec: async () => ({
      container: {
        json_dict: {
          cardlists: [
            {
              header: 'Top Cards',
              tag: 'topcards',
              cardviews: Array.from({ length: 8 }, (_, index) => ({ name: `Candidate ${index}` })),
            },
          ],
        },
      },
    }),
    searchCards: async () => [],
  }
  const fields = [
    ...Object.keys(state),
    'signatureEpoch',
    'signatureDeckKey',
    'focusedRole',
    'deckDoctorError',
    'collectionPoolSize',
    'batchAnnouncement',
    'recommendationLoadingStep',
    'recommendationLoadingTitle',
    'importState',
    'importError',
    'collectionState',
    'collectionSearch',
    'showCollectionBrowser',
  ]
  for (const field of fields)
    state[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value: any) => {
      state[field] = typeof value === 'function' ? value(state[field]) : value
    }
  state.getCurrentState = () => state
  return state
}

test('named-save and recovery loads mark every persisted card pending without altering the source or choices', () => {
  for (const id of ['named', '']) {
    const deps = fixture()
    const source = {
      ...a14BaseState,
      deck: deps.deck,
      queue: deps.queue,
      deferredCards: [{ card: deps.queue[0], eligibleBatch: 9, available: false }],
      decisions: { Queued: 'later' as const },
    }
    const before = structuredClone(source)
    loadSavedDeck(deps, { id, name: 'Recovery', updatedAt: '', state: source })
    assert.deepEqual(source, before)
    assert.equal(deps.deck[0].dataStatus, 'pending')
    assert.equal(deps.queue[0].dataStatus, 'pending')
    assert.equal(deps.deferredCards[0].card.dataStatus, 'pending')
    assert.equal(deps.deferredCards[0].eligibleBatch, 9)
    assert.equal(deps.deferredCards[0].available, false)
    assert.deepEqual(deps.decisions, source.decisions)
  }
})

test('legacy swap undo refreshes the cut card and preserves its printing; all failed undos retain history', async () => {
  for (const mode of ['legal', 'banned', 'offline', 'missing-added', 'missing-sideboard']) {
    const deps = fixture()
    const cut = {
      ...toDeckCard(raw('Cut')),
      oracleId: undefined,
      commanderLegality: undefined,
      manaValueKnown: undefined,
      image: 'selected',
      set: 'old',
      finish: 'foil',
      collectorNumber: '99',
    }
    const record = {
      id: mode,
      cutCard: cut,
      addedCard: deps.deck[1],
      cutIndex: 1,
      movedToSideboard: true,
    }
    deps.sideboard = mode === 'missing-sideboard' ? [] : [cut]
    deps.deckDoctorHistory = [record]
    deps.cardDataFetcher = async () =>
      mode === 'offline'
        ? new Response('', { status: 503 })
        : Response.json({
            data: [
              { ...raw('Cut'), legalities: { commander: mode === 'banned' ? 'banned' : 'legal' } },
            ],
          })
    if (mode === 'missing-added') deps.deck = [deps.deck[0]]
    const original = { deck: deps.deck, sideboard: deps.sideboard, history: deps.deckDoctorHistory }
    const succeeded = await undoDeckDoctorSwap(deps, mode)
    assert.equal(succeeded, mode === 'legal')
    if (succeeded) {
      assert.equal(deps.deck[1].name, 'Cut')
      assert.equal(deps.deck[1].image, 'selected')
      assert.equal(deps.deck[1].finish, 'foil')
      assert.equal(deps.deck[1].commanderLegality, 'legal')
      assert.equal(deps.sideboard.length, 0)
      assert.equal(deps.deckDoctorHistory.length, 0)
    } else {
      assert.equal(deps.deck, original.deck)
      assert.equal(deps.sideboard, original.sideboard)
      assert.equal(deps.deckDoctorHistory, original.history)
      assert.ok(deps.deckDoctorError)
    }
  }
})

test('an undo result cannot touch a different workspace, even with the same commander and printing', async () => {
  const deps = fixture()
  deps.deckDoctorHistory = [
    {
      id: 'swap',
      cutCard: toDeckCard(raw('Cut')),
      addedCard: deps.deck[1],
      cutIndex: 1,
      movedToSideboard: false,
    },
  ]
  let resolve!: (response: Response) => void
  const dispatched = Promise.withResolvers<void>()
  deps.cardDataFetcher = async () => {
    dispatched.resolve()
    return new Promise((done) => {
      resolve = done
    })
  }
  const undo = undoDeckDoctorSwap(deps, 'swap')
  await dispatched.promise
  deps.switchWorkspace()
  const before = { deck: deps.deck, history: deps.deckDoctorHistory }
  resolve(Response.json({ data: [raw('Cut')] }))
  assert.equal(await undo, false)
  assert.equal(deps.deck, before.deck)
  assert.equal(deps.deckDoctorHistory, before.history)
  assert.equal(deps.deckDoctorError, '')
})

const imported: ImportedDeck = {
  name: 'Imported',
  cards: [
    {
      name: 'Commander',
      quantity: 1,
      board: 'commander',
      set: 'tst',
      collectorNumber: 'Commander',
    },
    {
      name: 'Imported card',
      quantity: 1,
      board: 'mainboard',
      set: 'tst',
      collectorNumber: 'Imported card',
    },
  ],
}

test('import commits only after successful resolution and recommendation preparation', async (context) => {
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      data: [raw('Commander'), raw('Imported card')],
    }),
  )
  const deps = fixture()
  deps.fetchCards = async () => {
    throw new Error('Provider unavailable')
  }
  const before = {
    deck: deps.deck,
    queue: deps.queue,
    sideboard: deps.sideboard,
    decisions: deps.decisions,
    liked: deps.liked,
  }
  await assert.rejects(applyImportedDeck(deps, imported), /Too few|unavailable|cards/i)
  for (const [key, value] of Object.entries(before)) assert.equal(deps[key], value)
  assert.equal(deps.workspace.getSnapshot().id, 'first')
  assert.equal(deps.importSource, 'recovery data')
  const success = fixture()
  await applyImportedDeck(success, imported)
  assert.equal(success.workspace.getSnapshot().id, 'imported')
  assert.deepEqual(
    success.deck.map(({ name }) => name),
    ['Commander', 'Imported card'],
  )
  assert.equal(success.deck[1].collectorNumber, 'Imported card')
  assert.equal(success.deck[1].dataStatus, undefined)
})

const cardSignatures = (cards: DeckCard[]) =>
  cards
    .map(({ name, set, collectorNumber, finish }) => [name, set, collectorNumber, finish])
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))

for (const format of ['plain', 'moxfield', 'csv'] as const) {
  test(`${format} export round-trips commanders, finishes, condensed basics and sideboard copies`, async (context) => {
    const records: ScryfallCard[] = [
      { ...raw('Commander'), collector_number: '1', finishes: ['nonfoil', 'foil'] },
      {
        ...raw('Forest'),
        type_line: 'Basic Land — Forest',
        collector_number: '2',
        finishes: ['nonfoil', 'foil'],
      },
      { ...raw('Etched, "card"'), collector_number: '3', finishes: ['nonfoil', 'etched'] },
    ]
    context.mock.method(globalThis, 'fetch', async () => Response.json({ data: records }))
    const deps = fixture()
    deps.fetchCard = async (name) => records.find((record) => record.name === name)!
    const commander = { ...toDeckCard(records[0]), finish: 'foil' as const }
    const forest = { ...toDeckCard(records[1]), finish: 'foil' as const }
    const etched = { ...toDeckCard(records[2]), finish: 'etched' as const }
    deps.deck = [
      commander,
      ...Array.from({ length: 15 }, () => ({ ...forest })),
      etched,
      ...Array.from({ length: 15 }, () => ({ ...forest })),
      { ...forest, finish: 'nonfoil' },
      { ...forest, finish: 'nonfoil' },
    ]
    deps.sideboard = [{ ...forest }, { ...forest }, { ...etched }, { ...etched }]
    const expectedDeck = cardSignatures(deps.deck)
    const expectedSideboard = cardSignatures(deps.sideboard)
    const output = deckList(deps, format)
    if (format === 'moxfield') assert.ok(!output.includes('Commander'))
    if (format === 'plain') assert.match(output, /^COMMANDER:\n1 Commander \*F\*\n\nDECK:\n/)
    const imported = parseDeckImportSource(
      format === 'moxfield' ? `COMMANDER:\n1 Commander (TST) 1 *F*\n\nDECK:\n${output}` : output,
    )
    assert.equal(imported.cards.filter(({ board }) => board === 'commander').length, 1)
    assert.deepEqual(
      imported.cards
        .filter(({ name }) => name === 'Forest')
        .map(({ quantity, finish, board }) => [quantity, finish, board]),
      [
        [30, 'foil', 'mainboard'],
        [2, undefined, 'mainboard'],
        [2, 'foil', 'sideboard'],
      ],
    )
    assert.equal(
      imported.cards.find(({ name, board }) => name === etched.name && board === 'sideboard')
        ?.quantity,
      2,
    )
    await applyImportedDeck(deps, imported)
    assert.deepEqual(cardSignatures(deps.deck), expectedDeck)
    assert.deepEqual(cardSignatures(deps.sideboard), expectedSideboard)
    const selected = deps.commanderDetails!.printings[0][deps.commanderDetails!.selections[0]]
    assert.equal(selected.finish, 'foil')
  })
}

test('every export keeps different printings, finishes and boards in separate quantity groups', () => {
  const forest = { ...toDeckCard(raw('Forest')), collectorNumber: '1', finish: 'foil' as const }
  const deps = fixture()
  deps.deck = [
    deps.deck[0],
    forest,
    { ...forest, set: 'alt' },
    { ...forest, collectorNumber: '2' },
    { ...forest, finish: 'etched' },
    { ...forest },
  ]
  deps.sideboard = [{ ...forest }, { ...forest }]
  for (const format of ['plain', 'moxfield', 'csv'] as const) {
    const groups = parseDeckImportSource(deckList(deps, format)).cards.filter(
      ({ name }) => name === 'Forest',
    )
    assert.deepEqual(
      groups.map(({ quantity, board }) => [quantity, board]),
      [
        [2, 'mainboard'],
        [1, 'mainboard'],
        [1, 'mainboard'],
        [1, 'mainboard'],
        [2, 'sideboard'],
      ],
    )
    if (format !== 'plain')
      assert.deepEqual(
        groups.map(({ set, collectorNumber, finish }) => [set, collectorNumber, finish]),
        [
          ['tst', '1', 'foil'],
          ['alt', '1', 'foil'],
          ['tst', '2', 'foil'],
          ['tst', '1', 'etched'],
          ['tst', '1', 'foil'],
        ],
      )
  }
})

test('name-only finish imports find the newest paper printing, reuse the cache and keep exact-printing fallbacks', async (context) => {
  const records: ScryfallCard[] = [
    'Commander',
    'Foil',
    'Etched',
    'Supported',
    'Missing',
    'Normal',
  ].map((name, index) => ({
    ...raw(name),
    collector_number: String(index + 1),
    finishes: name === 'Supported' ? ['nonfoil', 'foil'] : ['nonfoil'],
    prices: { usd: '1', usd_foil: '3', usd_etched: '4' },
    prints_search_uri:
      name === 'Etched' || name === 'Missing'
        ? `https://api.scryfall.com/cards/search?q=oracleid%3A${name}&unique=prints`
        : '',
  }))
  const requests: URL[] = []
  context.mock.method(globalThis, 'fetch', async (input: unknown, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('Accept'), 'application/json')
    assert.ok(init.signal)
    const url = new URL(String(input))
    if (url.pathname.endsWith('/collection')) return Response.json({ data: records })
    requests.push(url)
    assert.equal(url.searchParams.get('unique'), 'prints')
    assert.equal(url.searchParams.get('order'), 'released')
    assert.equal(url.searchParams.get('dir'), 'desc')
    const query = url.searchParams.get('q')!
    assert.match(query, /game:paper/)
    if (query.includes('Missing')) return new Response('', { status: 404 })
    const name = query.includes('Etched') ? 'Etched' : 'Foil'
    const finish = name === 'Etched' ? 'etched' : 'foil'
    assert.match(query, new RegExp(`is:${finish}`))
    assert.match(query, name === 'Etched' ? /oracleid:Etched/ : /!"Foil"/)
    const newest: ScryfallCard = {
      ...records.find((card) => card.name === name)!,
      set: 'new',
      finishes: [finish],
      released_at: '2026-01-01',
      promo_types: ['surgefoil'],
    }
    return Response.json({
      data: [newest, { ...newest, set: 'old', released_at: '2020-01-01' }],
    })
  })
  const imported = parseDeckImportSource(
    'COMMANDER:\n1 Commander\nDECK:\n1 Foil *F*\n1 Etched *E*\n1 Supported *F*\n1 Missing *E*\n1 Normal\nSIDEBOARD:\n2 Foil *F*\n1 Foil (TST) 2 *F*',
  )
  const deps = fixture()
  await applyImportedDeck(deps, imported)
  assert.deepEqual(
    deps.deck.slice(1).map(({ name, set, finish, price }) => [name, set, finish, price]),
    [
      ['Foil', 'new', 'foil', '3'],
      ['Etched', 'new', 'etched', '4'],
      ['Supported', 'tst', 'foil', '3'],
      ['Missing', 'tst', 'nonfoil', '1'],
      ['Normal', 'tst', 'nonfoil', '1'],
    ],
  )
  assert.equal(deps.deck[1].foilType, 'surgefoil')
  assert.deepEqual(
    deps.sideboard.map(({ set, finish }) => [set, finish]),
    [
      ['new', 'foil'],
      ['new', 'foil'],
      ['tst', 'nonfoil'],
    ],
  )
  assert.equal(requests.length, 3, 'Repeated name-only entries share the finish lookup')
  await applyImportedDeck(fixture(), {
    cards: imported.cards.filter(({ name }) => name !== 'Missing'),
  })
  assert.equal(requests.length, 3, 'Successful finish lookups are cached across imports')
})

test('a stale import cannot create or overwrite a different workspace', async (context) => {
  const dispatched = Promise.withResolvers<void>()
  let resolve!: (response: Response) => void
  context.mock.method(globalThis, 'fetch', async () => {
    dispatched.resolve()
    return new Promise((done) => {
      resolve = done
    })
  })
  const deps = fixture()
  const request = applyImportedDeck(deps, imported)
  await dispatched.promise
  deps.switchWorkspace()
  resolve(Response.json({ data: [raw('Commander'), raw('Imported card')] }))
  await assert.rejects(request, /workspace changed/i)
  assert.equal(deps.workspace.getSnapshot().id, 'second')
  assert.equal(deps.deck[1].name, 'Added')
})

test('printing enrichment and invalid recommendation decisions preserve another deck and existing choices', async () => {
  const deps = fixture()
  const dispatched = Promise.withResolvers<void>()
  const response = Promise.withResolvers<ScryfallCard[]>()
  deps.fetchPrintings = async () => {
    dispatched.resolve()
    return response.promise
  }
  const before = deps.queue
  const request = loadPrintings(deps, deps.queue)
  await dispatched.promise
  deps.switchWorkspace()
  response.resolve([{ ...raw('Queued'), image_uris: { normal: 'stale art' } }])
  await request
  assert.equal(deps.queue, before)
  decide(deps, { ...deps.queue[0], gameChanger: true }, 'add')
  assert.equal(deps.decisions.Queued, 'later')
  assert.equal(deps.deck.length, 2)
})

test('both basic-land writers discard a held result after a workspace change', async () => {
  for (const mode of ['plan', 'one']) {
    const dispatched = Promise.withResolvers<void>()
    const response = Promise.withResolvers<Response>()
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      dispatched.resolve()
      return response.promise
    }
    try {
      const deps = fixture()
      deps.closeModal = () => {
        deps.activeModal = null
      }
      deps.activeModal = 'basics'
      deps.basicLandState = 'idle'
      const request =
        mode === 'plan'
          ? addBasicLands(deps, [{ name: 'Forest', count: 2 }])
          : addOneBasic(deps, 'Forest')
      await dispatched.promise
      deps.switchWorkspace()
      deps.deck = [toDeckCard({ ...raw('Blue commander'), color_identity: ['U'] })]
      deps.commanderDetails = { colours: ['U'] }
      deps.basicLandState = 'idle'
      const before = deps.deck
      response.resolve(Response.json({ ...raw('Forest'), type_line: 'Basic Land — Forest' }))
      await request
      assert.equal(deps.deck, before, mode)
      assert.equal(deps.basicLandState, 'idle', mode)
      assert.equal(deps.activeModal, 'basics', mode)
    } finally {
      globalThis.fetch = originalFetch
    }
  }
})

test('held detail hydration never resets a newer printing or finish choice', async (context) => {
  const dispatched = Promise.withResolvers<void>()
  const response = Promise.withResolvers<Response>()
  context.mock.method(globalThis, 'fetch', async () => {
    dispatched.resolve()
    return response.promise
  })
  const source = {
    ...raw('Held detail finish'),
    set_name: 'Test Set',
    scryfall_uri: 'https://scryfall.com/card/tst/held-detail',
    prints_search_uri: 'https://api.scryfall.com/held-detail-printings',
    finishes: ['nonfoil', 'foil'] as const,
    prices: { usd: '1', usd_foil: '3' },
  }
  const deps = fixture()
  const card = { ...toDeckCard(source), finish: 'nonfoil' as const, price: '1' }
  deps.deck = [deps.deck[0], card]
  const request = hydrateDeckCardDetails(deps, card)
  await dispatched.promise
  deps.deck = [
    deps.deck[0],
    {
      ...card,
      image: 'chosen-foil-art',
      finish: 'foil',
      printing: 1,
      price: '3',
      printingManuallySelected: true,
    },
  ]
  const before = deps.deck
  response.resolve(Response.json({ data: [source] }))
  await request
  assert.equal(deps.deck[1], before[1])
  assert.equal(deps.deck[1].finish, 'foil')
  assert.equal(deps.deck[1].printing, 1)
  assert.equal(deps.deck[1].image, 'chosen-foil-art')
  assert.equal(deps.deck[1].price, '3')
})

test('held promotion keeps newer deck and sideboard choices and discards a workspace switch', async () => {
  for (const mode of ['newer-choices', 'other-workspace']) {
    const deps = fixture()
    const promoted = toCard(
      { ...raw('Promoted'), type_line: 'Legendary Creature' },
      'Popular inclusion',
    )
    deps.sideboard = [toDeckCard(raw('Held sideboard'))]
    const response = Promise.withResolvers<boolean>()
    deps.start = async () => response.promise
    const request = promoteToCommander(deps, promoted)
    deps.deck = [
      deps.deck[0],
      { ...deps.deck[1], image: 'newer-art', set: 'newer-set', finish: 'foil', printing: 1 },
      toDeckCard(raw('Newer addition')),
    ]
    deps.sideboard = [{ ...deps.sideboard[0], image: 'newer-sideboard-art', finish: 'etched' }]
    if (mode === 'other-workspace') deps.switchWorkspace()
    const before = {
      deck: deps.deck,
      sideboard: deps.sideboard,
      queue: deps.queue,
      announcement: deps.batchAnnouncement,
    }
    response.resolve(true)
    await request
    if (mode === 'other-workspace') {
      assert.equal(deps.deck, before.deck)
      assert.equal(deps.sideboard, before.sideboard)
      assert.equal(deps.queue, before.queue)
      assert.equal(deps.batchAnnouncement, before.announcement)
    } else {
      assert.equal(deps.deck[0].name, promoted.name)
      assert.deepEqual(deps.deck.slice(1), before.deck)
      assert.deepEqual(deps.sideboard, before.sideboard)
      assert.equal(deps.deck[2].finish, 'foil')
      assert.equal(deps.deck[2].image, 'newer-art')
    }
  }
})

test('held art never changes a replacement card at the same index or a different workspace', async (context) => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image')
  context.after(() => {
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage)
    else Reflect.deleteProperty(globalThis, 'Image')
  })
  for (const switchWorkspace of [false, true]) {
    const dispatched = Promise.withResolvers<void>()
    let finish!: () => void
    Reflect.set(
      globalThis,
      'Image',
      class {
        onload: () => void = () => undefined
        onerror: () => void = () => undefined
        set src(_value: string) {
          finish = () => this.onload()
          dispatched.resolve()
        }
      },
    )
    const deps = fixture()
    deps.loadingArt = ''
    deps.deck[1] = {
      ...deps.deck[1],
      printings: [
        { image: 'old', set: 'old', collectorNumber: '1' },
        { image: 'new', set: 'new', collectorNumber: '2' },
      ],
    }
    const request = cycleDeckPrinting(deps, 1)
    await dispatched.promise
    if (switchWorkspace) deps.switchWorkspace()
    deps.deck = [deps.deck[0], toDeckCard(raw('Replacement'))]
    deps.loadingArt = ''
    const before = deps.deck
    finish()
    await request
    assert.equal(deps.deck, before)
    assert.equal(deps.loadingArt, '')
  }
})

test('changing commander can drop the outgoing commander or keep it as a deck card', async () => {
  for (const keepOutgoing of [true, false]) {
    const deps = fixture()
    deps.start = async () => true
    const promoted = toDeckCard({ ...raw('New commander'), type_line: 'Legendary Creature' })
    await promoteToCommander(deps, promoted, keepOutgoing)
    assert.deepEqual(
      deps.deck.map(({ name }) => name),
      keepOutgoing ? ['New commander', 'Commander', 'Added'] : ['New commander', 'Added'],
    )
  }
})

test('dropping the outgoing commander frees its colours for the new one', async () => {
  const deps = fixture()
  deps.start = async () => true
  deps.commanderDetails = { ...deps.commanderDetails!, colours: ['B', 'G'] }
  deps.deck = [{ ...deps.deck[0], colorIdentity: ['B', 'G'] }, deps.deck[1]]
  const mono = toDeckCard({ ...raw('Mono green'), type_line: 'Legendary Creature' })
  await promoteToCommander(deps, mono)
  assert.equal(deps.deck[0].name, 'Commander')
  await promoteToCommander(deps, mono, false)
  assert.deepEqual(
    deps.deck.map(({ name }) => name),
    ['Mono green', 'Added'],
  )
})
