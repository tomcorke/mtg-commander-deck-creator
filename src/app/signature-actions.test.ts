import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseDeckImportSource, mainDeckCardCount } from '../deck-import.ts'
import { persistedDeckStateSchema } from '../deck-state.ts'
import {
  toCard,
  toDeckCard,
  toDeckCardFromRecommendation,
  type ScryfallCard,
} from '../domain/card-model.ts'
import {
  selectSignatureSeeds,
  mergeSignatureResults,
  signatureEntries,
  supportsSignature,
  type SignatureSeed,
  type SignatureSettings,
} from '../domain/signature-recommendations.ts'
import { buildRecommendationContext } from './recommendation-context.ts'
import {
  loadSignatureResults,
  signatureBudget,
  bindSignatureBudget,
  tabSignatureBudget,
  resetSignatureContext,
} from './signature-actions.ts'
import { advanceRecommendationQueue } from '../domain/recommendation-queue.ts'
import { fetchEdhrecPage } from '../adapters/edhrec.ts'
import {
  fetchScryfallCard,
  fetchScryfallCardsByIdentifiers,
  searchScryfall,
} from '../adapters/scryfall.ts'
import type { EdhrecCommanderPage } from '../adapters/edhrec.ts'
import { showCardPreview, hideCardPreview } from '../shared/card-preview.ts'

const raw = (
  name: string,
  oracle_text = 'Put a +1/+1 counter on target creature.',
  type_line = 'Creature',
): ScryfallCard => ({
  name,
  oracle_text,
  type_line,
  color_identity: ['G'],
  legalities: { commander: 'legal' },
  game_changer: false,
  released_at: '2020-01-01',
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
})
const deckCard = (name: string, text: string, type = 'Creature') =>
  toDeckCard(raw(name, text, type))
const counterDeck = [
  deckCard('Commander', ''),
  deckCard(
    'Hardened Scales',
    'If a +1/+1 counter would be put on a creature, put an additional one instead.',
    'Enchantment',
  ),
  deckCard(
    'Shalai, Voice of Plenty',
    '{4}{G}{G}: Put a +1/+1 counter on each creature you control.',
    'Legendary Creature',
  ),
  deckCard('Counter peer', 'Creatures with +1/+1 counters have flying.'),
  deckCard('Sol Ring', '{T}: Add {C}{C}.', 'Artifact'),
]
const settings = (deck = counterDeck): SignatureSettings => ({
  commander: 'Commander',
  deck,
  sideboard: [],
  ignoredCards: [],
  deferredCards: [],
  commanderDetails: { colours: ['G'] },
  collectionMode: 'none',
  collectionSets: [],
  includeCreature: true,
  powerTarget: 'precon',
  excludeGameChangers: true,
  excludeTutors: true,
  excludeExtraTurns: true,
  excludeUnreleased: true,
})
const context = (theme = '+1/+1 counters', deck = counterDeck) =>
  buildRecommendationContext({ commander: 'Commander', deck, theme }, [])
const seed: SignatureSeed = { card: counterDeck[1], theme: '+1/+1 counters', page: 'cards' }
const page = (names: string[]): EdhrecCommanderPage => ({
  container: {
    json_dict: {
      cardlists: [
        {
          tag: 'creatures',
          header: 'Creatures',
          cardviews: names.map((name) => ({ name, lift: 2, synergy: 3, num_decks: 200 })),
        },
        {
          tag: 'topcommanders',
          header: 'Commanders',
          cardviews: [{ name: 'Never hydrate commander', lift: 9, num_decks: 1000 }],
        },
      ],
    },
  },
})
const result = (card: ScryfallCard, seeds = [seed]) => ({
  raw: card,
  seeds,
  evidence: seeds.map((seed) => ({
    name: card.name,
    seed: seed.card.name,
    theme: seed.theme,
    page: seed.page,
    tag: 'creatures',
    lift: 2,
    decks: 200,
  })),
})
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

test('seeds use known mechanics, primary intent, partners, and real Anikthea counter engines', () => {
  assert.deepEqual(
    selectSignatureSeeds('Commander', counterDeck, context()).map(({ card }) => card.name),
    ['Hardened Scales', 'Shalai, Voice of Plenty'],
  )
  assert.deepEqual(
    selectSignatureSeeds(
      'Thrasios & Tymna',
      [
        { ...counterDeck[1], name: 'Thrasios, Triton Hero' },
        { ...counterDeck[1], name: 'Tymna the Weaver' },
        ...counterDeck.slice(1),
      ],
      context(),
    ).map(({ card }) => card.name),
    ['Hardened Scales', 'Shalai, Voice of Plenty'],
  )
  assert.deepEqual(selectSignatureSeeds('Commander', counterDeck.slice(0, 2), context()), [])
  const imported = parseDeckImportSource(
    readFileSync(new URL('../../scripts/fixtures/a6-anikthea.txt', import.meta.url), 'utf8'),
  )
  assert.equal(mainDeckCardCount(imported), 100)
  assert.equal(imported.cards.filter(({ board }) => board === 'sideboard').length, 8)
  const anikthea = [
    deckCard('Commander', ''),
    deckCard(
      'Calix, Guided by Fate',
      'Whenever an enchantment you control enters, put a +1/+1 counter on target creature.',
    ),
    deckCard(
      "Cathars' Crusade",
      'Whenever a creature you control enters, put a +1/+1 counter on each creature you control.',
      'Enchantment',
    ),
    deckCard(
      'Setessan Champion',
      'Whenever an enchantment you control enters, put a +1/+1 counter on this creature and draw a card.',
    ),
    deckCard('Skullclamp', 'Whenever equipped creature dies, draw two cards.', 'Artifact'),
    deckCard('Bestow', '(If the enchanted creature dies, this becomes a creature.)'),
  ]
  assert.deepEqual(
    selectSignatureSeeds('Commander', anikthea, context('Enchantments', anikthea)).map(
      ({ card }) => card.name,
    ),
    ['Calix, Guided by Fate', "Cathars' Crusade"],
  )
  const blink = [
    deckCard('Commander', ''),
    deckCard(
      'Panharmonicon',
      'If an artifact or creature entering causes a triggered ability, that ability triggers an additional time.',
      'Artifact',
    ),
    deckCard(
      'Brago',
      'Whenever this deals combat damage, exile target creature, then return it.',
      'Legendary Creature',
    ),
    deckCard('Mulldrifter', 'When this creature enters, draw two cards.'),
  ]
  assert.deepEqual(
    selectSignatureSeeds('Commander', blink, context('ETB', blink)).map(({ page }) => page),
    ['cards', 'commanders'],
  )
  assert.equal(
    supportsSignature(
      toCard(raw('Landfall', 'Whenever a land enters, create a Treasure token.')),
      { ...seed, theme: 'ETB', card: blink[1] },
      blink,
    ),
    false,
  )
  const sacrifice = [
    deckCard('Commander', ''),
    deckCard(
      'Pitiless Plunderer',
      'Whenever another creature you control dies, create a Treasure token.',
    ),
    deckCard(
      'Liliana',
      'Whenever a creature you control dies, draw a card.',
      'Legendary Planeswalker',
    ),
    deckCard('Viscera Seer', 'Sacrifice a creature: Scry 1.'),
  ]
  assert.deepEqual(
    selectSignatureSeeds('Commander', sacrifice, context('Sacrifice', sacrifice)).map(
      ({ card, page }) => [card.name, page],
    ),
    [
      ['Pitiless Plunderer', 'cards'],
      ['Liliana', 'cards'],
    ],
  )
})

test('merge preserves visible objects, exclusions, cooldowns, printing choices and stored evidence', () => {
  const visible = ['Later', 'Ignored', 'Accepted', 'Undecided'].map((name) =>
    toCard(raw(name), 'Initial'),
  )
  const pending = {
    ...toCard(raw('Pending'), 'Commander synergy'),
    printingManuallySelected: true,
    image: 'chosen-art',
  }
  const queue = [...visible, pending]
  const live = {
    ...settings(),
    sideboard: [deckCard('Sideboard', '')],
    ignoredCards: ['Old ignore'],
    deferredCards: [{ card: toCard(raw('Deferred // Back'), ''), eligibleBatch: 8 }],
  }
  const incoming = [
    ...visible.map(({ name }) => raw(name)),
    raw('Sideboard'),
    raw('Old ignore'),
    raw('Deferred'),
    raw('Pending'),
    raw('New'),
    raw('New'),
  ].map((card) => result(card))
  incoming.push(result(raw('New'), [{ ...seed, card: counterDeck[2] }]))
  const merged = mergeSignatureResults(queue, incoming, live)
  assert.deepEqual(merged.slice(0, 4), visible)
  for (let index = 0; index < 4; index++) assert.equal(merged[index], visible[index])
  assert.deepEqual(
    merged.slice(4).map(({ name }) => name),
    ['Pending', 'New'],
  )
  assert.equal(merged[5].seedEvidence?.length, 2)
  assert.equal(merged[4].image, 'chosen-art')
  assert.equal(merged[4].reason, 'Commander synergy')
  assert.equal(merged[4].printingManuallySelected, true)
  assert.equal(mergeSignatureResults(merged, incoming, live), merged)
  assert.equal(mergeSignatureResults(visible.slice(0, 2), incoming, live).length, 2)
  assert.deepEqual(
    persistedDeckStateSchema.shape.queue.element.parse(merged[5]).seedEvidence,
    merged[5].seedEvidence,
  )
  assert.deepEqual(toDeckCardFromRecommendation(merged[5]).seedEvidence, merged[5].seedEvidence)
  const denied = [
    { ...raw('Illegal'), legalities: { commander: 'banned' } },
    { ...raw('Unknown legality'), legalities: undefined },
    { ...raw('Unknown game changer status'), game_changer: undefined },
    { ...raw('Unknown release date'), released_at: undefined },
    { ...raw('Outside colours'), color_identity: ['U'] },
    { ...raw('Game changer'), game_changer: true },
    raw('Tutor', 'Search your library for a card, then put a +1/+1 counter on a creature.'),
    raw('Extra turn', 'Take an extra turn. Put a +1/+1 counter on a creature.'),
    { ...raw('Unreleased'), released_at: '2999-01-01' },
    raw('Mana Vault'),
  ].map((card) => result(card))
  assert.equal(mergeSignatureResults(queue, denied, live), queue)
  assert.equal(
    mergeSignatureResults(queue, incoming, { ...live, collectionMode: 'only', collectionSets: [] }),
    queue,
  )
  for (const recommendationStyle of ['balanced', 'thematic', 'fun', 'competitive'] as const) {
    const next = advanceRecommendationQueue({
      queue: merged,
      deferredCards: live.deferredCards,
      batchNumber: 1,
      decisions: { Later: 'later', Ignored: 'ignore', Accepted: 'add' },
      liked: ['Undecided'],
      preferenceScores: {},
      theme: '+1/+1 counters',
      activeSubThemes: [],
      includeCreature: false,
      recommendationStyle,
    })
    assert.deepEqual(new Set(next.queue.map(({ name }) => name)), new Set(['Pending', 'New']))
    assert.equal(next.deferredCards.find(({ card }) => card.name === 'Later')?.eligibleBatch, 5)
    assert.equal(
      next.deferredCards.find(({ card }) => card.name === 'Deferred // Back')?.eligibleBatch,
      8,
    )
  }
})

test('a pass caps source lists at 24, overlaps seeds, reuses raw pages and warm hydration', async () => {
  const paths: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    paths.push(String(input))
    if (!init?.body)
      return Response.json(page(Array.from({ length: 30 }, (_, index) => `Candidate ${index}`)))
    const identifiers = JSON.parse(String(init.body)).identifiers as { name: string }[]
    assert(identifiers.length <= 48)
    assert.equal(identifiers.length, 24)
    return Response.json({ data: identifiers.map(({ name }) => raw(name)) })
  }
  const seeds = [seed, { ...seed, card: counterDeck[2] }]
  assert.equal(
    signatureEntries(
      page(Array.from({ length: 30 }, (_, index) => `Candidate ${index}`)),
      seed,
      new Set(),
    ).length,
    24,
  )
  const budget = signatureBudget()
  const first = await loadSignatureResults(
    'A',
    seeds,
    new Set(),
    new AbortController().signal,
    fetcher,
    budget,
  )
  assert.equal(first.length, 24)
  assert.equal(first[0].evidence.length, 2)
  assert.equal(paths.length, 3)
  assert.deepEqual(
    await loadSignatureResults(
      'A',
      seeds,
      new Set(),
      new AbortController().signal,
      fetcher,
      budget,
    ),
    [],
  )
  await loadSignatureResults('B', seeds, new Set(), new AbortController().signal, fetcher, budget)
  assert.equal(paths.length, 3)
  assert.equal(budget.posts, 1)
})

test('actual transport stays within four seed/two POST deck caps and twelve/six tab caps', async () => {
  const budget = signatureBudget()
  let gets = 0,
    posts = 0
  const fetcher: typeof fetch = async (input, init) => {
    if (!init?.body) {
      gets++
      return Response.json(page([`Card ${String(input).split('/').at(-1)}`]))
    }
    posts++
    const identifiers = JSON.parse(String(init.body)).identifiers as { name: string }[]
    return Response.json({ data: identifiers.map(({ name }) => raw(name)) })
  }
  for (let deck = 0; deck < 3; deck++)
    for (let index = 0; index < 5; index++) {
      const current = { ...seed, card: { ...seed.card, name: `Engine ${deck}-${index}` } }
      const work = loadSignatureResults(
        `Deck ${deck}`,
        [current],
        new Set(),
        new AbortController().signal,
        fetcher,
        budget,
      )
      if (index === 2 || index === 3) await assert.rejects(work, /budget exhausted/)
      else await work
    }
  await loadSignatureResults(
    'New deck',
    [{ ...seed, card: { ...seed.card, name: 'Another engine' } }],
    new Set(),
    new AbortController().signal,
    fetcher,
    budget,
  )
  assert.equal(gets, 12)
  assert.equal(posts, 6)
  assert.equal(budget.attempts, 12)
  assert.equal(budget.posts, 6)
  const record = { seeds: new Set(['tried']), posts: 2 }
  tabSignatureBudget.decks.set('unsaved-test', record)
  bindSignatureBudget('unsaved-test', 'saved-test')
  assert.equal(tabSignatureBudget.decks.get('saved-test'), record)
  let epoch = 0,
    key = 'old'
  resetSignatureContext(
    {
      setSignatureEpoch: (update) => {
        epoch = update(epoch)
      },
      setSignatureDeckKey: (next) => {
        key = next
      },
    },
    'new',
  )
  assert.equal(epoch, 1)
  assert.equal(key, 'new')
})

test('failures, malformed pages and 429 cooldowns do not retry background work', async () => {
  let gets = 0,
    posts = 0
  const broken: typeof fetch = async (_input, init) => {
    if (!init?.body) {
      gets++
      return Response.json(page(['Candidate']))
    }
    posts++
    return Response.json({}, { status: 503 })
  }
  await assert.rejects(
    loadSignatureResults(
      'broken',
      [seed],
      new Set(),
      new AbortController().signal,
      broken,
      signatureBudget(),
    ),
    /Scryfall unavailable/,
  )
  assert.equal(gets, 1)
  assert.equal(posts, 1)
  const malformed: typeof fetch = async () =>
    Response.json({ container: { json_dict: { cardlists: [{ cardviews: [{ name: 5 }] }] } } })
  assert.deepEqual(
    await loadSignatureResults(
      'bad',
      [seed],
      new Set(),
      new AbortController().signal,
      malformed,
      signatureBudget(),
    ),
    [],
  )
  let calls = 0
  const limited: typeof fetch = async () => {
    calls++
    return Response.json({}, { status: 429 })
  }
  assert.deepEqual(
    await loadSignatureResults(
      'limited',
      [seed, { ...seed, card: counterDeck[2] }],
      new Set(),
      new AbortController().signal,
      limited,
      signatureBudget(),
    ),
    [],
  )
  assert.equal(calls, 1)
  await assert.rejects(fetchEdhrecPage('commanders', 'commander', limited), /cooling down/)
  assert.equal(calls, 1)
  const scryLimited: typeof fetch = async () => Response.json({}, { status: 429 })
  await assert.rejects(
    fetchScryfallCardsByIdentifiers([{ name: 'Limited' }], scryLimited, undefined, {
      background: true,
    }),
    /rate limit/,
  )
  await assert.rejects(searchScryfall('foreground', scryLimited), /estimate/)
})

test('source card previews stay inside the viewport and remain open while focused', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { innerWidth: 390, innerHeight: 600 },
  })
  t.after(() =>
    descriptor
      ? Object.defineProperty(globalThis, 'window', descriptor)
      : Reflect.deleteProperty(globalThis, 'window'),
  )
  let shown = 0,
    hidden = 0,
    active = true
  const preview = {
    style: { top: '', left: '' },
    showPopover: () => shown++,
    hidePopover: () => hidden++,
    getBoundingClientRect: () => ({ width: 260, height: 360 }),
  }
  const anchor = {
    querySelector: () => preview,
    matches: () => active,
    getBoundingClientRect: () => ({ top: 4, left: 375, width: 30 }),
  } as unknown as HTMLElement
  showCardPreview(anchor)
  assert.equal(shown, 1)
  assert.equal(preview.style.top, '16px')
  assert.equal(preview.style.left, '114px')
  hideCardPreview(anchor)
  assert.equal(hidden, 0)
  active = false
  hideCardPreview(anchor)
  assert.equal(hidden, 1)
})

test('malformed hydration records are not cached or shared with later foreground requests', async () => {
  let posts = 0,
    named = 0
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('json.edhrec.com')) return Response.json(page(['Safe', 'Broken']))
    if (url.includes('/collection')) {
      posts++
      return Response.json({ data: [raw('Safe'), { ...raw('Broken'), color_identity: null }] })
    }
    named++
    return Response.json(raw('Broken'))
  }) as typeof fetch
  const loaded = await loadSignatureResults(
    'malformed',
    [seed],
    new Set(),
    new AbortController().signal,
    fetcher,
    signatureBudget(),
  )
  assert.deepEqual(
    loaded.map(({ raw }) => raw.name),
    ['Safe'],
  )
  assert.equal((await fetchScryfallCard('Broken', fetcher)).name, 'Broken')
  assert.equal(posts, 1)
  assert.equal(named, 1)
})

test('foreground wins queued work, dispatches are paced, and cancellation drops queued requests', async () => {
  const paths: string[] = [],
    times: number[] = []
  const fetcher: typeof fetch = async (input, init) => {
    paths.push(String(input))
    times.push(performance.now())
    if (init?.body) return Response.json({ data: [raw('Background')] })
    return Response.json(raw(String(input).includes('Foreground') ? 'Foreground' : 'First'))
  }
  await fetchScryfallCard('First', fetcher)
  const background = fetchScryfallCardsByIdentifiers([{ name: 'Background' }], fetcher, undefined, {
    background: true,
  })
  await tick()
  const foreground = fetchScryfallCard('Foreground', fetcher)
  await Promise.all([foreground, background])
  assert(paths[1].includes('Foreground'))
  assert(paths[2].endsWith('/collection'))
  assert(times[1] - times[0] >= 500)
  assert(times[2] - times[1] >= 500)
  const controller = new AbortController()
  const cancelled = fetchScryfallCardsByIdentifiers(
    [{ name: 'Cancelled' }],
    fetcher,
    controller.signal,
    { background: true },
  )
  await tick()
  controller.abort()
  await assert.rejects(cancelled, { name: 'AbortError' })
  await new Promise((resolve) => setTimeout(resolve, 510))
  assert.equal(paths.length, 3)
})
