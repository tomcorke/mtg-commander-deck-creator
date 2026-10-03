import assert from 'node:assert/strict'
import test from 'node:test'
import { toCard, toDeckCard, type ScryfallCard } from './card-model.ts'
import {
  selectSignatureSeeds,
  supportsSignature,
  signatureLimits,
} from './signature-recommendations.ts'
import { buildRecommendationContext } from '../app/recommendation-context.ts'

const raw = (name: string, oracle_text: string, type_line = 'Creature'): ScryfallCard => ({
  name,
  oracle_text,
  type_line,
  color_identity: ['G'],
  set: 'tst',
  collector_number: name,
  prints_search_uri: '',
})
const fixtures = [
  {
    theme: 'Tokens',
    engine: raw(
      'Anointed Procession',
      'If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.',
      'Enchantment',
    ),
    peers: [
      raw('Raise the Alarm', 'Create two 1/1 white Soldier creature tokens.', 'Instant'),
      raw(
        'Intangible Virtue',
        'Creature tokens you control get +1/+1 and have vigilance.',
        'Enchantment',
      ),
    ],
    support: raw(
      'Call the Coppercoats',
      'Create X 1/1 white Human Soldier creature tokens.',
      'Instant',
    ),
    unrelated: raw('Sol Ring', '{T}: Add {C}{C}.', 'Artifact'),
  },
  {
    theme: 'Enchantments',
    engine: raw(
      "Sythis, Harvest's Hand",
      'Whenever you cast an enchantment spell, you gain 1 life and draw a card.',
      'Legendary Enchantment Creature',
    ),
    peers: [
      raw('Sterling Grove', 'Other enchantments you control have shroud.', 'Enchantment'),
      raw(
        'Seal of Cleansing',
        'Sacrifice this enchantment: Destroy target artifact or enchantment.',
        'Enchantment',
      ),
    ],
    support: raw(
      'Setessan Champion',
      'Whenever an enchantment you control enters, put a +1/+1 counter on this creature and draw a card.',
    ),
    unrelated: raw('Naturalize', 'Destroy target artifact or enchantment.', 'Instant'),
  },
  {
    theme: 'Artifacts',
    engine: raw(
      'Etherium Sculptor',
      'Artifact spells you cast cost {1} less to cast.',
      'Artifact Creature',
    ),
    peers: [
      raw('Sol Ring', '{T}: Add {C}{C}.', 'Artifact'),
      raw(
        'Ichor Wellspring',
        'When this artifact enters or is put into a graveyard from the battlefield, draw a card.',
        'Artifact',
      ),
    ],
    support: raw(
      'Thought Monitor',
      'Affinity for artifacts. When this creature enters, draw two cards.',
      'Artifact Creature',
    ),
    unrelated: raw('Annul', 'Counter target artifact or enchantment spell.', 'Instant'),
  },
  {
    theme: 'Lifegain',
    engine: raw(
      'Heliod, Sun-Crowned',
      'Whenever you gain life, put a +1/+1 counter on target creature or enchantment you control.',
      'Legendary Enchantment Creature',
    ),
    peers: [
      raw('Soul Warden', 'Whenever another creature enters, you gain 1 life.'),
      raw("Ajani's Pridemate", 'Whenever you gain life, put a +1/+1 counter on this creature.'),
    ],
    support: raw(
      'Authority of the Consuls',
      'Whenever a creature an opponent controls enters, you gain 1 life.',
      'Enchantment',
    ),
    unrelated: raw(
      'False Cure',
      'Until end of turn, whenever a player gains life, that player loses twice that much life.',
      'Instant',
    ),
  },
  {
    theme: 'Graveyard',
    engine: raw(
      'Muldrotha, the Gravetide',
      'During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard.',
      'Legendary Creature',
    ),
    peers: [
      raw("Stitcher's Supplier", 'When this creature enters or dies, mill three cards.'),
      raw('Grisly Salvage', 'Reveal five cards, then put the rest into your graveyard.', 'Instant'),
    ],
    support: raw(
      'Victimize',
      'Choose two target creature cards in your graveyard. Return those cards to the battlefield tapped.',
      'Sorcery',
    ),
    unrelated: raw(
      'Soul-Guide Lantern',
      'When this artifact enters, exile target card from a graveyard.',
      'Artifact',
    ),
  },
  {
    theme: 'Spellslinger',
    engine: raw(
      'Young Pyromancer',
      'Whenever you cast an instant or sorcery spell, create a 1/1 red Elemental creature token.',
    ),
    peers: [
      raw('Ponder', 'Look at three cards. Draw a card.', 'Sorcery'),
      raw('Consider', 'Surveil 1. Draw a card.', 'Instant'),
    ],
    support: raw('Opt', 'Scry 1. Draw a card.', 'Instant'),
    unrelated: raw('Elvish Visionary', 'When this creature enters, draw a card.'),
  },
  {
    theme: 'Landfall',
    engine: raw('Lotus Cobra', 'Whenever a land you control enters, add one mana of any color.'),
    peers: [
      raw(
        'Tireless Provisioner',
        'Whenever a land you control enters, create a Food token or a Treasure token.',
      ),
      raw(
        'Scute Swarm',
        'Whenever a land you control enters, create a 1/1 green Insect creature token.',
      ),
    ],
    support: raw(
      'Felidar Retreat',
      'Landfall — Whenever a land you control enters, create a Cat token or put a +1/+1 counter on each creature.',
      'Enchantment',
    ),
    unrelated: raw(
      'Rampant Growth',
      'Search your library for a basic land card and put it onto the battlefield.',
      'Sorcery',
    ),
  },
  {
    theme: 'Equipment',
    engine: raw(
      'Puresteel Paladin',
      'Whenever an Equipment you control enters, you may draw a card.',
    ),
    peers: [
      raw(
        'Colossus Hammer',
        'Equipped creature gets +10/+10 and loses flying. Equip {8}',
        'Artifact — Equipment',
      ),
      raw(
        'Sword of the Animist',
        'Equipped creature gets +1/+1.',
        'Legendary Artifact — Equipment',
      ),
    ],
    support: raw(
      "Sigarda's Aid",
      'Whenever an Equipment you control enters, you may attach it to target creature you control.',
      'Enchantment',
    ),
    unrelated: raw(
      'Bear Umbra',
      'Enchant creature. Enchanted creature gets +2/+2.',
      'Enchantment — Aura',
    ),
  },
]

test('expanded families select supported engines and reject incidental associations', () => {
  for (const fixture of fixtures) {
    const deck = [raw('Commander', ''), fixture.engine, ...fixture.peers].map(toDeckCard)
    const context = buildRecommendationContext(
      { commander: 'Commander', deck, theme: fixture.theme },
      [],
    )
    const seeds = selectSignatureSeeds('Commander', deck, context)
    assert(seeds.length <= signatureLimits.seedsPerPass)
    const selected = seeds.find(
      ({ card, theme }) => card.name === fixture.engine.name && theme === fixture.theme,
    )
    assert(selected, fixture.theme)
    assert.equal(selected.page, 'cards')
    assert(supportsSignature(toCard(fixture.support, ''), selected, deck), fixture.support.name)
    assert(
      !supportsSignature(toCard(fixture.unrelated, ''), selected, deck),
      fixture.unrelated.name,
    )
    assert.deepEqual(selectSignatureSeeds('Commander', deck.slice(0, 2), context), [])
  }
})

test('one-shots, reminder text, opponents-only triggers and unsupported packages do not become engines', () => {
  for (const [theme, card] of [
    [
      'Tokens',
      raw(
        'Rootborn Defenses',
        'Creatures you control gain indestructible until end of turn. Populate.',
        'Instant',
      ),
    ],
    ['Lifegain', raw('Opponent payoff', 'Whenever an opponent gains life, draw a card.')],
    ['Tokens', raw('Opponent tokens', 'Whenever an opponent creates a token, draw a card.')],
    [
      'Tokens',
      raw(
        'Smothering Tithe',
        "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token.",
        'Enchantment',
      ),
    ],
    [
      'Landfall',
      raw('Opponent lands', "Whenever a land enters under an opponent's control, draw a card."),
    ],
    ['Enchantments', raw('Removal', 'Destroy target enchantment.', 'Instant')],
    ['Artifacts', raw('Arcane Signet', '{T}: Add one mana.', 'Artifact')],
    [
      'Spellslinger',
      raw('Reminder', 'Flying (Whenever you cast an instant or sorcery, draw a card.)'),
    ],
  ] as const) {
    const deck = [raw('Commander', ''), card, card, card].map(toDeckCard)
    assert.deepEqual(
      selectSignatureSeeds('Commander', deck, buildRecommendationContext({ theme, deck }, [])),
      [],
    )
  }
  const seed = {
    card: toDeckCard(raw('Unknown engine', '')),
    theme: 'Unsupported',
    page: 'cards' as const,
  }
  assert(!supportsSignature(toCard(raw('Control', ''), ''), seed, []))
})

test('equipment and death-trigger staples do not become engines', () => {
  const skullclamp = raw(
    'Skullclamp',
    'Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}',
    'Artifact — Equipment',
  )
  const deck = [
    raw('Commander', ''),
    skullclamp,
    raw(
      'Lightning Greaves',
      'Equipped creature has haste and shroud.\nEquip {0}',
      'Artifact — Equipment',
    ),
    raw(
      'Swiftfoot Boots',
      'Equipped creature has hexproof and haste.\nEquip {1}',
      'Artifact — Equipment',
    ),
    raw(
      'Sword of Fire and Ice',
      'Whenever equipped creature deals combat damage to a player, draw a card.\nEquip {2}',
      'Artifact — Equipment',
    ),
    raw('Doomed Dissenter', 'When this creature dies, create a 2/2 black Zombie creature token.'),
    raw('Viscera Seer', 'Sacrifice a creature: Scry 1.'),
  ].map(toDeckCard)
  const seeds = selectSignatureSeeds('Commander', deck, buildRecommendationContext({ deck }, []))
  assert.deepEqual(
    seeds.map(({ card, theme }) => `${card.name}:${theme}`),
    ['Viscera Seer:Sacrifice'],
  )
})
