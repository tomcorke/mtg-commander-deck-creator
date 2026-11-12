import { selectableThemes } from './commander-catalog.ts'
import { creatureTypeForTheme } from './creature-types.ts'

export type ThemeGroupName = 'Strategies' | 'Mechanics' | 'Creature types'

/**
 * Start-screen theme groups in a fixed order (#483); the first few of each show while a group is
 * collapsed, so the same chips appear on every visit. The order is an app choice of approachable
 * themes first, not usage data. Creature types are every remaining curated theme.
 */
const strategies = [
  'Tokens',
  'Spellslinger',
  'Graveyard',
  'Artifacts',
  'Enchantments',
  'Lifegain',
  'Sacrifice',
  'Voltron',
  'Big mana',
  'Group hug',
  'Political',
]
const mechanics = [
  '+1/+1 counters',
  'Landfall',
  'Blink',
  'ETB',
  'Death triggers',
  'Equipment',
  'Vehicles',
  'Mill',
  'Goad',
  'Wither',
  'Indestructible',
]
const creatureTypeOrder = ['Dragons', 'Zombies', 'Elves', 'Goblins', 'Vampires', 'Angels']

export const themeGroups: { name: ThemeGroupName; themes: string[] }[] = [
  { name: 'Strategies', themes: strategies },
  { name: 'Mechanics', themes: mechanics },
  {
    name: 'Creature types',
    themes: [
      ...creatureTypeOrder,
      ...selectableThemes.filter(
        (name) =>
          !strategies.includes(name) &&
          !mechanics.includes(name) &&
          !creatureTypeOrder.includes(name),
      ),
    ],
  },
]

/** Chips each group shows while collapsed. */
export const collapsedThemeCount = 3

/**
 * One plain-language line per curated theme. Strategy names and what they build around are
 * community conventions (heuristic), and the app matches cards to them by wording; see
 * docs/domain/heuristics.md. Keyword meanings are Rule claims, checked 2026-11-12 against the
 * Comprehensive Rules effective 2026-09-25: Equipment 301.5, Vehicles 301.7 and crew 702.122a,
 * enters abilities 603.6a, dies 700.4, Goad 701.15, Mill 701.17, Indestructible 702.12b, sacrifice 701.21a,
 * Wither 702.80a, landfall as an ability word 207.2c, and 21 commander damage 903.10a.
 */
export const themeDescriptions: Record<string, string> = {
  Tokens: 'Create many tokens, then strengthen or spend the whole group.',
  Spellslinger: 'Cast lots of instants and sorceries, with cards that reward each spell.',
  Graveyard: 'Fill your graveyard, then cast or return cards from it.',
  Artifacts: 'Play many artifacts, with cards that reward having or casting them.',
  Enchantments: 'Play many enchantments, with cards that reward having or casting them.',
  Lifegain: 'Gain life often, with cards that reward you each time you do.',
  Sacrifice: 'Sacrifice your own creatures for value, with payoffs when they die.',
  Voltron:
    'Make one creature, often your commander, huge with Equipment and Auras. 21 combat damage from one commander defeats a player.',
  'Big mana': 'Make far more mana than usual, then spend it on expensive spells.',
  'Group hug': 'Give every player extra cards or mana, and plan to use the extra best.',
  Political: 'Use votes, deals and opponents’ choices to shape what the table does.',
  '+1/+1 counters': 'Put +1/+1 counters on creatures, with cards that add more or reward them.',
  Landfall: 'Gain a bonus whenever a land enters under your control, and play extra lands.',
  Blink: 'Exile your own creatures and return them, so their enter abilities happen again.',
  ETB: 'Short for “enters the battlefield”: abilities that trigger when a permanent enters.',
  'Death triggers': 'Abilities that trigger when a creature dies, often with ways to sacrifice.',
  Equipment: 'Artifacts you attach to your creatures with equip, and creatures that use them.',
  Vehicles: 'Artifacts that most often become creatures when you tap creatures to crew them.',
  Mill: 'Move cards from the top of a library to its graveyard: yours for value, or opponents’.',
  Goad: 'A goaded creature must attack each combat, and attack someone other than you if able.',
  Wither: 'Shrink creatures with -1/-1 counters, including wither, whose damage becomes counters.',
  Indestructible:
    'Indestructible permanents can’t be destroyed, but can still be exiled or sacrificed.',
}

/** A theme's description: curated, or the shared line for any creature type such as Cats. */
export function themeDescription(theme: string) {
  if (themeDescriptions[theme]) return themeDescriptions[theme]
  if (creatureTypeForTheme(theme))
    return `Build around ${theme}: creatures of that type and cards that make or reward them.`
  return undefined
}

/**
 * Chips per group: matches across every theme while searching, else the collapsed few or all.
 * The selected theme always stays visible in its group.
 */
export function themeChoiceGroups(query: string, selected: string, expanded: ThemeGroupName[]) {
  const typed = query.trim().toLowerCase()
  return themeGroups.map(({ name, themes }) => {
    const shown = typed
      ? themes.filter((theme) => theme.toLowerCase().includes(typed))
      : expanded.includes(name)
        ? themes
        : themes.slice(0, collapsedThemeCount)
    return {
      name,
      total: themes.length,
      themes: themes.includes(selected) && !shown.includes(selected) ? [selected, ...shown] : shown,
    }
  })
}

/** Themes matching a search, excluding a selection kept visible without matching. */
export const themeMatchCount = (query: string) =>
  themeChoiceGroups(query, '', []).reduce((count, group) => count + group.themes.length, 0)
