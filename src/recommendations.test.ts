import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceRecommendationQueue, batchRecommendations, buildEdhrecRecommendations, commanderThemes, deferBatch, findSynergyPair, freshRecommendationCycle, limitThemeMatches, orderedPrintings, parseEdhrecEntries, preferredPrintingIndex, releaseDeferred, releaseNextDeferred, supportedThemes, tagsFor, updatePreferenceScores } from './recommendations.ts'

test('all exposed themes can tag matching card text', () => {
  for (const theme of supportedThemes) {
    const source = ({
      Tokens: 'create one Soldier token', '+1/+1 counters': 'put a +1/+1 counter', Enchantments: 'enchantment', Graveyard: 'graveyard', Dragons: 'Dragon', Spellslinger: 'instant or sorcery', Artifacts: 'artifact', Lifegain: 'gain 2 life', Sacrifice: 'sacrifice a creature', Equipment: 'Equipment', 'Group hug': 'each player draws', Landfall: 'landfall', Voltron: 'equipped creature', Goad: 'goad', Typal: 'choose a creature type', 'Big mana': 'mana value 7', Blink: 'exile it then return', Political: 'vote', Vampires: 'Vampire', Angels: 'Angel', Demons: 'Demon', Faeries: 'Faerie', Vehicles: 'Vehicle', Indestructible: 'indestructible', Mill: 'mill three cards', Zombies: 'Zombie', Elves: 'Elf', Goblins: 'Goblin', Dinosaurs: 'Dinosaur', Merfolk: 'Merfolk', Knights: 'Knight', Spirits: 'Spirit', Slivers: 'Sliver',
    } as Record<string, string>)[theme]
    assert.ok(tagsFor(source, '').includes(theme), theme)
  }
})

test('synergy pair requires concrete complementary rules text', () => {
  const cards = [
    { name: 'Maker', typeLine: 'Creature', detail: 'Create two Soldier tokens.', tags: ['Tokens'] },
    { name: 'Payoff', typeLine: 'Enchantment', detail: 'Tokens you control get +1/+1.', tags: ['Tokens'] },
  ]
  assert.match(findSynergyPair(cards)?.explanation ?? '', /creates tokens/)
  assert.equal(findSynergyPair(cards.map((card) => ({ ...card, detail: 'Artifact creature.' }))), null)
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
  ]
  const entries = cards.map((card) => ({ name: card.name, tag: card.name === 'Creature' ? 'highsynergycards' : 'topcards', header: 'Top Cards' }))
  const result = buildEdhrecRecommendations(entries, cards, { includeCreature: true, excludeGameChangers: true, excludeTutors: true, excludeExtraTurns: true, powerTarget: 'precon' })
  assert.deepEqual(result.map((card) => card.name), ['Creature', 'Spell', 'Rock'])
  assert.equal(result[0].reason, 'Commander synergy')
  assert.equal(result[2].reason, 'Land or mana')
})

test('batches reserve mana and prefer distinct recommendation reasons', () => {
  const cards = [
    ...['Synergy 1', 'Synergy 2', 'Synergy 3', 'Synergy 4'].map((name) => ({ name, reason: 'Commander synergy', typeLine: 'Creature' })),
    { name: 'Interaction', reason: 'Interaction', typeLine: 'Instant' },
    { name: 'Utility', reason: 'Utility artifact', typeLine: 'Artifact' },
    { name: 'Mana', reason: 'Land or mana', typeLine: 'Land' },
  ]
  const first = batchRecommendations(cards, true).slice(0, 4)
  assert.equal(first.filter((card) => card.reason === 'Land or mana').length, 1)
  assert.equal(new Set(first.map((card) => card.reason)).size, 4)
})

test('new cards are limited to one per batch when established picks exist', () => {
  const cards = [
    ...['New 1', 'New 2', 'New 3', 'New 4'].map((name) => ({ name, reason: 'Interesting new pick', typeLine: 'Creature' })),
    { name: 'Synergy', reason: 'Commander synergy', typeLine: 'Creature' },
    { name: 'Interaction', reason: 'Interaction', typeLine: 'Instant' },
    { name: 'Mana', reason: 'Land or mana', typeLine: 'Land' },
  ]
  const ordered = batchRecommendations(cards, true)
  assert.equal(ordered.slice(0, 4).filter((card) => card.reason === 'Interesting new pick').length, 1)
  assert.equal(ordered.slice(0, 4).filter((card) => card.reason === 'Land or mana').length, 1)
  assert.equal(new Set(ordered).size, cards.length)
})

test('active themes fill at most two slots without changing batch roles or losing cards', () => {
  const cards = [
    { name: 'Theme creature', tags: ['Tokens'], mana: false, creature: true },
    { name: 'Theme spell', tags: ['Tokens'], mana: false, creature: false },
    { name: 'Theme utility', tags: ['Tokens'], mana: false, creature: false },
    { name: 'Theme mana', tags: ['Tokens'], mana: true, creature: false },
    { name: 'Varied creature', tags: ['Artifacts'], mana: false, creature: true },
    { name: 'Varied spell', tags: ['Artifacts'], mana: false, creature: false },
    { name: 'Varied utility', tags: ['Artifacts'], mana: false, creature: false },
    { name: 'Varied mana', tags: ['Artifacts'], mana: true, creature: false },
  ]
  const ordered = limitThemeMatches(cards, ['Tokens'], (card) => card.mana, (card) => card.creature)
  const first = ordered.slice(0, 4)
  assert.equal(first.filter((card) => card.tags.includes('Tokens')).length, 2)
  assert.equal(first.filter((card) => card.mana).length, 1)
  assert.equal(first.filter((card) => card.creature).length, 1)
  assert.equal(new Set(ordered).size, cards.length)
  assert.deepEqual(new Set(ordered), new Set(cards))
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
  assert.deepEqual(commanderThemes([
    { count: 100, slug: 'enchantress', value: 'Enchantress' },
    { count: 80, slug: 'tokens', value: 'Tokens' },
    { count: 60, slug: 'combo', value: 'Combo' },
    { count: 40, slug: 'graveyard', value: 'Graveyard' },
  ]), ['Enchantments', 'Tokens', 'Graveyard'])
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
