// SYNTHETIC EDHREC FIXTURE. Every list's membership and every num_decks, potential_decks,
// synergy and lift value below is invented for development replay. Nothing is copied from an
// EDHREC response; the #309 policy forbids committing EDHREC bodies. The pages copy only the
// shape the app's adapter validates (`src/adapters/edhrec.ts`) and the list tags the provider
// note observes. They prove code paths, not recommendation quality.
//
// Card names come from the Meren review deck in docs/agents/design-conventions.md, so a recorded
// review corpus already holds their Scryfall data. A test keeps the two in step.

type Card = { name: string; num_decks: number; potential_decks: number } & (
  { synergy: number } | { lift: number }
)
type List = { header: string; tag: string; cardviews: Card[] }
type Metric = 'synergy' | 'lift'

/** Invented population every synthetic entry is measured against. */
const syntheticPotentialDecks = 5000

/**
 * One synthetic list: tag, header, names separated by `; `, then deck count and metric for the
 * first card with the drop per position. Values fall down the list, so ordering, the 100-deck
 * signature floor and metric thresholds are easy to read off.
 */
type Spec = [tag: string, header: string, names: string, decks: number[], metric: number[]]
const build =
  (metric: Metric) =>
  ([tag, header, names, [decks, step], [value, metricStep]]: Spec): List => ({
    header,
    tag,
    cardviews: names.split('; ').map((name, index) => ({
      name,
      num_decks: decks - index * step,
      potential_decks: syntheticPotentialDecks,
      [metric]: Math.round((value - index * metricStep) * 100) / 100,
    })) as Card[],
  })

/**
 * Land and mana-artifact case for #379's suspected shared land/mana batch slot: Sol Ring and the
 * other rocks lead `manaartifacts` and recur in `topcards`, while `lands` and `utilitylands` carry
 * comparable counts, so mana rocks and lands compete for the same offers.
 */
export const manaRocks = 'Sol Ring; Arcane Signet; Golgari Signet; Mind Stone; Fellwar Stone'
const lands =
  'Command Tower; Overgrown Tomb; Woodland Cemetery; Llanowar Wastes; Twilight Mire; Jungle Hollow; Evolving Wilds; Terramorphic Expanse'

const commanderLists: Spec[] = [
  [
    'newcards',
    'New Cards',
    'Bone Splinters; Village Rites; Deadly Dispute',
    [420, 60],
    [0.12, 0.04],
  ],
  [
    'topcards',
    'Top Cards',
    'Sol Ring; Eternal Witness; Sakura-Tribe Elder; Arcane Signet; Blood Artist; Zulaport Cutthroat; Phyrexian Altar; Skullclamp',
    [4300, 210],
    [0.08, 0.01],
  ],
  [
    'highliftcards',
    'High Lift Cards',
    "Grim Haruspex; Spore Frog; Satyr Wayfinder; Stitcher's Supplier; Fleshbag Marauder; Plaguecrafter; Carrion Feeder; Viscera Seer",
    [2600, 150],
    [0.52, 0.04],
  ],
  [
    'creatures',
    'Creatures',
    'Shriekmaw; Ravenous Chupacabra; Gravedigger; Merciless Executioner; Wood Elves; Reclamation Sage',
    [2900, 180],
    [0.21, 0.03],
  ],
  [
    'instants',
    'Instants',
    "Beast Within; Assassin's Trophy; Putrefy; Go for the Throat; Golgari Charm; Abrupt Decay; Vraska's Contempt; Entomb",
    [2400, 160],
    [0.06, 0.02],
  ],
  [
    'sorceries',
    'Sorceries',
    "Cultivate; Kodama's Reach; Buried Alive; Damnation; Reanimate; Living Death; Toxic Deluge; Casualties of War",
    [2700, 170],
    [0.15, 0.03],
  ],
  [
    'enchantments',
    'Enchantments',
    'Animate Dead; Phyrexian Arena; Pernicious Deed',
    [1900, 250],
    [0.18, 0.05],
  ],
  [
    'utilityartifacts',
    'Utility Artifacts',
    "Skullclamp; Ashnod's Altar",
    [1500, 300],
    [0.11, 0.04],
  ],
  ['manaartifacts', 'Mana Artifacts', manaRocks, [4600, 450], [0.03, 0.02]],
  [
    'utilitylands',
    'Utility Lands',
    'Bojuka Bog; Reliquary Tower; Golgari Rot Farm; Mortuary Mire',
    [3100, 400],
    [0.09, 0.03],
  ],
  ['lands', 'Lands', lands, [4400, 260], [0.05, 0.01]],
]

const cardLists: Spec[] = [
  ['newcommanders', 'New Commanders', 'Meren of Clan Nel Toth', [180, 0], [1.4, 0]],
  ['topcommanders', 'Top Commanders', 'Meren of Clan Nel Toth', [1700, 0], [2.2, 0]],
  ['highliftcards', 'High Lift Cards', 'Grim Haruspex; Spore Frog', [900, 200], [3.1, 0.3]],
  ['topcards', 'Top Cards', 'Sol Ring; Eternal Witness; Skullclamp', [3800, 400], [1.1, 0.1]],
  // Signature seeds read ordinary type lists. The last creature falls below both the 1.5 lift
  // and 100-deck floors; Murder falls below the lift floor only.
  [
    'creatures',
    'Creatures',
    'Blood Artist; Zulaport Cutthroat; Viscera Seer; Carrion Feeder; Midnight Reaper; Plaguecrafter',
    [1300, 250],
    [2.6, 0.25],
  ],
  ['instants', 'Instants', 'Village Rites; Deadly Dispute; Murder', [1100, 300], [2.0, 0.3]],
  [
    'manaartifacts',
    'Mana Artifacts',
    'Sol Ring; Arcane Signet; Golgari Signet',
    [3500, 500],
    [1.2, 0.1],
  ],
  [
    'lands',
    'Lands',
    'Command Tower; Overgrown Tomb; Woodland Cemetery; Llanowar Wastes',
    [3300, 300],
    [1.0, 0.05],
  ],
]

/** Requested pair slug → canonical page. Deliberately not alphabetical, as the provider note warns. */
const pairRedirects: Record<string, string> = {
  'pair-fixture-elf-pair-fixture-mage': '/commanders/pair-fixture-mage-pair-fixture-elf',
}

export type EdhrecFixture =
  { redirect: string } | { container: { json_dict: { cardlists: List[] } } }

/** Every card name the synthetic pages list. */
export const fixtureCardNames = () =>
  new Set([...commanderLists, ...cardLists].flatMap(([, , names]) => names.split('; ')))

/** The synthetic body for an EDHREC page path, or undefined when the path is not a page. */
export function edhrecFixture(pathname: string): EdhrecFixture | undefined {
  const match = pathname.match(/^\/pages\/(cards|commanders)\/([a-z0-9-]+)\.json$/)
  if (!match) return undefined
  const [, kind, slug] = match
  if (kind === 'commanders' && pairRedirects[slug]) return { redirect: pairRedirects[slug] }
  const cardlists =
    kind === 'cards' ? cardLists.map(build('lift')) : commanderLists.map(build('synergy'))
  return { container: { json_dict: { cardlists } } }
}
