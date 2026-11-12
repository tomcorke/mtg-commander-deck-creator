import assert from 'node:assert/strict'
import test from 'node:test'
import type { ScryfallCard } from './card-model.ts'
import {
  deckCountFor,
  deckCountLabel,
  edhrecDeckCounts,
  edhrecIdentitySlug,
} from './commander-popularity.ts'

test('every colour identity maps to one EDHREC commander list page', () => {
  const colours = ['W', 'U', 'B', 'R', 'G']
  const slugs = new Set<string>()
  for (let mask = 0; mask < 32; mask++) {
    const identity = colours.filter((_, index) => mask & (1 << index))
    const slug = edhrecIdentitySlug(identity)
    assert.ok(slug, identity.join(''))
    assert.equal(edhrecIdentitySlug(identity.toReversed()), slug, 'order does not matter')
    slugs.add(slug)
  }
  assert.equal(slugs.size, 32)
  assert.equal(edhrecIdentitySlug([]), 'colorless')
  assert.equal(edhrecIdentitySlug(['U', 'W']), 'azorius')
  assert.equal(edhrecIdentitySlug(['G', 'W', 'U', 'B']), 'witch-maw')
})

test('deck counts match full names and double-faced front faces', () => {
  const counts = edhrecDeckCounts({
    container: {
      json_dict: {
        cardlists: [
          {
            header: 'Azorius Commanders',
            tag: 'azoriuscommanders',
            cardviews: [
              { name: 'Brago, King Eternal', num_decks: 15611 },
              { name: 'Front Face', num_decks: 42 },
              { name: 'No count' },
            ],
          },
        ],
      },
    },
  })
  const card = (name: string) => ({ name, color_identity: ['W', 'U'] }) as ScryfallCard
  assert.equal(deckCountFor(counts, card('Brago, King Eternal')), 15611)
  assert.equal(deckCountFor(counts, card('Front Face // Back Face')), 42)
  assert.equal(deckCountFor(counts, card('No count')), undefined)
  assert.equal(deckCountFor(undefined, card('Brago, King Eternal')), undefined)
})

test('deck count labels name EDHREC and round large counts', () => {
  assert.equal(deckCountLabel(1), '1 deck on EDHREC')
  assert.equal(deckCountLabel(999), '999 decks on EDHREC')
  assert.equal(deckCountLabel(15611), '≈15.6k decks on EDHREC')
  assert.equal(deckCountLabel(59441), '≈59.4k decks on EDHREC')
})
