import { deckPriceTotal, describeDeckPrice, priceSourceNote } from '../domain/deck-price.ts'

type Props = {
  deck: { price?: string }[]
  sideboard: { price?: string }[]
  /** Show the price source as text; otherwise it is a tooltip and screen-reader note. */
  showSource?: boolean
}

/** Main-deck and sideboard price totals from each card's chosen printing and finish. */
export function DeckPrice({ deck, sideboard, showSource = false }: Props) {
  return (
    <div className="deck-price" title={showSource ? undefined : priceSourceNote}>
      <p>
        <span>
          Main deck <b>{describeDeckPrice(deckPriceTotal(deck))}</b>
        </span>
        {sideboard.length > 0 && (
          <span>
            Sideboard <b>{describeDeckPrice(deckPriceTotal(sideboard))}</b>
          </span>
        )}
      </p>
      {showSource ? (
        <p className="deck-price-source">{priceSourceNote}</p>
      ) : (
        <span className="sr-only">{priceSourceNote}</span>
      )}
    </div>
  )
}
