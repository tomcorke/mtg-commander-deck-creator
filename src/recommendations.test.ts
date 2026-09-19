import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceRecommendationQueue, batchRecommendations, buildEdhrecRecommendations, commanderThemes, deferBatch, findSynergyPair, formatUsdPrice, freshRecommendationCycle, manualCardError, orderedPrintings, parseEdhrecEntries, preferredPrintingIndex, recommendationScore, recommendedScoreThreshold, releaseDeferred, releaseNextDeferred, sharedThemes, supportedThemes, tagsFor, unsupportedCommanderThemes, updatePreferenceScores } from './recommendations.ts'

test('ordinary tapped lands do not create false Landfall preferences', () => {
  assert.equal(tagsFor('Land\nHideaway 4. This land enters tapped.', 'Land').includes('Landfall'), false)
  assert.equal(tagsFor('Land\nWhenever a land enters the battlefield under your control, draw a card.', 'Land').includes('Landfall'), true)
})

test('all exposed themes can tag matching card text', () => {
  for (const theme of supportedThemes) {
    const source = ({
      Tokens: 'create one Soldier token', '+1/+1 counters': 'put a +1/+1 counter', Enchantments: 'enchantment', Graveyard: 'graveyard', Dragons: 'Dragon', Spellslinger: 'instant or sorcery', Artifacts: 'artifact', Lifegain: 'gain 2 life', Sacrifice: 'sacrifice a creature', Equipment: 'Equipment', 'Group hug': 'each player draws', Landfall: 'landfall', Voltron: 'equipped creature', Goad: 'goad', 'Big mana': 'mana value 7', Blink: 'exile it then return', ETB: 'Whenever another creature enters the battlefield under your control', 'Death triggers': 'Whenever another creature dies', Wither: 'wither', Political: 'vote', Vampires: 'Vampire', Angels: 'Angel', Demons: 'Demon', Faeries: 'Faerie', Vehicles: 'Vehicle', Indestructible: 'indestructible', Mill: 'mill three cards', Zombies: 'Zombie', Elves: 'Elf', Goblins: 'Goblin', Dinosaurs: 'Dinosaur', Merfolk: 'Merfolk', Knights: 'Knight', Spirits: 'Spirit', Slivers: 'Sliver', Mutants: 'Mutant', Turtles: 'Turtle', Defenders: 'Defender', 'Toughness matters': 'assign combat damage equal to its toughness', 'Power matters': 'power is equal to its mana value', 'Power 7+': 'creature with power 7 or greater', Counters: 'proliferate', Combat: 'additional combat phase', 'Resource tokens': 'create a Treasure token', Recursion: 'return target card from your graveyard', Protection: 'other creatures have hexproof', Flying: 'flying', Energy: 'get {E}', Sagas: 'Saga', 'Exile matters': 'play that card from exile', 'Spell copying': 'copy target instant spell', Cascade: 'cascade', Discover: 'discover 4', Explore: 'it explores', Ninjas: 'Ninja', Eldrazi: 'Eldrazi', Humans: 'Human', Soldiers: 'Soldier', Phyrexians: 'Phyrexian', Planeswalkers: 'Planeswalker', Poison: 'toxic 2', Wheels: 'each player discards their hand, then draws seven cards', Clones: 'enters as a copy', Amass: 'amass Orcs 2', Populate: 'populate', Anthems: 'creatures you control get +1/+1', Topdeck: 'look at the top card of your library',
    } as Record<string, string>)[theme]
    assert.ok(tagsFor(source, '').includes(theme), theme)
  }
})

test('trigger themes avoid unrelated enter and death wording', () => {
  assert.equal(tagsFor('This creature enters tapped.', 'Creature').includes('ETB'), false)
  assert.equal(tagsFor('Destroy target creature. It cannot be regenerated.', 'Instant').includes('Death triggers'), false)
  assert.equal(tagsFor('When this creature enters, draw a card.', 'Creature').includes('ETB'), true)
  assert.equal(tagsFor('Whenever another creature dies, gain 1 life.', 'Creature').includes('Death triggers'), true)
  assert.equal(tagsFor('Put a -1/-1 counter on target creature.', 'Instant').includes('Wither'), true)
})

test('inferred themes expire unless recent picks keep supporting them', () => {
  const cards = [
    { tags: ['Tokens'] }, { tags: ['Tokens'] }, { tags: ['Tokens'] },
    ...Array.from({ length: 12 }, () => ({ tags: ['Artifacts'] })),
  ]
  assert.deepEqual(sharedThemes(cards), ['Artifacts'])
  assert.deepEqual(sharedThemes([...cards, { tags: ['Tokens'] }, { tags: ['Tokens'] }, { tags: ['Tokens'] }]), ['Artifacts', 'Tokens'])
  assert.deepEqual(sharedThemes(cards, ['Artifacts']), [])
})

test('synergy pair requires concrete complementary rules text', () => {
  const cards = [
    { name: 'Maker', typeLine: 'Creature', detail: 'Create two Soldier tokens.', tags: ['Tokens'] },
    { name: 'Payoff', typeLine: 'Enchantment', detail: 'Tokens you control get +1/+1.', tags: ['Tokens'] },
  ]
  assert.match(findSynergyPair(cards)?.explanation ?? '', /creates tokens/)
  assert.equal(findSynergyPair(cards.map((card) => ({ ...card, detail: 'Artifact creature.' }))), null)
})

test('manual card validation enforces deck legality', () => {
  const card = { name: 'Swords to Plowshares', type_line: 'Instant', color_identity: ['W'] }
  assert.equal(manualCardError(card, [], ['W']), '')
  assert.match(manualCardError(card, [], ['U']), /colour identity/)
  assert.match(manualCardError(card, [card.name], ['W']), /already in/)
  assert.equal(manualCardError({ name: 'Plains', type_line: 'Basic Land — Plains', color_identity: [] }, ['Plains'], ['W']), '')
})

test('card prices use compact US dollar labels', () => {
  assert.equal(formatUsdPrice('1.20'), '$1.20')
  assert.equal(formatUsdPrice(null), '')
})

test('printing preference preserves defaults and manual choices', () => {
  const original = { image: 'default', set: 'clb', collectorNumber: '284' }
  const printings = orderedPrintings(original, [{ image: 'alternate', set: 'sld', collectorNumber: '2500' }, original, { image: 'other', set: 'mkc', collectorNumber: '19' }])
  assert.equal(printings[0].image, 'default')
  assert.equal(preferredPrintingIndex(printings, 'sld'), 1)
  assert.equal(preferredPrintingIndex(printings, 'missing'), 0)
  assert.equal(preferredPrintingIndex(printings, 'clb', 1, true), 1)
})

test('EDHREC parser keeps first category for each unique card', () => {
  assert.deepEqual(parseEdhrecEntries([
    { header: 'High Synergy Cards', tag: 'highsynergycards', cardviews: [{ name: 'Shared' }, { name: 'First' }] },
    { header: 'Top Cards', tag: 'topcards', cardviews: [{ name: 'Shared' }, { name: 'Second' }] },
  ]), [
    { name: 'Shared', tag: 'highsynergycards', header: 'High Synergy Cards' },
    { name: 'First', tag: 'highsynergycards', header: 'High Synergy Cards' },
    { name: 'Second', tag: 'topcards', header: 'Top Cards' },
  ])
})

test('production EDHREC builder applies safety filters and batches every card once', () => {
  const cards = [
    { name: 'Creature', type_line: 'Creature', oracle_text: '', color_identity: ['G'], set: 'tst', collector_number: '1', prints_search_uri: '' },
    { name: 'Tutor', type_line: 'Sorcery', oracle_text: 'Search your library for a card.', color_identity: ['B'], set: 'tst', collector_number: '2', prints_search_uri: '' },
    { name: 'Spell', type_line: 'Instant', oracle_text: '', color_identity: ['U'], set: 'tst', collector_number: '3', prints_search_uri: '' },
    { name: 'Rock', type_line: 'Artifact', oracle_text: '{T}: Add {G}.', color_identity: [], set: 'tst', collector_number: '4', prints_search_uri: '' },
    { name: 'Future', type_line: 'Creature', oracle_text: '', color_identity: ['G'], set: 'tst', collector_number: '5', prints_search_uri: '', released_at: '2999-01-01' },
  ]
  const entries = cards.map((card) => ({ name: card.name, tag: card.name === 'Creature' ? 'highsynergycards' : 'topcards', header: 'Top Cards' }))
  const result = buildEdhrecRecommendations(entries, cards, { includeCreature: true, excludeGameChangers: true, excludeTutors: true, excludeExtraTurns: true, excludeUnreleased: true, powerTarget: 'precon' })
  assert.deepEqual(result.map((card) => card.name), ['Creature', 'Spell', 'Rock'])
  assert.equal(result[0].reason, 'Commander synergy')
  assert.equal(result[2].reason, 'Land or mana')
})

test('recommendation score rewards evidence and leaves weak picks below badge threshold', () => {
  const context = { theme: 'Tokens', activeSubThemes: ['Artifacts'], pickedTags: new Set(['Tokens']), preferenceScores: { Tokens: 4 }, neededRoles: new Set(['draw']), cardRoles: ['draw'] }
  assert.equal(recommendationScore({ reason: 'Commander synergy', tags: ['Tokens'] }, context), 74)
  assert.ok(recommendationScore({ reason: 'Interesting new pick', tags: [] }, { ...context, cardRoles: [] }) < recommendedScoreThreshold)
})

test('batching preserves rank while limiting new cards to one per batch', () => {
  const cards = [
    { name: 'New 1', reason: 'Interesting new pick' },
    { name: 'New 2', reason: 'Interesting new pick' },
    { name: 'Theme 1', reason: 'Commander synergy' },
    { name: 'Theme 2', reason: 'Commander synergy' },
    { name: 'Theme 3', reason: 'Commander synergy' },
    { name: 'New 3', reason: 'Interesting new pick' },
    { name: 'Theme 4', reason: 'Commander synergy' },
    { name: 'Theme 5', reason: 'Commander synergy' },
  ]
  assert.deepEqual(batchRecommendations(cards, true).map(({ name }) => name), ['New 1', 'Theme 1', 'Theme 2', 'Theme 3', 'New 2', 'Theme 4', 'Theme 5', 'New 3'])
})

test('ignore suppresses more-like-this score', () => {
  assert.deepEqual(updatePreferenceScores([{ name: 'Ignored', tags: ['Tokens'] }], { Ignored: 'ignore' }, ['Ignored'], {}), { Tokens: -1 })
})

test('undecided and later cards observe full cooldown near queue exhaustion', () => {
  const cards = [{ name: 'Undecided' }, { name: 'Later' }]
  const deferred = deferBatch(cards, { Later: 'later' }, 1, (card) => card.name)
  assert.deepEqual(releaseDeferred(deferred, 2).ready, [])
  assert.deepEqual(releaseDeferred(deferred, 3).ready, [])
  assert.deepEqual(releaseDeferred(deferred, 4).ready.map((card) => card.name), ['Undecided'])
  assert.deepEqual(releaseDeferred(deferred, 5).ready.map((card) => card.name), ['Undecided', 'Later'])
  assert.deepEqual(releaseNextDeferred(deferred, 2, false).ready.map((card) => card.name), ['Undecided'])
  assert.equal(releaseNextDeferred(deferred, 2, false).batchNumber, 4)
})

test('commander theme choices use supported EDHREC associations in source order', () => {
  const tags = [
    { count: 100, slug: 'mutants', value: 'Mutants' },
    { count: 80, slug: 'turtles', value: 'Turtles' },
    { count: 60, slug: 'toughness-matters', value: 'Toughness Matters' },
    { count: 50, slug: 'energy', value: 'Energy' },
    { count: 40, slug: 'reanimator', value: 'Reanimator' },
    { count: 20, slug: 'combo', value: 'Combo' },
  ]
  assert.deepEqual(commanderThemes(tags), ['Mutants', 'Turtles', 'Toughness matters', 'Energy', 'Recursion'])
  assert.deepEqual(unsupportedCommanderThemes(tags), ['Combo'])
})

test('broad mechanic matchers avoid common false positives', () => {
  assert.equal(tagsFor('Counter target spell.', 'Instant').includes('Counters'), false)
  assert.equal(tagsFor('Create a token that is a copy of target creature.', 'Sorcery').includes('Resource tokens'), false)
  assert.equal(tagsFor('Target creature gets +0/+3.', 'Instant').includes('Toughness matters'), false)
  assert.equal(tagsFor('This creature has power 3.', 'Creature').includes('Power 7+'), false)
})

test('scarce missing roles beat abundant roles and accumulated preferences', () => {
  const card = (name: string, tags: string[]) => ({ name, tags, typeLine: 'Instant', reason: 'Interaction' })
  const queue = [card('Old 1', []), card('Old 2', []), card('Old 3', []), card('Old 4', []), card('Ramp 1', ['ramp', 'Popular']), card('Ramp 2', ['ramp']), card('Ramp 3', ['ramp']), card('Wipe', ['wipes'])]
  const result = advanceRecommendationQueue({
    queue, deferredCards: [], batchNumber: 8, decisions: {}, liked: [], preferenceScores: { Popular: 50 }, activeSubThemes: [], theme: '', includeCreature: false,
    roleBoosts: { ramp: 6, wipes: 6 }, cardRoles: (item) => item.tags,
  })
  assert.equal(result.queue[0].name, 'Wipe')
})

test('role deficits boost ranking without fixed batch quotas', () => {
  const card = (name: string, tags: string[] = [], reason = 'Interaction') => ({ name, tags, typeLine: 'Instant', reason })
  const queue = [
    ...['Current 1', 'Current 2', 'Current 3', 'Current 4'].map((name) => card(name)),
    card('Themed', ['Tokens']), card('Generic 1'), card('Generic 2'), card('Generic 3'), card('Ramp', ['ramp']), card('Wipe', ['wipes']),
  ]
  const result = advanceRecommendationQueue({
    queue, deferredCards: [], batchNumber: 1, decisions: Object.fromEntries(queue.slice(0, 4).map(({ name }) => [name, 'add' as const])), liked: [], preferenceScores: {}, activeSubThemes: [], theme: 'Tokens', includeCreature: false,
    roleBoosts: { ramp: 8, wipes: 18 }, cardRoles: (item) => item.tags,
  })
  assert.deepEqual(result.queue.slice(0, 3).map(({ name }) => name), ['Wipe', 'Ramp', 'Themed'])
})

test('recommendation reload starts a fresh cooldown cycle', () => {
  assert.deepEqual(freshRecommendationCycle(), { deferredCards: [], batchNumber: 1 })
})

test('queue transition uses production ranking and cooldown rules', () => {
  const card = (name: string, tags: string[] = [], typeLine = 'Instant', reason = 'Interaction') => ({ name, tags, typeLine, reason })
  const result = advanceRecommendationQueue({
    queue: [card('Added', ['Tokens']), card('Liked', ['Tokens']), card('Later'), card('Undecided'), card('Next', ['Tokens']), card('Mana', [], 'Land', 'Land or mana')],
    deferredCards: [], batchNumber: 1, decisions: { Added: 'add', Later: 'later' }, liked: ['Liked'], preferenceScores: {}, activeSubThemes: [], theme: '', includeCreature: false,
  })
  assert.equal(result.batchNumber, 2)
  assert.deepEqual(result.queue.map(({ name }) => name), ['Next', 'Mana'])
  assert.deepEqual(result.deferredCards.map(({ card, eligibleBatch }) => [card.name, eligibleBatch]), [['Liked', 4], ['Later', 5], ['Undecided', 4]])
  assert.equal(result.preferenceScores.Tokens, 6)
})
