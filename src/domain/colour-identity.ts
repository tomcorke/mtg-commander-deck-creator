/** Colour identity keys, combination names and match modes for commander filters. */

const colourOrder = 'WUBRG'
export const colourNames: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}

/**
 * How chosen colours match a commander's colour identity: `exactly` those colours, `within` them
 * (no other colours, so mono-colour and colourless commanders too), or `including` them (and
 * possibly more). Scryfall's `id=`, `id<=` and `id>=` (#482).
 */
export type ColourMatch = 'exactly' | 'within' | 'including'
export const colourMatches: readonly ColourMatch[] = ['exactly', 'within', 'including']
const scryfallOperators: Record<ColourMatch, string> = {
  exactly: '=',
  within: '<=',
  including: '>=',
}

/**
 * EDHREC's commander list page for each colour identity, keyed by WUBRG-ordered colours.
 * Slugs from the identity links on https://json.edhrec.com/pages/commanders/colorless.json,
 * checked 2026-11-12. Each page lists up to 100 of that identity's top commanders, often fewer,
 * with `num_decks`.
 */
export const identitySlugs: Record<string, string> = {
  '': 'colorless',
  W: 'mono-white',
  U: 'mono-blue',
  B: 'mono-black',
  R: 'mono-red',
  G: 'mono-green',
  WU: 'azorius',
  UB: 'dimir',
  BR: 'rakdos',
  RG: 'gruul',
  WG: 'selesnya',
  WB: 'orzhov',
  UR: 'izzet',
  BG: 'golgari',
  WR: 'boros',
  UG: 'simic',
  WUB: 'esper',
  UBR: 'grixis',
  BRG: 'jund',
  WRG: 'naya',
  WUG: 'bant',
  WBG: 'abzan',
  WUR: 'jeskai',
  UBG: 'sultai',
  WBR: 'mardu',
  URG: 'temur',
  WUBR: 'yore-tiller',
  UBRG: 'glint-eye',
  WBRG: 'dune-brood',
  WURG: 'ink-treader',
  WUBG: 'witch-maw',
  WUBRG: 'five-color',
}

/** Colours in WUBRG order without repeats; anything else is dropped. */
export const identityKey = (colours: readonly string[]) =>
  [...new Set(colours)]
    .filter((colour) => colourOrder.includes(colour))
    .sort((left, right) => colourOrder.indexOf(left) - colourOrder.indexOf(right))
    .join('')

/**
 * The name players and EDHREC use for a combination of two or more colours, such as Golgari or
 * Yore-Tiller; one colour or none has no combination name.
 */
export function identityName(colours: readonly string[]) {
  const key = identityKey(colours)
  if (key.length < 2) return undefined
  if (key === colourOrder) return 'Five-colour'
  return identitySlugs[key]
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('-')
}

/** The chosen colours' names in WUBRG order, such as "Black, Green". */
const chosenNames = (colours: readonly string[]) =>
  Object.entries(colourNames)
    .filter(([symbol]) => colours.includes(symbol))
    .map(([, name]) => name)
    .join(', ')

/** "Golgari · Black, Green"; one colour has no combination name, so it reads "Black". */
export function identityLabel(colours: readonly string[]) {
  const name = identityName(colours)
  return name ? `${name} · ${chosenNames(colours)}` : chosenNames(colours)
}

/** The filter summary's phrase, such as "Colour identity within Golgari (Black, Green)". */
export function identitySummary(colours: readonly string[], match: ColourMatch) {
  if (!colours.length) return ''
  const name = identityName(colours)
  const names = chosenNames(colours)
  return `Colour identity ${match} ${name ? `${name} (${names})` : names}`
}

/** Scryfall's identity term for the chosen colours, or '' when none are chosen. */
export function identityTerm(colours: readonly string[], match: ColourMatch = 'exactly') {
  return colours.length
    ? `id${scryfallOperators[match]}${[...colours].sort().join('').toLowerCase()}`
    : ''
}

/** Whether a colour identity matches the chosen colours; no chosen colours match everything. */
export function matchesIdentity(
  identity: readonly string[],
  colours: readonly string[],
  match: ColourMatch = 'exactly',
) {
  if (!colours.length) return true
  const within = identity.every((colour) => colours.includes(colour))
  const including = colours.every((colour) => identity.includes(colour))
  return match === 'within' ? within : match === 'including' ? including : within && including
}
