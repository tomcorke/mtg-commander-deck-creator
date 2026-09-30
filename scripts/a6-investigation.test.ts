// Investigation-only proof. Nothing in the application imports this file.
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveScryfallIdentifiers } from '../src/adapters/scryfall.ts'
import { buildRecommendationContext } from '../src/app/recommendation-context.ts'
import { toCard, type Card, type ScryfallCard } from '../src/domain/card-model.ts'
import { isCommanderCandidate } from '../src/domain/commander-promotion.ts'
import { advanceRecommendationQueue } from '../src/domain/recommendation-queue.ts'
import { recommendationScore } from '../src/domain/recommendation-scoring.ts'

const nameKey = (name: string) => name.trim().toLowerCase().split(' // ')[0]
const sample = (name: string, detail = '', typeLine = 'Creature') =>
  toCard(
    {
      name,
      type_line: typeLine,
      oracle_text: detail,
      color_identity: [],
      legalities: { commander: 'legal' },
      set: 'tst',
      collector_number: '1',
      prints_search_uri: '',
    },
    'Seed support',
  )

// ponytail: only the three investigated mechanics; expand with labeled decks, not more generic tags.
const profiles = [
  {
    themes: ['+1/+1 counters'],
    participant: /\+1\/\+1 counter/i,
    engine: /instead|:\s*put (?:a|an|one).*\+1\/\+1 counter/i,
    multiplier: /instead/i,
  },
  {
    themes: ['ETB', 'Blink'],
    participant: /\benter(?:s|ing)?\b|exile .*return/i,
    engine: /triggers an additional time|(?:whenever|at the beginning).*exile .*return/i,
    multiplier: /triggers an additional time/i,
  },
  {
    themes: ['Sacrifice', 'Death triggers'],
    participant: /creature.*dies|sacrifice (?:a|another|one or more) .*creature/i,
    engine: /whenever .*creature.*dies|^sacrifice (?:a|another) creature:/i,
    multiplier: /whenever .*creature.*dies/i,
  },
]

function selectSeeds(deck: Card[], theme: string) {
  const profile = profiles.find((profile) => profile.themes.includes(theme))
  if (!profile) return []
  const main = deck.slice(1)
  const context = buildRecommendationContext(
    { commander: deck[0].name, theme, deck, recommendationStyle: 'balanced' },
    main,
  )
  return main
    .filter(
      (card) =>
        !card.typeLine.includes('Land') &&
        profile.participant.test(card.detail) &&
        profile.engine.test(card.detail),
    )
    .map((card) => ({
      card,
      support: main.filter(
        (peer) =>
          nameKey(peer.name) !== nameKey(card.name) && profile.participant.test(peer.detail),
      ).length,
      priority: Number(profile.multiplier.test(card.detail)),
      fit: recommendationScore(card, context),
    }))
    .filter(({ support }) => support >= 2)
    .sort((left, right) => right.priority - left.priority || right.fit - left.fit)
    .slice(0, 2)
    .map(({ card }) => card)
}

const counterDeck = [
  sample('Commander'),
  sample(
    'Hardened Scales',
    'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.',
    'Enchantment',
  ),
  sample(
    'Shalai, Voice of Plenty',
    '{4}{G}{G}: Put a +1/+1 counter on each creature you control.',
    'Legendary Creature — Angel',
  ),
  sample('Abzan Falconer', 'Each creature you control with a +1/+1 counter on it has flying.'),
  sample(
    'Rishkar, Peema Renegade',
    'When Rishkar enters, put a +1/+1 counter on each of up to two target creatures.',
    'Legendary Creature — Elf Druid',
  ),
]
const blinkDeck = [
  sample('Commander'),
  sample(
    'Panharmonicon',
    'If an artifact or creature entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.',
    'Artifact',
  ),
  sample(
    'Brago, King Eternal',
    "Whenever Brago deals combat damage to a player, exile any number of target nonland permanents you control, then return those cards to the battlefield under their owner's control.",
    'Legendary Creature — Spirit Noble',
  ),
  sample('Mulldrifter', 'When this creature enters, draw two cards.'),
  sample(
    'Soulherder',
    "At the beginning of your end step, you may exile another target creature you control, then return that card to the battlefield under its owner's control.",
  ),
]
const sacrificeDeck = [
  sample('Commander'),
  sample(
    'Pitiless Plunderer',
    'Whenever another creature you control dies, create a Treasure token.',
  ),
  sample(
    'Liliana, Dreadhorde General',
    'Whenever a creature you control dies, draw a card.',
    'Legendary Planeswalker — Liliana',
  ),
  sample('Viscera Seer', 'Sacrifice a creature: Scry 1.'),
  sample(
    'Blood Artist',
    'Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.',
  ),
]
const controls = [
  sample('Sol Ring', '{T}: Add {C}{C}.', 'Artifact'),
  sample(
    'Arcane Signet',
    "{T}: Add one mana of any color in your commander's color identity.",
    'Artifact',
  ),
  sample('Counterspell', 'Counter target spell.', 'Instant'),
  sample(
    'Off-theme legend',
    'If you would draw a card, you gain 1 life instead.',
    'Legendary Creature — Angel',
  ),
  sample('Forest', '{T}: Add {G}.', 'Basic Land — Forest'),
]

type Pool = {
  generation: number
  queue: Card[]
  deck: Card[]
  sideboard: Card[]
  ignored: string[]
  deferredCards: { card: Card; eligibleBatch: number }[]
}

function appendPending(pool: Pool, incoming: Card[], generation: number) {
  if (pool.generation !== generation) return pool
  const excluded = new Set(
    [...pool.queue, ...pool.deck, ...pool.sideboard, ...pool.deferredCards.map(({ card }) => card)]
      .map(({ name }) => nameKey(name))
      .concat(pool.ignored.map(nameKey)),
  )
  const fresh = incoming.filter(({ name }) => {
    const key = nameKey(name)
    if (excluded.has(key)) return false
    excluded.add(key)
    return true
  })
  return { ...pool, queue: [...pool.queue, ...fresh] }
}

function checkLateResults() {
  const visible = ['Later', 'Ignored', 'Accepted', 'Undecided'].map((name) => sample(name))
  const pool: Pool = {
    generation: 2,
    queue: [...visible, sample('Pending')],
    deck: [visible[2]],
    sideboard: [sample('Sideboard')],
    ignored: ['Ignored', 'Old ignore'],
    deferredCards: [{ card: sample('Deferred'), eligibleBatch: 8 }],
  }
  const incoming = [
    ...pool.queue,
    ...pool.deck,
    ...pool.sideboard,
    sample('Deferred'),
    sample('Old ignore'),
    sample('New'),
    sample(' NEW '),
  ]
  const decisions = { Later: 'later', Ignored: 'ignore', Accepted: 'add' } as const
  const liked = ['Undecided']
  const next = appendPending(pool, incoming, 2)
  assert.deepEqual(next.queue.slice(0, 4), visible)
  assert.deepEqual(
    next.queue.slice(4).map(({ name }) => name),
    ['Pending', 'New'],
  )
  assert.equal(next.deferredCards, pool.deferredCards)
  assert.equal(appendPending(pool, incoming, 1), pool)
  assert.equal(appendPending({ ...pool, generation: 3 }, incoming, 2).queue, pool.queue)
  const deferred = {
    ...pool,
    deferredCards: [
      { card: sample('Invasion of Gobakhan // Lightshield Array'), eligibleBatch: 8 },
    ],
  }
  assert.equal(
    appendPending(deferred, [sample('Invasion of Gobakhan')], 2).queue.length,
    pool.queue.length,
  )
  for (const recommendationStyle of ['balanced', 'thematic', 'fun', 'competitive'] as const) {
    const advanced = advanceRecommendationQueue({
      queue: next.queue,
      deferredCards: next.deferredCards,
      batchNumber: 1,
      decisions,
      liked,
      preferenceScores: {},
      activeSubThemes: [],
      theme: '',
      includeCreature: false,
      recommendationStyle,
    })
    assert.deepEqual(new Set(advanced.queue.map(({ name }) => name)), new Set(['Pending', 'New']))
    assert.equal(advanced.deferredCards.find(({ card }) => card.name === 'Later')?.eligibleBatch, 5)
    assert.equal(
      advanced.deferredCards.find(({ card }) => card.name === 'Undecided')?.eligibleBatch,
      4,
    )
    assert.equal(
      advanced.deferredCards.find(({ card }) => card.name === 'Deferred')?.eligibleBatch,
      8,
    )
  }
  assert.deepEqual(decisions, { Later: 'later', Ignored: 'ignore', Accepted: 'add' })
  assert.deepEqual(liked, ['Undecided'])
}

async function checkHydrationBudget() {
  let requests = 0
  const fetcher: typeof fetch = async (_input, init) => {
    requests++
    const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: { name: string }[] }
    assert(identifiers.length <= 48)
    const data: ScryfallCard[] = identifiers.map(({ name }) => ({
      name,
      type_line: 'Creature',
      color_identity: [],
      set: 'tst',
      collector_number: '1',
      prints_search_uri: '',
      legalities: { commander: 'legal' },
    }))
    return Response.json({ data })
  }
  const names = Array.from({ length: 48 }, (_, index) => ({ name: `Candidate ${index}` }))
  const cold = await resolveScryfallIdentifiers(names, fetcher)
  assert.equal(cold.data.length, 48)
  assert.equal(requests, 1)
  await resolveScryfallIdentifiers([...names, ...names.slice(12, 36)], fetcher)
  assert.equal(requests, 1)
}

test('A6 offline investigation: engine seeds, late pool append, and cold/warm hydration', async () => {
  for (const [deck, theme, expected] of [
    [counterDeck, '+1/+1 counters', ['Hardened Scales', 'Shalai, Voice of Plenty']],
    [blinkDeck, 'ETB', ['Panharmonicon', 'Brago, King Eternal']],
    [sacrificeDeck, 'Sacrifice', ['Pitiless Plunderer', 'Liliana, Dreadhorde General']],
  ] as const) {
    const withControls = [...deck, ...controls]
    assert.deepEqual(
      selectSeeds(withControls, theme).map(({ name }) => name),
      expected,
    )
    assert.equal(selectSeeds([deck[0], deck[1]], theme).length, 0)
  }
  assert.deepEqual(selectSeeds([...counterDeck, ...controls], 'Artifacts'), [])
  assert.equal(isCommanderCandidate(blinkDeck[2]), true)
  assert.equal(isCommanderCandidate(sacrificeDeck[2]), false)
  checkLateResults()
  await checkHydrationBudget()
})
