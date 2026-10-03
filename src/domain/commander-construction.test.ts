import assert from 'node:assert/strict'
import test from 'node:test'
import { toCard, toDeckCard, type ScryfallCard } from './card-model.ts'
import { cardConstructionError, commanderConstructionError } from './commander-construction.ts'
import { commanderNames } from './commander-catalog.ts'
import { commanderPromotionInfo, isCommanderCandidate } from './commander-promotion.ts'
import { addCardSearchCards } from './card-search.ts'
import { applyDeckDoctorSwap } from '../deck-doctor.ts'
import { addRecommendationCard, decide, moveSideboardCard } from '../app/deck-actions.ts'
import type { ActionDeps } from '../app/recommendation-actions.ts'

const raw = (name: string, changes: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  oracle_id: name,
  type_line: 'Legendary Creature — Human',
  color_identity: ['B'],
  cmc: 2,
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: '1',
  prints_search_uri: '',
  ...changes,
})
const card = (name: string, changes: Partial<ScryfallCard> = {}) => toDeckCard(raw(name, changes))

test('copy limits use basic supertype, Oracle exceptions, and gameplay identity', () => {
  for (const name of ['Snow-Covered Swamp', 'Wastes']) {
    const basic = card(name, { type_line: `Basic Snow Land${name === 'Wastes' ? '' : ' — Swamp'}` })
    assert.equal(cardConstructionError(basic, Array(20).fill(basic), ['B']), '')
  }
  const rats = card('Relentless Rats', {
    oracle_text: 'A deck can have any number of cards named Relentless Rats.',
  })
  assert.equal(cardConstructionError(rats, Array(20).fill(rats), ['B']), '')
  for (const [name, word, maximum] of [
    ['Seven Dwarves', 'seven', 7],
    ['Nazgûl', 'nine', 9],
  ] as const) {
    const repeat = card(name, { oracle_text: `A deck can have up to ${word} cards named ${name}.` })
    assert.equal(cardConstructionError(repeat, Array(maximum - 1).fill(repeat), ['B']), '')
    assert.match(cardConstructionError(repeat, Array(maximum).fill(repeat), ['B']), /copy limit/)
  }
  assert.match(
    cardConstructionError(
      card('Alternate name', { oracle_id: 'Same card' }),
      [card('Same card')],
      ['B'],
    ),
    /copy limit/,
  )
})

test('legality, identity, and mana value fail closed without scanning reminder text', () => {
  assert.match(
    cardConstructionError(card('Banned', { legalities: { commander: 'banned' } }), [], ['B']),
    /legal/,
  )
  assert.match(
    cardConstructionError(card('Unknown', { legalities: undefined }), [], ['B']),
    /legal/,
  )
  assert.match(
    cardConstructionError({ ...card('Unknown'), colorIdentity: undefined }, [], ['B']),
    /unknown/,
  )
  assert.match(
    cardConstructionError(card('Unknown', { cmc: undefined }), [], ['B']),
    /mana value is unknown/,
  )
  const ghast = card('Crypt Ghast', {
    oracle_text: 'Extort (Whenever you cast a spell, you may pay {W/B}.)',
  })
  assert.equal(cardConstructionError(ghast, [], ['B']), '')
  assert.equal(commanderPromotionInfo(card('Mono-black'), [ghast])?.canPromote, true)
  assert.equal(
    commanderPromotionInfo(card('Mono-black'), [{ ...ghast, colorIdentity: undefined }])
      ?.canPromote,
    false,
  )
  assert.match(
    cardConstructionError(card('Bad dual', { type_line: 'Land — Swamp Plains' }), [], ['B']),
    /colour identity/,
  )
})

test('commander eligibility uses only the front face and includes Grist', () => {
  for (const [name, front] of [
    ['Westvale Abbey', 'Land'],
    ['Elbrus, the Binding Blade', 'Legendary Artifact — Equipment'],
  ]) {
    const transforming = card(name, {
      type_line: `${front} // Legendary Creature — Demon`,
      card_faces: [
        { type_line: front, oracle_text: '' },
        {
          type_line: 'Legendary Creature — Demon',
          oracle_text: 'This card can be your commander.',
        },
      ],
    })
    assert.equal(isCommanderCandidate(transforming), false)
    assert.match(commanderConstructionError([transforming]), /cannot/)
  }
  assert.equal(
    commanderConstructionError([
      card('Grist, the Hunger Tide', { type_line: 'Legendary Planeswalker — Grist' }),
    ]),
    '',
  )
  assert.match(
    commanderConstructionError([card('Legendary rock', { type_line: 'Legendary Artifact' })]),
    /cannot/,
  )
  assert.match(
    commanderConstructionError([card('Banned legend', { legalities: { commander: 'banned' } })]),
    /legal/,
  )
  assert.match(commanderConstructionError([card('The Prismatic Piper')]), /not supported/)
})

test('all five partner abilities are checked, including mismatches and unknown variants', () => {
  const partner = (name: string, text: string) => card(name, { oracle_text: text })
  const pairs = [
    [partner('A', 'Partner'), partner('B', 'Partner (You can have two commanders.)')],
    [partner('A', 'Partner with B'), partner('B', 'Partner with A')],
    [
      partner('A', 'Choose a Background'),
      card('B', { type_line: 'Legendary Enchantment — Background' }),
    ],
    [
      card('A', { type_line: 'Legendary Creature — Time Lord Doctor' }),
      partner('B', "Doctor's companion"),
    ],
    ...['Character select', 'Father & son', 'Friends forever', 'Survivors'].map((variant) => [
      partner('A', `Partner—${variant}`),
      partner('B', `Partner—${variant}`),
    ]),
    [partner('A', 'Friends forever'), partner('B', 'Friends forever')],
  ]
  for (const pair of pairs) {
    assert.equal(commanderConstructionError(pair), '')
    assert.equal(commanderConstructionError([...pair].reverse()), '')
  }
  assert.match(
    commanderConstructionError([partner('A', 'Partner'), partner('B', 'Friends forever')]),
    /partner ability/,
  )
  assert.match(
    commanderConstructionError([partner('A', 'Partner with B'), partner('B', 'Partner with C')]),
    /partner ability/,
  )
  assert.match(
    commanderConstructionError([partner('A', 'Partner—Unknown'), partner('B', 'Partner—Unknown')]),
    /supported/,
  )
  assert.deepEqual(commanderNames('A & B'), ['A', 'B'])
  assert.deepEqual(commanderNames('Thrasios & Tymna'), [
    'Thrasios, Triton Hero',
    'Tymna the Weaver',
  ])
})

test('search, guidance, batch decisions, sideboard moves and swaps reject the same illegal card', () => {
  for (const changes of [
    { legalities: { commander: 'banned' } },
    { color_identity: ['W'] },
    { cmc: undefined },
  ]) {
    const illegal = raw('Illegal', changes)
    const candidate = toCard(illegal, 'Test')
    const deck = [card('Commander'), card('Cut')]
    const deps: Record<string, any> = {
      deck,
      sideboard: [toDeckCard(illegal)],
      decisions: {},
      commanderDetails: { colours: ['B'] },
      setBatchAnnouncement: () => {},
      setDeck: () => assert.fail('Illegal card must not change deck'),
      setSideboard: () => assert.fail('Illegal card must not change sideboard'),
      setQueue: () => assert.fail('Illegal card must not change queue'),
      setDecisions: () => assert.fail('Illegal card must not record an Add decision'),
    }
    assert.throws(() => addCardSearchCards([illegal], deck, [], ['B']))
    addRecommendationCard(deps as ActionDeps, candidate)
    decide(deps as ActionDeps, candidate, 'add')
    moveSideboardCard(deps as ActionDeps, 0)
    assert.throws(() =>
      applyDeckDoctorSwap({
        id: 'test',
        deck,
        sideboard: [],
        commanderCount: 1,
        commanderColours: ['B'],
        swap: { cutIndex: 1, cutCard: deck[1], addCard: candidate, reason: '' },
        moveCutToSideboard: false,
      }),
    )
  }
})
