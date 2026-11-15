import { basicLandNames, type AnalysisCard } from '../deck-analysis.ts'
import {
  creatureTypeForTheme,
  creatureTypeTags,
  everyCreatureTypePattern,
  hasTag,
} from './creature-types.ts'
import { opposingAnswerEvidence } from './opposing-strategies.ts'
import { shortQuote, themeMatchers } from './recommendation-themes.ts'

/**
 * What a nonbasic land can do for a deck (#588). A land can have several roles. Entering tapped
 * and costing life are drawbacks, not roles. Detection is a text heuristic: a match shows the
 * wording that fired, never proof the land does that job well (docs/domain/heuristics.md).
 */
export const landRoleNames = [
  'fixing',
  'utility',
  'creature-land',
  'flexible',
  'land-synergy',
  'theme',
  'interaction',
  'colourless-utility',
] as const
export type LandRole = (typeof landRoleNames)[number]

/**
 * Roles every deck can use. Creature-land needs no deck evidence either, so it is core too. The
 * rest are earned: they apply only when the deck shows it cares (`deckLandRoles`).
 */
export const coreLandRoles: readonly LandRole[] = [
  'fixing',
  'utility',
  'creature-land',
  'flexible',
  'interaction',
  'colourless-utility',
]
export const earnedLandRoles: readonly LandRole[] = ['land-synergy', 'theme']

/**
 * What an earned role match needs the deck to care about: `lands-matter` (landfall, land
 * sacrifice and land recursion), a nonbasic land type such as `Gate`, `Snow`, a theme name
 * (`Artifacts`, `Graveyard`, `Counters`, `Spellslinger`) or a creature-type theme (`Elves`).
 * `Chosen type` marks a land that names a creature type you choose, so any creature-type
 * focus earns it.
 */
export type LandFocus = string
export const landsMatterFocus = 'lands-matter'
export const chosenTypeFocus = 'Chosen type'
export const snowFocus = 'Snow'

export type LandRoleMatch = {
  role: LandRole
  /** The rules-text sentence or type line that matched, shortened for display. */
  evidence: string
  source: 'rules' | 'type' | 'override'
  /** Set on earned roles only. */
  focus?: LandFocus
}

/**
 * Rule, CR 205.3i, Comprehensive Rules effective 2026-11-06, checked 2026-11-14 in
 * mtg-knowledge-base knowledge/topics/commander/rules.md ("Land types"). Scryfall `type_line`
 * spells Urza's with a straight apostrophe. Scryfall's land-types catalog also lists Cloud, from
 * a playtest card that is not a rules land type, so it is left out. Recheck when a new
 * Comprehensive Rules file is published.
 */
export const nonbasicLandTypes = [
  'Cave',
  'Desert',
  'Gate',
  'Lair',
  'Locus',
  'Mine',
  'Planet',
  'Power-Plant',
  'Sphere',
  'Tower',
  'Town',
  "Urza's",
] as const

/** Card fields the detector reads. Face text is optional, as on `AnalysisCard`. */
export type LandRoleCard = Omit<AnalysisCard, 'faces'> & {
  faces: readonly { typeLine: string; manaCost: string; detail?: string }[]
}

type Override = { add?: Omit<LandRoleMatch, 'source'>[]; remove?: LandRole[] }

// Reviewed Oracle-ID corrections for wording the patterns miss or misread. Each entry names the
// card and the Oracle text checked against Scryfall Oracle bulk data 2026-11-04 (checked
// 2026-11-14). Overrides add or remove roles; they never widen the patterns.
const landRoleOverrides: Record<string, Override> = {
  // Urborg, Tomb of Yawgmoth: "Each land is a Swamp in addition to its other land types." A static
  // ability, which the activated and triggered patterns skip.
  'db6174d7-211d-4817-b8e4-8384594c83f9': {
    add: [
      { role: 'utility', evidence: 'Each land is a Swamp in addition to its other land types.' },
    ],
  },
  // Yavimaya, Cradle of Growth: "Each land is a Forest in addition to its other land types."
  '8dd5f5af-d2d8-4356-8617-8381081b930c': {
    add: [
      { role: 'utility', evidence: 'Each land is a Forest in addition to its other land types.' },
    ],
  },
  // Reliquary Tower: "You have no maximum hand size." Static, and it makes only {C}.
  'c23e5b80-08d2-4e24-9908-fe2aa4f30f6f': {
    add: [
      { role: 'utility', evidence: 'You have no maximum hand size.' },
      { role: 'colourless-utility', evidence: 'You have no maximum hand size.' },
    ],
  },
  // The Tabernacle at Pendrell Vale: "All creatures have 'At the beginning of your upkeep, destroy
  // this creature unless you pay {1}.'" A static tax on every creature; it makes no mana.
  '69b409b3-fa16-4c79-8b46-215a7036ed46': {
    add: [
      { role: 'interaction', evidence: 'All creatures have an upkeep cost of {1}.' },
      { role: 'colourless-utility', evidence: 'All creatures have an upkeep cost of {1}.' },
    ],
  },
  // Path of Ancestry: its mana rewards "a creature spell that shares a creature type with your
  // commander", which the creature-type patterns cannot name.
  'b473e293-59e3-4e04-acf2-622604aeb25f': {
    add: [
      {
        role: 'theme',
        focus: 'Chosen type',
        evidence: 'When that mana is spent to cast a creature spell that shares a creature type…',
      },
    ],
  },
  // Nykthos, Shrine to Nyx: Scryfall `produced_mana` lists every colour, but it adds mana of one
  // chosen colour equal to devotion. That is big mana, not fixing.
  '84dc18f0-8225-4b40-a165-b10321e41769': { remove: ['fixing'] },
}

const colourSymbols = ['W', 'U', 'B', 'R', 'G'] as const
const typeColour = new Map(Object.entries(basicLandNames).map(([colour, type]) => [type, colour]))
const basicTypePattern = new RegExp(`\\b(?:${[...typeColour.keys()].join('|')})\\b`, 'g')
const hasBasicType = new RegExp(basicTypePattern.source)
const isLandLine = (typeLine: string) => /\bLand\b/.test(typeLine)

/** The land face's type line and rules text, with the card's own name read as "this land". */
function landFace(card: LandRoleCard) {
  const face =
    card.layout === 'modal_dfc'
      ? card.faces.find((candidate) => isLandLine(candidate.typeLine))
      : card.faces[0]
  const typeLine = face?.typeLine || card.typeLine.split(' // ', 1)[0]
  const text = face?.detail ?? card.detail
  const name = card.name.split(' // ', 1)[0]
  const names = [...new Set([name, name.split(',', 1)[0]])].filter((value) => value.length > 2)
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean)
    .map((original) => ({
      original,
      text: names.reduce((line, value) => line.replaceAll(value, 'this land'), original),
    }))
  return { typeLine, lines }
}

type Line = ReturnType<typeof landFace>['lines'][number]

/** Splits an activated ability into cost and effect; undefined for other lines. */
function activated(line: string) {
  if (/^(?:when(?:ever)?|at)\b/i.test(line)) return undefined
  const colon = line.indexOf(':')
  if (colon < 0) return undefined
  const cost = line.slice(0, colon)
  if (cost.includes('.') || cost.length > 120) return undefined
  return { cost, effect: line.slice(colon + 1).trim() }
}
const isManaEffect = (effect: string) => /^(?:choose a colou?r\. )?add\b/i.test(effect)
const isTrigger = (line: string) => /^(?:when(?:ever)?|at the beginning)\b/i.test(line)

const fetchPattern = /search your library for ([^.]*)/i
const sacrificeSelf = /\bsacrifice this land\b/i
const bounce =
  /\breturn (?:an?|target|one) (?:untapped )?(?:[\w-]+ )?(?:lands?|Plains|Island|Swamp|Mountain|Forest) you control to (?:its|their) owner'?s'? hand/i
const landRecursion =
  /\b(?:return|put) (?:up to \w+ )?(?:target |a |an |all )?land cards? (?:[^.]*)?from (?:your|a) graveyard|\bplay lands from your graveyard/i
const animates = /\bthis land becomes (?:an? )?[^.]*\bcreature\b/i
const flexibleKeyword = /^(?:[\w-]+ )*?(?:cycling|landcycling)\b|^(?:channel|transmute|morph)\b/i
const landDestruction =
  /\bdestroy (?:target|all|each) (?:nonbasic |artifact or |nontoken )?lands?\b|\b(?:each|target) (?:player|opponent) sacrifices? (?:an? )?(?:nonbasic )?land\b|\btap target (?:nonbasic )?land\b/i
const stax =
  /\b(?:players|opponents|your opponents|each player|each opponent|(?:creatures|lands|permanents|artifacts) (?:your )?opponents control)\b[^.]*\b(?:can't|enter (?:the battlefield )?tapped|don't untap|cost \{\d+\} more)/i
// Minor riders on taplands; a deck gains little from them, so they are not a utility role.
const minorEffect =
  /^(?:you gain \d+ life|scry \d+|surveil \d+|you get \{E\}|it deals 1 damage to target (?:opponent|player)(?: or planeswalker)?|target player loses 1 life)\.?$/i
// Triggered drawbacks and upkeep bookkeeping, such as karoo and depletion lands.
const drawbackEffect =
  /\bdeals? \d+ damage to you\b|\byou lose \d+ life\b|\bsacrifice (?:it|this land|an? (?:untapped )?(?:[\w-]+ )?land|two (?:untapped )?lands)\b|\bgains control of this land\b|\b(?:storage|depletion|age) counters?\b/i
const triggerEffect = (line: string) => line.replace(/^[^,]*,\s*/, '')
const enteringRule =
  /\benters? (?:the battlefield )?tapped\b|^as this land enters\b|^if this land would enter\b|^this land enters\b|\bsacrifice it unless\b/i
const multiMana = /\badd (?:\{C\}){2,}|\badd \{C\} for each\b|\badd x\b|\badd an amount\b/i
const typalChoice = /\bchoose a creature type\b/i
// "Put into a graveyard from the battlefield" is a death trigger, not graveyard use.
const graveyardDeath =
  /\bput into a graveyard from the battlefield\b|\bput (?:it|this land) into (?:its owner's|your) graveyard\b/i
const graveyardMatters =
  /\bgraveyard\b|\bdredge\b|\bflashback\b|\bmill\b|\bsurveil\b|\bunearth\b|\bdelve\b/i
const countersMatter = /\+1\/\+1 counters?\b|\bproliferate\b|^graft\b/i
const spellsMatter =
  /\binstant (?:or|and) sorcery\b|\bnoncreature spells?\b|\bwhenever you cast\b|\binstant or sorcery spells?\b/i
const artifactsMatter = /\bartifacts? (?:you control|cards?|spells?)\b|\bTreasure\b/

const isColour = (symbol: string) => (colourSymbols as readonly string[]).includes(symbol)
const fetchTarget = (text: string) => {
  const target = text.match(fetchPattern)?.[1]
  return target && /\bland\b|\b(?:Plains|Island|Swamp|Mountain|Forest)\b/.test(target)
    ? target
    : undefined
}

/** The rules line that best shows a colour the land adds. */
function manaLineFor(colour: string, lines: Line[]) {
  const manaLines = lines.filter((line) => /\badd\b/i.test(line.text))
  return (
    manaLines.find((candidate) => candidate.text.includes(`{${colour}}`)) ??
    manaLines.find((candidate) => /\bmana of any\b|\bany colou?r\b/i.test(candidate.text)) ??
    manaLines[0]
  )
}

/** Colours a fetch line can find: named basic land types, or any basic. */
function fetchedColours(target: string): readonly string[] {
  const named = [...target.matchAll(basicTypePattern)].map(([type]) => typeColour.get(type)!)
  if (named.length) return named
  return /\bbasic land\b|\bland card\b(?! with)|land cards? with a basic land type/i.test(target)
    ? colourSymbols
    : []
}

/** Colours in `identity` the land makes or fetches, with the first evidence for each. */
function fixingEvidence(card: LandRoleCard, typeLine: string, lines: Line[], identity: string[]) {
  const colours = new Map<string, LandRoleMatch>()
  const note = (colour: string, evidence: string, source: LandRoleMatch['source']) => {
    if (identity.includes(colour) && !colours.has(colour))
      colours.set(colour, { role: 'fixing', evidence: shortQuote(evidence), source })
  }
  for (const colour of card.producedMana.filter(isColour)) {
    const line = manaLineFor(colour, lines)
    note(colour, line?.original ?? typeLine, line ? 'rules' : 'type')
  }
  // CR 305.6: a basic land type grants its mana ability without printed text.
  for (const [type] of typeLine.matchAll(basicTypePattern))
    note(typeColour.get(type)!, typeLine, 'type')
  for (const line of lines) {
    const target = fetchTarget(line.text)
    if (target) for (const colour of fetchedColours(target)) note(colour, line.original, 'rules')
  }
  return colours
}

const match = (
  role: LandRole,
  evidence: string,
  source: LandRoleMatch['source'] = 'rules',
  focus?: LandFocus,
): LandRoleMatch => ({ role, evidence: shortQuote(evidence), source, ...(focus ? { focus } : {}) })

/** Roles read from the type line and layout alone. */
function typeLineRoles(card: LandRoleCard, typeLine: string): LandRoleMatch[] {
  const back = card.layout === 'transform' ? card.faces[1]?.typeLine : undefined
  const spell =
    card.layout === 'modal_dfc' ? card.faces.find((face) => !isLandLine(face.typeLine)) : undefined
  const types = typeLine.replace('’', "'").split(/[\s—]+/)
  return [
    ...[typeLine, back ?? '']
      .filter((line) => /\bCreature\b/.test(line))
      .map((line) => match('creature-land', line, 'type')),
    ...(spell ? [match('flexible', spell.typeLine, 'type')] : []),
    ...nonbasicLandTypes
      .filter((subtype) => types.includes(subtype))
      .map((subtype) => match('land-synergy', typeLine, 'type', subtype)),
    ...(types.includes('Artifact') ? [match('theme', typeLine, 'type', 'Artifacts')] : []),
    ...(types.includes('Snow') ? [match('theme', typeLine, 'type', snowFocus)] : []),
  ]
}

/** Land-synergy clues: fetching onto the battlefield, sacrificing itself, bounce and recursion. */
function synergyClue(text: string, cost: string, effect: string) {
  const target = fetchTarget(text)
  if (target && (/onto the battlefield/i.test(text) || sacrificeSelf.test(text))) return true
  return (
    sacrificeSelf.test(cost) ||
    sacrificeSelf.test(effect) ||
    bounce.test(text) ||
    landRecursion.test(text)
  )
}

/** Whether a triggered ability is only a minor rider or a drawback, so not a utility role. */
const minorTriggerEffect = (trigger: string) =>
  minorEffect.test(trigger) || drawbackEffect.test(trigger)

/** Earned theme focuses a rules line names. */
function themeFocuses(text: string, { hate, entering }: { hate: boolean; entering: boolean }) {
  // A choose-a-creature-type land suits any typal deck. Changeling text is left out, as
  // every-type lands are not theme picks (#174).
  let typal: string[] = []
  if (typalChoice.test(text)) typal = [chosenTypeFocus]
  else if (!everyCreatureTypePattern.test(text))
    typal = creatureTypeTags(text.replaceAll('Power-Plant', ''))
  const graveyard = !hate && !entering && !graveyardDeath.test(text) && graveyardMatters.test(text)
  return [
    ...typal,
    ...(graveyard ? ['Graveyard'] : []),
    ...(countersMatter.test(text) ? ['Counters'] : []),
    ...(spellsMatter.test(text) ? ['Spellslinger'] : []),
    ...(artifactsMatter.test(text) ? ['Artifacts'] : []),
    ...(/\bsnow\b/i.test(text) ? [snowFocus] : []),
  ]
}

/** Roles one rules line reads as. */
function lineRoles({ text, original }: Line, card: LandRoleCard): LandRoleMatch[] {
  const ability = activated(text)
  const effect = ability?.effect ?? text
  const isMana = ability !== undefined && isManaEffect(ability.effect)
  const trigger = isTrigger(text) ? triggerEffect(text) : undefined
  const hate =
    !!opposingAnswerEvidence({ detail: text }, 'graveyard') ||
    landDestruction.test(effect) ||
    stax.test(effect)
  const roles: LandRole[] = []
  if (flexibleKeyword.test(text)) roles.push('flexible')
  if (animates.test(text)) roles.push('creature-land')
  if (hate) roles.push('interaction')
  if (isMana && multiMana.test(effect) && card.producedMana.every((symbol) => symbol === 'C'))
    roles.push('colourless-utility')
  // Lines read as another role, fetches, bounce and recursion are not utility as well.
  const claimed =
    isMana ||
    roles.length > 0 ||
    fetchTarget(text) !== undefined ||
    bounce.test(text) ||
    landRecursion.test(text)
  const usable = ability !== undefined || (trigger !== undefined && !minorTriggerEffect(trigger))
  if (!claimed && usable) roles.push('utility')

  const entering = !ability && trigger === undefined && enteringRule.test(text)
  return [
    ...roles.map((role) => match(role, original)),
    ...(synergyClue(text, ability?.cost ?? '', effect)
      ? [match('land-synergy', original, 'rules', landsMatterFocus)]
      : []),
    ...themeFocuses(text, { hate, entering }).map((focus) =>
      match('theme', original, 'rules', focus),
    ),
    ...nonbasicLandTypes
      .filter((subtype) => subtypePattern(subtype).test(text))
      .map((subtype) => match('land-synergy', original, 'rules', subtype)),
  ]
}

/** Colourless utility: no coloured mana, but another role gives the slot a purpose. */
function colourlessUtility(card: LandRoleCard, typeLine: string, found: LandRoleMatch[]) {
  if (card.producedMana.some(isColour) || hasBasicType.test(typeLine)) return []
  const reason = found.find((m) => ['utility', 'interaction', 'creature-land'].includes(m.role))
  return reason ? [{ ...reason, role: 'colourless-utility' as const }] : []
}

function applyOverride(card: LandRoleCard, found: LandRoleMatch[]) {
  const override = card.oracleId ? landRoleOverrides[card.oracleId] : undefined
  if (!override) return found
  return [
    ...found.filter((m) => !override.remove?.includes(m.role)),
    ...(override.add ?? []).map((m) => ({ ...m, source: 'override' as const })),
  ]
}

/** First match per role and focus, in detection order. */
const unique = (matches: LandRoleMatch[]) =>
  matches.filter(
    (m, index) =>
      matches.findIndex((other) => other.role === m.role && other.focus === m.focus) === index,
  )

/**
 * Every role a nonbasic land's Oracle text and type line read as, each with the words that
 * matched. `identity` is the commander's colour identity; fixing needs two or more of its colours.
 * Basic lands and nonland cards return none.
 */
export function detectLandRoles(card: LandRoleCard, identity: readonly string[]): LandRoleMatch[] {
  const { typeLine, lines } = landFace(card)
  if (!isLandLine(typeLine) || /\bBasic\b/.test(typeLine)) return []
  const fixing = [...fixingEvidence(card, typeLine, lines, [...identity]).values()]
  const found = unique([
    ...(fixing.length >= 2 ? [fixing[0]] : []),
    ...typeLineRoles(card, typeLine),
    ...lines.flatMap((line) => lineRoles(line, card)),
  ])
  return applyOverride(card, unique([...found, ...colourlessUtility(card, typeLine, found)]))
}

const subtypePatterns = new Map<string, RegExp>()
/** A capitalised land type in rules text: "Gate", "Gates", "Desert card", "Urza's Tower". */
function subtypePattern(subtype: string) {
  let pattern = subtypePatterns.get(subtype)
  if (!pattern) {
    const word = subtype.replace("'", "['’]")
    pattern = new RegExp(`(?<![\\w-])${word}(?:s)?(?![\\w-])`)
    subtypePatterns.set(subtype, pattern)
  }
  return pattern
}

/** Why a deck earned a role focus. */
export type LandRoleEvidence =
  | { source: 'theme'; theme: string }
  | { source: 'commander'; commander: string; quote: string }
  | { source: 'deck'; count: number; examples: string[] }

export type DeckLandRole = {
  role: LandRole
  /**
   * Relative importance for later ranking (#589): 1 for most roles; fixing scales with colour
   * count, 0 for mono-coloured and colourless decks. An ordering heuristic, not a probability.
   */
  weight: number
  /** For earned roles, each focus the deck earned and the evidence for it. Empty for core roles. */
  focuses: { focus: LandFocus; evidence: LandRoleEvidence[] }[]
}

type DeckCard = { name: string; typeLine: string; detail: string; tags: string[] }
type Commander = { name: string; detail: string }

/** Deck-card evidence threshold, matching sub-theme inference (heuristics.md). */
export const landRoleDeckThreshold = 3

const focusThemes: Record<string, readonly string[]> = {
  [landsMatterFocus]: ['Landfall'],
  Artifacts: ['Artifacts'],
  Graveyard: ['Graveyard', 'Recursion', 'Mill'],
  Counters: ['Counters', '+1/+1 counters'],
  Spellslinger: ['Spellslinger', 'Spell copying'],
}
const landsMatterText =
  /\blandfall\b|whenever (?:a|one or more) lands? (?:you control )?enters?|play an additional land|land cards? (?:are put into|from|in) your graveyard|sacrifice (?:a|another) land/i
const snowText = /\bsnow\b|\{S\}/i

/** Sentences of rules text, reminder text removed. */
const sentencesOf = (detail: string) =>
  detail
    .split('\n')
    .flatMap((line) => line.replace(/\s*\([^)]*\)/g, '').split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.trim())
    .filter(Boolean)

/** Text-only test for a focus, used on commander text and on tagless deck evidence. */
function focusText(focus: LandFocus): RegExp | undefined {
  if (focus === landsMatterFocus) return landsMatterText
  if (focus === snowFocus) return snowText
  if ((nonbasicLandTypes as readonly string[]).includes(focus)) return subtypePattern(focus)
  const type = creatureTypeForTheme(focus)
  if (type) return new RegExp(`\\b(?:${type}|${focus})\\b`)
  return themeMatchers.find(([name]) => name === focus)?.[1]
}
const withoutName = (card: { name: string; detail: string }) =>
  card.detail.replaceAll(card.name.split(' // ', 1)[0], 'this card')
const isLandCard = (card: DeckCard) => isLandLine(card.typeLine.split(' // ', 1)[0])

/**
 * Whether 3+ noncommander main-deck cards show a focus. Theme focuses use `hasTag` on nonland
 * cards. Snow and land types have no theme tag, so they read text instead: nonland cards for snow,
 * and any card for a land type, since Gate and Locus payoffs are often lands themselves.
 */
function deckEvidence(focus: LandFocus, cards: DeckCard[]): LandRoleEvidence[] | undefined {
  const themes = focusThemes[focus] ?? (creatureTypeForTheme(focus) ? [focus] : [])
  const isSubtype = (nonbasicLandTypes as readonly string[]).includes(focus)
  const pattern = focusText(focus)
  const matching = cards.filter((card) =>
    themes.length
      ? !isLandCard(card) && themes.some((theme) => hasTag(card, theme))
      : (isSubtype || !isLandCard(card)) && !!pattern?.test(withoutName(card)),
  )
  const names = [...new Set(matching.map((card) => card.name))]
  return matching.length >= landRoleDeckThreshold
    ? [{ source: 'deck', count: matching.length, examples: names.slice(0, 3) }]
    : undefined
}

/** Creature-type themes worth checking: selected, named by a commander, or tagged in the deck. */
function creatureThemeCandidates(
  themes: readonly string[],
  commanders: readonly Commander[],
  cards: DeckCard[],
) {
  return new Set([
    ...themes.filter((theme) => creatureTypeForTheme(theme)),
    ...commanders.flatMap((commander) => creatureTypeTags(withoutName(commander))),
    ...cards
      .filter((card) => !isLandCard(card))
      .flatMap((card) => card.tags.filter((tag) => creatureTypeForTheme(tag))),
  ])
}

/** The evidence a deck has for one focus, or none. */
function earnFocus(
  focus: LandFocus,
  themes: readonly string[],
  commanders: readonly Commander[],
  cards: DeckCard[],
) {
  const mapped = focusThemes[focus] ?? (creatureTypeForTheme(focus) ? [focus] : [])
  const pattern = focusText(focus)
  const evidence: LandRoleEvidence[] = [
    ...themes
      .filter((theme) => mapped.includes(theme))
      .map((theme) => ({ source: 'theme' as const, theme })),
    ...commanders.flatMap((commander) => {
      const quote = pattern && sentencesOf(withoutName(commander)).find((s) => pattern.test(s))
      return quote
        ? [{ source: 'commander' as const, commander: commander.name, quote: shortQuote(quote) }]
        : []
    }),
    ...(deckEvidence(focus, cards) ?? []),
  ]
  return evidence.length ? [{ focus, evidence }] : []
}

/**
 * The land roles a deck uses (#588). Core roles always apply; fixing's weight grows with the
 * identity's colour count. Earned roles (land synergy, theme or keyword) apply only for a focus
 * the deck earned through a selected theme or extra theme, a commander's rules text, or 3+
 * noncommander main-deck cards (`landRoleDeckThreshold`). Each earned focus keeps its evidence.
 */
export function deckLandRoles({
  identity,
  themes,
  commanders,
  deck,
}: {
  identity: readonly string[]
  /** The selected theme and extra themes. */
  themes: readonly string[]
  commanders: readonly Commander[]
  /** Main-deck cards; any that are commanders are skipped, as commanders count separately. */
  deck: readonly DeckCard[]
}): DeckLandRole[] {
  const colours = colourSymbols.filter((colour) => identity.includes(colour)).length
  const commanderNames = new Set(commanders.map((card) => card.name))
  const cards = deck.filter((card) => !commanderNames.has(card.name))

  const creatureThemes = creatureThemeCandidates(themes, commanders, cards)
  const earn = (focus: LandFocus) => earnFocus(focus, themes, commanders, cards)
  const synergy = [landsMatterFocus, ...nonbasicLandTypes].flatMap(earn)
  const theme = [
    'Artifacts',
    'Graveyard',
    'Counters',
    'Spellslinger',
    snowFocus,
    ...creatureThemes,
  ].flatMap(earn)

  return [
    ...coreLandRoles.map((role) => ({
      role,
      weight: role === 'fixing' ? Math.max(0, colours - 1) / 4 : 1,
      focuses: [],
    })),
    ...(synergy.length ? [{ role: 'land-synergy' as const, weight: 1, focuses: synergy }] : []),
    ...(theme.length ? [{ role: 'theme' as const, weight: 1, focuses: theme }] : []),
  ]
}

/**
 * The matches a deck can use: core-role matches, and earned-role matches whose focus the deck
 * earned. A `Chosen type` land fits any earned creature-type focus.
 */
export function deckLandRoleMatches(
  matches: readonly LandRoleMatch[],
  roles: readonly DeckLandRole[],
): LandRoleMatch[] {
  return matches.filter((found) => {
    const role = roles.find((candidate) => candidate.role === found.role)
    if (!role) return false
    if (!found.focus) return true
    return role.focuses.some(
      ({ focus }) =>
        focus === found.focus ||
        (found.focus === chosenTypeFocus && creatureTypeForTheme(focus) !== undefined),
    )
  })
}
