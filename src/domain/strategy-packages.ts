import {
  chosenCreatureTypeTag,
  creatureTypeForTheme,
  everyCreatureTypeTag,
} from './creature-types.ts'

// Heuristic strategy packages: a plan is a set of enablers, payoffs that reward them, and
// protection or recovery that keeps the engine running. Regex detection, like theme tags.
// shortcut: two families only; add more once #98's rank bench can measure them.
export const packageParts = ['enabler', 'payoff', 'protection'] as const
export type PackagePart = (typeof packageParts)[number]
export type PackageCounts = Record<string, Record<PackagePart, number>>

export const strategyPackages: ReadonlyArray<{
  name: string
  parts: Record<PackagePart, RegExp>
}> = Object.freeze([
  {
    name: 'Sacrifice',
    parts: {
      enabler:
        /sacrifice (?:a|an|another|one or more|x) (?:other )?(?:creature|permanent|artifact)/i,
      payoff:
        /whenever (?:(?:you|a player) sacrifices?\b|(?:a|an|another|one or more) [^.]*\b(?:dies|die))/i,
      protection:
        /return (?:target|up to \w+ target|all) [^.]*creature cards? from your graveyard to the battlefield/i,
    },
  },
  {
    name: 'Tokens',
    parts: {
      enabler:
        /creates? (?:one|two|three|four|five|a|an|x|that many|\d+) [^.;]*?\bcreature tokens?\b/i,
      payoff: /tokens? you control|whenever (?:a|one or more) [^.]*tokens? (?:enters|you control)/i,
      protection: /creatures you control (?:gain|have) [^.]*(?:indestructible|hexproof)/i,
    },
  },
])

export const packagePartsFor = (pkg: (typeof strategyPackages)[number], detail = '') =>
  packageParts.filter((part) =>
    pkg.parts[part].test(
      pkg.name === 'Sacrifice' && part === 'enabler'
        ? detail.replace(/(?:whenever|when|if) [^,.:;]*\bsacrifices?\b[^,.:;]*[,.:;]/gi, '')
        : detail,
    ),
  )

/**
 * Counts each package's parts across the deck, commanders included: a commander is a strategic
 * piece. A package is active when the theme names it or the deck holds at least three of its cards.
 */
export function packageCounts(deck: { detail?: string }[], themes: string[] = []): PackageCounts {
  const counts: PackageCounts = {}
  for (const pkg of strategyPackages) {
    const parts = { enabler: 0, payoff: 0, protection: 0 }
    let cards = 0
    for (const card of deck) {
      const found = packagePartsFor(pkg, card.detail)
      for (const part of found) parts[part] += 1
      if (found.length) cards += 1
    }
    if (themes.includes(pkg.name) || cards >= 3) counts[pkg.name] = parts
  }
  return counts
}

/** Marginal package value: the side the deck lacks scores; adding to an excess side scores 0. */
export function packageScore(detail: string | undefined, counts: PackageCounts = {}) {
  let score = 0
  for (const pkg of strategyPackages) {
    const parts = counts[pkg.name]
    if (!parts) continue
    for (const part of packagePartsFor(pkg, detail)) {
      if (part === 'enabler') score += 2 * Math.max(0, parts.payoff - parts.enabler + 1)
      if (part === 'payoff') score += 2 * Math.max(0, parts.enabler - parts.payoff)
      if (part === 'protection' && parts.enabler && parts.payoff && !parts.protection) score += 4
    }
  }
  return Math.min(8, score)
}

/**
 * Creature-type plan for each creature-type theme (#379): members are creatures of the type;
 * payoffs reward the type (Patchwork Banner, Herald's Horn, "other Rabbits you control").
 */
export type TypalCounts = { theme: string; members: number; payoffs: number }[]
type TypalCard = { detail?: string; tags?: string[]; typeLine?: string }

const typalPayoffPattern = (type: string, plural: string) =>
  new RegExp(
    String.raw`\b(?:${plural}|${type} creatures) you control\b|\b${type} spells?\b|\bwhenever (?:a|an|another|one or more)(?: other)?(?: nontoken)? (?:${type}|${plural})\b`,
    'i',
  )

export function typalParts(theme: string, card: TypalCard) {
  const type = creatureTypeForTheme(theme)
  if (!type) return { member: false, payoff: false }
  const front = (card.typeLine ?? '').split('//')[0]
  const creature = /\bCreature\b/.test(front)
  return {
    member:
      creature &&
      (new RegExp(String.raw`\b${type}\b`).test(front) ||
        (card.tags ?? []).includes(everyCreatureTypeTag)),
    payoff:
      !/\bLand\b/.test(front) &&
      ((card.tags ?? []).includes(chosenCreatureTypeTag) ||
        typalPayoffPattern(type, theme).test(card.detail ?? '')),
  }
}

/** Members and payoffs of each creature-type theme across the deck, commanders included. */
export function typalCounts(deck: TypalCard[], themes: string[] = []): TypalCounts {
  return [...new Set(themes.filter((theme) => creatureTypeForTheme(theme)))].map((theme) => {
    const parts = deck.map((card) => typalParts(theme, card))
    return {
      theme,
      members: parts.filter(({ member }) => member).length,
      payoffs: parts.filter(({ payoff }) => payoff).length,
    }
  })
}

/** Payoffs a typal deck wants per member: about one for every three creatures of the type. */
export const typalMembersPerPayoff = 3

/**
 * Marginal typal value: a payoff scores while the deck has fewer than one per three members, and
 * a member scores while payoffs outnumber that share. A heuristic ratio, not a measured optimum.
 */
export function typalScore(card: TypalCard, counts: TypalCounts = []) {
  let score = 0
  for (const { theme, members, payoffs } of counts) {
    const parts = typalParts(theme, card)
    const wanted = Math.ceil(members / typalMembersPerPayoff)
    if (parts.payoff) score += 2 * Math.max(0, wanted - payoffs)
    else if (parts.member) score += 2 * Math.max(0, payoffs - wanted)
  }
  return Math.min(8, score)
}
