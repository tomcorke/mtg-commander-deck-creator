import assert from 'node:assert/strict'
import test from 'node:test'
import { a14BaseState } from '../../scripts/fixtures/a14.ts'
import { analyseDeck } from '../deck-analysis.ts'
import { persistedDeckStateSchema, encodeDeckState, storedDeckStateSchema } from '../deck-state.ts'
import { cardConstructionError } from './commander-construction.ts'
import { toCard, toDeckCard, type ScryfallCard } from './card-model.ts'
import { deckDataStatus, recommendationDataError } from './deck-data-status.ts'
import {
  applyCurrentCardData,
  cardDataKey,
  pendingDeckData,
  refreshCardData,
} from './current-card-data.ts'

const raw = (name: string, extra: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  oracle_id: name,
  type_line: name === 'Commander' ? 'Legendary Creature' : 'Artifact',
  color_identity: ['G'],
  mana_cost: '{G}',
  cmc: 1,
  legalities: { commander: 'legal' },
  game_changer: false,
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
  ...extra,
})

test('refresh updates gameplay by Oracle ID, not result position, and preserves selected printings and choices', async () => {
  const chosen = {
    ...toCard(raw('Old name'), 'Commander synergy'),
    image: 'chosen art',
    set: 'old',
    collectorNumber: '42',
    finish: 'etched' as const,
    printingManuallySelected: true,
    printings: [],
    printing: 0,
  }
  const missing = toCard(raw('Missing'), 'Popular inclusion')
  const fetched = raw('Canonical name', {
    oracle_id: 'Old name',
    cmc: 7,
    color_identity: ['U'],
    game_changer: true,
    legalities: { commander: 'banned' },
  })
  let requests = 0
  const fetcher: typeof fetch = async (_, init) => {
    requests++
    assert.deepEqual(JSON.parse(String(init?.body)).identifiers, [
      { oracle_id: 'Old name' },
      { oracle_id: 'Missing' },
    ])
    return Response.json({ data: [fetched], not_found: [{ oracle_id: 'Missing' }] })
  }
  const state = pendingDeckData(
    persistedDeckStateSchema.parse({
      ...a14BaseState,
      deck: [toDeckCard(raw('Commander')), chosen],
      queue: [chosen, missing],
      decisions: { 'Old name': 'later' },
      liked: ['Old name'],
      deferredCards: [{ card: chosen, eligibleBatch: 12, available: false }],
    }),
  )
  const before = structuredClone(state)
  const results = await refreshCardData(
    [state.queue[0], state.queue[1]],
    new AbortController().signal,
    fetcher,
  )
  const updated = applyCurrentCardData(state.queue[0], results)
  assert.equal(requests, 1)
  for (const field of [
    'name',
    'image',
    'set',
    'collectorNumber',
    'finish',
    'printings',
    'printing',
    'printingManuallySelected',
    'reason',
  ] as const)
    assert.deepEqual(updated[field], chosen[field])
  assert.equal(updated.commanderLegality, 'banned')
  assert.deepEqual(updated.colorIdentity, ['U'])
  assert.equal(updated.manaValue, 7)
  assert.equal(updated.gameChanger, true)
  assert.equal(updated.dataWarnings?.length, 4)
  assert.equal(applyCurrentCardData(state.queue[1], results).dataStatus, 'unavailable')
  assert.deepEqual(state, before)
  await refreshCardData([chosen, missing], new AbortController().signal, fetcher)
  assert.equal(requests, 2, 'Only the not-found identifier is retried on an explicit new load')
})

test('unknown current fields never reuse old legality, identity, mana value or Game Changer evidence', async () => {
  const old = toDeckCard(raw('Old'))
  const fetcher: typeof fetch = async () =>
    Response.json({
      data: [raw('Old', { legalities: undefined, cmc: undefined, game_changer: null })],
    })
  const results = await refreshCardData([old], new AbortController().signal, fetcher)
  const updated = applyCurrentCardData(old, results)
  assert.equal(updated.commanderLegality, undefined)
  assert.equal(updated.gameChanger, undefined)
  assert.equal(updated.manaValue, 1, 'Keep the numeric display fallback')
  assert.equal(updated.manaValueKnown, false)
  assert.match(cardConstructionError(updated, [], ['G']), /not verified legal/)
  const missingIdentity: typeof fetch = async () =>
    Response.json({
      data: [{ ...raw('Old'), color_identity: undefined }],
    })
  const invalid = applyCurrentCardData(
    old,
    await refreshCardData([old], new AbortController().signal, missingIdentity),
  )
  assert.equal(invalid.dataStatus, 'unavailable')
  assert.equal(analyseDeck([updated, invalid]).averageManaValue, 0)
  assert.equal(analyseDeck([updated, invalid]).curve[1].permanents, 0)
})

test('saves without stored gameplay fields refresh silently and stale warnings clear', async () => {
  const {
    commanderLegality: _legality,
    gameChanger: _gameChanger,
    manaValueKnown: _known,
    ...old
  } = toDeckCard(raw('Old'))
  const fetcher: typeof fetch = async () => Response.json({ data: [raw('Old', { cmc: 2 })] })
  const results = await refreshCardData([old], new AbortController().signal, fetcher)
  const updated = applyCurrentCardData({ ...old, dataWarnings: ['Mana value changed.'] }, results)
  assert.deepEqual(updated.dataWarnings, [])
  assert.deepEqual(applyCurrentCardData(toDeckCard(raw('Old')), results).dataWarnings, [
    'Mana value: 1 → 2.',
  ])
})

test('pending and failed migrations keep 100-card decks incomplete; a current legal deck can complete', async () => {
  const commander = toDeckCard(raw('Commander'))
  const forest = toDeckCard(raw('Forest', { type_line: 'Basic Land — Forest', cmc: 0 }))
  const deck = [commander, ...Array.from({ length: 99 }, () => forest)]
  assert.equal(deckDataStatus(deck, 'Commander', [], [], []).deckComplete, true)
  const state = pendingDeckData({ ...a14BaseState, commander: 'Commander', deck })
  assert.equal(deckDataStatus(state.deck, 'Commander', [], [], []).deckComplete, false)
  const fetcher: typeof fetch = async () => new Response('', { status: 503 })
  const results = await refreshCardData(state.deck, new AbortController().signal, fetcher)
  const failed = state.deck.map((card) => applyCurrentCardData(card, results))
  assert.equal(failed.length, 100)
  assert.equal(deckDataStatus(failed, 'Commander', [], [], []).deckComplete, false)
  assert.match(
    deckDataStatus(failed, 'Commander', [], [], []).cardDataNotices[0].message,
    /unavailable/,
  )
  const roundtrip = storedDeckStateSchema.parse(encodeDeckState({ ...state, deck: failed }))
  assert.equal(roundtrip.deck[0].dataStatus, 'unavailable')
})

test('unknown Game Changer membership warns without invalidating a legal 100-card deck', () => {
  const commander = toDeckCard(raw('Commander'))
  const forest = toDeckCard(raw('Forest', { type_line: 'Basic Land — Forest', cmc: 0 }))
  const deck = [
    commander,
    ...Array.from({ length: 99 }, () => ({ ...forest, gameChanger: undefined })),
  ]
  const status = deckDataStatus(deck, 'Commander', [], [], [])
  assert.equal(status.deckComplete, true)
  assert.match(status.cardDataNotices[0].message, /Game Changer status is unknown/)
})

test('refresh is deduplicated, capped at 20 paced batches of 75, and abortable', async () => {
  const cards = Array.from({ length: 1501 }, (_, index) => toDeckCard(raw(String(index))))
  let requests = 0
  const times: number[] = []
  const fetcher: typeof fetch = async (_, init) => {
    times.push(Date.now())
    requests++
    const identifiers = JSON.parse(String(init?.body)).identifiers
    assert.ok(identifiers.length <= 75)
    return Response.json({ data: identifiers.map(({ oracle_id }) => raw(oracle_id)) })
  }
  const results = await refreshCardData([...cards, cards[0]], new AbortController().signal, fetcher)
  assert.equal(requests, 20)
  assert.equal(results.size, 1500)
  assert.equal(applyCurrentCardData(cards[1500], results).dataStatus, 'unavailable')
  assert.ok(times.slice(1).every((time, index) => time - times[index] >= 490))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(refreshCardData(cards, controller.signal, fetcher), /abort/i)
  assert.equal(requests, 20)
})

test('queued and deferred Game Changers fail closed without changing player waiting periods', () => {
  const card = toCard(raw('Candidate'), 'Popular inclusion')
  assert.equal(recommendationDataError(card, [], ['G'], true), '')
  for (const gameChanger of [true, undefined]) {
    const changed = { ...card, gameChanger }
    assert.ok(recommendationDataError(changed, [], ['G'], true))
    const state = {
      ...a14BaseState,
      queue: [changed],
      deferredCards: [{ card: changed, eligibleBatch: 8, available: false }],
    }
    const loaded = pendingDeckData(state)
    assert.equal(loaded.deferredCards[0].eligibleBatch, 8)
    assert.equal(loaded.deferredCards[0].available, false)
    assert.equal(loaded.queue[0].name, card.name)
    assert.equal(cardDataKey(changed), cardDataKey(card))
  }
})
