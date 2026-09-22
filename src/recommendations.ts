export type TaggedCard = { name: string; typeLine: string; detail: string; tags: string[] }
export type DeferredCard<T> = { card: T; eligibleBatch: number }
export type EdhrecThemeCount = { count: number; slug: string; value: string }
export type CardFinish = 'nonfoil' | 'foil' | 'etched'
export type PrintingLike = {
  image: string
  set: string
  collectorNumber: string
  finish?: CardFinish
}
export type PowerTarget = 'precon' | 'upgraded' | 'high'
export type RecommendationStyle = 'story' | 'balanced' | 'optimized'
export type CollectionMode = 'none' | 'prefer' | 'only'
export type RecommendationSource = 'edhrec' | 'scryfall'
export type CuratedCollection = { id: string; name: string; setCodes: string[] }
export const curatedCollections: CuratedCollection[] = [
  { id: 'middle-earth', name: 'Middle-earth', setCodes: ['ltr', 'ltc'] },
  { id: 'marvel', name: 'Marvel', setCodes: ['spm'] },
]
export type ScryfallCardFace = {
  type_line?: string
  mana_cost?: string
  oracle_text?: string
  power?: string
  toughness?: string
  image_uris?: { normal: string }
}
export type ScryfallCard = {
  name: string
  layout?: string
  type_line: string
  mana_cost?: string
  cmc?: number
  oracle_text?: string
  power?: string
  toughness?: string
  produced_mana?: string[]
  color_identity: string[]
  set: string
  set_name?: string
  collector_number: string
  scryfall_uri?: string
  prints_search_uri: string
  purchase_uris?: { tcgplayer?: string; cardmarket?: string; cardhoarder?: string }
  finishes?: CardFinish[]
  released_at?: string
  game_changer?: boolean
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null }
  image_uris?: { normal: string }
  card_faces?: ScryfallCardFace[]
}
export type EdhrecEntry = { name: string; tag: string; header: string }
export type RecommendationCard = {
  name: string
  layout: string
  typeLine: string
  manaCost: string
  manaValue: number
  detail: string
  producedMana: string[]
  faces: { typeLine: string; manaCost: string }[]
  power?: string
  toughness?: string
  reason: string
  source?: RecommendationSource
  image: string
  set: string
  setName?: string
  collectorNumber: string
  scryfallUri?: string
  printsUri: string
  price?: string
  priceUri?: string
  finish?: CardFinish
  tags: string[]
  collectionMatch?: boolean
}
export type RecommendationOptions = {
  includeCreature: boolean
  excludeGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
  excludeUnreleased: boolean
  powerTarget: PowerTarget
}
export const recommendedScoreThreshold = 45
export const recommendationScoreFactorMaximums = {
  evidence: 20,
  theme: 10,
  subThemes: 8,
  collection: 12,
  deckFit: 10,
  preferences: 10,
  deckNeeds: 30,
  popularityPenalty: 15,
} as const
export type RecommendationScoreCard = Pick<RecommendationCard, 'reason' | 'tags'> &
  Partial<Pick<RecommendationCard, 'set' | 'collectionMatch'>>
export type RecommendationScoreContext = {
  theme: string
  activeSubThemes: string[]
  pickedTags: Set<string>
  preferenceScores: Record<string, number>
  neededRoles: Set<string>
  cardRoles: string[]
  recommendationStyle?: RecommendationStyle
  collectionSets?: string[]
  collectionMode?: CollectionMode
  roleBoosts?: Record<string, number>
  roleSupply?: Record<string, number>
  batchNumber?: number
}
export type RecommendationScoreBreakdown = {
  total: number
  evidence: number
  theme: number
  subThemes: number
  collection: number
  deckFit: number
  preferences: number
  deckNeeds: number
  popularityPenalty: number
}

export function recommendationScoreBreakdown(
  card: RecommendationScoreCard,
  {
    theme: declaredTheme,
    activeSubThemes,
    pickedTags,
    preferenceScores,
    neededRoles,
    cardRoles,
    recommendationStyle = 'balanced',
    collectionSets = [],
    collectionMode = 'none',
    roleBoosts = {},
    roleSupply = {},
    batchNumber = 1,
  }: RecommendationScoreContext,
): RecommendationScoreBreakdown {
  const evidenceBase =
    card.reason === 'Commander synergy'
      ? 20
      : card.reason === 'Commander favourite'
        ? 15
        : card.reason === 'Popular inclusion' || card.reason === 'Land or mana'
          ? 8
          : 12
  const evidence =
    recommendationStyle === 'story'
      ? Math.round(evidenceBase * 0.65)
      : recommendationStyle === 'optimized'
        ? Math.min(recommendationScoreFactorMaximums.evidence, Math.round(evidenceBase * 1.1))
        : evidenceBase
  const theme =
    declaredTheme && card.tags.includes(declaredTheme) ? recommendationScoreFactorMaximums.theme : 0
  const subThemes = Math.min(
    recommendationScoreFactorMaximums.subThemes,
    card.tags.filter((tag) => activeSubThemes.includes(tag)).length * 4,
  )
  const isCollectionMatch =
    collectionMode !== 'none' &&
    Boolean(card.collectionMatch || (card.set && collectionSets.includes(card.set)))
  const collection = isCollectionMatch
    ? collectionMode === 'only' || recommendationStyle === 'story'
      ? recommendationScoreFactorMaximums.collection
      : recommendationStyle === 'balanced'
        ? 8
        : 6
    : 0
  const deckFit = Math.min(
    recommendationScoreFactorMaximums.deckFit,
    card.tags.filter((tag) => pickedTags.has(tag)).length * 5,
  )
  const preferenceBase =
    card.tags.reduce((score, tag) => score + (preferenceScores[tag] ?? 0), 0) +
    (isCollectionMatch ? (preferenceScores.Collection ?? 0) : 0)
  const preferences = Math.max(
    -recommendationScoreFactorMaximums.preferences,
    Math.min(
      recommendationScoreFactorMaximums.preferences,
      preferenceBase * (recommendationStyle === 'story' ? 1.2 : 1),
    ),
  )
  const roleUrgency = cardRoles.reduce(
    (score, role) =>
      score +
      (roleBoosts[role] ?? 0) * (1 + 4 / Math.max(1, roleSupply[role] ?? 1)) +
      ((roleBoosts[role] ?? 0) > 0 ? Math.min(12, batchNumber - 1) : 0),
    0,
  )
  const roleAware = Object.values(roleBoosts).some((boost) => boost > 0)
  const roleCeiling = roleAware
    ? Math.max(
        1,
        ...Object.entries(roleBoosts)
          .filter(([, boost]) => boost > 0)
          .map(
            ([role, boost]) =>
              boost * (1 + 4 / Math.max(1, roleSupply[role] ?? 1)) + Math.min(12, batchNumber - 1),
          ),
      )
    : 1
  const deckNeedsBase = roleAware
    ? recommendationScoreFactorMaximums.deckNeeds * Math.min(1, roleUrgency / roleCeiling) ** 1.23
    : cardRoles.filter((role) => neededRoles.has(role)).length * 10
  const deckNeeds = Math.min(
    recommendationScoreFactorMaximums.deckNeeds,
    Math.floor(
      deckNeedsBase *
        (roleAware && recommendationStyle === 'story'
          ? 0.35
          : roleAware && recommendationStyle === 'optimized'
            ? 1.25
            : 1),
    ),
  )
  const popularityPenalty =
    recommendationStyle === 'story' &&
    (card.reason === 'Commander favourite' || card.reason === 'Popular inclusion')
      ? -recommendationScoreFactorMaximums.popularityPenalty
      : 0
  const total = Math.max(
    0,
    evidence +
      theme +
      subThemes +
      collection +
      deckFit +
      preferences +
      deckNeeds +
      popularityPenalty,
  )
  return {
    total,
    evidence,
    theme,
    subThemes,
    collection,
    deckFit,
    preferences,
    deckNeeds,
    popularityPenalty,
  }
}

export function recommendationScore(
  card: RecommendationScoreCard,
  context: RecommendationScoreContext,
) {
  return recommendationScoreBreakdown(card, context).total
}

export function manualCardError(
  card: Pick<ScryfallCard, 'name' | 'type_line' | 'color_identity'>,
  deckNames: string[],
  commanderColours: string[],
) {
  if (card.color_identity.some((colour) => !commanderColours.includes(colour)))
    return 'Card is outside your commander’s colour identity.'
  if (!card.type_line.includes('Basic Land') && deckNames.includes(card.name))
    return 'Card is already in your deck.'
  return ''
}

export const recommendationReasons: Record<string, string> = {
  highsynergycards: 'Commander synergy',
  topcards: 'Commander favourite',
  newcards: 'Interesting new pick',
  creatures: 'Creature synergy',
  instants: 'Interaction',
  sorceries: 'Sorcery support',
  utilityartifacts: 'Utility artifact',
  utilityenchantments: 'Utility enchantment',
  enchantments: 'Enchantment synergy',
  artifacts: 'Artifact synergy',
  planeswalkers: 'Planeswalker support',
  lands: 'Land or mana',
  utilitylands: 'Land or mana',
  manafixing: 'Land or mana',
}

export const preconFastMana = new Set([
  'Chrome Mox',
  'Grim Monolith',
  'Jeweled Lotus',
  'Lotus Petal',
  'Mana Crypt',
  'Mana Vault',
  'Mox Diamond',
])
export const cardText = (card: ScryfallCard) =>
  card.oracle_text ??
  card.card_faces
    ?.map((face) => face.oracle_text)
    .filter(Boolean)
    .join('\n') ??
  card.type_line
export const formatUsdPrice = (price: string | null | undefined) => (price ? `$${price}` : '')
export const isReleased = (
  card: Pick<ScryfallCard, 'released_at'>,
  today = new Date().toISOString().slice(0, 10),
) => !card.released_at || card.released_at <= today
export const isManaCard = (card: ScryfallCard) =>
  card.type_line.includes('Land') || /add \{/i.test(cardText(card))

export function orderedPrintings<T extends PrintingLike>(original: PrintingLike, printings: T[]) {
  const unique = printings.filter(
    (printing, index, all) =>
      all.findIndex((item) => item.image === printing.image && item.finish === printing.finish) ===
      index,
  )
  const originalIndex = unique.findIndex((printing) => printing.image === original.image)
  return originalIndex < 1
    ? unique
    : [unique[originalIndex], ...unique.slice(0, originalIndex), ...unique.slice(originalIndex + 1)]
}

export function preferredPrintingIndex(
  printings: PrintingLike[],
  preferredSet: string,
  current = 0,
  manuallySelected = false,
) {
  if (manuallySelected) return current
  const preferred = preferredSet
    ? printings.findIndex((printing) => printing.set === preferredSet)
    : -1
  return preferred >= 0 ? preferred : 0
}

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

export function parseEdhrecEntries(
  lists: { header: string; tag: string; cardviews: { name: string }[] }[],
) {
  const entries: EdhrecEntry[] = []
  const seen = new Set<string>()
  for (const list of lists)
    for (const card of list.cardviews)
      if (!seen.has(card.name)) {
        seen.add(card.name)
        entries.push({ name: card.name, tag: list.tag.toLowerCase(), header: list.header })
      }
  return entries
}

export function toRecommendationCard(
  card: ScryfallCard,
  reason: string,
  category = '',
): RecommendationCard {
  return {
    name: card.name,
    layout: card.layout ?? 'normal',
    typeLine: card.type_line,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '',
    manaValue: card.cmc ?? 0,
    detail: cardText(card),
    producedMana: card.produced_mana ?? [],
    faces:
      card.card_faces?.map((face) => ({
        typeLine: face.type_line ?? '',
        manaCost: face.mana_cost ?? '',
      })) ?? [],
    power: card.power ?? card.card_faces?.[0]?.power,
    toughness: card.toughness ?? card.card_faces?.[0]?.toughness,
    reason,
    image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '',
    set: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    scryfallUri: card.scryfall_uri,
    printsUri: card.prints_search_uri,
    price: card.prices?.usd ?? undefined,
    priceUri: card.purchase_uris?.tcgplayer,
    finish: card.finishes?.includes('nonfoil') ? 'nonfoil' : card.finishes?.[0],
    tags: tagsFor(`${card.type_line}\n${cardText(card)}\n${category}`, card.type_line),
  }
}

export function buildEdhrecRecommendations(
  entries: EdhrecEntry[],
  responseCards: ScryfallCard[],
  options: RecommendationOptions,
) {
  const cards = new Map(responseCards.map((card) => [card.name, card]))
  const allowed = entries.filter((entry) => {
    const card = cards.get(entry.name)
    const text = card ? cardText(card) : ''
    return (
      card &&
      !(options.excludeGameChangers && (entry.tag === 'gamechangers' || card.game_changer)) &&
      !(options.excludeTutors && /search your library/i.test(text)) &&
      !(options.excludeExtraTurns && /extra turn/i.test(text)) &&
      !(options.excludeUnreleased && !isReleased(card)) &&
      !(options.powerTarget === 'precon' && preconFastMana.has(card.name))
    )
  })
  return batchRecommendations(
    allowed.map((entry) => {
      const card = cards.get(entry.name)!
      return {
        ...toRecommendationCard(
          card,
          isManaCard(card)
            ? 'Land or mana'
            : (recommendationReasons[entry.tag] ?? entry.header.replace(/ Cards$/, '')),
          `${entry.tag} ${entry.header}`,
        ),
        source: 'edhrec' as const,
      }
    }),
    options.includeCreature,
  )
}

export function batchRecommendations<T extends { name: string; reason: string; typeLine: string }>(
  cards: T[],
  includeCreature: boolean,
) {
  const remaining = [...cards]
  const ordered: T[] = []
  while (remaining.length) {
    const picks: T[] = []
    const take = (test: (card: T) => boolean) => {
      const allowedNewCard = (card: T) =>
        card.reason !== 'Interesting new pick' ||
        !picks.some((pick) => pick.reason === 'Interesting new pick')
      const newReason = (card: T) => !picks.some((pick) => pick.reason === card.reason)
      let index = remaining.findIndex(
        (card) => test(card) && allowedNewCard(card) && newReason(card),
      )
      if (index < 0) index = remaining.findIndex((card) => test(card) && allowedNewCard(card))
      if (index < 0) index = remaining.findIndex(test)
      if (index >= 0) picks.push(...remaining.splice(index, 1))
    }
    if (includeCreature)
      take((card) => card.reason !== 'Land or mana' && card.typeLine.includes('Creature'))
    while (picks.filter((card) => card.reason !== 'Land or mana').length < 3) {
      const count = picks.length
      take((card) => card.reason !== 'Land or mana')
      if (picks.length === count) break
    }
    take((card) => card.reason === 'Land or mana')
    while (picks.length < 4) {
      const count = picks.length
      take(() => true)
      if (picks.length === count) break
    }
    ordered.push(...picks)
  }
  if (
    ordered.length !== cards.length ||
    new Set(ordered.map((card) => card.name)).size !== cards.length
  )
    throw new Error('Recommendation queue lost or duplicated cards')
  return ordered
}

function keepStoryIdentity<T extends { tags: string[]; set?: string; collectionMatch?: boolean }>(
  cards: T[],
  context: RecommendationScoreContext,
) {
  const isIdentity = (card: T) =>
    Boolean(
      card.collectionMatch ||
      (card.set && context.collectionSets?.includes(card.set)) ||
      [context.theme, ...context.activeSubThemes]
        .filter(Boolean)
        .some((theme) => card.tags.includes(theme)),
    )
  const ordered = [...cards]
  for (let start = 0; start < ordered.length; start += 4) {
    const batch = ordered.slice(start, start + 4)
    if (ordered.slice(start).filter(isIdentity).length < Math.min(3, batch.length)) continue
    while (batch.filter((card) => !isIdentity(card)).length > 1) {
      const replacement = ordered.findIndex((card, index) => index >= start + 4 && isIdentity(card))
      const displaced = batch.findLastIndex((card) => !isIdentity(card))
      if (replacement < 0 || displaced < 0) break
      ;[ordered[start + displaced], ordered[replacement]] = [
        ordered[replacement],
        ordered[start + displaced],
      ]
      batch[displaced] = ordered[start + displaced]
    }
  }
  return ordered
}

export function rankRecommendationCards<
  T extends {
    name: string
    reason: string
    typeLine: string
    tags: string[]
    set?: string
    collectionMatch?: boolean
  },
>(
  cards: T[],
  context: RecommendationScoreContext,
  includeCreature: boolean,
  cardRoles: (card: T) => string[] = () => [],
) {
  const eligible =
    context.collectionMode === 'only' && context.collectionSets?.length
      ? cards.filter(
          (card) =>
            card.collectionMatch || (card.set && context.collectionSets?.includes(card.set)),
        )
      : cards
  const ranked = [...eligible].sort(
    (left, right) =>
      recommendationScore(right, { ...context, cardRoles: cardRoles(right) }) -
      recommendationScore(left, { ...context, cardRoles: cardRoles(left) }),
  )
  const varied = balanceThemeCoverage(
    batchRecommendations(ranked, includeCreature),
    [context.theme, ...context.activeSubThemes].filter(Boolean),
  )
  return context.recommendationStyle === 'story' ? keepStoryIdentity(varied, context) : varied
}

export function selectSubTheme(activeSubThemes: string[], name: string) {
  const next = activeSubThemes.includes(name)
    ? activeSubThemes
    : [...activeSubThemes, name].slice(0, 2)
  return { activeSubThemes: next, refreshRecommendations: next.length !== activeSubThemes.length }
}

export function balanceThemeCoverage<T extends { tags: string[]; reason: string }>(
  cards: T[],
  themes: string[],
) {
  if (themes.length < 2) return cards
  const ordered = [...cards]
  for (let start = 0; start < ordered.length; start += 4)
    for (const theme of themes) {
      if (ordered.slice(start, start + 4).some((card) => card.tags.includes(theme))) continue
      const batch = ordered.slice(start, start + 4)
      const replacement = ordered.findIndex(
        (card, index) =>
          index >= start + 4 &&
          card.tags.includes(theme) &&
          card.reason !== 'Land or mana' &&
          (card.reason !== 'Interesting new pick' ||
            !batch.some((item) => item.reason === 'Interesting new pick')),
      )
      const displaced = batch.findLastIndex(
        (card) =>
          card.reason !== 'Land or mana' &&
          !card.tags.includes(theme) &&
          !themes.some(
            (other) =>
              other !== theme &&
              card.tags.includes(other) &&
              batch.filter((item) => item.tags.includes(other)).length === 1,
          ),
      )
      if (replacement >= 0 && displaced >= 0)
        [ordered[start + displaced], ordered[replacement]] = [
          ordered[replacement],
          ordered[start + displaced],
        ]
    }
  return ordered
}

export function updatePreferenceScores(
  cards: { name: string; tags: string[]; collectionMatch?: boolean }[],
  decisions: Record<string, 'add' | 'later' | 'ignore'>,
  liked: string[],
  current: Record<string, number>,
) {
  const scores = { ...current }
  for (const card of cards) {
    const decision = decisions[card.name]
    const change = decision === 'add' ? 2 : decision === 'ignore' ? -1 : 0
    const likeBoost = decision !== 'ignore' && liked.includes(card.name) ? 4 : 0
    for (const tag of card.tags) scores[tag] = (scores[tag] ?? 0) + change + likeBoost
    if (card.collectionMatch) scores.Collection = (scores.Collection ?? 0) + change + likeBoost
  }
  return scores
}

export function deferBatch<T>(
  batch: T[],
  decisions: Record<string, 'add' | 'later' | 'ignore'>,
  batchNumber: number,
  name: (card: T) => string,
) {
  return batch.flatMap((card): DeferredCard<T>[] => {
    const decision = decisions[name(card)]
    if (decision === 'add' || decision === 'ignore') return []
    return [{ card, eligibleBatch: batchNumber + (decision === 'later' ? 4 : 3) }]
  })
}

export function releaseDeferred<T>(deferred: DeferredCard<T>[], batchNumber: number) {
  return {
    ready: deferred.filter((item) => item.eligibleBatch <= batchNumber).map((item) => item.card),
    waiting: deferred.filter((item) => item.eligibleBatch > batchNumber),
  }
}

export function releaseNextDeferred<T>(
  deferred: DeferredCard<T>[],
  requestedBatch: number,
  hasUnseenCards: boolean,
) {
  const batchNumber =
    !hasUnseenCards && deferred.length
      ? Math.max(requestedBatch, Math.min(...deferred.map((item) => item.eligibleBatch)))
      : requestedBatch
  return { batchNumber, ...releaseDeferred(deferred, batchNumber) }
}

export type RecommendationDecision = 'add' | 'later' | 'ignore'

export function advanceRecommendationQueue<
  T extends {
    name: string
    reason: string
    typeLine: string
    tags: string[]
    set?: string
    collectionMatch?: boolean
  },
>({
  queue,
  deferredCards,
  batchNumber,
  decisions,
  liked,
  preferenceScores,
  pickedTags = new Set(),
  activeSubThemes,
  extraSubTheme = '',
  theme,
  includeCreature,
  roleBoosts = {},
  cardRoles = () => [],
  recommendationStyle = 'balanced',
  collectionSets = [],
  collectionMode = 'none',
}: {
  queue: T[]
  deferredCards: DeferredCard<T>[]
  batchNumber: number
  decisions: Record<string, RecommendationDecision>
  liked: string[]
  preferenceScores: Record<string, number>
  pickedTags?: Set<string>
  activeSubThemes: string[]
  extraSubTheme?: string
  theme: string
  includeCreature: boolean
  roleBoosts?: Record<string, number>
  cardRoles?: (card: T) => string[]
  recommendationStyle?: RecommendationStyle
  collectionSets?: string[]
  collectionMode?: CollectionMode
}) {
  const batch = queue.slice(0, 4)
  const pending = [
    ...deferredCards,
    ...deferBatch(batch, decisions, batchNumber, (card) => card.name),
  ]
  const released = releaseNextDeferred(pending, batchNumber + 1, queue.length > 4)
  const scores = updatePreferenceScores(batch, decisions, liked, preferenceScores)
  const rankedSubThemes = extraSubTheme ? [...activeSubThemes, extraSubTheme] : activeSubThemes
  const candidates = [...queue.slice(4), ...released.ready]
  const roleSupply = Object.fromEntries(
    Object.keys(roleBoosts).map((role) => [
      role,
      candidates.filter((card) => cardRoles(card).includes(role)).length,
    ]),
  )
  const context: RecommendationScoreContext = {
    theme,
    activeSubThemes: rankedSubThemes,
    pickedTags: new Set([
      ...pickedTags,
      ...Object.entries(scores)
        .filter(([, score]) => score > 0)
        .map(([tag]) => tag),
    ]),
    preferenceScores: scores,
    neededRoles: new Set(Object.keys(roleBoosts).filter((role) => (roleBoosts[role] ?? 0) > 0)),
    cardRoles: [],
    recommendationStyle,
    collectionSets,
    collectionMode,
    roleBoosts,
    roleSupply,
    batchNumber,
  }
  return {
    queue: rankRecommendationCards(candidates, context, includeCreature, cardRoles),
    deferredCards: released.waiting,
    batchNumber: released.batchNumber,
    preferenceScores: scores,
  }
}

export function freshRecommendationCycle() {
  return { deferredCards: [], batchNumber: 1 } as { deferredCards: never[]; batchNumber: number }
}
