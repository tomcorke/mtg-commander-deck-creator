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
  P: 'Phyrexian',
}

function symbolName(symbol: string) {
  if (/^\d+$/.test(symbol)) return `${symbol} generic mana`
  return symbol
    .split('/')
    .map((part) => symbolNames[part] ?? part)
    .join(' or ')
}

const colourNames: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colourless',
}

export function ManaSymbols({ symbols }: { symbols: string[] }) {
  return (
    <>
      {symbols.map((symbol) => (
        <img
          className="mana-symbol"
          src={`https://svgs.scryfall.io/card-symbols/${symbol}.svg`}
          alt={colourNames[symbol] ?? 'Colourless'}
          title={colourNames[symbol] ?? 'Colourless'}
          key={symbol}
        />
      ))}
    </>
  )
}

export function OracleText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  return (
    <>
      {lines.map((line, lineIndex) => (
        <span className={lines.length > 1 ? 'oracle-line' : undefined} key={`${line}-${lineIndex}`}>
          {line.split(/(\{[^}]+\})/g).map((part, index) => {
            const symbol = part.match(/^\{(.+)\}$/)?.[1]
            if (!symbol) return part
            const file = symbol.replace('/', '')
            const label = symbolName(symbol)
            return (
              <img
                className="mana-symbol"
                src={`https://svgs.scryfall.io/card-symbols/${file}.svg`}
                alt={label}
                title={label}
                key={`${part}-${index}`}
              />
            )
          })}
        </span>
      ))}
    </>
  )
}
