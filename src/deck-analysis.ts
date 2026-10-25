export const targetKeys = ['lands', 'ramp', 'draw', 'removal', 'wipes'] as const
export type TargetKey = (typeof targetKeys)[number]
export type DeckTargets = Record<TargetKey, number>
export type AddZone = 'deck' | 'sideboard'
/** A player's zone choice, tied to whether the main deck had 100 cards when they made it. */
export type AddZoneChoice = { zone: AddZone; full: boolean } | null
/**
 * New cards go to the main deck below 100 and to the sideboard from 100. A player's choice
 * overrides that until the main deck crosses 100 either way, so reaching 100 re-enables the sideboard.
 */
// Takes the app's loosely typed state and action deps as well as plain objects.
export const addZone = (state: Record<string, any>): AddZone => {
  const full = (state.deck?.length ?? 0) >= 100
  const choice: AddZoneChoice = state.addZoneChoice ?? null
  return choice?.full === full ? choice.zone : full ? 'sideboard' : 'deck'
}
export const addsToSideboard = (state: Record<string, any>): boolean =>
  addZone(state) === 'sideboard'
/** Main-deck size a multi-card add fills before the rest spills to the sideboard. */
export const mainDeckLimit = (state: Record<string, any>): number =>
  addsToSideboard(state) ? 0 : (state.deck?.length ?? 0) >= 100 ? Infinity : 100
export const deckBecameComplete = (previousCount: number, nextCount: number) =>
  previousCount < 100 && nextCount >= 100
export const shouldAutoOpenDeckReview = (
  previousCount: number,
  nextCount: number,
  suppress = false,
) => !suppress && deckBecameComplete(previousCount, nextCount)

export type AnalysisCard = {
  name: string
  layout: string
  typeLine: string
  manaCost: string
  manaValue: number
  manaValueKnown?: boolean
  dataStatus?: 'pending' | 'unavailable'
  detail: string
  producedMana: string[]
  faces: { typeLine: string; manaCost: string }[]
  oracleId?: string
}

export const defaultDeckTargets: DeckTargets = {
  lands: 35,
  ramp: 10,
  draw: 10,
  removal: 8,
  wipes: 3,
}
export const targetLabels: Record<TargetKey, string> = {
  lands: 'Lands',
  ramp: 'Ramp',
  draw: 'Card draw',
  removal: 'Targeted removal',
  wipes: 'Board wipes',
}
export const cardTypes = [
  'Creature',
  'Artifact',
  'Enchantment',
  'Instant',
  'Sorcery',
  'Planeswalker',
  'Battle',
] as const
const colours = ['W', 'U', 'B', 'R', 'G'] as const
const manaSymbols = [...colours, 'C', 'S'] as const
export type ManaColour = (typeof colours)[number]
export type ManaGuidanceSymbol = (typeof manaSymbols)[number]
export const basicLandNames: Record<ManaColour, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
}
export const isBasicLandName = (name: string) =>
  name === 'Wastes' || Object.values(basicLandNames).includes(name)

const isLandLine = (typeLine: string) => typeLine.includes('Land')
const frontTypeLine = (card: AnalysisCard) =>
  card.faces[0]?.typeLine || card.typeLine.split(' // ', 1)[0]
const isLand = (card: AnalysisCard) =>
  card.layout === 'modal_dfc'
    ? card.faces.length
      ? card.faces.some((face) => isLandLine(face.typeLine))
      : isLandLine(card.typeLine)
    : isLandLine(frontTypeLine(card))
const isOptionalLandMdfc = (card: AnalysisCard) => card.layout === 'modal_dfc' && isLand(card)
const curveType = (card: AnalysisCard) =>
  card.layout === 'modal_dfc'
    ? card.faces.find((face) => !isLandLine(face.typeLine))?.typeLine
    : frontTypeLine(card)
export const curveBucket = (card: AnalysisCard) =>
  card.manaValueKnown === false ||
  card.dataStatus ||
  !Number.isFinite(card.manaValue) ||
  curveType(card) === undefined ||
  isLand(card)
    ? null
    : Math.min(Math.floor(card.manaValue), 7)
const isPermanent = (card: AnalysisCard) => !/\b(?:Instant|Sorcery)\b/.test(curveType(card) ?? '')
const effectClauses = (text: string) =>
  text.split(/[.\n]/).map((effect) =>
    effect
      .trim()
      .replace(/^[^:]*:\s*/, '')
      .replace(/^(?:when(?:ever)?|at the beginning)[^,]*,\s*/i, ''),
  )
const isWipe = (text: string) =>
  effectClauses(text).some(
    (effect) =>
      !/from [^.]*graveyard|(?:destroy|exile|return) (?:all|each) [^,.]*you control|damage to each (?:\w+ )?creature you control/i.test(
        effect,
      ) &&
      /(?:destroy|exile|return) (?:all|each) (?:non\w+ )?(?:creature|artifact|enchantment|permanent)|each (?:creature|artifact|enchantment|player) (?:sacrifices|exiles) (?:all|any number)|deals? [^.]+ damage to each (?:\w+ )?creature|all creatures get -[x\d]+\/-[x\d]+/i.test(
        effect,
      ),
  )
// Targets you control and graveyard cards aren't interaction with opposing threats.
const isRemoval = (text: string) =>
  !isWipe(text) &&
  effectClauses(text).some(
    (effect) =>
      !/you control|from [^.]*graveyard|from exile|in exile|target exiled|target [^.]*graveyard|target (?:spell|player)[’']s? controller/i.test(
        effect,
      ) &&
      /(?:destroy|exile|return|shuffle) (?:up to (?:\w+|\d+) |any number of |one |two |three |six )?target|target .* gets -(?:\d+|x)\/(?:-\d+|-x)|deals? [^.]*damage(?: equal to [^.]*)? to (?:any target|target (?:creature|planeswalker|permanent))|deals? [^.]*damage divided [^.]*target creatures|deals? [^.]*damage[^.]* to target (?:opponent|player) or planeswalker|fights? target|counter target/i.test(
        effect,
      ),
  )
const landSearch =
  /search your library for [^.]*(?:\bland|Plains|Island|Swamp|Mountain|Forest) cards?/i
const drawWords = /\bdraws?\b/i
const withoutOpponentDraw = (text: string) =>
  text.replace(
    /\b(?:target|each|an?) opponents? (?:may )?draws? (?:up to )?(?:a|one|two|three|four|five|six|seven|\d+|x|that many) cards?\b/gi,
    '',
  )
const ambiguousDraw =
  /(?:target player|that player|its controller|their controller|that \w+[’']s controller) (?:may )?draw|(?:can't|cannot|can’t|would) draw/i
const cardDraw =
  /\bdraws? (?:up to )?(?:(?:a|one|two|three|four|five|six|seven|\d+|that many|x) cards?|cards? equal to)/i
const rulesText = (card: AnalysisCard) => card.detail.replace(/\([^)]*\)/g, '').trim()

/**
 * What a card does for the mana, card-flow and interaction roles. `unknown` means the wording
 * fits a rule only partly, so it gets no role credit.
 * - mana: land-ramp (land onto the battlefield), repeatable (rocks, dorks, Treasure engines),
 *   burst (rituals, one-shot Treasure, sacrifice-for-mana), fixing and land-to-hand.
 * - draw: net (more than one card, or a repeating draw), cantrip (one card, once), selection
 *   (draw/discard or put-back), impulse (exile and play), and recursion (graveyard to hand).
 * - interaction: opposing (removal) or self (blink and protection of your own permanents).
 */
export type CardFeatures = {
  mana: 'land-ramp' | 'repeatable' | 'burst' | 'fixing' | 'land-to-hand' | 'unknown' | null
  draw: 'net' | 'cantrip' | 'selection' | 'impulse' | 'recursion' | 'unknown' | null
  interaction: 'opposing' | 'self' | 'unknown' | null
  strategy: ('resource' | 'enabler' | 'payoff' | 'finisher' | 'unknown')[]
  /** Beneficiary of the detected draw, not ownership of every effect on the card. */
  beneficiary: 'you' | 'opponents' | 'unknown' | null
  /** Explicit activated/additional costs, not a claim that the card can be afforded. */
  costs: string[]
  /** Full rules-text evidence; overrides retain it rather than inventing a parsed explanation. */
  evidence: Partial<Record<'mana' | 'draw' | 'interaction' | 'strategy' | 'wipe', string>>
  wipe: boolean | 'unknown'
  source: 'rules' | 'override'
}

// Reviewed Oracle-ID corrections; sources and scope: docs/role-detection-audit.md (2026-10-25).
const featureOverrides: Record<string, Partial<CardFeatures>> = {
  // Arcane Denial: "at the beginning of the next turn's upkeep" reads as a repeating draw, but
  // you draw one card, once.
  'ab1cc360-b9de-48d9-9983-4dfe4a7d2a37': { draw: 'cantrip' },
  'a7c6f07c-3cc3-4271-bbc7-9f7d5bbed3e8': { draw: 'cantrip' }, // Wheel and Deal: opponents draw seven; you draw one.
  '9e6a3df4-67a3-452e-a6ef-f04dbadb21ef': { interaction: 'opposing', wipe: true }, // Living Death: graveyard exchange also sacrifices all battlefield creatures.
  // Land abilities beyond ordinary one-mana production; costs remain unevaluated.
  '58257464-278e-45fa-8e0b-bcd9a7500bc1': { mana: 'land-to-hand' }, // Ash Barrens
  '02679a2e-303d-412f-87d8-0a37a8ca259c': { mana: 'land-ramp' }, // Blighted Woodland
  'd9a10971-f32b-4978-952d-fed0a5bc9e36': { mana: 'land-ramp' }, // Krosan Verge
  '2549bc57-9ffb-4053-9f10-f2a5f792b845': { mana: 'land-ramp' }, // Myriad Landscape
  'aa6723a2-75da-49f5-a1ba-cbfa82c55301': { mana: 'fixing' }, // Opal Palace
  'cfdd5dc6-593e-495a-8cfe-3a56b3c4c7df': { mana: 'repeatable' }, // Temple of the False God
  // Cross-sentence, controller-relative, modal and indirect resource effects.
  '65bc4f8a-3226-4648-862b-3f62736ff1ae': { mana: 'land-to-hand' }, // Borderland Explorer
  '6832f9e2-294a-44a2-8af9-eb16ccfdfc36': { mana: 'repeatable' }, // Empowered Autogenerator
  '38a55562-1e2d-4240-9454-219a4a25d38d': { mana: 'land-ramp', draw: 'selection' }, // Lord Windgrace
  'a242af4b-5de6-4961-b684-f4bd809977c6': { draw: 'selection' }, // Curse of Chaos
  '9f31dbb1-c350-46f8-bd1d-9f23a073d2f1': { draw: 'recursion' }, // Endless Cockroaches
  '5fd78088-53db-453b-90a3-b8426b0a8269': { draw: 'recursion' }, // Fell Shepherd
  'efcaadbe-24e3-4dfc-b08c-a910f003d427': { draw: 'recursion' }, // Liesa, Forgotten Archangel
  '0310dfdb-0498-488d-9f1a-279f8239e024': { draw: 'recursion' }, // Meren of Clan Nel Toth
  '20cc0f3e-de69-4e5f-88b3-ae7e6c6b5996': { draw: 'recursion' }, // Naya Charm
  '02f062f5-8012-4440-ac12-49fc49822106': { draw: 'recursion' }, // Spine of Ish Sah
  'f2ce9e55-07c0-4f36-a59e-127693fc0f62': { draw: 'net' }, // Magnifying Glass: repeatable investigate.
  '9929d7ba-cdc5-4099-a0ee-3a15073336f3': { draw: 'net' }, // Seer's Sundial: pay, then draw in a separate sentence.
  // Effects whose targets, protection or clearance span clauses the narrow rules do not parse.
  '9abd2286-23e9-49cd-be53-39423890f35c': { interaction: 'opposing' }, // Capricious Efreet
  '07a0cba9-8768-4fd9-a3d5-b0f83b4bf8e8': { interaction: 'opposing' }, // Chaos Warp
  '1f0548f8-5dec-44b5-b5a9-e55fa4366e08': { interaction: 'opposing' }, // Enchanter's Bane
  '0ce47c8b-1e1f-463f-94f0-35ca00be89e6': { interaction: 'opposing' }, // Inferno Titan
  '5f9dd005-1648-451e-b888-69ef81331c95': { interaction: 'opposing' }, // Leadership Vacuum: chosen player's commanders, not a general wipe.
  'c53ba31a-ba27-4e17-9a92-311acb1cab29': { interaction: 'opposing' }, // Myr Battlesphere: can damage a planeswalker.
  '15d8b339-7520-43c9-b2dc-4a936357042b': { interaction: 'opposing', wipe: true }, // Divine Reckoning
  '4475e9a7-4e94-4965-8e7e-211d40a98217': { wipe: true }, // Lavalanche: asymmetric mass damage.
  'c7ee1b21-d02e-49ef-95d6-d6dbf2f886ae': { interaction: 'self' }, // Eldrazi Monument
  'b415684e-40f0-43c1-b8d5-1a90b75c5a47': { interaction: 'self' }, // Emissary of Grudges
  'e828b189-0e8f-43b8-b909-4c23e742e028': { interaction: 'self' }, // Ghostly Prison
  'c309ec42-34a0-4083-a36c-7814643d7960': { interaction: 'self' }, // Mandate of Peace
  'de80c742-4da0-4d67-9711-2b4e6452e2d0': { interaction: 'self' }, // Pristine Skywise
  'afad2e76-4b53-4884-8f96-ba68b0808990': { interaction: 'self' }, // Reality Scramble
  'd6bf5e22-8d33-43a9-8824-435068e0a87a': { interaction: 'self' }, // Reincarnation
  'ee8cf4b4-2e23-4f01-a9fc-7b47ddda31b7': { interaction: 'self' }, // Thalia's Geistcaller
}

function manaFeature(card: AnalysisCard): CardFeatures['mana'] {
  if (isLand(card)) return null
  const text = rulesText(card)
  // A land search only ramps when the land goes onto the battlefield; land-to-hand is fixing.
  if (
    new RegExp(`${landSearch.source}[^.]*onto the battlefield`, 'i').test(text) ||
    /put .*\bland card.* onto the battlefield/i.test(text)
  )
    return 'land-ramp'
  if (new RegExp(`${landSearch.source}[^.]*into your hand`, 'i').test(text)) return 'land-to-hand'
  if (/(?:^|\n)\{T\}: Add /i.test(text)) return 'repeatable'
  if (/\{1\}[^.:]*: add (?:one mana|\{[WUBRGC]\}(?!\{))/i.test(text)) return 'fixing'
  if (
    /adds? (?:\{|(?:one|two|three|x) mana)|create (?:a|one|two|\d+|x) treasure|lands? you control produces? .*additional/i.test(
      text,
    )
  ) {
    if (
      !isPermanent(card) ||
      /sacrifice this \w+[^.:]*: add/i.test(text.replaceAll(card.name, 'this card'))
    )
      return 'burst'
    if (
      /(?:whenever|at the beginning|:)[^.\n]*(?:add|create)|lands? you control produces? .*additional/i.test(
        text,
      )
    )
      return 'repeatable'
    return /when [^.\n]*enters/i.test(text) ? 'burst' : 'unknown'
  }
  return landSearch.test(text) || card.producedMana.length > 0 ? 'unknown' : null
}

function drawFeature(text: string): CardFeatures['draw'] {
  const effects = withoutOpponentDraw(text)
    .split(/[.\n]/)
    .map((effect) => effect.trim())
    .filter((effect) =>
      drawWords.test(effect.replace(/^(?:when(?:ever)?|at the beginning)[^,]*,\s*/i, '')),
    )
  const yours = effects.filter((effect) => cardDraw.test(effect) && !ambiguousDraw.test(effect))
  if (yours.length) {
    if (
      /draw [^.]*cards?\.\s*(?:then )?discard/i.test(text) ||
      yours.some((effect) =>
        /draw [^.]*cards?, then (?:discard|put) |discard [^:.]*[.:][^.]*draw/i.test(effect),
      )
    )
      return 'selection'
    if (/sacrifice this [^:]+: draw (?:a|one) card\b/i.test(text)) return 'cantrip'
    if (
      yours.some((effect) =>
        /draws? (?:two|three|four|five|six|seven|\d+|x|that many) cards|draws? cards equal|draw a card for each|whenever|at the beginning of|:.*draw/i.test(
          effect,
        ),
      )
    )
      return 'net'
    return /\bdraws? (?:a|one) card\b/i.test(yours.join(' ')) ? 'cantrip' : 'unknown'
  }
  if (/(?:^|\n)cycling(?: \{|—)/i.test(text)) return 'cantrip'
  if (/return [^.]*cards? [^.]*from your graveyard to your hand/i.test(text)) return 'recursion'
  if (effects.length) return 'unknown'
  if (/exile the top [^.]*\.[^.]*you may (?:play|cast)/i.test(text)) return 'impulse'
  return null
}

// Strategy clues, not an engine parser or proof that a deck can supply the required resources.
function strategyFeatures(
  text: string,
  features: Pick<CardFeatures, 'mana' | 'draw' | 'interaction' | 'wipe'>,
): CardFeatures['strategy'] {
  const strategy: CardFeatures['strategy'] = []
  if (
    /\bcreate\b[^.\n]*tokens?/i.test(text) ||
    (features.mana && features.mana !== 'unknown') ||
    (features.draw && features.draw !== 'unknown')
  )
    strategy.push('resource')
  if (
    /sacrifice (?:a|another) [^:]+:|you may (?:play|cast) [^.]*from your graveyard|triggers an additional time/i.test(
      text,
    )
  )
    strategy.push('enabler')
  if (/whenever [^,\n]*(?:you control|you cast|you gain|you sacrifice)[^,\n]*,/i.test(text))
    strategy.push('payoff')
  if (/you win the game|(?:each|target) opponent loses the game/i.test(text))
    strategy.push('finisher')
  if (!strategy.length && text && !features.interaction && !features.wipe) strategy.push('unknown')
  return strategy
}

function interactionFeature(text: string): CardFeatures['interaction'] {
  if (isRemoval(text)) return 'opposing'
  if (
    /(?:exile|destroy|return) target [^.]*you control|target [^.]*you control (?:gains?|gets?) (?:hexproof|indestructible|protection)/i.test(
      text,
    ) ||
    /regenerate this|(?:creatures|permanents) you control (?:gain|have)[^.]*indestructible|equipped creature has [^.]*(?:hexproof|shroud)|prevent all (?:combat )?damage/i.test(
      text,
    )
  )
    return 'self'
  return /\btarget\b/i.test(text) && !/from your graveyard/i.test(text) ? 'unknown' : null
}

function drawBeneficiary(text: string, draw: CardFeatures['draw']): CardFeatures['beneficiary'] {
  if (!drawWords.test(text)) return null
  if (draw && draw !== 'unknown') return 'you'
  return ambiguousDraw.test(text) || drawWords.test(withoutOpponentDraw(text))
    ? 'unknown'
    : 'opponents'
}

export function cardFeatures(card: AnalysisCard): CardFeatures {
  const override = card.oracleId ? featureOverrides[card.oracleId] : undefined
  const text = rulesText(card)
  const draw = drawFeature(text)
  const features: CardFeatures = {
    mana: manaFeature(card),
    draw,
    interaction: isWipe(text) ? 'opposing' : interactionFeature(text),
    strategy: [],
    beneficiary: drawBeneficiary(text, draw),
    costs: [...text.matchAll(/(?:^|\n)([^.\n:]+):|as an additional cost[^.]+/gi)].map((match) =>
      (match[1] ?? match[0]).trim(),
    ),
    evidence: {},
    wipe:
      isWipe(text) ||
      (/(?:destroy|exile|return|damage|sacrifice)[^.\n]*(?:all|each)/i.test(text)
        ? 'unknown'
        : false),
    source: 'rules',
  }
  const result = override ? { ...features, ...override, source: 'override' as const } : features
  result.strategy = strategyFeatures(text, result)
  for (const key of ['mana', 'draw', 'interaction', 'strategy', 'wipe'] as const)
    if (key === 'strategy' ? result.strategy.length : result[key]) result.evidence[key] = text
  return result
}

/**
 * How much of a role need a card meets when ranking: one-shot mana and cantrips fill the ramp
 * and draw roles, but a deck short on them gains less than from repeatable ramp or net draw.
 */
export function roleCredit(card: AnalysisCard): Partial<Record<TargetKey, number>> {
  const { mana, draw } = cardFeatures(card)
  return { ramp: mana === 'burst' ? 0.5 : 1, draw: draw === 'cantrip' ? 0.5 : 1 }
}

/** The five deck-target roles, projected from `cardFeatures`. */
export function rolesForCard(card: AnalysisCard) {
  const { mana, draw, interaction, wipe } = cardFeatures(card)
  return [
    isLand(card) && 'lands',
    (mana === 'land-ramp' || mana === 'repeatable' || mana === 'burst') && 'ramp',
    (draw === 'net' || draw === 'cantrip') && 'draw',
    interaction === 'opposing' && wipe !== true && 'removal',
    wipe === true && 'wipes',
  ].filter(Boolean) as TargetKey[]
}
const manaCosts = (card: AnalysisCard) =>
  card.faces.length
    ? card.faces.filter((face) => !face.typeLine.includes('Land')).map((face) => face.manaCost)
    : [card.manaCost]
export const requiredPipsForCard = (card: AnalysisCard, symbol: ManaGuidanceSymbol) =>
  manaCosts(card)
    .flatMap((cost) => [...cost.matchAll(/\{([^}]+)\}/g)])
    .filter(([, costSymbol]) => costSymbol.split('/').includes(symbol)).length

export const isSnowManaSource = (card: AnalysisCard) =>
  /\bSnow\b/.test(frontTypeLine(card)) && card.producedMana.length > 0

export const manaGuidanceSymbols = (identity: string[]): ManaGuidanceSymbol[] => [
  ...colours.filter((colour) => identity.includes(colour)),
  'C',
  'S',
]

export function analyseDeck(cards: AnalysisCard[]) {
  const spells = cards.filter((card) => curveBucket(card) !== null)
  const curve = Array.from({ length: 8 }, (_, manaValue) => ({
    manaValue,
    permanents: spells.filter((card) => isPermanent(card) && curveBucket(card) === manaValue)
      .length,
    nonPermanents: spells.filter((card) => !isPermanent(card) && curveBucket(card) === manaValue)
      .length,
  }))
  const required = Object.fromEntries(
    manaSymbols.map((symbol) => [
      symbol,
      cards.reduce((count, card) => count + requiredPipsForCard(card, symbol), 0),
    ]),
  ) as Record<ManaGuidanceSymbol, number>
  const produced = Object.fromEntries(
    manaSymbols.map((symbol) => [
      symbol,
      cards.filter((card) =>
        symbol === 'S' ? isSnowManaSource(card) : card.producedMana.includes(symbol),
      ).length,
    ]),
  ) as Record<ManaGuidanceSymbol, number>
  const counts = Object.fromEntries(
    targetKeys.map((key) => [key, cards.filter((card) => rolesForCard(card).includes(key)).length]),
  ) as DeckTargets
  const typeCounts = Object.fromEntries(
    cardTypes.map((type) => [
      type,
      cards.filter((card) => {
        const lines = isOptionalLandMdfc(card)
          ? card.faces.length
            ? card.faces.filter((face) => isLandLine(face.typeLine)).map((face) => face.typeLine)
            : ['Land']
          : card.layout === 'transform'
            ? [frontTypeLine(card)]
            : [card.typeLine, ...card.faces.map((face) => face.typeLine)]
        return lines.some((line) => new RegExp(`\\b${type}\\b`).test(line))
      }).length,
    ]),
  ) as Record<(typeof cardTypes)[number], number>
  const averageManaValue = spells.length
    ? spells.reduce((sum, card) => sum + card.manaValue, 0) / spells.length
    : 0
  const landCentre = Math.max(
    32,
    Math.min(40, Math.round(35 + (averageManaValue - 3) * 2 - (counts.ramp - 10) / 3)),
  )
  return {
    curve,
    required,
    produced,
    counts,
    typeCounts,
    averageManaValue,
    // Saved decks drop type lines, so the curve is unknown until current card data loads.
    curvePending: cards.some((card) => card.dataStatus === 'pending'),
    landRange: [Math.max(30, landCentre - 1), Math.min(42, landCentre + 1)] as [number, number],
  }
}

export function deckSection(typeLine: string) {
  if (typeLine.includes('Creature')) return 'Creatures'
  if (typeLine.includes('Enchantment')) return 'Enchantments'
  if (typeLine.includes('Artifact')) return 'Artifacts'
  if (typeLine.includes('Sorcery')) return 'Sorceries'
  if (typeLine.includes('Instant')) return 'Instants'
  if (typeLine.includes('Land')) return 'Lands'
  return 'Other'
}

export function basicLandPlan(
  identity: string[],
  demand: Record<ManaColour, number>,
  currentLands: number,
  targetLands: number,
  cardCount: number,
  existingSources: Partial<Record<ManaColour, number>> = {},
) {
  const count = Math.min(Math.max(0, 100 - cardCount), Math.max(0, targetLands - currentLands))
  if (!count) return []
  const legalColours = colours.filter((colour) => identity.includes(colour))
  if (!legalColours.length) return [{ name: 'Wastes', colour: 'C', count }]
  const totalDemand = legalColours.reduce((sum, colour) => sum + demand[colour], 0)
  const shares = legalColours.map((colour) =>
    totalDemand ? demand[colour] / totalDemand : 1 / legalColours.length,
  )
  // Split by the sources each colour still lacks once the finished mana base has its share,
  // so colours already covered by duals and fixing get fewer basics.
  const deficits = legalColours.map((colour, index) =>
    Math.max(0, shares[index] * (currentLands + count) - (existingSources[colour] ?? 0)),
  )
  const totalDeficit = deficits.reduce((sum, value) => sum + value, 0)
  const weights = totalDeficit ? deficits.map((value) => value / totalDeficit) : shares
  const base = weights.map((weight) => Math.floor(weight * count))
  let remainder = count - base.reduce((sum, value) => sum + value, 0)
  const order = legalColours
    .map((_, index) => index)
    .sort((a, b) => weights[b] * count - base[b] - (weights[a] * count - base[a]))
  for (const index of order) if (remainder-- > 0) base[index]++
  return legalColours.flatMap((colour, index) =>
    base[index] ? [{ name: basicLandNames[colour], colour, count: base[index] }] : [],
  )
}

// Promote the land fill once most non-land slots are taken (55 of 65 with a 35-land target).
export const landFillReady = (cardCount: number, landCount: number, landTarget: number) =>
  cardCount - landCount >= 100 - landTarget - 10

export function nonbasicLandSuggestions<T extends AnalysisCard>(
  candidates: T[],
  ownedNames: string[],
  limit: number,
) {
  return candidates
    .filter(
      (card) =>
        rolesForCard(card).includes('lands') &&
        !/\bBasic\b/.test(card.typeLine) &&
        !isBasicLandName(card.name) &&
        !ownedNames.includes(card.name),
    )
    .slice(0, Math.max(0, limit))
}

export function deckRoleBoosts(cardCount: number, counts: DeckTargets, targets: DeckTargets) {
  const urgency = cardCount >= 85 ? 3 : cardCount >= 70 ? 2 : 1
  return Object.fromEntries(
    targetKeys.map((key) => {
      const manaRole = key === 'lands' || key === 'ramp'
      const multiplier = manaRole ? 1.5 : 1
      const limit = manaRole ? 24 : 18
      const boost = targets[key]
        ? Math.ceil(
            (Math.max(0, targets[key] - counts[key]) / targets[key]) * 6 * urgency * multiplier,
          )
        : 0
      return [key, Math.min(limit, boost)]
    }),
  ) as DeckTargets
}

export function deckGuidance(cardCount: number, counts: DeckTargets, targets: DeckTargets) {
  if (cardCount < 70) return []
  const remaining = Math.max(0, 100 - cardCount)
  const gaps = Object.fromEntries(
    targetKeys.map((key) => [key, Math.max(0, targets[key] - counts[key])]),
  ) as DeckTargets
  const totalGap = targetKeys.reduce((sum, key) => sum + gaps[key], 0)
  let slotsShown = false
  return targetKeys.flatMap((key) => {
    const gap = gaps[key]
    if (!gap) return []
    const strong = cardCount >= 85 && totalGap > Math.max(0, remaining - 2)
    const slots = strong && !slotsShown ? ` with ${remaining} slots left` : ''
    if (strong) slotsShown = true
    return [{ key, strong, text: `${targetLabels[key]}: ${gap} short of target${slots}.` }]
  })
}
