import type { ComponentProps, ReactNode } from 'react'

import { cardPowerToughness, cardSourceLink, type DeckCard } from '../domain/card-model.ts'
import { ArtLoading, FinishedCardImage } from './CardArt.tsx'
import { CardDetails } from './CardDetails.tsx'
import { OracleText } from './ManaSymbols.tsx'

/** Shared art and complete rules description for card-preview dialogs. */
export function CardDetailContent({
  card,
  titleId,
  title = card.name,
  printing,
  loading = false,
  onToggleSet,
  collectionSelected,
  children,
}: {
  card: DeckCard
  titleId: string
  title?: ReactNode
  printing?: ComponentProps<typeof FinishedCardImage>['printing']
  loading?: boolean
  onToggleSet?: () => void
  collectionSelected?: boolean
  children?: ReactNode
}) {
  const powerToughness = cardPowerToughness(card)
  return (
    <div className="deck-card-modal-content">
      <figure className="deck-card-modal-art">
        <FinishedCardImage
          image={card.image}
          backImage={card.backImage}
          alt={`${card.name} card`}
          cardName={card.name}
          finish={card.finish}
          foilType={card.foilType}
          set={card.set}
          collectorNumber={card.collectorNumber}
          className="deck-card-modal-image"
          showFlipButton
          printing={printing}
        />
        <ArtLoading active={loading} />
      </figure>
      <div className="deck-card-modal-copy">
        <div className="deck-card-modal-title">
          <h2 id={titleId}>{title}</h2>
          <span className="deck-card-modal-mana">
            <OracleText text={card.manaCost} />
          </span>
        </div>
        <p className="card-type-line">{card.typeLine}</p>
        <p className="deck-card-description">
          <OracleText text={card.detail} />
        </p>
        {powerToughness && (
          <p className="card-power-toughness">
            <span className="sr-only">Power and toughness </span>
            {powerToughness}
          </p>
        )}
        {children}
        <CardDetails
          card={card}
          source={cardSourceLink(card)}
          onToggleSet={onToggleSet}
          collectionSelected={collectionSelected}
        />
      </div>
    </div>
  )
}
