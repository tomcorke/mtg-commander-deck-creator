export type ScryfallManaSymbol = {
  symbol: string
  english: string
  svg_uri: string
}

export const manaSymbolDetails = (
  symbol: string,
  symbology: ReadonlyMap<string, ScryfallManaSymbol> | null,
) => symbology?.get(`{${symbol}}`)

const symbolNames: Record<string, string> = {
  W: 'white',
  U: 'blue',
  B: 'black',
  R: 'red',
  G: 'green',
  C: 'colourless',
  X: 'X mana',
  T: 'tap',
  Q: 'untap',
  H: 'generic Phyrexian mana',
  P: 'pawprint',
}

export function fallbackManaSymbolName(symbol: string) {
  if (/^\d+$/.test(symbol)) return `${symbol} generic mana`
  return symbol
    .split('/')
    .map((part) => symbolNames[part] ?? part)
    .join(' or ')
}
