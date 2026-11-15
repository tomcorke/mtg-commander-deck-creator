import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isScryfallCard,
  parseScryfallCard,
  toCard,
  toDeckCard,
  type ScryfallCard,
} from '../domain/card-model.ts'
import { scryfallTypeLine } from '../domain/scryfall-type-line.ts'
import {
  fetchRandomScryfallCommander,
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  fetchScryfallCollectionCards,
  fetchScryfallPrintings,
  searchScryfallPage,
} from './scryfall.ts'

// Provider shape checked 2026-11-15: https://api.scryfall.com/cards/sld/1875
// Small hand-authored fixture: gameplay fields occur on the faces, not the root.
const reversiblePrinting = {
  name: 'Chulane, Teller of Tales // Chulane, Teller of Tales',
  layout: 'reversible_card',
  color_identity: ['G', 'U', 'W'],
  set: 'sld',
  collector_number: '1875',
  prints_search_uri: 'https://api.scryfall.com/cards/search?unique=prints&q=chulane',
  card_faces: [
    {
      type_line: 'Legendary Creature — Human Druid',
      mana_cost: '{2}{G}{W}{U}',
      image_uris: { normal: 'https://example.test/front.jpg' },
    },
    {
      type_line: 'Legendary Creature — Human Druid',
      mana_cost: '{2}{G}{W}{U}',
      image_uris: { normal: 'https://example.test/back.jpg' },
    },
  ],
}

const response = (body: unknown) => Response.json(body)

test('manual printing conversion handles the real reversible Chulane shape', async () => {
  const cards = await fetchScryfallPrintings(reversiblePrinting.prints_search_uri, async () =>
    response({ data: [reversiblePrinting] }),
  )
  // AppView maps every manual printing through this conversion while rendering the modal.
  const converted = cards.map(toDeckCard)
  assert.equal(converted.length, 1)
  assert.equal(converted[0].typeLine, 'Legendary Creature — Human Druid')
  assert.ok(converted[0].tags.includes('Humans'))
  assert.equal(converted[0].manaCost, '{2}{G}{W}{U}')
  assert.equal(converted[0].image, 'https://example.test/front.jpg')
})

test('card converters also tolerate unnormalised face-only type lines', () => {
  // Represents the legacy unchecked API cast, before data reaches the adapter normaliser.
  const raw = reversiblePrinting as ScryfallCard
  for (const card of [toDeckCard(raw), toCard(raw, 'Fixture')]) {
    assert.equal(card.typeLine, 'Legendary Creature — Human Druid')
    assert.ok(card.tags.includes('Humans'))
  }
})

test('normalisation preserves root types, combines distinct face types and rejects malformed data', () => {
  const card = parseScryfallCard(reversiblePrinting)
  assert.ok(isScryfallCard(card))
  assert.equal('type_line' in reversiblePrinting, false, 'never mutates the provider response')
  assert.equal(card.type_line, 'Legendary Creature — Human Druid')
  const root = { ...reversiblePrinting, type_line: 'Root type', lang: 'en', digital: false }
  assert.deepEqual(parseScryfallCard(root), root, 'preserves printing metadata')
  assert.equal(
    parseScryfallCard({
      ...reversiblePrinting,
      card_faces: [{ type_line: 'Creature' }, { type_line: 'Land' }],
    })?.type_line,
    'Creature // Land',
  )
  for (const value of [
    null,
    {},
    { ...reversiblePrinting, card_faces: [] },
    { ...reversiblePrinting, card_faces: [{ type_line: 3 }] },
    { ...reversiblePrinting, color_identity: null },
    { ...reversiblePrinting, type_line: 3 },
  ])
    assert.equal(parseScryfallCard(value), undefined)
  assert.equal(scryfallTypeLine({}), '', 'missing types never reach tagsFor as undefined')
})

test('all live card sources normalise face-only types before returning cards', async () => {
  const list = async () => response({ data: [reversiblePrinting] })
  const cards = [
    await fetchScryfallCard('Chulane', async () => response(reversiblePrinting)),
    await fetchRandomScryfallCommander(undefined, undefined, async () =>
      response(reversiblePrinting),
    ),
    ...(await fetchScryfallCardsByIdentifiers([{ set: 'sld', collector_number: '1875' }], list)),
    ...(await searchScryfallPage('chulane', list)).data,
    ...(await fetchScryfallCollectionCards(
      [],
      ['sld'],
      {
        excludeGameChangers: false,
        excludeTutors: false,
        excludeExtraTurns: false,
        excludeUnreleased: false,
      },
      list,
    )),
  ]
  assert.equal(cards.length, 5)
  for (const card of cards) {
    assert.ok(isScryfallCard(card))
    assert.equal(card.type_line, 'Legendary Creature — Human Druid')
  }
})

test('printing pages, progress and cached results expose only validated cards', async () => {
  let requests = 0
  const fetcher: typeof fetch = async () => {
    requests++
    return requests === 1
      ? response({
          data: [],
          has_more: true,
          next_page: 'https://example.test/2',
          total_cards: 2,
        })
      : response({ data: [reversiblePrinting], total_cards: 2 })
  }
  const progress: number[] = []
  const cards = await fetchScryfallPrintings(
    'https://example.test/1',
    fetcher,
    undefined,
    (page) => {
      assert.ok(page.every(isScryfallCard))
      page.map(toDeckCard)
      progress.push(page.length)
    },
  )
  assert.deepEqual(progress, [0, 1])
  assert.equal(cards.length, 1)
  assert.deepEqual(await fetchScryfallPrintings('https://example.test/1', fetcher), cards)
  assert.equal(requests, 2)
  const cached = await fetchScryfallCardsByIdentifiers(
    [{ set: 'sld', collector_number: '1875' }],
    fetcher,
  )
  assert.equal(cached[0].type_line, cards[0].type_line)
  assert.equal(requests, 2, 'normalised printing also warms the exact-print cache')
})

test('malformed named cards, list entries and envelopes are rejected', async () => {
  await assert.rejects(
    fetchScryfallCard('Bad', async () => response({ name: 'Bad' })),
    /incomplete/,
  )
  for (const body of [
    null,
    {},
    { data: null },
    { data: [], next_page: 42 },
    { data: [reversiblePrinting, { name: 'Malformed' }] },
  ])
    await assert.rejects(
      fetchScryfallPrintings('https://example.test/prints', async () => response(body)),
      /Invalid Scryfall card list/,
    )
  const malformedList = async () => response({ data: [{ name: 'Malformed' }] })
  await assert.rejects(searchScryfallPage('fixture', malformedList), /Invalid Scryfall card list/)
  assert.deepEqual(
    await fetchScryfallCardsByIdentifiers([{ name: 'Malformed' }], malformedList),
    [],
    'identifier collections retain their partial-result policy',
  )
})
