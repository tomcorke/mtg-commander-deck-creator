import type { EdhrecThemeCount, TaggedCard } from './recommendation-types.ts'

export const themeMatchers: [string, RegExp][] = [
  ['Tokens', /create[s]? (?:one|two|three|a|an|x|that many|\d+) .* token|tokens? you control/i],
  ['+1/+1 counters', /\+1\/\+1 counter/i],
  ['Enchantments', /enchantment|constellation/i],
  ['Graveyard', /graveyard|mill |surveil/i],
  ['Dragons', /\bDragon\b/i],
  ['Spellslinger', /instant or sorcery|noncreature spell|whenever you cast/i],
  ['Artifacts', /artifact|treasure token/i],
  ['Lifegain', /gain .* life|lifelink/i],
  ['Sacrifice', /sacrifice|dies/i],
  ['Equipment', /equipment|equip /i],
  ['Group hug', /each player|all players/i],
  ['Landfall', /landfall|whenever (?:a|one or more) lands? enters?|play an additional land/i],
  ['Voltron', /equipped creature|enchanted creature|commander you control/i],
  ['Goad', /goad/i],
  ['Tribal', /choose a creature type|creatures you control (?:get|have)/i],
  ['Big mana', /mana value (?:[5-9]|[1-9]\d)|add (?:\{[^}]+\}){2,}/i],
  ['Blink', /exile .* return|exile .* then return/i],
  [
    'ETB',
    /when(?:ever)? (?:this|another|a|one or more|one or another|an? [^,.]+) (?:creature |permanent )?enters|enters the battlefield/i,
  ],
  [
    'Death triggers',
    /when(?:ever)? (?:this|another|a|one or more|one or another|an? [^,.]+) (?:creature |permanent )?dies|when .* is put into a graveyard from the battlefield/i,
  ],
  ['Wither', /\bwither\b|-1\/-1 counters?/i],
  ['Political', /vote|opponent chooses|each opponent may/i],
  ['Vampires', /\bVampire\b/i],
  ['Angels', /\bAngel\b/i],
  ['Demons', /\bDemon\b/i],
  ['Faeries', /\bFaerie\b/i],
  ['Vehicles', /\bVehicle\b|crew \d/i],
  ['Indestructible', /indestructible/i],
  ['Mill', /mill\b/i],
  ['Zombies', /\bZombie\b/i],
  ['Elves', /\bElf\b/i],
  ['Goblins', /\bGoblin\b/i],
  ['Dinosaurs', /\bDinosaur\b/i],
  ['Merfolk', /\bMerfolk\b/i],
  ['Knights', /\bKnight\b/i],
  ['Spirits', /\bSpirit\b/i],
  ['Slivers', /\bSliver\b/i],
  ['Mutants', /\bMutant\b/i],
  ['Turtles', /\bTurtle\b/i],
  ['Defenders', /\bDefender\b/i],
  [
    'Toughness matters',
    /(?:equal to|greater than|less than|with) (?:its |their )?toughness|toughness rather than (?:its |their )?power|\btoughness matters\b/i,
  ],
  ['Power matters', /power (?:is equal to|is greater than|rather than)|power matters/i],
  ['Power 7+', /power (?:7|[89]|[1-9]\d)(?: or greater| or more)?|power is (?:7|[89]|[1-9]\d)/i],
  [
    'Counters',
    /\bproliferate\b|(?:put|remove|double|with|has|have) (?:an? |one or more |any number of |\w+ )?(?!spell\b)counter|counters? on (?:it|them|a |target |each |you|permanent|creature|player)/i,
  ],
  [
    'Combat',
    /combat damage|additional combat|at the beginning of combat|attacks? each combat|whenever .* attacks/i,
  ],
  ['Resource tokens', /\b(?:Treasure|Food|Clue|Blood|Gold|Map) tokens?\b/i],
  [
    'Recursion',
    /return .* from (?:your|a) graveyard|cast .* from your graveyard|play .* from your graveyard/i,
  ],
  ['Protection', /\bhexproof\b|\bward(?: \{|—)|\bprotection from\b|\bindestructible\b/i],
  ['Flying', /\bflying\b/i],
  ['Energy', /(?:get|pay|lose) (?:an? |one or more |\d+ )?\{E\}|energy counters?/i],
  ['Sagas', /\bSaga\b|lore counter/i],
  ['Exile matters', /(?:cast|play)(?: cards?| that card)? from exile|whenever .* exil/i],
  ['Spell copying', /copy target (?:instant|sorcery|spell)|copy that spell/i],
  ['Cascade', /\bcascade\b/i],
  ['Discover', /\bdiscover \d|\bdiscover X/i],
  ['Explore', /\bexplores?\b/i],
  ['Ninjas', /\bNinja\b|ninjutsu/i],
  ['Eldrazi', /\bEldrazi\b/i],
  ['Humans', /\bHuman\b/i],
  ['Soldiers', /\bSoldier\b/i],
  ['Phyrexians', /\bPhyrexian\b/i],
  ['Planeswalkers', /\bPlaneswalker\b|loyalty counter/i],
  ['Poison', /\binfect\b|poison counter|\btoxic \d/i],
  [
    'Wheels',
    /each player (?:discards? (?:their|his or her) hand|shuffles? (?:their|his or her) hand).*draws? (?:seven|\d+) cards/i,
  ],
  ['Clones', /enters (?:the battlefield )?as a copy|becomes? a copy of target/i],
  ['Amass', /\bamass (?:Orcs |Zombies )?\d/i],
  ['Populate', /\bpopulate\b/i],
  ['Anthems', /creatures you control get \+[1-9X]\/\+[1-9X]/i],
  [
    'Topdeck',
    /top (?:card|\d+ cards) of (?:your|a|target player’s|target player's) library|look at the top/i,
  ],
]

export const supportedThemes = themeMatchers
  .map(([name]) => name)
  .filter((name) => name !== 'Tribal')
const supportedThemeNames = new Map(supportedThemes.map((theme) => [theme.toLowerCase(), theme]))

const edhrecThemeAliases: Record<string, string> = {
  enchantress: 'Enchantments',
  'self-mill': 'Mill',
  'plus-1-plus-1-counters': '+1/+1 counters',
  aristocrats: 'Sacrifice',
  auras: 'Voltron',
  defenders: 'Defenders',
  'toughness-matters': 'Toughness matters',
  'power-matters': 'Power matters',
  power: 'Power matters',
  'counters-matter': 'Counters',
  'rad-counters': 'Counters',
  proliferate: 'Counters',
  'attack-triggers': 'Combat',
  'extra-combats': 'Combat',
  'forced-combat': 'Combat',
  etb: 'ETB',
  'enter-the-battlefield': 'ETB',
  'death-triggers': 'Death triggers',
  wither: 'Wither',
  'minus-1-minus-1-counters': 'Wither',
  treasure: 'Resource tokens',
  food: 'Resource tokens',
  clues: 'Resource tokens',
  blood: 'Resource tokens',
  reanimator: 'Recursion',
  recursion: 'Recursion',
  mutants: 'Mutants',
  turtles: 'Turtles',
  flying: 'Flying',
  energy: 'Energy',
  sagas: 'Sagas',
  exile: 'Exile matters',
  'spell-copy': 'Spell copying',
  cascade: 'Cascade',
  discover: 'Discover',
  explore: 'Explore',
  ninjas: 'Ninjas',
  ninjutsu: 'Ninjas',
  eldrazi: 'Eldrazi',
  humans: 'Humans',
  soldiers: 'Soldiers',
  phyrexians: 'Phyrexians',
  planeswalkers: 'Planeswalkers',
  infect: 'Poison',
  wheels: 'Wheels',
  clones: 'Clones',
  amass: 'Amass',
  populate: 'Populate',
  anthems: 'Anthems',
  topdeck: 'Topdeck',
  'lands-matter': 'Landfall',
}

export function themeMatchesSearch(theme: string, search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return true
  const aliases = Object.entries(edhrecThemeAliases)
    .filter(([, name]) => name === theme)
    .map(([alias]) => alias.replaceAll('-', ' '))
  return [theme, ...aliases].some((name) => name.toLowerCase().includes(query))
}

function edhrecThemeName({ slug, value }: EdhrecThemeCount) {
  return edhrecThemeAliases[slug] ?? supportedThemeNames.get(value.toLowerCase())
}

export function commanderThemes(tagCounts: EdhrecThemeCount[]) {
  return [...new Set(tagCounts.flatMap((tag) => edhrecThemeName(tag) ?? []))]
}

export function unsupportedCommanderThemes(tagCounts: EdhrecThemeCount[]) {
  return tagCounts.filter((tag) => !edhrecThemeName(tag)).map(({ value }) => value)
}

export function sharedThemes(cards: { tags: string[] }[], excluded: string[] = []) {
  const counts = new Map<string, number>()
  for (const card of cards.slice(-12))
    for (const tag of card.tags)
      if (supportedThemes.includes(tag) && !excluded.includes(tag))
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
}

export function tagsFor(source: string, typeLine: string) {
  const tags = themeMatchers.filter(([, matcher]) => matcher.test(source)).map(([tag]) => tag)
  for (const type of ['Creature', 'Artifact', 'Enchantment', 'Land'])
    if (typeLine.includes(type) && !tags.includes(`${type}s`)) tags.push(`${type}s`)
  return tags
}

const synergyRules: { left: RegExp; right: RegExp; explanation: string }[] = [
  {
    left: /create[s]? .* token/i,
    right: /tokens? you control/i,
    explanation: 'one creates tokens while the other rewards your token army',
  },
  {
    left: /put .*\+1\/\+1 counter/i,
    right: /creature[s]? .*\+1\/\+1 counter|remove .*\+1\/\+1 counter/i,
    explanation: 'one places +1/+1 counters while the other rewards or spends them',
  },
  {
    left: /sacrifice (?:another )?(?:creature|permanent)/i,
    right: /whenever .* dies|when .* dies/i,
    explanation: 'one provides a sacrifice outlet while the other rewards creatures dying',
  },
  {
    left: /mill|put .*graveyard/i,
    right: /return .* from your graveyard|cast .* from your graveyard/i,
    explanation: 'one fills your graveyard while the other reuses those cards',
  },
  {
    left: /create[s]? .*Treasure|create[s]? .*artifact token/i,
    right: /whenever .*artifact|artifacts? you control/i,
    explanation:
      'one creates artifacts while the other rewards artifacts entering or staying in play',
  },
]

export function findSynergyPair<T extends TaggedCard>(cards: T[]) {
  for (const rule of synergyRules)
    for (let left = 0; left < cards.length; left += 1)
      for (let right = 0; right < cards.length; right += 1) {
        if (
          left !== right &&
          rule.left.test(cards[left].detail) &&
          rule.right.test(cards[right].detail)
        )
          return { cards: [cards[left], cards[right]], explanation: rule.explanation }
      }
  return null
}
