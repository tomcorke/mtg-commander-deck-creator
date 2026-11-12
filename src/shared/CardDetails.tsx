import { finishLabel } from '../domain/printing.ts'
import { cardPrintingsUri, cardScryfallUri, type Card } from '../domain/card-model'
import { formatUsdPrice } from '../domain/recommendation-scoring'

export type CardSource = { label: string; uri: string }

/** One short price line: the USD price linking to its seller, or nothing when unpriced. */
export function CardPriceLink({
  card,
}: {
  card: Pick<Card, 'name' | 'set' | 'collectorNumber' | 'scryfallUri' | 'price' | 'priceUri'>
}) {
  if (!card.price) return null
  return (
    <a href={card.priceUri ?? cardScryfallUri(card)} target="_blank" rel="noreferrer">
      {formatUsdPrice(card.price)} <span>{card.priceUri ? 'TCGplayer' : 'Scryfall'} ↗</span>
    </a>
  )
}

export function ModalCloseButton({
  label,
  onClick,
  disabled = false,
  autoFocus = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      className="modal-close"
      autoFocus={autoFocus}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
    >
      ×
    </button>
  )
}

export function CardDetails({
  card,
  source,
  onToggleSet,
  collectionSelected = false,
}: {
  card: Pick<
    Card,
    | 'name'
    | 'set'
    | 'setName'
    | 'collectorNumber'
    | 'scryfallUri'
    | 'price'
    | 'priceUri'
    | 'finish'
    | 'foilType'
  >
  source: CardSource
  onToggleSet?: () => void
  collectionSelected?: boolean
}) {
  const scryfallUri = cardScryfallUri(card)
  const printingName =
    card.setName && card.setName.toLowerCase() !== card.set.toLowerCase() ? card.setName : undefined
  return (
    <dl className="card-details">
      <div>
        <dt>Printing</dt>
        <dd>
          <strong>{printingName ?? card.set.toUpperCase()}</strong>{' '}
          <span>
            {printingName ? `(${card.set.toUpperCase()}) · ` : '· '}#{card.collectorNumber}
            {finishLabel(card) ? ` · ${finishLabel(card)}` : ''}
          </span>
          {onToggleSet && (
            <button
              type="button"
              className="compact-action"
              onClick={onToggleSet}
              aria-pressed={collectionSelected}
            >
              {collectionSelected ? 'Stop preferring this set' : 'Prefer this set'}
            </button>
          )}
        </dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>
          <a href={source.uri} target="_blank" rel="noreferrer">
            {source.label} ↗
          </a>
        </dd>
      </div>
      {card.price && (
        <div>
          <dt>Price</dt>
          <dd>
            <CardPriceLink card={card} />
          </dd>
        </div>
      )}
      <div>
        <dt>Links</dt>
        <dd>
          <a href={scryfallUri} target="_blank" rel="noreferrer">
            Scryfall ↗
          </a>{' '}
          <span aria-hidden="true">·</span>{' '}
          <a href={cardPrintingsUri(card)} target="_blank" rel="noreferrer">
            All printings ↗
          </a>
        </dd>
      </div>
    </dl>
  )
}
