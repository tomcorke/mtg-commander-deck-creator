import {
  analyseDeck,
  basicLandNames,
  basicLandPlan,
  cardFeatures,
  isBasicLandName,
  requiredPipsForCard,
  rolesForCard,
  type AnalysisCard,
  type ManaColour,
} from '../deck-analysis.ts'
import { cardPrice, exceedsDeckBudget } from './deck-price.ts'
import {
  deckLandRoleMatches,
  deckLandRoles,
  detectLandRoles,
  landsMatterFocus,
  chosenTypeFocus,
  type DeckLandRole,
  type LandFocus,
  type LandRole,
  type LandRoleCommander,
  type LandRoleEvidence,
  type LandRoleMatch,
} from './land-roles.ts'
import { creatureTypeForTheme } from './creature-types.ts'
import type { PowerTarget } from './recommendation-types.ts'
import { withinPriceCap } from './recommendation-tuning.ts'

/*
 * Role-aware land fill (#589). One pure planner serves Choose lands and Build a starting deck, so
 * the two never disagree. Every number here is an app heuristic for #98 to check, not a solved or
 * optimal mana base (docs/domain/heuristics.md, "Basic-land plan").
 */

/** Most nonbasic lands a finished deck holds, by identity colour count: mono 6, two 10, 3+ 15. */
export function nonbasicLandCap(colours: number) {
  return colours >= 3 ? 15 : colours === 2 ? 10 : 6
}
/** Basics kept for each basic-fetching card (Cultivate, Rampant Growth, Evolving Wilds). */
export const basicReservePerFetcher = 2
/** Basics kept for each identity colour, whatever the fetchers. */
export const basicReservePerColour = 1
/**
 * How Power tolerates lands that always enter tapped: a score penalty against a role worth 1, and
 * the most such nonbasics the deck may hold. Core is tolerant, Upgraded moderate, High strict.
 */
export const tappedTolerance: Record<PowerTarget, { penalty: number; cap: number }> = {
  precon: { penalty: 0.1, cap: 8 },
  upgraded: { penalty: 0.3, cap: 4 },
  high: { penalty: 0.6, cap: 1 },
}
/** Lands that enter tapped only sometimes (shocks, checklands) keep a small fixed penalty. */
export const conditionalTappedPenalty = 0.15
/** Lands that cost life to use. */
export const lifePenalty = 0.1
/**
 * Most nonbasics that make no identity colour, by identity colour count. Each one replaces a
 * coloured source, so the cap falls as colours rise; a deck's own {C} costs add their source gap.
 * A colourless identity has no limit.
 */
export const colourlessOnlyLandLimit = [Infinity, 3, 2, 1, 1, 1] as const
/** Unselected options the plan lists after its picks. */
export const landPlanAlternatives = 6

const colours = ['W', 'U', 'B', 'R', 'G'] as const
const sourceSymbols = [...colours, 'C'] as const
type SourceSymbol = (typeof sourceSymbols)[number]
const colourNames: Record<SourceSymbol, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
  C: 'colourless',
}
const typeColour = Object.fromEntries(
  Object.entries(basicLandNames).map(([colour, name]) => [name, colour]),
) as Record<string, ManaColour>
const basicTypes = Object.keys(typeColour)
const typesIn = (text: string) =>
  basicTypes.filter((type) => new RegExp(`\\b${type}\\b`).test(text))
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : (items[0] ?? '')
const withoutReminders = (text: string) => text.replace(/\([^)]*\)/g, '')

const isLandCard = (card: AnalysisCard) => rolesForCard(card).includes('lands')
const isBasicLand = (card: AnalysisCard) =>
  /\bBasic\b/.test(card.typeLine) || isBasicLandName(card.name)

/** `always`, `conditional` (shocks, checklands, pay-or-tapped) or null. A text heuristic. */
export function entersTapped(card: AnalysisCard): 'always' | 'conditional' | null {
  const text = card.detail
  if (
    /enters (?:the battlefield )?tapped unless|you may pay [^.]*\. if you don['’]t, it enters/i.test(
      text,
    )
  )
    return 'conditional'
  return /enters (?:the battlefield )?tapped/i.test(text) ? 'always' : null
}

/** The drawbacks the plan shows beside a land, as short sentences. */
export function landDrawbacks(card: AnalysisCard) {
  const tapped = entersTapped(card)
  return [
    tapped === 'always' && 'Always enters tapped',
    tapped === 'conditional' && 'Enters tapped unless its condition is met',
    /pay \d+ life|deals \d+ damage to you/i.test(card.detail) && 'Costs life to use',
    card.layout === 'modal_dfc' && 'Each copy is a land or a spell, not both',
  ].filter((note): note is string => Boolean(note))
}

/**
 * Colours a land adds for this deck: identity colours and {C} it produces, its basic land types,
 * and the basic types it fetches that the identity allows or the deck already holds.
 */
export function landColours(card: AnalysisCard, deck: AnalysisCard[], identity: string[]) {
  const fetched = typesIn(card.detail.match(/search your library for ([^.]*)/i)?.[1] ?? '').filter(
    (type) =>
      identity.includes(typeColour[type]) || deck.some((land) => land.typeLine.includes(type)),
  )
  return [
    ...new Set([
      ...card.producedMana.filter((symbol) => symbol === 'C' || identity.includes(symbol)),
      ...typesIn(card.typeLine.split(' // ').at(-1) ?? '')
        .map((type) => typeColour[type])
        .filter((colour) => identity.includes(colour)),
      ...fetched.map((type) => typeColour[type]),
    ]),
  ] as SourceSymbol[]
}

const basicSearch = new RegExp(
  `search your library for [^.]*\\b(?:basic|${basicTypes.join('|')})\\b`,
  'i',
)
/**
 * A card whose search finds basic lands: a land, or a nonland card `cardFeatures` reads as
 * land-ramp or land-to-hand, whose search names basic lands or basic land types.
 */
export function fetchesBasics(card: AnalysisCard) {
  if (isBasicLand(card) || !basicSearch.test(withoutReminders(card.detail))) return false
  if (isLandCard(card)) return true
  const { mana } = cardFeatures(card)
  return mana === 'land-ramp' || mana === 'land-to-hand'
}

/**
 * Sources each symbol still lacks, from land sources only, as raw counts and scaled so the largest
 * gap is 1. Pips on cards of mana value 3 or less count double, so early colour needs come first.
 */
export function sourceGaps(deck: AnalysisCard[], landTarget: number) {
  const produced = analyseDeck(deck.filter(isLandCard)).produced
  const demand = Object.fromEntries(
    sourceSymbols.map((symbol) => [
      symbol,
      deck.reduce(
        (sum, card) => sum + requiredPipsForCard(card, symbol) * (card.manaValue <= 3 ? 2 : 1),
        0,
      ),
    ]),
  ) as Record<SourceSymbol, number>
  const total = sourceSymbols.reduce((sum, symbol) => sum + demand[symbol], 0)
  const raw = Object.fromEntries(
    sourceSymbols.map((symbol) => [
      symbol,
      total ? Math.max(0, Math.round((demand[symbol] / total) * landTarget) - produced[symbol]) : 0,
    ]),
  ) as Record<SourceSymbol, number>
  const largest = Math.max(0, ...Object.values(raw))
  const scaled = Object.fromEntries(
    sourceSymbols.map((symbol) => [symbol, largest ? raw[symbol] / largest : 0]),
  ) as Record<SourceSymbol, number>
  return { raw, scaled }
}

export type LandPlanStep = 'fixing' | 'earned' | 'utility'

export type LandPlanPick<T> = {
  card: T
  /** The fill step that chose it, which is also its group in the dialog. */
  step: LandPlanStep
  /** The role it was planned for, and the matched line. */
  role: LandRole
  focus?: LandFocus
  match: LandRoleMatch
  /** Why the deck earned the role; empty for core roles. */
  deckEvidence: LandRoleEvidence[]
  /** Every role this deck can use from the land. */
  roles: LandRole[]
  /** Colours it adds that the deck still lacked when planned (fixing only). */
  helps: SourceSymbol[]
  drawbacks: string[]
  score: number
  overBudget: boolean
  /** Why an alternative was left out; unset on picks. */
  held?: LandPlanHold
}

/**
 * `budget`: it would break the deck budget; `room`: the nonbasic cap or basic reserve is full;
 * `tapped`: Power's always-tapped limit is reached; `colourless`: the colourless-only limit is
 * reached; `basic`: a basic fills the colours it would add as well.
 */
export type LandPlanHold = 'budget' | 'room' | 'tapped' | 'colourless' | 'basic'

export const landPlanHoldLabels: Record<LandPlanHold, string> = {
  budget: 'Over budget',
  room: 'Over the nonbasic limit',
  tapped: 'Tapped-land limit reached',
  colourless: 'Colourless-land limit reached',
  basic: 'A basic does as well',
}

export type BasicLandCount = { name: string; colour: string; count: number }

export type LandPlan<T> = {
  /** Lands still to add toward the target. */
  landSlots: number
  /** Nonbasic cap for the identity and the slots it allows after existing nonbasics. */
  cap: number
  room: number
  /** Basics the deck keeps for colours and basic-fetching cards, and how many fetchers it has. */
  reserve: number
  fetchers: number
  /** Planned nonbasics in fill order. */
  picks: LandPlanPick<T>[]
  /** Usable lands the plan left out (cap, tapped limit, budget or a basic is as good). */
  alternatives: LandPlanPick<T>[]
  /** Basics for the slots the picks leave. */
  basics: BasicLandCount[]
}

export type LandPlanInput<T> = {
  /** The main deck, commanders included. */
  deck: AnalysisCard[]
  commanders: LandRoleCommander[]
  /** Selected theme and extra themes. */
  themes: string[]
  identity: string[]
  landTarget: number
  power: PowerTarget
  /**
   * Lands the plan may choose from. Callers apply their own construction and preference filters;
   * #590 can widen the pool without changing the planner.
   */
  candidates: T[]
  maxPrice?: number | null
  /** Deck budget left before any land is added; null without a budget. */
  remainingBudget?: number | null
  /** Price kept back for each deck slot still empty after a pick, so basics can fill it. */
  basicPrice?: number
}

type Candidate<T> = {
  card: T
  usable: LandRoleMatch[]
  roles: LandRole[]
  tapped: 'always' | 'conditional' | null
  penalty: number
  colourlessOnly: boolean
  fetcher: boolean
  inclusion: number
}

const fillOrder: Record<LandPlanStep, readonly LandRole[]> = {
  fixing: ['fixing'],
  earned: ['land-synergy', 'theme'],
  utility: ['utility', 'creature-land', 'flexible', 'interaction', 'colourless-utility'],
}

const roleWeight = (roles: readonly DeckLandRole[], role: LandRole) =>
  roles.find((entry) => entry.role === role)?.weight ?? 0

function earnedEvidence(roles: readonly DeckLandRole[], match: LandRoleMatch) {
  const role = roles.find((entry) => entry.role === match.role)
  return (
    role?.focuses.find(
      ({ focus }) =>
        focus === match.focus ||
        (match.focus === chosenTypeFocus && creatureTypeForTheme(focus) !== undefined),
    )?.evidence ?? []
  )
}

/** Count the deck's nonbasic lands that match a test. */
const nonbasicLands = (deck: AnalysisCard[], test: (card: AnalysisCard) => boolean = () => true) =>
  deck.filter((card) => isLandCard(card) && !isBasicLand(card) && test(card)).length

/**
 * Basics for the slots left once `chosen` lands join the deck: `basicLandPlan` split by colour
 * demand against land sources only (spells that make mana never crowd out a colour's basics), then
 * at least one basic for each identity colour the deck has none of, while slots allow.
 */
export function planBasics(
  deck: AnalysisCard[],
  identity: string[],
  landTarget: number,
  chosen: AnalysisCard[] = [],
): BasicLandCount[] {
  const filled = [...deck, ...chosen]
  const analysis = analyseDeck(filled)
  const plan = basicLandPlan(
    identity,
    analysis.required,
    analysis.counts.lands,
    landTarget,
    filled.length,
    analyseDeck(filled.filter(isLandCard)).produced,
  )
  const legal = colours.filter((colour) => identity.includes(colour))
  const missing = legal.filter(
    (colour) =>
      !plan.some((entry) => entry.colour === colour) &&
      !filled.some((card) => card.name === basicLandNames[colour]),
  )
  for (const colour of missing) {
    const largest = plan.reduce<BasicLandCount | undefined>(
      (best, entry) => (entry.count > 1 && (!best || entry.count > best.count) ? entry : best),
      undefined,
    )
    if (!largest) break
    largest.count -= 1
    plan.push({ name: basicLandNames[colour], colour, count: 1 })
  }
  return legal
    .flatMap((colour) => plan.filter((entry) => entry.colour === colour))
    .concat(plan.filter((entry) => !legal.includes(entry.colour as ManaColour)))
}

type PlanCard = AnalysisCard & { price?: string; inclusion?: number }

const holdOrder: LandPlanStep[] = ['fixing', 'earned', 'utility']
const byRank = <T extends PlanCard>(
  a: { candidate: Candidate<T>; score: number },
  b: { candidate: Candidate<T>; score: number },
) =>
  b.score - a.score ||
  b.candidate.inclusion - a.candidate.inclusion ||
  a.candidate.card.name.localeCompare(b.candidate.card.name)

/** One planning run: the deck's limits, the running picks and the options left out. */
class LandPlanner<T extends PlanCard> {
  readonly colourCount: number
  readonly deckRoles: DeckLandRole[]
  readonly landSlots: number
  readonly cap: number
  readonly capLeft: number
  readonly basicsHeld: number
  readonly fetchers: number
  readonly tolerance: { penalty: number; cap: number }
  readonly candidates: Candidate<T>[]
  readonly picks: LandPlanPick<T>[] = []
  readonly passed = new Map<string, LandPlanPick<T>>()
  remaining: number | null
  pickFetchers = 0
  tappedLeft: number
  colourlessLeft: number

  readonly input: LandPlanInput<T>

  constructor(input: LandPlanInput<T>) {
    this.input = input
    const { deck, identity, landTarget } = input
    this.colourCount = colours.filter((colour) => identity.includes(colour)).length
    this.deckRoles = deckLandRoles({
      identity,
      themes: input.themes,
      commanders: input.commanders,
      deck,
    })
    this.landSlots = Math.max(
      0,
      Math.min(100 - deck.length, landTarget - analyseDeck(deck).counts.lands),
    )
    this.cap = nonbasicLandCap(this.colourCount)
    this.capLeft = Math.max(0, this.cap - nonbasicLands(deck))
    this.basicsHeld = deck.filter((card) => isLandCard(card) && isBasicLand(card)).length
    this.fetchers = deck.filter(fetchesBasics).length
    this.tolerance = tappedTolerance[input.power]
    this.remaining = input.remainingBudget ?? null
    this.tappedLeft =
      this.tolerance.cap - nonbasicLands(deck, (card) => entersTapped(card) === 'always')
    this.colourlessLeft =
      colourlessOnlyLandLimit[this.colourCount] +
      sourceGaps(deck, landTarget).raw.C -
      nonbasicLands(deck, (card) => this.colourlessOnly(card))
    this.candidates = this.prepare()
  }

  colourlessOnly(card: AnalysisCard) {
    return (
      this.colourCount > 0 &&
      !landColours(card, this.input.deck, this.input.identity).some((symbol) => symbol !== 'C')
    )
  }

  reserveFor(extraFetchers: number) {
    return Math.max(
      this.colourCount * basicReservePerColour,
      (this.fetchers + extraFetchers) * basicReservePerFetcher,
    )
  }

  roomFor(extraFetchers: number) {
    const reserveLeft = Math.max(0, this.reserveFor(extraFetchers) - this.basicsHeld)
    return Math.max(0, Math.min(this.capLeft, this.landSlots - reserveLeft))
  }

  /** Unique nonbasic lands within the price cap that have a role this deck can use. */
  prepare() {
    const { deck, identity, maxPrice } = this.input
    const deckNames = new Set(deck.map(({ name }) => name))
    const prepared: Candidate<T>[] = []
    for (const card of this.input.candidates) {
      const skip =
        !isLandCard(card) ||
        isBasicLand(card) ||
        deckNames.has(card.name) ||
        prepared.some((other) => other.card.name === card.name) ||
        !withinPriceCap(card, maxPrice ?? null)
      const usable = skip
        ? []
        : deckLandRoleMatches(detectLandRoles(card, identity), this.deckRoles)
      if (usable.length) prepared.push(this.candidate(card, usable))
    }
    return prepared
  }

  candidate(card: T, usable: LandRoleMatch[]): Candidate<T> {
    const tapped = entersTapped(card)
    const tapPenalty =
      tapped === 'always'
        ? this.tolerance.penalty
        : tapped === 'conditional'
          ? conditionalTappedPenalty
          : 0
    return {
      card,
      usable,
      roles: [...new Set(usable.map(({ role }) => role))],
      tapped,
      penalty:
        tapPenalty + (/pay \d+ life|deals \d+ damage to you/i.test(card.detail) ? lifePenalty : 0),
      colourlessOnly: this.colourlessOnly(card),
      fetcher: fetchesBasics(card),
      inclusion: card.inclusion ?? 0,
    }
  }

  chosen() {
    return [...this.input.deck, ...this.picks.map(({ card }) => card)]
  }

  /** Whether the budget still covers the card and a basic for every slot after it. */
  fits(card: T) {
    const slotsAfter = Math.max(0, 99 - this.input.deck.length - this.picks.length)
    return !exceedsDeckBudget(
      card,
      this.remaining === null ? null : this.remaining - (this.input.basicPrice ?? 0) * slotsAfter,
    )
  }

  /** Summed role weights, without the roles named, less drawbacks. */
  roleScore(candidate: Candidate<T>, without: LandRole[] = []) {
    return (
      candidate.roles
        .filter((role) => !without.includes(role))
        .reduce((sum, role) => sum + roleWeight(this.deckRoles, role), 0) - candidate.penalty
    )
  }

  describe(
    candidate: Candidate<T>,
    step: LandPlanStep,
    score: number,
    helps: SourceSymbol[] = [],
  ): LandPlanPick<T> {
    const match =
      candidate.usable.find(({ role }) => fillOrder[step].includes(role)) ?? candidate.usable[0]
    return {
      card: candidate.card,
      step,
      role: match.role,
      focus: match.focus,
      match,
      deckEvidence: match.focus ? earnedEvidence(this.deckRoles, match) : [],
      roles: candidate.roles,
      helps,
      drawbacks: landDrawbacks(candidate.card),
      score: Math.round(score * 100) / 100,
      overBudget: false,
    }
  }

  taken(candidate: Candidate<T>) {
    return this.picks.some((pick) => pick.card.name === candidate.card.name)
  }

  /** Why a pick cannot be taken now, if a limit stops it. */
  holdFor(candidate: Candidate<T>): LandPlanHold | undefined {
    if (!this.fits(candidate.card)) return 'budget'
    if (this.picks.length + 1 > this.roomFor(this.pickFetchers + Number(candidate.fetcher)))
      return 'room'
    if (candidate.tapped === 'always' && this.tappedLeft <= 0) return 'tapped'
    if (candidate.colourlessOnly && this.colourlessLeft <= 0) return 'colourless'
    return undefined
  }

  /** Keep a left-out land as an option; a specific limit replaces "a basic does as well". */
  hold(pick: LandPlanPick<T>, held: LandPlanHold) {
    const known = this.passed.get(pick.card.name)
    if (!known || (known.held === 'basic' && held !== 'basic'))
      this.passed.set(pick.card.name, { ...pick, overBudget: held === 'budget', held })
  }

  /** Take a pick when every limit allows it; otherwise keep it as an option. */
  consider(candidate: Candidate<T>, pick: LandPlanPick<T>) {
    const held = this.holdFor(candidate)
    if (held) {
      this.hold(pick, held)
      return
    }
    this.passed.delete(candidate.card.name)
    this.picks.push(pick)
    const price = cardPrice(candidate.card)
    if (this.remaining !== null && price !== null) this.remaining -= price
    if (candidate.fetcher) this.pickFetchers += 1
    if (candidate.tapped === 'always') this.tappedLeft -= 1
    if (candidate.colourlessOnly) this.colourlessLeft -= 1
  }

  /** Fixing lands ranked against the colours still short of sources. */
  rankFixing(tried: Set<string>) {
    const { identity, landTarget } = this.input
    const { scaled } = sourceGaps(this.chosen(), landTarget)
    const basic = Math.max(0, ...identity.map((colour) => scaled[colour as SourceSymbol] ?? 0))
    const ranked = this.candidates
      .filter(
        (candidate) =>
          candidate.roles.includes('fixing') &&
          !this.taken(candidate) &&
          !tried.has(candidate.card.name),
      )
      .map((candidate) => {
        const helps = landColours(candidate.card, this.chosen(), identity).filter(
          (symbol) => scaled[symbol] > 0,
        )
        const gap = helps.reduce((sum, symbol) => sum + scaled[symbol], 0)
        const beats = helps.length >= 2 && gap - candidate.penalty > basic
        return { candidate, helps, beats, score: gap + this.roleScore(candidate, ['fixing']) }
      })
      .sort(byRank)
    return { ranked, best: ranked.find(({ beats }) => beats) }
  }

  /** Step 1: fixing, re-ranked after each pick, while a land beats the basic it would replace. */
  fixingStep() {
    if (this.colourCount < 2) return
    const tried = new Set<string>()
    for (;;) {
      const { ranked, best } = this.rankFixing(tried)
      for (const { candidate, score, helps } of ranked)
        if (candidate !== best?.candidate)
          this.hold(
            this.describe(candidate, 'fixing', score, helps),
            this.fits(candidate.card) ? 'basic' : 'budget',
          )
      if (!best) return
      tried.add(best.candidate.card.name)
      this.consider(best.candidate, this.describe(best.candidate, 'fixing', best.score, best.helps))
    }
  }

  /** Steps 2 and 3: earned roles, then utility, flexible, interaction and colourless utility. */
  roleStep(step: 'earned' | 'utility') {
    const ranked = this.candidates
      .filter(
        (candidate) =>
          !this.taken(candidate) && candidate.roles.some((role) => fillOrder[step].includes(role)),
      )
      .map((candidate) => ({ candidate, score: this.roleScore(candidate, ['fixing']) }))
      .filter(({ score }) => score > 0)
      .sort(byRank)
    for (const { candidate, score } of ranked)
      this.consider(candidate, this.describe(candidate, step, score))
  }

  result(): LandPlan<T> {
    const { deck, identity, landTarget } = this.input
    const alternatives = [...this.passed.values()]
      .filter((option) => !this.picks.some((pick) => pick.card.name === option.card.name))
      .sort(
        (a, b) =>
          Number(a.overBudget) - Number(b.overBudget) ||
          holdOrder.indexOf(a.step) - holdOrder.indexOf(b.step) ||
          b.score - a.score ||
          a.card.name.localeCompare(b.card.name),
      )
      .slice(0, landPlanAlternatives)
    return {
      landSlots: this.landSlots,
      cap: this.cap,
      room: this.roomFor(this.pickFetchers),
      reserve: this.reserveFor(this.pickFetchers),
      fetchers: this.fetchers + this.pickFetchers,
      picks: this.picks,
      alternatives,
      basics: planBasics(
        deck,
        identity,
        landTarget,
        this.picks.map(({ card }) => card),
      ),
    }
  }
}

/**
 * Plan the land slots left toward the target (#589). Nonbasics fill in order: fixing while it
 * beats a basic for the colours still short of sources, then roles the deck earned, then utility,
 * flexible, interaction and colourless utility. Within a step lands rank by role score, then EDHREC
 * inclusion, then name. Basics keep the reserve and fill the rest. A heuristic draft, never a
 * solved mana base.
 */
export function planLandFill<T extends PlanCard>(input: LandPlanInput<T>): LandPlan<T> {
  const planner = new LandPlanner(input)
  planner.fixingStep()
  planner.roleStep('earned')
  planner.roleStep('utility')
  return planner.result()
}

/** The dialog group a pick belongs to: its role, with the focus for earned roles. */
export function landPlanGroup(pick: Pick<LandPlanPick<unknown>, 'role' | 'focus'>) {
  if (pick.role === 'land-synergy')
    return pick.focus === landsMatterFocus
      ? 'Landfall and land synergy'
      : `${pick.focus ?? 'Land'} synergy`
  if (pick.role === 'theme') {
    if (pick.focus === chosenTypeFocus || (pick.focus && creatureTypeForTheme(pick.focus)))
      return 'Typal'
    return `${pick.focus ?? 'Theme'} theme`
  }
  return landRoleLabels[pick.role]
}

export const landRoleLabels: Record<LandRole, string> = {
  fixing: 'Fixing',
  utility: 'Utility',
  'creature-land': 'Creature lands',
  flexible: 'Flexible slots',
  'land-synergy': 'Land synergy',
  theme: 'Theme',
  interaction: 'Interaction',
  'colourless-utility': 'Colourless utility',
}

/** Why the deck earned a role, in words that name no card (card names render as references). */
export function earnedEvidenceText(evidence: LandRoleEvidence) {
  if (evidence.source === 'theme') return `You chose the ${evidence.theme} theme`
  if (evidence.source === 'commander') return `Your commander: “${evidence.quote}”`
  return `${evidence.count} cards in your deck show it`
}

/** The reason line for a planned land: the matched text, then why the deck wants that role. */
export function landPlanReason(pick: LandPlanPick<unknown>) {
  const matched =
    pick.match.source === 'type' ? `Type line: ${pick.match.evidence}` : `“${pick.match.evidence}”`
  const why =
    pick.step === 'fixing' && pick.helps.length
      ? `Adds a ${list(pick.helps.map((symbol) => colourNames[symbol]))} source you lack`
      : pick.deckEvidence[0]
        ? earnedEvidenceText(pick.deckEvidence[0])
        : undefined
  return why ? `${matched} · ${why}` : matched
}
