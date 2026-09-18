import assert from 'node:assert/strict'
import test from 'node:test'
import { batchRecommendations, commanderThemes, deferBatch, findSynergyPair, freshRecommendationCycle, limitThemeMatches, orderedPrintings, preferredPrintingIndex, releaseDeferred, releaseNextDeferred, supportedThemes, tagsFor, updatePreferenceScores } from './recommendations.ts'

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
