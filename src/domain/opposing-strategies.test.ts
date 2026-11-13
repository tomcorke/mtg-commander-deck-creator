import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeOpposingAnswerTargets,
  normalizeOpposingStrategies,
  opposingAnswerCounts,
  opposingAnswerEvidence,
  opposingAnswerLabel,
  opposingAnswerScore,
  opposingAnswers,
} from './opposing-strategies.ts'
import { recommendationScoreBreakdown } from './recommendation-scoring.ts'
import type { OpposingStrategy, RecommendationStyle } from './recommendation-types.ts'

// Oracle text as printed on Scryfall, checked 2026-11-13; detection is a heuristic over this text.
const cards: Record<string, { detail: string; answers: string[] }> = {
  'Bojuka Bog': {
    detail:
      'Bojuka Bog enters tapped.\nWhen Bojuka Bog enters, exile target player’s graveyard.\n{T}: Add {B}.',
    answers: ['graveyard'],
  },
  'Rest in Peace': {
    detail:
      'When Rest in Peace enters, exile all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.',
    answers: ['graveyard'],
  },
  "Grafdigger's Cage": {
    detail:
      'Creature cards in graveyards and libraries can’t enter the battlefield.\nPlayers can’t cast spells from graveyards or libraries.',
    answers: ['graveyard'],
  },
  'Scavenging Ooze': {
    detail:
      '{G}: Exile target card from a graveyard. If it was a creature card, put a +1/+1 counter on Scavenging Ooze and you gain 1 life.',
    answers: ['graveyard'],
  },
  'Eternal Witness': {
    detail: 'When Eternal Witness enters, return target card from your graveyard to your hand.',
    answers: [],
  },
  'Treasure Cruise': {
    detail:
      'Delve (Each card you exile from your graveyard while casting this spell pays for {1}.)\nDraw three cards.',
    answers: [],
  },
  "Nature's Claim": {
    detail: 'Destroy target artifact or enchantment. Its controller gains 4 life.',
    answers: ['artifacts'],
  },
  Vandalblast: {
    detail:
      'Destroy target artifact you don’t control.\nOverload {4}{R} (You may cast this spell for its overload cost. If you do, change “target” in its text to “each.”)',
    answers: ['artifacts'],
  },
  'Beast Within': {
    detail: 'Destroy target permanent. Its controller creates a 3/3 green Beast creature token.',
    answers: ['artifacts', 'big-creatures'],
  },
  'Collector Ouphe': {
    detail: 'Activated abilities of artifacts can’t be activated.',
    answers: ['artifacts', 'combo'],
  },
  'Massacre Wurm': {
    detail:
      'When Massacre Wurm enters, creatures your opponents control get -2/-2 until end of turn.\nWhenever a creature an opponent controls dies, that player loses 2 life.',
    answers: ['tokens'],
  },
  Pyroclasm: { detail: 'Pyroclasm deals 2 damage to each creature.', answers: ['tokens'] },
  'Wrath of God': {
    detail: 'Destroy all creatures. They can’t be regenerated.',
    answers: ['tokens', 'big-creatures'],
  },
  Counterspell: { detail: 'Counter target spell.', answers: ['combo', 'spellslinger'] },
  'Essence Scatter': { detail: 'Counter target creature spell.', answers: ['combo'] },
  Stifle: {
    detail: 'Counter target activated or triggered ability. (Mana abilities can’t be targeted.)',
    answers: ['combo'],
  },
  'Rule of Law': {
    detail: 'Each player can’t cast more than one spell each turn.',
    answers: ['combo', 'spellslinger'],
  },
  'Torpor Orb': {
    detail: 'Creatures entering the battlefield don’t cause abilities to trigger.',
    answers: ['combo'],
  },
  'Swords to Plowshares': {
    detail: 'Exile target creature. Its controller gains life equal to its power.',
    answers: ['big-creatures'],
  },
  Pacifism: {
    detail: 'Enchant creature\nEnchanted creature can’t attack or block.',
    answers: ['big-creatures'],
  },
  'Diabolic Edict': { detail: 'Target player sacrifices a creature.', answers: ['big-creatures'] },
  Smother: {
    detail: 'Destroy target creature with mana value 3 or less. It can’t be regenerated.',
    answers: [],
  },
  'Animate Dead': {
    detail:
      'Enchant creature card in a graveyard\nWhen Animate Dead enters, if it’s on the battlefield, it loses “enchant creature card in a graveyard” and gains “enchant creature put onto the battlefield with Animate Dead.” Return enchanted creature card to the battlefield under your control and attach Animate Dead to it. When Animate Dead leaves the battlefield, that creature’s controller sacrifices it.\nEnchanted creature gets -1/-0.',
    answers: [],
  },
  'Lightning Bolt': { detail: 'Lightning Bolt deals 3 damage to any target.', answers: [] },
  'Thalia, Guardian of Thraben': {
    detail: 'First strike\nNoncreature spells cost {1} more to cast.',
    answers: ['spellslinger'],
  },
  'Goblin Electromancer': {
    detail: 'Instant and sorcery spells you cast cost {1} less to cast.',
    answers: [],
  },
  'Kambal, Consul of Allocation': {
    detail:
      'Whenever an opponent casts a noncreature spell, that player loses 2 life and you gain 2 life.',
    answers: ['spellslinger'],
  },
  'Swiftfoot Boots': {
    detail:
      'Equipped creature has hexproof and haste. (It can’t be the target of spells or abilities your opponents control.)\nEquip {1}',
    answers: [],
  },
}

test('answer clues match real Oracle text for each opposing strategy (#503)', () => {
  for (const [name, { detail, answers }] of Object.entries(cards))
    assert.deepEqual(opposingAnswers({ detail }), answers, name)
})

test('straight apostrophes match as typographic ones do', () => {
  assert.deepEqual(opposingAnswers({ detail: "Exile target player's graveyard." }), ['graveyard'])
})

test('only selected strategies are checked, in the order given', () => {
  const { detail } = cards['Beast Within']
  assert.deepEqual(opposingAnswers({ detail }, ['big-creatures', 'artifacts']), [
    'big-creatures',
    'artifacts',
  ])
  assert.deepEqual(opposingAnswers({ detail }, []), [])
  assert.deepEqual(opposingAnswers({}, ['graveyard']), [])
})

test('evidence quotes the matching rules-text sentence without reminder text', () => {
  assert.equal(
    opposingAnswerEvidence(cards['Bojuka Bog'], 'graveyard'),
    'When Bojuka Bog enters, exile target player’s graveyard.',
  )
  assert.equal(
    opposingAnswerEvidence(cards.Stifle, 'combo'),
    'Counter target activated or triggered ability.',
  )
  assert.equal(opposingAnswerEvidence(cards['Lightning Bolt'], 'combo'), undefined)
  assert.equal(opposingAnswerLabel('big-creatures'), 'Answers big creatures')
})

test('counts include every main-deck card that answers each strategy', () => {
  const deck = [cards['Bojuka Bog'], cards['Scavenging Ooze'], cards['Beast Within']]
  assert.deepEqual(opposingAnswerCounts(deck, ['graveyard', 'artifacts', 'combo']), {
    graveyard: 2,
    artifacts: 1,
    combo: 0,
  })
})

test('answer score eases once a strategy meets its target and halves under Theme first', () => {
  const beast = cards['Beast Within']
  const score = (
    opposingStrategies: OpposingStrategy[],
    opposingAnswerCounts = {},
    recommendationStyle: RecommendationStyle = 'balanced',
  ) => opposingAnswerScore(beast, { opposingStrategies, opposingAnswerCounts, recommendationStyle })
  assert.equal(score([]), 0)
  assert.equal(score(['artifacts']), 6)
  assert.equal(score(['artifacts'], { artifacts: 3 }), 2)
  assert.equal(score(['artifacts', 'big-creatures']), 10)
  assert.equal(score(['artifacts'], {}, 'thematic'), 3)
  assert.equal(
    opposingAnswerScore(cards['Lightning Bolt'], { opposingStrategies: ['artifacts', 'combo'] }),
    0,
  )
})

test('each strategy eases at its own edited target (#565)', () => {
  const beast = cards['Beast Within']
  const score = (opposingAnswerTargets: Partial<Record<OpposingStrategy, number>>) =>
    opposingAnswerScore(beast, {
      opposingStrategies: ['artifacts', 'big-creatures'],
      opposingAnswerCounts: { artifacts: 3, 'big-creatures': 3 },
      opposingAnswerTargets,
    })
  // Both at the default target of 3: met, 2 each.
  assert.equal(score({}), 4)
  // Artifacts raised to 5: still below, so 6 + 2.
  assert.equal(score({ artifacts: 5 }), 8)
  // Both lowered to 0: met with no answers needed.
  assert.equal(score({ artifacts: 0, 'big-creatures': 0 }), 4)
})

test('saved answer targets keep known strategies as whole numbers from 0 to 99 (#565)', () => {
  assert.deepEqual(
    normalizeOpposingAnswerTargets({
      combo: 5.4,
      graveyard: -2,
      tokens: 400,
      artifacts: 3,
      spellslinger: 'six',
      'future-thing': 4,
    }),
    { graveyard: 0, tokens: 99, combo: 5 },
  )
  assert.deepEqual(normalizeOpposingAnswerTargets(undefined), {})
  assert.deepEqual(normalizeOpposingAnswerTargets([4]), {})
})

test('scores are unchanged without expected opponents and rise for answers with them', () => {
  const card = { name: 'Bojuka Bog', reason: 'Commander synergy', tags: [], ...cards['Bojuka Bog'] }
  const context = {
    theme: '',
    activeSubThemes: [],
    pickedTags: new Set<string>(),
    preferenceScores: {},
    neededRoles: new Set<string>(),
    cardRoles: [],
  }
  const without = recommendationScoreBreakdown(card, context)
  assert.equal(without.opposingAnswers, 0)
  const withOpponents = recommendationScoreBreakdown(card, {
    ...context,
    opposingStrategies: ['graveyard'],
    opposingAnswerCounts: { graveyard: 0 },
  })
  assert.equal(withOpponents.opposingAnswers, 6)
  assert.equal(withOpponents.total, without.total + 6)
})

test('saved selections keep known strategies once, in canonical order', () => {
  assert.deepEqual(normalizeOpposingStrategies(['combo', 'graveyard', 'combo', 'future-thing']), [
    'graveyard',
    'combo',
  ])
  assert.deepEqual(normalizeOpposingStrategies(undefined), [])
  assert.deepEqual(normalizeOpposingStrategies('graveyard'), [])
})

test('typed spell taxes and power-only shrinking are not answers', () => {
  assert.deepEqual(opposingAnswers({ detail: 'Creature spells cost {2} more to cast.' }), [])
  assert.deepEqual(
    opposingAnswers({ detail: 'Creatures your opponents control get -2/-0 until end of turn.' }),
    [],
  )
  assert.deepEqual(opposingAnswers({ detail: 'All creatures get -2/-0 until end of turn.' }), [])
  assert.deepEqual(
    opposingAnswers({
      detail: 'If this creature would be put into a graveyard from anywhere, exile it instead.',
    }),
    [],
  )
  assert.deepEqual(
    opposingAnswers({
      detail:
        'When you cast this spell, you may put two cards your opponents own from exile into their owners’ graveyards.',
    }),
    [],
  )
  assert.deepEqual(
    opposingAnswers({ detail: 'Return all artifacts and enchantments to their owners’ hands.' }),
    [],
  )
  assert.deepEqual(
    opposingAnswers({
      detail: 'Until end of turn, gain control of target creature and it gains haste.',
    }),
    [],
  )
})

test('noncreature removal is no big-creature answer; your-own trigger conditions do not veto (#503 review)', () => {
  assert.deepEqual(
    opposingAnswers({ detail: 'Destroy target noncreature permanent.' }, ['big-creatures']),
    [],
  )
  assert.deepEqual(
    opposingAnswers(
      {
        detail:
          'Whenever a creature you control dies, destroy target creature an opponent controls.',
      },
      ['big-creatures'],
    ),
    ['big-creatures'],
  )
  // A cost naming your own permanents does not veto either; the effect itself still does.
  assert.deepEqual(
    opposingAnswers({ detail: 'Sacrifice a creature you control: Exile target creature.' }, [
      'big-creatures',
    ]),
    ['big-creatures'],
  )
  assert.deepEqual(
    opposingAnswers({ detail: 'Exile target creature you control.' }, ['big-creatures']),
    [],
  )
})
