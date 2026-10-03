import { useEffect, useState } from 'react'

import { fetchScryfallSymbology } from '../adapters/scryfall.ts'
import {
  fallbackManaSymbolName,
  manaSymbolDetails,
  type ScryfallManaSymbol,
} from '../domain/mana-symbols.ts'

function useSymbology() {
  const [symbols, setSymbols] = useState<ReadonlyMap<string, ScryfallManaSymbol> | null>(null)
  useEffect(() => {
    let active = true
    void fetchScryfallSymbology()
      .then((result) => {
        if (active) setSymbols(result)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return symbols
}

function ManaSymbolImage({
  symbol,
  symbols,
  className = 'mana-symbol',
  decorative = false,
}: {
  symbol: string
  symbols: ReadonlyMap<string, ScryfallManaSymbol> | null
  className?: string
  decorative?: boolean
}) {
  const details = manaSymbolDetails(symbol, symbols)
  if (!details)
    return (
      <span
        className={className}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : fallbackManaSymbolName(symbol)}
        aria-hidden={decorative || undefined}
      >
        {symbol}
      </span>
    )
  return (
    <img
      className={className}
      src={details.svg_uri}
      alt={decorative ? '' : details.english || fallbackManaSymbolName(symbol)}
      aria-hidden={decorative || undefined}
    />
  )
}

export function ManaSymbols({
  symbols,
  className,
  decorative,
}: {
  symbols: string[]
  className?: string
  decorative?: boolean
}) {
  const symbology = useSymbology()
  return (
    <>
      {symbols.map((symbol) => (
        <ManaSymbolImage
          symbol={symbol}
          symbols={symbology}
          className={className}
          decorative={decorative}
          key={symbol}
        />
      ))}
    </>
  )
}

export function OracleText({ text }: { text: string }) {
  const symbology = useSymbology()
  const lines = text.split(/\r?\n/)
  return (
    <>
      {lines.map((line, lineIndex) => (
        <span className={lines.length > 1 ? 'oracle-line' : undefined} key={`${line}-${lineIndex}`}>
          {line.split(/(\{[^}]+\})/g).map((part, index) => {
            const symbol = part.match(/^\{(.+)\}$/)?.[1]
            if (!symbol) return part
            return <ManaSymbolImage symbol={symbol} symbols={symbology} key={`${part}-${index}`} />
          })}
        </span>
      ))}
    </>
  )
}
