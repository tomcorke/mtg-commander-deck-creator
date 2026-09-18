import assert from 'node:assert/strict'
import test from 'node:test'
import { commanderThemes, deferBatch, findSynergyPair, freshRecommendationCycle, releaseDeferred, releaseNextDeferred, supportedThemes, tagsFor, updatePreferenceScores } from './recommendations.ts'

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
