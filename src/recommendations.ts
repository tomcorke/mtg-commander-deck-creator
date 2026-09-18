export type TaggedCard = { name: string; typeLine: string; detail: string; tags: string[] }
export type DeferredCard<T> = { card: T; eligibleBatch: number }
export type EdhrecThemeCount = { count: number; slug: string; value: string }

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
  ['Landfall', /landfall|land enters|play an additional land/i],
  ['Voltron', /equipped creature|enchanted creature|commander you control/i],
  ['Goad', /goad/i],
  ['Typal', /choose a creature type|creatures you control (?:get|have)/i],
  ['Big mana', /mana value (?:[5-9]|[1-9]\d)|add (?:\{[^}]+\}){2,}/i],
  ['Blink', /exile .* return|exile .* then return/i],
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
]

export const supportedThemes = themeMatchers.map(([name]) => name)

const edhrecThemeAliases: Record<string, string> = {
  enchantress: 'Enchantments',
  reanimator: 'Graveyard',
  'self-mill': 'Mill',
  'plus-1-plus-1-counters': '+1/+1 counters',
  aristocrats: 'Sacrifice',
  auras: 'Voltron',
}

export function commanderThemes(tagCounts: EdhrecThemeCount[]) {
  const supported = new Map(supportedThemes.map((theme) => [theme.toLowerCase(), theme]))
  return [...new Set(tagCounts.flatMap(({ slug, value }) => {
    const theme = edhrecThemeAliases[slug] ?? supported.get(value.toLowerCase())
    return theme ? [theme] : []
  }))]
}

export function tagsFor(source: string, typeLine: string) {
  const tags = themeMatchers.filter(([, matcher]) => matcher.test(source)).map(([tag]) => tag)
  for (const type of ['Creature', 'Artifact', 'Enchantment', 'Land']) if (typeLine.includes(type) && !tags.includes(`${type}s`)) tags.push(`${type}s`)
  return tags
}

const synergyRules: { left: RegExp; right: RegExp; explanation: string }[] = [
  { left: /create[s]? .* token/i, right: /tokens? you control/i, explanation: 'one creates tokens while the other rewards your token army' },
  { left: /put .*\+1\/\+1 counter/i, right: /creature[s]? .*\+1\/\+1 counter|remove .*\+1\/\+1 counter/i, explanation: 'one places +1/+1 counters while the other rewards or spends them' },
  { left: /sacrifice (?:another )?(?:creature|permanent)/i, right: /whenever .* dies|when .* dies/i, explanation: 'one provides a sacrifice outlet while the other rewards creatures dying' },
  { left: /mill|put .*graveyard/i, right: /return .* from your graveyard|cast .* from your graveyard/i, explanation: 'one fills your graveyard while the other reuses those cards' },
  { left: /create[s]? .*Treasure|create[s]? .*artifact token/i, right: /whenever .*artifact|artifacts? you control/i, explanation: 'one creates artifacts while the other rewards artifacts entering or staying in play' },
]

export function findSynergyPair<T extends TaggedCard>(cards: T[]) {
  for (const rule of synergyRules) for (let left = 0; left < cards.length; left += 1) for (let right = 0; right < cards.length; right += 1) {
    if (left !== right && rule.left.test(cards[left].detail) && rule.right.test(cards[right].detail)) return { cards: [cards[left], cards[right]], explanation: rule.explanation }
  }
  return null
}

export function batchRecommendations<T extends { name: string; reason: string; typeLine: string }>(cards: T[], includeCreature: boolean) {
  const remaining = [...cards]
  const ordered: T[] = []
  while (remaining.length) {
    const picks: T[] = []
    const take = (test: (card: T) => boolean) => {
      const withinNewCardLimit = (card: T) => card.reason !== 'Interesting new pick' || !picks.some((pick) => pick.reason === 'Interesting new pick')
      let index = remaining.findIndex((card) => !picks.includes(card) && test(card) && withinNewCardLimit(card))
      if (index < 0) index = remaining.findIndex((card) => !picks.includes(card) && test(card))
      if (index >= 0) picks.push(remaining[index])
    }
    if (includeCreature) take((card) => card.reason !== 'Land or mana' && card.typeLine.includes('Creature'))
    while (picks.filter((card) => card.reason !== 'Land or mana').length < 3) {
      const before = picks.length
      take((card) => card.reason !== 'Land or mana')
      if (picks.length === before) break
    }
    take((card) => card.reason === 'Land or mana')
    while (picks.length < 4) {
      const before = picks.length
      take(() => true)
      if (picks.length === before) break
    }
    ordered.push(...picks)
    for (const pick of picks) remaining.splice(remaining.indexOf(pick), 1)
  }
  if (ordered.length !== cards.length || new Set(ordered.map((card) => card.name)).size !== cards.length) throw new Error('Recommendation queue lost or duplicated cards')
  return ordered
}

export function limitThemeMatches<T extends { tags: string[] }>(cards: T[], themes: string[], isMana: (card: T) => boolean, isCreature: (card: T) => boolean, perBatch = 2) {
  const ordered = [...cards]
  if (!themes.length) return ordered
  const matchesTheme = (card: T) => card.tags.some((tag) => themes.includes(tag))
  for (let start = 0; start < ordered.length; start += 4) {
    const themed = ordered.slice(start, start + 4).map((card, offset) => ({ card, index: start + offset })).filter(({ card }) => matchesTheme(card))
    for (const { card, index } of themed.slice(perBatch)) {
      const replacement = ordered.findIndex((candidate, candidateIndex) => candidateIndex >= start + 4 && !matchesTheme(candidate) && isMana(candidate) === isMana(card) && isCreature(candidate) === isCreature(card))
      if (replacement >= 0) [ordered[index], ordered[replacement]] = [ordered[replacement], ordered[index]]
    }
  }
  return ordered
}

export function updatePreferenceScores(cards: { name: string; tags: string[] }[], decisions: Record<string, 'add' | 'later' | 'ignore'>, liked: string[], current: Record<string, number>) {
  const scores = { ...current }
  for (const card of cards) {
    const decision = decisions[card.name]
    const change = decision === 'add' ? 2 : decision === 'ignore' ? -1 : 0
    const likeBoost = decision !== 'ignore' && liked.includes(card.name) ? 4 : 0
    for (const tag of card.tags) scores[tag] = (scores[tag] ?? 0) + change + likeBoost
  }
  return scores
}

export function deferBatch<T>(batch: T[], decisions: Record<string, 'add' | 'later' | 'ignore'>, batchNumber: number, name: (card: T) => string) {
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

export function releaseNextDeferred<T>(deferred: DeferredCard<T>[], requestedBatch: number, hasUnseenCards: boolean) {
  const batchNumber = !hasUnseenCards && deferred.length
    ? Math.max(requestedBatch, Math.min(...deferred.map((item) => item.eligibleBatch)))
    : requestedBatch
  return { batchNumber, ...releaseDeferred(deferred, batchNumber) }
}

export function freshRecommendationCycle() {
  return { deferredCards: [], batchNumber: 1 } as { deferredCards: never[]; batchNumber: number }
}
