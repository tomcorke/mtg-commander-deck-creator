// Heuristic strategy packages: a plan is a set of enablers, payoffs that reward them, and
// protection or recovery that keeps the engine running. Regex detection, like theme tags.
// ponytail: two families only; add more once #98's rank bench can measure them.
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
      payoff: /whenever (?:a|an|another|one or more) [^.]*\b(?:dies|die|you sacrifice)/i,
      protection:
        /return (?:target|up to \w+ target|all) [^.]*creature cards? from your graveyard to the battlefield/i,
    },
  },
  {
    name: 'Tokens',
    parts: {
      enabler: /create[s]? (?:one|two|three|four|five|a|an|x|that many|\d+) [^.]*token/i,
      payoff:
        /tokens? you control|whenever (?:a|one or more) [^.]*tokens? (?:enters|you control)|creatures you control get \+/i,
      protection: /creatures you control (?:gain|have) [^.]*(?:indestructible|hexproof)/i,
    },
  },
])

export const packagePartsFor = (pkg: (typeof strategyPackages)[number], detail = '') =>
  packageParts.filter((part) => pkg.parts[part].test(detail))

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
      if (part === 'protection' && parts.protection === 0) score += 4
    }
  }
  return Math.min(8, score)
}
