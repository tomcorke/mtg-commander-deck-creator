import { persistedDeckStateSchema, type PersistedDeckState } from '../../src/deck-state.ts'
import { toDeckCard } from '../../src/domain/card-model.ts'

export const a14BaseState = persistedDeckStateSchema.parse({
  commander: 'Test commander',
  commanderDetails: { images: [], art: [], colours: [], printings: [], selections: [] },
  theme: 'Test theme',
  queue: [],
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
  deck: [
    toDeckCard({
      name: 'Test commander',
      type_line: 'Creature',
      color_identity: [],
      set: 'tst',
      collector_number: '1',
      prints_search_uri: '',
    }),
  ],
  preferredPrintSet: '',
  deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
})

export function printingHeavyFixture(state: PersistedDeckState = a14BaseState) {
  const printings = Array.from({ length: 40 }, (_, index) => ({
    image: `https://cards.scryfall.io/normal/front/a/b/abcdef01-2345-6789-abcd-0123456789ab.jpg?${index}`,
    backImage: `https://cards.scryfall.io/normal/back/a/b/abcdef01-2345-6789-abcd-0123456789ab.jpg?${index}`,
    set: 'tst',
    setName: 'Test Commander Set',
    collectorNumber: String(index),
    scryfallUri: `https://scryfall.com/card/tst/${index}/test-card`,
    price: '2.50',
    priceUri: `https://www.tcgplayer.com/product/123456?partner=Scryfall&printing=${index}`,
    finish: index % 2 ? ('foil' as const) : ('nonfoil' as const),
  }))
  const queue = Array.from({ length: 19 }, (_, index) => ({
    ...state.deck[0],
    ...printings[17],
    name: `Printing-heavy candidate ${index}`,
    detail: 'Whenever another permanent enters, put a counter on this creature. '.repeat(3),
    reason: 'Popular inclusion for this commander',
    printsUri: `https://api.scryfall.com/cards/search?order=released&q=oracleid%3Acandidate-${index}&unique=prints`,
    source: 'edhrec' as const,
    inclusion: index / 19,
    collectionMatch: index % 2 === 0,
    printings,
    printing: 17,
    printingManuallySelected: index === 0,
    seedEvidence: [
      {
        name: `Candidate ${index}`,
        seed: 'Test engine',
        page: 'cards' as const,
        theme: 'Counters',
        tag: 'highliftcards',
        lift: 2,
      },
    ],
  }))
  const full = persistedDeckStateSchema.parse({
    ...state,
    commanderDetails: {
      images: [printings[0].image],
      art: [printings[0].image],
      colours: ['G'],
      printings: [printings.slice(0, 2)],
      selections: [0],
    },
    deck: Array.from({ length: 12 }, (_, index) => ({
      ...queue[index],
      ...printings[0],
      name: index === 0 ? state.commander : `Deck card ${index}`,
      printings: printings.slice(0, 2),
      printing: 0,
    })),
    queue,
    deferredCards: [{ card: queue[0], eligibleBatch: 3 }],
  })
  return { state: full, printings }
}
