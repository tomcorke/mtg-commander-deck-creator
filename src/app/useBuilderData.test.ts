import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultDeckTargets } from '../deck-analysis.ts'
import { analyzeDeckDoctor } from '../deck-doctor.ts'
import { buildEdhrecRecommendations } from '../domain/recommendation-sources.ts'
import {
  toCard,
  toDeckCard,
  toDeckCardFromRecommendation,
  type ScryfallCard,
} from '../domain/card-model.ts'
import { buildBuilderData, displayDeckSection } from './useBuilderData.ts'

function builderDeps(queue: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    commander: 'Test Commander',
    commanderDetails: { colours: ['G'] },
    deck: [
      {
        name: 'Test Commander',
        layout: 'normal',
        typeLine: 'Legendary Creature',
        manaCost: '{G}',
        manaValue: 1,
        detail: '',
        producedMana: [],
        faces: [],
      },
    ],
    deckTargets: { ...defaultDeckTargets, lands: 32 },
    queue,
    sideboard: [],
    activeSubThemes: [],
    theme: '',
    dismissedSubThemes: [],
    subThemeSearch: '',
    commanderSubThemes: [],
    collectionBrowserCards: [],
    collectionBrowserType: 'all',
    collectionBrowserMana: '',
    collectionSearch: '',
    setOptions: [],
    showSupplementalSets: false,
    collectionSets: [],
    collectionMode: 'none',
    preferenceScores: {},
    prioritizeDeckHealth: true,
    recommendationStyle: 'balanced',
    batchNumber: 1,
    powerTarget: 'precon',
    includeCreature: true,
    excludeGameChangers: true,
    excludeTutors: true,
    excludeExtraTurns: true,
    excludeUnreleased: true,
    ...overrides,
  }
}

test('finding suggestions reuse provider exclusions, power, goal, price, set preferences and ignore filters', () => {
  const raw = (name: string, overrides: Partial<ScryfallCard> = {}): ScryfallCard => ({
    name,
    type_line: 'Artifact',
    cmc: 2,
    mana_cost: '{1}{G}',
    produced_mana: ['G'],
    oracle_text: '{T}: Add {G}.',
    color_identity: ['G'],
    legalities: { commander: 'legal' },
    set: 'tst',
    collector_number: '1',
    prints_search_uri: '',
    game_changer: false,
    released_at: '2020-01-01',
    ...overrides,
  })
  const options = {
    includeCreature: true,
    powerTarget: 'precon' as const,
    excludeGameChangers: true,
    excludeTutors: true,
    excludeExtraTurns: true,
    excludeUnreleased: true,
  }
  const fetched = [
    raw('Allowed'),
    raw('Price cap', { prices: { usd: '25' } }),
    raw('Ignored'),
    raw('Pending ignore'),
    raw('Sideboard'),
    raw('Other set', { set: 'other' }),
    raw('Game Changer', { game_changer: true }),
    raw('Tutor', { oracle_text: 'Search your library for a card.' }),
    raw('Extra turn', { oracle_text: 'Take an extra turn after this one.' }),
    raw('Future', { released_at: '2999-01-01' }),
    raw('Lotus Petal'),
    raw('Banned', { legalities: { commander: 'banned' } }),
  ]
  const pool = buildEdhrecRecommendations(
    fetched.map(({ name }) => ({ name, tag: 'highsynergycards', header: 'High Synergy Cards' })),
    fetched,
    options,
  )
  const deck = Array.from({ length: 100 }, (_, index) =>
    toDeckCard(
      raw(`Deck ${index}`, {
        type_line: 'Creature',
        produced_mana: [],
        oracle_text: index > 1 ? 'Create a token creature.' : '',
      }),
    ),
  )
  const deps = builderDeps(pool, {
    ...options,
    commander: 'Deck 0',
    deck,
    theme: 'Tokens',
    maxPrice: 5,
    ignoredCards: ['Ignored'],
    decisions: { 'Pending ignore': 'ignore' },
    sideboard: [toDeckCard(raw('Sideboard'))],
    collectionMode: 'only',
    collectionSets: ['tst'],
  })
  const data = buildBuilderData(deps)
  const findings = analyzeDeckDoctor({
    deck,
    sideboard: deps.sideboard,
    commanderCount: 1,
    theme: 'Tokens',
    activeSubThemes: [],
    deckTargets: defaultDeckTargets,
  })
  const suggestions = data.suggestFindingChanges(findings, pool)['role-gap:ramp']
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].addCard.name, 'Allowed')
  assert.equal(suggestions[0].cut?.cutCard.name, 'Deck 1')
  assert(data.recommendationSettingsSummary.includes('Balanced'))

  const preferencePool = [
    { ...pool.find(({ name }) => name === 'Allowed')!, name: 'Off-theme', tags: [], set: 'other' },
    {
      ...pool.find(({ name }) => name === 'Allowed')!,
      name: 'Theme match',
      tags: ['Tokens'],
      set: 'tst',
    },
  ]
  const thematic = buildBuilderData({
    ...deps,
    collectionMode: 'prefer',
    recommendationStyle: 'thematic',
  })
  assert.equal(
    thematic.suggestFindingChanges(findings, preferencePool)['role-gap:ramp'][0].addCard.name,
    'Theme match',
  )
})

test('priority and price summary reflect tuning, and the visible batch filters only the requested role', () => {
  const cards = Array.from({ length: 8 }, (_, i) => ({
    name: `Pick ${i}`,
    layout: 'normal',
    typeLine: 'Artifact',
    manaCost: '{2}',
    manaValue: 2,
    detail: i % 2 ? '{T}: Add {G}.' : '',
    producedMana: [],
    faces: [],
    reason: 'Commander synergy',
    tags: [],
    set: 'tst',
    price: i === 0 ? '10.00' : undefined,
  }))
  const data = buildBuilderData(
    builderDeps(cards, { focusedRole: 'ramp', recommendationStyle: 'competitive', maxPrice: 5 }),
  )
  assert.equal(data.scoredBatch.length, 4)
  assert.deepEqual(
    data.rawBatch.map(({ name }) => name),
    ['Pick 1', 'Pick 3', 'Pick 5', 'Pick 7'],
  )
  assert(data.recommendationSettingsSummary.includes('Deck needs first'))
  assert(data.recommendationSettingsSummary.includes('≤ $5'))
  assert(!data.recommendationSettingsSummary.includes('Health'))
  assert(!data.scoreReplacements(cards, []).some(({ card }) => card.name === 'Pick 0'))
  assert(!buildBuilderData(builderDeps(cards)).recommendationSettingsSummary.includes('≤'))
})

test('the settings summary does not imply a play style before one is chosen, and notes a skip once', () => {
  const summary = (overrides: Record<string, unknown>) =>
    buildBuilderData(builderDeps([], overrides)).recommendationSettingsSummary
  assert.equal(summary({ awaitingPlayStyle: true }), 'Play style: not chosen yet')
  assert.match(summary({ playStyleSkippedBatch: 1 }), /^Play style skipped · Balanced · /)
  assert.doesNotMatch(summary({ playStyleSkippedBatch: 1, batchNumber: 2 }), /skipped/)
  assert.match(summary({}), /^Balanced · /)
})

test('shows basic-land fill and scores lands when the deck has a land gap', () => {
  const land = {
    name: 'Forest',
    layout: 'normal',
    typeLine: 'Basic Land — Forest',
    manaCost: '',
    manaValue: 0,
    detail: '{T}: Add {G}.',
    producedMana: ['G'],
    faces: [],
    reason: 'Land or mana',
    tags: [],
    set: 'tst',
  }
  const creature = {
    name: 'Expensive Creature',
    layout: 'normal',
    typeLine: 'Creature',
    manaCost: '{5}{G}{G}{G}',
    manaValue: 8,
    detail: '',
    producedMana: [],
    faces: [],
    reason: 'Interesting new pick',
    tags: [],
    set: 'tst',
  }
  const deps = builderDeps([land, creature])
  const data = buildBuilderData(deps)
  const withoutDeckHealth = buildBuilderData({ ...deps, prioritizeDeckHealth: false })

  assert.deepEqual(data.basicLands, [{ name: 'Forest', colour: 'G', count: 32 }])
  assert.ok(data.scoredBatch[0].score.deckNeeds > 0)
  assert.ok(data.scoredBatch[1].score.manaFitPenalty < 0)
  assert.deepEqual(data.scoreCandidate(creature), data.scoredBatch[1].score)
  assert.equal(withoutDeckHealth.scoredBatch[0].score.deckNeeds, 0)
  assert.ok(withoutDeckHealth.scoredBatch[1].score.manaFitPenalty < 0)
  assert.deepEqual(
    data.scoreReplacements(deps.queue, deps.deck)[1].score,
    data.scoreCandidate(creature),
  )

  const ramp = {
    ...creature,
    name: 'Ramp',
    manaValue: 1,
    manaCost: '{G}',
    producedMana: ['G'],
    detail: '{T}: Add {G}.',
  }
  const supportedDeck = [...deps.deck, ramp]
  const supported = buildBuilderData({
    ...deps,
    deck: supportedDeck,
    queue: [ramp],
    deckTargets: { lands: 0, ramp: 1, draw: 0, removal: 0, wipes: 0 },
  })
  assert.equal(supported.scoreCandidate(ramp).deckNeeds, 0)
  assert.ok(supported.scoreReplacements([ramp], deps.deck)[0].score.deckNeeds > 0)
})

test('defers land fill, respects current decisions, and recalculates after a nonbasic add', () => {
  const card = (name: string, typeLine = 'Land') => ({
    name,
    layout: 'normal',
    typeLine,
    manaCost: typeLine === 'Land' ? '' : '{G}',
    manaValue: typeLine === 'Land' ? 0 : 1,
    // A utility ability lets these lands beat the untapped Forest they replace.
    detail: typeLine === 'Land' ? '{T}: Add {G}.\n{2}, {T}: Scry 1.' : '',
    producedMana: ['G'],
    faces: [],
    reason: 'Land or mana',
    tags: [],
    set: 'tst',
  })
  const queue = [
    card('In sideboard'),
    card('Ignored'),
    card('Later'),
    card('Pending ignore'),
    card('First land'),
    card('Second land'),
  ]
  const deps = builderDeps(queue, {
    sideboard: [card('In sideboard')],
    ignoredCards: ['Ignored'],
    decisions: { Later: 'later', 'Pending ignore': 'ignore' },
  })
  const early = buildBuilderData(deps)
  assert.equal(early.showLandFill, false)
  assert.equal(early.landGap, 32)
  assert.deepEqual(
    early.nonbasicLands.map(({ card }) => card.name),
    ['First land', 'Second land'],
  )

  const deck = Array.from({ length: 58 }, (_, index) => card(`Spell ${index}`, 'Creature'))
  const nearComplete = buildBuilderData({ ...deps, deck })
  assert.equal(nearComplete.showLandFill, true)
  assert.deepEqual(nearComplete.basicLands, [{ name: 'Forest', colour: 'G', count: 32 }])

  const updated = buildBuilderData({ ...deps, deck: [...deck, queue[4]] })
  assert.equal(updated.landGap, 31)
  assert.deepEqual(updated.basicLands, [{ name: 'Forest', colour: 'G', count: 31 }])
  assert.deepEqual(
    updated.nonbasicLands.map(({ card }) => card.name),
    ['Second land'],
  )

  const oneSlot = buildBuilderData({ ...deps, deck: Array(99).fill(deck[0]) })
  assert.equal(oneSlot.landGap, 1)
  assert.equal(oneSlot.nonbasicLands.length, 1)
  const full = buildBuilderData({ ...deps, deck: Array(100).fill(deck[0]) })
  assert.equal(full.landGap, 0)
  assert.deepEqual(full.nonbasicLands, [])
})

test('groups planeswalker creatures with planeswalkers', () => {
  for (const typeLine of [
    'Legendary Planeswalker Creature — Test',
    'Legendary Planeswalker — Test',
  ])
    assert.equal(displayDeckSection({ typeLine, faces: [] }), 'Planeswalkers')
  assert.equal(
    displayDeckSection({
      typeLine: 'Creature — Test',
      faces: [{ typeLine: 'Legendary Planeswalker — Test', manaCost: '' }],
    }),
    'Planeswalkers',
  )
})

test('explains each recommendation in a plain sentence', () => {
  const card = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    layout: 'normal',
    typeLine: 'Creature',
    manaCost: '{2}{G}',
    manaValue: 3,
    detail: '',
    producedMana: [],
    faces: [],
    reason: 'Commander favourite',
    source: 'edhrec',
    tags: [],
    set: 'tst',
    ...extra,
  })
  const popular = card('Popular', { inclusion: 41.4 })
  const rare = card('Rare', { inclusion: 0.4, reason: 'Interesting new pick' })
  const unknown = card('Unknown', { reason: 'Commander synergy' })
  const ramp = card('Ramp', {
    producedMana: ['G'],
    detail: '{T}: Add {G}.',
    manaValue: 1,
    inclusion: 27,
  })
  const tokens = card('Tokens', { tags: ['Tokens'], source: 'scryfall' })
  const data = buildBuilderData(
    builderDeps([popular, rare, unknown, ramp], {
      commander: 'Meren of Clan Nel Toth',
      theme: 'Tokens',
    }),
  )
  const explain = (item: unknown) => data.explainRecommendation(item as never)

  assert.deepEqual(explain(popular), {
    label: 'Commander favourite',
    sentence: 'In 41% of Meren of Clan Nel Toth decks on EDHREC.',
  })
  assert.equal(
    explain(rare).sentence,
    'A new card already in under 1% of Meren of Clan Nel Toth decks on EDHREC.',
  )
  assert.equal(
    explain(unknown).sentence,
    'EDHREC rates it a high-synergy card for Meren of Clan Nel Toth.',
  )
  assert.deepEqual(explain(ramp), {
    label: 'Ramp',
    sentence:
      'Adds ramp your deck needs (0 of 10 so far), and appears in 27% of Meren of Clan Nel Toth decks on EDHREC.',
  })
  assert.deepEqual(explain(tokens), {
    label: 'Tokens theme',
    sentence: 'Fits your Tokens theme.',
    themeFit: true,
  })
  assert.equal(
    explain(card('Fallback', { reason: 'Popular inclusion', source: 'scryfall' })).sentence,
    'A popular Commander card in your colours.',
  )
})

test('theme-matching offers lead with the theme and the words that matched (#501)', () => {
  const card = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    layout: 'normal',
    typeLine: 'Artifact',
    manaCost: '{2}',
    manaValue: 2,
    detail: '',
    producedMana: [],
    faces: [],
    reason: 'Commander synergy',
    source: 'scryfall',
    tags: [],
    set: 'tst',
    ...extra,
  })
  const data = buildBuilderData(
    builderDeps([], {
      commander: 'Meren of Clan Nel Toth',
      theme: 'Sacrifice',
      activeSubThemes: ['Zombies'],
    }),
  )
  const explain = (item: unknown) => data.explainRecommendation(item as never)
  // Ramp the deck needs, but theme fit still leads; EDHREC share follows as its own sentence.
  const altar = card('Altar', {
    source: 'edhrec',
    inclusion: 25,
    producedMana: ['B'],
    tags: ['Sacrifice'],
    detail: 'Sacrifice a creature: Add {B}{B}. (Reminder text.)\nWhenever a creature dies, scry 1.',
  })
  assert.deepEqual(explain(altar), {
    label: 'Sacrifice theme',
    sentence:
      'Text matches your Sacrifice theme: “Sacrifice a creature: Add {B}{B}.” In 25% of Meren of Clan Nel Toth decks on EDHREC.',
    themeFit: true,
  })
  // The theme comes before extra themes; a type-line match is named as such.
  const zombie = card('Zombie', {
    typeLine: 'Creature — Zombie',
    tags: ['Sacrifice', 'Zombies'],
    detail: 'Sacrifice another creature: Draw a card.',
  })
  assert.deepEqual(explain(zombie), {
    label: 'Sacrifice + Zombies theme',
    sentence:
      'Text matches your Sacrifice theme: “Sacrifice another creature: Draw a card.” Also fits your Zombies theme.',
    themeFit: true,
  })
  assert.equal(
    explain(card('Ghoul', { typeLine: 'Creature — Zombie', tags: ['Zombies'], detail: 'Menace' }))
      .sentence,
    'Type line matches your Zombies theme: Creature — Zombie.',
  )
  // Without a quote for the theme it still leads; the extra theme's quote follows.
  assert.equal(
    explain(card('Tagged', { typeLine: 'Creature — Zombie', tags: ['Sacrifice', 'Zombies'] }))
      .sentence,
    'Fits your Sacrifice theme. Type line matches your Zombies theme: Creature — Zombie.',
  )
  // A keyword quote gets closing punctuation before the next sentence.
  assert.equal(
    explain(card('Shifter', { tags: ['Changeling', 'Zombies'], detail: 'Changeling' })).sentence,
    'Text matches your Zombies theme: “Changeling”.',
  )
})

test('Theme first marks offers that match no selected theme as generic picks (#560)', () => {
  const card = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    layout: 'normal',
    typeLine: 'Artifact',
    manaCost: '{2}',
    manaValue: 2,
    detail: '',
    producedMana: [],
    faces: [],
    reason: 'Commander synergy',
    source: 'scryfall',
    tags: [],
    set: 'tst',
    ...extra,
  })
  const explainer = (overrides: Record<string, unknown>) => {
    const data = buildBuilderData(
      builderDeps([], { commander: 'Meren of Clan Nel Toth', theme: 'Sacrifice', ...overrides }),
    )
    return (item: unknown) => data.explainRecommendation(item as never)
  }
  const signet = card('Signet', { producedMana: ['B'], detail: '{T}: Add {B}.' })
  const altar = card('Altar', { tags: ['Sacrifice'], detail: 'Sacrifice a creature: Add {B}.' })
  // An extra theme's match is a theme match too; a changeling matches a creature-type theme.
  const ghoul = card('Ghoul', { typeLine: 'Creature — Zombie', tags: ['Zombies'] })
  const shifter = card('Shifter', { tags: ['Changeling'], detail: 'Changeling' })
  const thematic = explainer({ recommendationStyle: 'thematic', activeSubThemes: ['Zombies'] })

  // The mark rides alongside the role reason; it never replaces it.
  assert.deepEqual(thematic(signet), {
    label: 'Ramp',
    sentence: 'Adds ramp your deck needs (0 of 10 so far).',
    generic: true,
  })
  assert.equal(thematic(card('Plain')).generic, true)
  for (const item of [altar, ghoul, shifter]) {
    assert.equal(thematic(item).generic, undefined, item.name)
    assert.equal(thematic(item).themeFit, true, item.name)
  }
  // Other priorities, and Theme first with no theme chosen, never mark.
  for (const style of ['balanced', 'competitive', 'fun'])
    assert.equal(explainer({ recommendationStyle: style })(signet).generic, undefined, style)
  assert.equal(explainer({ recommendationStyle: 'thematic', theme: '' })(signet).generic, undefined)
})

test('answers to expected opponents lead offers as labelled heuristics (#503)', () => {
  const card = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    layout: 'normal',
    typeLine: 'Instant',
    manaCost: '{1}{G}',
    manaValue: 2,
    detail: '',
    producedMana: [],
    faces: [],
    reason: 'Commander synergy',
    source: 'scryfall',
    tags: [],
    set: 'tst',
    ...extra,
  })
  const deps = builderDeps([], {
    commander: 'Test Commander',
    theme: 'Tokens',
    opposingStrategies: ['graveyard', 'artifacts', 'big-creatures'],
  })
  const data = buildBuilderData(deps)
  const explain = (item: unknown) => data.explainRecommendation(item as never)
  const beast = card('Beast Within', {
    source: 'edhrec',
    inclusion: 40,
    detail: 'Destroy target permanent. Its controller creates a 3/3 green Beast creature token.',
  })
  assert.deepEqual(explain(beast), {
    label: 'Answers artifact decks',
    sentence:
      'Heuristic text match for artifact decks: “Destroy target permanent.” Also matches big creatures. In 40% of Test Commander decks on EDHREC.',
    answers: true,
  })
  // Theme fit still leads; the answer follows it.
  const maker = card('Token Hate', {
    tags: ['Tokens'],
    detail: 'Create a 1/1 green Saproling creature token.\nExile target player’s graveyard.',
  })
  assert.match(
    explain(maker).sentence,
    /^Text matches your Tokens theme: .* Text also reads as an answer to graveyard decks\.$/,
  )
  // Unselected strategies give no answer reason.
  const counter = card('Counterspell', { detail: 'Counter target spell.' })
  assert.equal(explain(counter).label, 'Targeted removal')
  assert.match(
    data.recommendationSettingsSummary,
    /Expecting Graveyard decks, Artifact decks, Big creatures/,
  )
  assert.doesNotMatch(buildBuilderData(builderDeps([])).recommendationSettingsSummary, /Expecting/)
})

test('generic picks in Theme first get an addable on-theme alternative from the pool (#563)', () => {
  const tokens = 'create a 1/1 green Saproling creature token.'
  const card = (name: string, overrides: Partial<ScryfallCard> = {}) =>
    toCard(
      {
        name,
        oracle_id: `oracle-${name}`,
        type_line: 'Artifact',
        color_identity: ['G'],
        cmc: 2,
        mana_cost: '{2}',
        set: 'tst',
        collector_number: '1',
        oracle_text: '',
        game_changer: false,
        legalities: { commander: 'legal' },
        prints_search_uri: `https://api.scryfall.com/cards/search?q=${name}`,
        ...overrides,
      },
      'Commander synergy',
    )
  const ramp = (name: string, extra = '', overrides: Partial<ScryfallCard> = {}) =>
    card(name, { produced_mana: ['G'], oracle_text: `{T}: Add {G}.${extra}`, ...overrides })
  const signet = ramp('Signet')
  const batchTokenRamp = ramp('Batch token ramp', `\nWhenever you cast a creature spell, ${tokens}`)
  const offeredDraw = card('Offered draw', { type_line: 'Sorcery', oracle_text: 'Draw two cards.' })
  const offeredPlain = card('Offered plain')
  const offTheme = ramp('Off-theme ramp')
  const offColour = ramp('Off-colour token ramp', `\n${tokens}`, { color_identity: ['B'] })
  const gameChanger = ramp('Game Changer token ramp', `\n${tokens}`, { game_changer: true })
  const queuedTokenRamp = ramp('Queued token ramp', `\n${tokens}`)
  const laterTokenDraw = card('Later token draw', {
    type_line: 'Sorcery',
    oracle_text: `Draw two cards, then ${tokens}`,
  })
  const queue = [
    signet,
    batchTokenRamp,
    offeredDraw,
    offeredPlain,
    offTheme,
    offColour,
    gameChanger,
    queuedTokenRamp,
  ]
  const alternatives = (overrides: Record<string, unknown> = {}) =>
    buildBuilderData(
      builderDeps(queue, {
        theme: 'Tokens',
        recommendationStyle: 'thematic',
        prioritizeDeckHealth: false,
        deferredCards: [{ card: laterTokenDraw, eligibleBatch: 4, later: true }],
        ...overrides,
      }),
    ).themeAlternative
  const find = alternatives()
  // The batch's own theme match is skipped; blocked and off-theme pool cards are passed over.
  assert.deepEqual(find(signet), {
    card: queuedTokenRamp,
    role: 'ramp',
    themes: ['Tokens'],
    source: 'queue',
  })
  // The Later list counts too; undecided skips waiting for return are not the Later list.
  assert.equal(find(offeredDraw)?.source, 'later')
  assert.equal(
    alternatives({
      deferredCards: [
        { card: { ...laterTokenDraw, undecidedSkips: 1 }, eligibleBatch: 4, later: false },
      ],
    })(offeredDraw),
    null,
  )
  // No role, or a theme match: none.
  assert.equal(find(offeredPlain), null)
  assert.equal(find(batchTokenRamp), null)
  // A card already in the deck is not offered again.
  assert.equal(
    alternatives({
      deck: [...builderDeps([]).deck, toDeckCardFromRecommendation(queuedTokenRamp)],
    })(signet),
    null,
  )
  // Other priorities, or no theme, never look.
  assert.equal(alternatives({ recommendationStyle: 'balanced' })(signet), null)
  assert.equal(alternatives({ theme: '' })(signet), null)
})
