import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deckLandRoleMatches,
  deckLandRoles,
  detectLandRoles,
  nonbasicLandTypes,
  type LandRoleCard,
} from './land-roles.ts'
import { tagsFor } from './recommendation-themes.ts'

// Modelled on Scryfall Oracle text (bulk data 2026-11-04), trimmed to the fields the detector reads.
// Current Oracle text says "this land"; most fixtures keep the older self-name wording, so they
// also cover reading a card's own name as "this land".
const land = (
  name: string,
  detail: string,
  { typeLine = 'Land', producedMana = [] as string[], ...rest }: Partial<LandRoleCard> = {},
): LandRoleCard => ({
  name,
  layout: 'normal',
  typeLine,
  manaCost: '',
  manaValue: 0,
  detail,
  producedMana,
  faces: [],
  ...rest,
})
const five = ['W', 'U', 'B', 'R', 'G']
const rolesOf = (card: LandRoleCard, identity = five) =>
  detectLandRoles(card, identity).map(({ role, focus }) => (focus ? `${role}:${focus}` : role))

const cabalCoffers = land('Cabal Coffers', '{2}, {T}: Add {B} for each Swamp you control.', {
  producedMana: ['B'],
})
const commandTower = land(
  'Command Tower',
  "{T}: Add one mana of any color in your commander's color identity.",
  { producedMana: ['B', 'G', 'R', 'U', 'W'] },
)
const wateryGrave = land(
  'Watery Grave',
  "({T}: Add {U} or {B}.)\nAs Watery Grave enters, you may pay 2 life. If you don't, it enters tapped.",
  { typeLine: 'Land — Island Swamp' },
)
const evolvingWilds = land(
  'Evolving Wilds',
  '{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
)
const roguesPassage = land(
  "Rogue's Passage",
  "{T}: Add {C}.\n{4}, {T}: Target creature can't be blocked this turn.",
  { producedMana: ['C'] },
)
const fieldOfTheDead = land(
  'Field of the Dead',
  'Field of the Dead enters tapped.\n{T}: Add {C}.\nWhenever Field of the Dead or another land you control enters, if you control seven or more lands with different names, create a 2/2 black Zombie creature token.',
  { producedMana: ['C'] },
)
const mutavault = land(
  'Mutavault',
  "{T}: Add {C}.\n{1}: Mutavault becomes a 2/2 creature with all creature types until end of turn. It's still a land.",
  { producedMana: ['C'] },
)
const colonnade = land(
  'Celestial Colonnade',
  "Celestial Colonnade enters tapped.\n{T}: Add {W} or {U}.\n{3}{W}{U}: Until end of turn, Celestial Colonnade becomes a 4/4 white and blue Elemental creature with flying and vigilance. It's still a land.",
  { producedMana: ['U', 'W'] },
)
const turntimber = land(
  'Turntimber Symbiosis // Turntimber, Serpentine Wood',
  'Look at the top seven cards of your library. You may put a creature card from among them onto the battlefield.\nAs Turntimber, Serpentine Wood enters, you may pay 3 life. If you don’t, it enters tapped.\n{T}: Add {G}.',
  {
    layout: 'modal_dfc',
    typeLine: 'Sorcery // Land',
    producedMana: ['G'],
    faces: [
      {
        typeLine: 'Sorcery',
        manaCost: '{4}{G}{G}{G}',
        detail:
          'Look at the top seven cards of your library. You may put a creature card from among them onto the battlefield.',
      },
      {
        typeLine: 'Land',
        manaCost: '',
        detail:
          'As Turntimber, Serpentine Wood enters, you may pay 3 life. If you don’t, it enters tapped.\n{T}: Add {G}.',
      },
    ],
  },
)
const ashBarrens = land(
  'Ash Barrens',
  '{T}: Add {C}.\nBasic landcycling {1} ({1}, Discard this card: Search your library for a basic land card, reveal it, put it into your hand, then shuffle.)',
  { producedMana: ['C'] },
)
const boseiju = land(
  'Boseiju, Who Endures',
  '{T}: Add {G}.\nChannel — {1}{G}, Discard Boseiju, Who Endures: Destroy target artifact, enchantment, or nonbasic land an opponent controls.',
  { typeLine: 'Legendary Land', producedMana: ['G'] },
)
const growthChamber = land(
  'Simic Growth Chamber',
  "Simic Growth Chamber enters tapped.\nWhen Simic Growth Chamber enters, return a land you control to its owner's hand.\n{T}: Add {G}{U}.",
  { producedMana: ['G', 'U'] },
)
const gondGate = land(
  'Gond Gate',
  'Gates you control enter untapped.\n{T}: Add {C}.\n{T}: Add one mana of any color that a Gate you control could produce.',
  { typeLine: 'Land — Gate', producedMana: ['B', 'C', 'G', 'R', 'U', 'W'] },
)
const urzasTower = land(
  "Urza's Tower",
  "{T}: Add {C}. If you control an Urza's Mine and an Urza's Power-Plant, add {C}{C}{C} instead.",
  { typeLine: "Land — Urza's Tower", producedMana: ['C'] },
)
const cavernOfSouls = land(
  'Cavern of Souls',
  "As Cavern of Souls enters, choose a creature type.\n{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a creature spell of the chosen type, and that spell can't be countered.",
  { producedMana: ['B', 'C', 'G', 'R', 'U', 'W'] },
)
const seatOfTheSynod = land('Seat of the Synod', '{T}: Add {U}.', {
  typeLine: 'Artifact Land',
  producedMana: ['U'],
})
const arcticTreeline = land(
  'Arctic Treeline',
  '({T}: Add {G} or {W}.)\nArctic Treeline enters tapped.',
  {
    typeLine: 'Snow Land — Forest Plains',
  },
)
const mysticSanctuary = land(
  'Mystic Sanctuary',
  '({T}: Add {U}.)\nMystic Sanctuary enters tapped unless you control three or more other Islands.\nWhen Mystic Sanctuary enters untapped, you may put target instant or sorcery card from your graveyard on top of your library.',
  { typeLine: 'Land — Island' },
)
const bojukaBog = land(
  'Bojuka Bog',
  "Bojuka Bog enters tapped.\nWhen Bojuka Bog enters, exile target player's graveyard.\n{T}: Add {B}.",
  { producedMana: ['B'] },
)
const stripMine = land(
  'Strip Mine',
  '{T}: Add {C}.\n{T}, Sacrifice Strip Mine: Destroy target land.',
  {
    producedMana: ['C'],
  },
)
const ancientTomb = land('Ancient Tomb', '{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.', {
  producedMana: ['C'],
})
const scouredBarrens = land(
  'Scoured Barrens',
  'Scoured Barrens enters tapped.\nWhen Scoured Barrens enters, you gain 1 life.\n{T}: Add {W} or {B}.',
  { producedMana: ['B', 'W'] },
)
const cityOfBrass = land(
  'City of Brass',
  'Whenever City of Brass becomes tapped, it deals 1 damage to you.\n{T}: Add one mana of any color.',
  { producedMana: ['B', 'G', 'R', 'U', 'W'] },
)
const radiantFountain = land(
  'Radiant Fountain',
  'When Radiant Fountain enters, you gain 2 life.\n{T}: Add {C}.',
  {
    producedMana: ['C'],
  },
)
const reliquaryTower = land('Reliquary Tower', 'You have no maximum hand size.\n{T}: Add {C}.', {
  producedMana: ['C'],
  oracleId: 'c23e5b80-08d2-4e24-9908-fe2aa4f30f6f',
})
const nykthos = land(
  'Nykthos, Shrine to Nyx',
  '{T}: Add {C}.\n{2}, {T}: Choose a color. Add an amount of mana of that color equal to your devotion to that color.',
  { typeLine: 'Legendary Land', producedMana: ['B', 'C', 'G', 'R', 'U', 'W'] },
)
const interplanarBeacon = land(
  'Interplanar Beacon',
  'Whenever you cast a planeswalker spell, you gain 1 life.\n{T}: Add {C}.\n{1}, {T}: Add two mana of different colors. Spend this mana only to cast planeswalker spells.',
  { producedMana: ['B', 'C', 'G', 'R', 'U', 'W'] },
)
const glimmervoid = land(
  'Glimmervoid',
  'At the beginning of the end step, if you control no artifacts, sacrifice this land.\n{T}: Add one mana of any color.',
  { producedMana: ['B', 'G', 'R', 'U', 'W'] },
)
const drannithRuins = land(
  'Drannith Ruins',
  '{T}: Add {C}.\n{2}, {T}: Put two +1/+1 counters on target non-Human creature that entered this turn.',
  { producedMana: ['C'] },
)

test('detects a representative land for each of the nine roles, with evidence', () => {
  const evidence = (card: LandRoleCard, role: string) =>
    detectLandRoles(card, five).find((found) => found.role === role)?.evidence
  assert.equal(evidence(commandTower, 'fixing'), commandTower.detail)
  assert.equal(
    evidence(roguesPassage, 'utility'),
    "{4}, {T}: Target creature can't be blocked this turn.",
  )
  assert.match(evidence(mutavault, 'creature-land')!, /becomes a 2\/2 creature/)
  assert.equal(evidence(ashBarrens, 'flexible'), 'Basic landcycling {1}')
  assert.match(evidence(growthChamber, 'land-synergy')!, /return a land you control/)
  assert.equal(evidence(seatOfTheSynod, 'theme'), 'Artifact Land')
  assert.equal(
    evidence(bojukaBog, 'interaction'),
    "When Bojuka Bog enters, exile target player's graveyard.",
  )
  assert.equal(evidence(ancientTomb, 'colourless-utility'), ancientTomb.detail)
  assert.equal(evidence(cabalCoffers, 'big-mana'), cabalCoffers.detail)
})

test('reads fixing from basic land types, fetches and identity', () => {
  // CR 305.6: the shock's mana ability comes from its types; the reminder text is ignored.
  assert.deepEqual(detectLandRoles(wateryGrave, ['U', 'B']), [
    { role: 'fixing', evidence: 'Land — Island Swamp', source: 'type' },
  ])
  assert.deepEqual(rolesOf(evolvingWilds, ['G', 'U']), ['fixing', 'land-synergy:lands-matter'])
  // Fixing needs two colours of the commander's identity.
  assert.deepEqual(rolesOf(wateryGrave, ['U']), [])
  assert.deepEqual(rolesOf(commandTower, ['G']), [])
  assert.deepEqual(rolesOf(commandTower, []), [])
})

test('finds multi-role lands', () => {
  assert.deepEqual(rolesOf(colonnade), ['fixing', 'creature-land', 'theme:Elementals'])
  assert.deepEqual(rolesOf(stripMine), [
    'interaction',
    'land-synergy:lands-matter',
    'colourless-utility',
  ])
  assert.deepEqual(rolesOf(fieldOfTheDead), ['utility', 'theme:Zombies', 'colourless-utility'])
  assert.deepEqual(rolesOf(mysticSanctuary), ['utility', 'theme:Graveyard', 'theme:Spellslinger'])
  assert.deepEqual(rolesOf(gondGate), ['fixing', 'land-synergy:Gate'])
  // Its own types first, then the Tron pieces its text names; {C}{C}{C} reads as colourless utility.
  assert.deepEqual(rolesOf(urzasTower), [
    'land-synergy:Tower',
    "land-synergy:Urza's",
    'colourless-utility',
    'land-synergy:Mine',
    'land-synergy:Power-Plant',
  ])
  assert.deepEqual(rolesOf(cavernOfSouls), ['fixing', 'theme:Chosen type'])
  assert.deepEqual(rolesOf(arcticTreeline), ['fixing', 'theme:Snow'])
})

test('reads a spell/land MDFC from its land face, and its spell face as a flexible slot', () => {
  assert.deepEqual(detectLandRoles(turntimber, five), [
    { role: 'flexible', evidence: 'Sorcery', source: 'type' },
  ])
  // Channel's removal is the flexible mode, not a utility or interaction role.
  assert.deepEqual(rolesOf(boseiju), ['flexible'])
})

test('known non-matches: drawbacks, minor riders, changelings, basics and nonlands', () => {
  // Entering tapped, paying life and taking damage are drawbacks, not roles.
  assert.deepEqual(rolesOf(cityOfBrass, ['W']), [])
  assert.deepEqual(rolesOf(scouredBarrens, ['W']), [])
  assert.deepEqual(rolesOf(radiantFountain), [])
  // Every-type lands are not theme picks (#174).
  assert.ok(!rolesOf(mutavault).some((role) => role.startsWith('theme')))
  assert.deepEqual(
    rolesOf(land('Forest', '({T}: Add {G}.)', { typeLine: 'Basic Land — Forest' })),
    [],
  )
  assert.deepEqual(
    rolesOf(land('Sol Ring', '{T}: Add {C}{C}.', { typeLine: 'Artifact', producedMana: ['C'] })),
    [],
  )
  // A chosen colour scaled by devotion is big mana, not fixing, despite `produced_mana`.
  assert.ok(!rolesOf(nykthos).includes('fixing'))
  // A forced self-sacrifice is a drawback, not land synergy.
  assert.deepEqual(rolesOf(glimmervoid), ['fixing'])
  // Planeswalker spells are not spellslinger; a negated type is not typal.
  assert.ok(!rolesOf(interplanarBeacon).includes('theme:Spellslinger'))
  assert.ok(!rolesOf(drannithRuins).includes('theme:Humans'))
})

test('fixing evidence quotes the line that makes the colours', () => {
  assert.equal(
    detectLandRoles(interplanarBeacon, five)[0].evidence,
    '{1}, {T}: Add two mana of different colors. Spend this mana only to cast planeswalker spells.',
  )
})

// Scryfall Oracle bulk data 2026-11-18 (checked 2026-11-18), trimmed as above.
const gaeasCradle = land('Gaea’s Cradle', '{T}: Add {G} for each creature you control.', {
  typeLine: 'Legendary Land',
  producedMana: ['G'],
})
const serrasSanctum = land('Serra’s Sanctum', '{T}: Add {W} for each enchantment you control.', {
  typeLine: 'Legendary Land',
  producedMana: ['W'],
})
const cabalStronghold = land(
  'Cabal Stronghold',
  '{T}: Add {C}.\n{3}, {T}: Add {B} for each basic Swamp you control.',
  { producedMana: ['B', 'C'] },
)
const castleGarenbrig = land(
  'Castle Garenbrig',
  'This land enters tapped unless you control a Forest.\n{T}: Add {G}.\n{2}{G}{G}, {T}: Add six {G}. Spend this mana only to cast creature spells or activate abilities of creatures.',
  { producedMana: ['G'] },
)
const saprazzanSkerry = land(
  'Saprazzan Skerry',
  'This land enters tapped with two depletion counters on it.\n{T}, Remove a depletion counter from this land: Add {U}{U}. If there are no depletion counters on this land, sacrifice it.',
  { producedMana: ['U'] },
)
const dreadshipReef = land(
  'Dreadship Reef',
  '{T}: Add {C}.\n{1}, {T}: Put a storage counter on this land.\n{1}, Remove X storage counters from this land: Add X mana in any combination of {U} and/or {B}.',
  { producedMana: ['B', 'C', 'U'] },
)
const landCap = land(
  'Land Cap',
  "This land doesn't untap during your untap step if it has a depletion counter on it.\nAt the beginning of your upkeep, remove a depletion counter from this land.\n{T}: Add {W} or {U}. Put a depletion counter on this land.",
  { producedMana: ['U', 'W'] },
)
const gemstoneMine = land(
  'Gemstone Mine',
  'This land enters with three mining counters on it.\n{T}, Remove a mining counter from this land: Add one mana of any color. If there are no mining counters on this land, sacrifice it.',
  { producedMana: ['B', 'G', 'R', 'U', 'W'] },
)
const mageRingNetwork = land(
  'Mage-Ring Network',
  '{T}: Add {C}.\n{1}, {T}: Put a storage counter on this land.\n{T}, Remove any number of storage counters from this land: Add {C} for each storage counter removed this way.',
  { producedMana: ['C'] },
)
const bigMana = (card: LandRoleCard, identity = five) =>
  detectLandRoles(card, identity).find(({ role }) => role === 'big-mana')

test('big mana: scaling lands quote the ability and list its restrictions', () => {
  assert.deepEqual(bigMana(cabalCoffers, ['B']), {
    role: 'big-mana',
    evidence: '{2}, {T}: Add {B} for each Swamp you control.',
    source: 'rules',
    restrictions: ['Activation cost: {2}', 'Scales with each Swamp you control'],
  })
  assert.deepEqual(rolesOf(gaeasCradle, ['G']), ['big-mana'])
  assert.deepEqual(bigMana(gaeasCradle)?.restrictions, ['Scales with each creature you control'])
  assert.deepEqual(rolesOf(serrasSanctum, ['W']), ['big-mana'])
  // The {C} line stays plain mana; the scaling line is big mana.
  assert.deepEqual(rolesOf(cabalStronghold, ['B']), ['big-mana'])
  assert.deepEqual(bigMana(cabalStronghold)?.restrictions, [
    'Activation cost: {3}',
    'Scales with each basic Swamp you control',
  ])
  // A fixed six with a cost and a spend restriction.
  assert.deepEqual(rolesOf(castleGarenbrig, ['G']), ['big-mana'])
  assert.deepEqual(bigMana(castleGarenbrig)?.restrictions, [
    'Activation cost: {2}{G}{G}',
    'Spend this mana only to cast creature spells or activate abilities of creatures.',
  ])
  assert.deepEqual(bigMana(nykthos)?.restrictions, [
    'Activation cost: {2}',
    'Scales with your devotion to that color',
  ])
})

test('big mana: depletion and storage lands count only with a multi-mana payout', () => {
  assert.deepEqual(rolesOf(saprazzanSkerry, ['U']), ['big-mana'])
  assert.deepEqual(bigMana(saprazzanSkerry)?.restrictions, [
    'Limited uses: each one spends a depletion counter',
  ])
  // Banking a storage counter is part of the payout, so it is not utility as well.
  assert.deepEqual(rolesOf(dreadshipReef, ['U', 'B']), ['fixing', 'big-mana'])
  assert.deepEqual(bigMana(dreadshipReef)?.restrictions, [
    'Activation cost: {1}',
    'Pays out only the storage counters it has banked',
  ])
  // Counter wording alone, with one mana per use, is not big mana.
  assert.equal(bigMana(landCap), undefined)
  assert.equal(bigMana(gemstoneMine), undefined)
  // Two mana with no counter cost (karoos, Interplanar Beacon) is not big mana.
  assert.equal(bigMana(growthChamber), undefined)
  assert.equal(bigMana(interplanarBeacon), undefined)
  // Colourless-only payouts stay colourless utility.
  assert.deepEqual(rolesOf(mageRingNetwork), ['colourless-utility'])
  assert.deepEqual(rolesOf(ancientTomb), ['colourless-utility'])
})

test('big mana keeps the chosen-colour fixing exclusion', () => {
  // Nykthos's `produced_mana` lists every colour; its devotion line is big mana, not fixing.
  assert.deepEqual(rolesOf(nykthos), ['big-mana'])
  assert.deepEqual(rolesOf(nykthos, ['G', 'U']), ['big-mana'])
})

test('reviewed Oracle-ID overrides add roles', () => {
  assert.deepEqual(
    detectLandRoles(reliquaryTower, five).map(({ role, source }) => [role, source]),
    [
      ['utility', 'override'],
      ['colourless-utility', 'override'],
    ],
  )
  // Without its Oracle ID the static text gets no role.
  assert.deepEqual(rolesOf({ ...reliquaryTower, oracleId: undefined }), [])
})

test('the land type list is the CR 205.3i nonbasic list, without Scryfall-only Cloud', () => {
  assert.equal(nonbasicLandTypes.length, 12)
  assert.ok(!(nonbasicLandTypes as readonly string[]).includes('Cloud'))
  assert.ok(nonbasicLandTypes.includes("Urza's"))
})

// App deck cards carry `tags` too; the deck gate ignores them and reads rules text.
const deckCard = (name: string, typeLine: string, detail: string) => ({
  name,
  typeLine,
  detail,
  tags: tagsFor(`${typeLine}\n${detail}`, typeLine),
})
const elf = (index: number) =>
  deckCard(`Elf ${index}`, 'Creature — Elf', 'Other Elves you control get +1/+1.')
const filler = (index: number) => deckCard(`Spell ${index}`, 'Sorcery', 'Draw a card.')
const tatyova = {
  name: 'Tatyova, Benthic Druid',
  detail: 'Landfall — Whenever a land you control enters, you gain 1 life and draw a card.',
}
const core = [
  'fixing',
  'utility',
  'creature-land',
  'flexible',
  'interaction',
  'colourless-utility',
  'big-mana',
]

test('a landfall commander earns land synergy with no theme selected', () => {
  const roles = deckLandRoles({
    identity: ['G', 'U'],
    themes: [],
    commanders: [tatyova],
    deck: [deckCard(tatyova.name, 'Legendary Creature — Merfolk Druid', tatyova.detail)],
  })
  assert.deepEqual(
    roles.map(({ role }) => role),
    [...core, 'land-synergy'],
  )
  const synergy = roles.find(({ role }) => role === 'land-synergy')!
  assert.deepEqual(synergy.focuses, [
    {
      focus: 'lands-matter',
      evidence: [
        {
          source: 'commander',
          commander: tatyova.name,
          quote: 'Landfall — Whenever a land you control enters, you gain 1 life and draw a card.',
        },
      ],
    },
  ])
  // Fixing scales with colour count.
  assert.equal(roles.find(({ role }) => role === 'fixing')!.weight, 0.25)
  // Fetches gain land synergy here; Gate's land type does not, as nothing references Gates.
  assert.deepEqual(
    deckLandRoleMatches(detectLandRoles(evolvingWilds, ['G', 'U']), roles).map(({ role }) => role),
    ['fixing', 'land-synergy'],
  )
  assert.deepEqual(
    deckLandRoleMatches(detectLandRoles(gondGate, ['G', 'U']), roles).map(({ role }) => role),
    ['fixing'],
  )
})

test('commander evidence replaces full and short names in single and two-commander decks', () => {
  const commanders = [
    {
      name: 'Omnath, Locus of Rage',
      detail: 'Whenever you sacrifice a land, Omnath, Locus of Rage and Omnath each deal damage.',
    },
    {
      name: 'Will, Test Commander',
      detail: "Whenever you sacrifice a land, Will's ability will affect Willow.",
    },
    { name: 'Nameless', detail: 'Whenever you sacrifice a land, Nameless draws a card.' },
  ]
  const expected = commanders.map((commander, index) => ({
    source: 'commander',
    commander: commander.name,
    quote: [
      'Whenever you sacrifice a land, this card and this card each deal damage.',
      "Whenever you sacrifice a land, this card's ability will affect Willow.",
      'Whenever you sacrifice a land, this card draws a card.',
    ][index],
  }))
  for (const indices of [[0, 1], [2]]) {
    const roles = deckLandRoles({
      identity: [],
      themes: [],
      commanders: indices.map((index) => commanders[index]),
      deck: [],
    })
    assert.deepEqual(
      roles.find(({ role }) => role === 'land-synergy')!.focuses[0].evidence,
      indices.map((index) => expected[index]),
    )
  }
})

test('a selected typal theme earns theme lands for that type and choose-a-type lands', () => {
  const roles = deckLandRoles({
    identity: ['G'],
    themes: ['Zombies'],
    commanders: [],
    deck: [],
  })
  const theme = roles.find(({ role }) => role === 'theme')!
  assert.deepEqual(theme.focuses, [
    { focus: 'Zombies', evidence: [{ source: 'theme', theme: 'Zombies' }] },
  ])
  assert.equal(roles.find(({ role }) => role === 'fixing')!.weight, 0)
  const usable = (card: LandRoleCard) =>
    deckLandRoleMatches(detectLandRoles(card, ['G']), roles).map(({ role, focus }) =>
      focus ? `${role}:${focus}` : role,
    )
  assert.deepEqual(usable(fieldOfTheDead), ['utility', 'theme:Zombies', 'colourless-utility'])
  assert.deepEqual(usable(cavernOfSouls), ['theme:Chosen type'])
  // Off-colour here, Colonnade keeps its core creature-land role; Elementals is not earned.
  assert.deepEqual(usable(colonnade), ['creature-land'])
})

test('3+ noncommander main-deck cards earn a theme; commanders and lands do not count', () => {
  const two = deckLandRoles({
    identity: ['G'],
    themes: [],
    commanders: [],
    deck: [elf(1), elf(2), filler(1)],
  })
  assert.equal(
    two.find(({ role }) => role === 'theme'),
    undefined,
  )
  const three = deckLandRoles({
    identity: ['G'],
    themes: [],
    commanders: [],
    deck: [elf(1), elf(2), elf(3)],
  })
  assert.deepEqual(three.find(({ role }) => role === 'theme')!.focuses, [
    {
      focus: 'Elves',
      evidence: [{ source: 'deck', count: 3, examples: ['Elf 1', 'Elf 2', 'Elf 3'] }],
    },
  ])
  // Type lines alone earn nothing: mana rocks are artifacts and Humans are Humans in any deck.
  const rock = (name: string) => deckCard(name, 'Artifact', '{T}: Add {C}{C}.')
  const human = (index: number) =>
    deckCard(`Human ${index}`, 'Creature — Human Soldier', 'Vigilance')
  assert.equal(
    deckLandRoles({
      identity: ['W'],
      themes: [],
      commanders: [],
      deck: [
        rock('Sol Ring'),
        rock('Mind Stone'),
        rock('Thran Dynamo'),
        human(1),
        human(2),
        human(3),
      ],
    }).find(({ role }) => role === 'theme'),
    undefined,
  )
  const commanderElf = { name: 'Elf 3', detail: '{T}: Add {G}.' }
  assert.equal(
    deckLandRoles({
      identity: ['G'],
      themes: [],
      commanders: [commanderElf],
      deck: [elf(1), elf(2), elf(3)],
    }).find(({ role }) => role === 'theme'),
    undefined,
  )
})

test('land types earn land synergy from cards that name them, lands included', () => {
  const gatePayoff = (name: string) =>
    deckCard(name, 'Land — Gate', 'Gates you control enter untapped.\n{T}: Add {C}.')
  const roles = deckLandRoles({
    identity: ['W', 'U'],
    themes: [],
    commanders: [],
    deck: [gatePayoff('Gate A'), gatePayoff('Gate B'), gatePayoff('Gate C')],
  })
  assert.deepEqual(
    roles.find(({ role }) => role === 'land-synergy')!.focuses.map(({ focus }) => focus),
    ['Gate'],
  )
})

test('a deck with no evidence has only the core roles', () => {
  const roles = deckLandRoles({
    identity: ['W', 'U', 'B'],
    themes: [],
    commanders: [{ name: 'Plain Commander', detail: 'Flying' }],
    deck: [filler(1), filler(2), filler(3)],
  })
  assert.deepEqual(
    roles.map(({ role }) => role),
    core,
  )
  assert.ok(roles.every(({ focuses }) => focuses.length === 0))
  assert.equal(roles.find(({ role }) => role === 'fixing')!.weight, 0.5)
  // Earned-role matches drop out; core matches stay.
  assert.deepEqual(
    deckLandRoleMatches(detectLandRoles(evolvingWilds, ['W', 'U', 'B']), roles).map(
      ({ role }) => role,
    ),
    ['fixing'],
  )
})
