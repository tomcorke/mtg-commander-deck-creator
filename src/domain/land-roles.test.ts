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

// Oracle text from Scryfall Oracle bulk data 2026-11-04, trimmed to the fields the detector reads.
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
  {
    typeLine: 'Legendary Land',
    producedMana: ['B', 'C', 'G', 'R', 'U', 'W'],
    oracleId: '84dc18f0-8225-4b40-a165-b10321e41769',
  },
)

test('detects a representative land for each of the eight roles, with evidence', () => {
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
})

test('reviewed Oracle-ID overrides add or remove roles', () => {
  assert.deepEqual(
    detectLandRoles(reliquaryTower, five).map(({ role, source }) => [role, source]),
    [
      ['utility', 'override'],
      ['colourless-utility', 'override'],
    ],
  )
  // Without its Oracle ID the static text gets no role.
  assert.deepEqual(rolesOf({ ...reliquaryTower, oracleId: undefined }), [])
  assert.ok(rolesOf({ ...nykthos, oracleId: undefined }).includes('fixing'))
  assert.ok(!rolesOf(nykthos).includes('fixing'))
})

test('the land type list is the CR 205.3i nonbasic list, without Scryfall-only Cloud', () => {
  assert.equal(nonbasicLandTypes.length, 12)
  assert.ok(!(nonbasicLandTypes as readonly string[]).includes('Cloud'))
  assert.ok(nonbasicLandTypes.includes("Urza's"))
})

const deckCard = (name: string, typeLine: string, detail: string) => ({
  name,
  typeLine,
  detail,
  tags: tagsFor(`${typeLine}\n${detail}`, typeLine),
})
const elf = (index: number) => deckCard(`Elf ${index}`, 'Creature — Elf', '{T}: Add {G}.')
const filler = (index: number) => deckCard(`Spell ${index}`, 'Sorcery', 'Draw a card.')
const tatyova = {
  name: 'Tatyova, Benthic Druid',
  detail: 'Landfall — Whenever a land you control enters, you gain 1 life and draw a card.',
}
const core = ['fixing', 'utility', 'creature-land', 'flexible', 'interaction', 'colourless-utility']

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
