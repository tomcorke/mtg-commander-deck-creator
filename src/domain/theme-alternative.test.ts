import assert from 'node:assert/strict'
import test from 'node:test'
import { toCard, type ScryfallCard } from './card-model.ts'
import { findThemeAlternative, type AlternativeSource } from './theme-alternative.ts'

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
const tokens = 'create a 1/1 green Saproling creature token.'
const signet = card('Signet', { produced_mana: ['G'], oracle_text: '{T}: Add {G}.' })
const divination = card('Divination', { type_line: 'Sorcery', oracle_text: 'Draw two cards.' })
const tokenRock = card('Token rock', {
  produced_mana: ['G'],
  oracle_text: `{T}: Add {G}.\nWhenever you cast a creature spell, ${tokens}`,
})
const tokenDraw = card('Token draw', {
  type_line: 'Sorcery',
  oracle_text: `Draw two cards, then ${tokens}`,
})
const zombieDraw = card('Zombie draw', {
  type_line: 'Creature — Zombie',
  oracle_text: 'When this creature enters, draw two cards.',
})
const tokenBear = card('Token bear', {
  type_line: 'Creature — Bear',
  oracle_text: `When this creature enters, ${tokens}`,
})
const forest = card('Forest', { type_line: 'Basic Land — Forest', produced_mana: ['G'] })
const tokenLand = card('Token land', {
  type_line: 'Land',
  produced_mana: ['G'],
  oracle_text: `{T}: Add {G}.\n{4}, {T}: ${tokens.replace(/^c/, 'C')}`,
})
const pool = (entries: [ReturnType<typeof card>, AlternativeSource][]) =>
  entries.map(([card, source]) => ({ card, source }))

test('a generic pick names an on-theme pool card with the same role (#563)', () => {
  const found = findThemeAlternative(
    signet,
    ['Tokens'],
    pool([
      [divination, 'queue'],
      [tokenDraw, 'queue'],
      [tokenRock, 'later'],
    ]),
  )
  assert.deepEqual(found, { card: tokenRock, role: 'ramp', themes: ['Tokens'], source: 'later' })
  // Pool order wins among matches: the queue is ranked, so it comes before Later.
  const both = pool([
    [tokenDraw, 'queue'],
    [zombieDraw, 'later'],
  ])
  assert.equal(findThemeAlternative(divination, ['Tokens', 'Zombies'], both)?.card, tokenDraw)
  // Every selected theme the alternative matches is named, in selection order.
  assert.deepEqual(findThemeAlternative(divination, ['Zombies', 'Tokens'], both)?.themes, [
    'Tokens',
  ])
  assert.deepEqual(findThemeAlternative(divination, ['Zombies'], both), {
    card: zombieDraw,
    role: 'draw',
    themes: ['Zombies'],
    source: 'later',
  })
})

test('no alternative without a role, a pool match or a theme, or for a theme match (#563)', () => {
  const everything = pool([
    [tokenRock, 'queue'],
    [tokenDraw, 'queue'],
    [tokenBear, 'queue'],
    [tokenLand, 'queue'],
  ])
  // No detected role on the offer: nothing to match.
  assert.equal(findThemeAlternative(card('Plain'), ['Tokens'], everything), null)
  // An on-theme card without the role does not count, and lands are not a matched role.
  assert.equal(
    findThemeAlternative(
      divination,
      ['Tokens'],
      pool([
        [tokenBear, 'queue'],
        [tokenRock, 'queue'],
      ]),
    ),
    null,
  )
  assert.equal(findThemeAlternative(forest, ['Tokens'], everything), null)
  // A same-role card that matches no theme is not on theme.
  assert.equal(findThemeAlternative(signet, ['Tokens'], pool([[signet, 'queue']])), null)
  assert.equal(
    findThemeAlternative(
      signet,
      ['Tokens'],
      pool([[card('Mind rock', { produced_mana: ['G'], oracle_text: '{T}: Add {G}.' }), 'queue']]),
    ),
    null,
  )
  // No theme chosen, or a theme-matching offer: never.
  assert.equal(findThemeAlternative(signet, [], everything), null)
  assert.equal(findThemeAlternative(tokenDraw, ['Tokens'], everything), null)
})
