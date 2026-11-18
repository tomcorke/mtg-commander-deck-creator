import type { Card } from '../../domain/card-model.ts'
import type { FavouriteHold } from '../../domain/favourite-holds.ts'
import { appTerms, claimKindLabels } from '../../domain/glossary.ts'
import type { OwnedQuantities } from '../../domain/owned-cards.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { CardTile } from '../../shared/CardTile.tsx'
import { OwnedBadge } from '../../shared/OwnedBadge.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import {
  favouriteHoldLabels,
  favouriteHoldSentences,
  type FavouriteHoldFacts,
} from './favourite-hold-copy.ts'

const shown = 3

const share = (inclusion = 0) => `${Math.round(inclusion)}%`

/**
 * Commander theme favourites that ranking holds back, and the gate holding each (#632). It
 * shares the Deck health lane's layout. Inclusion is popularity evidence, so the copy labels the
 * claim kind and never calls the card good.
 */
export function FavouriteHolds({
  holds,
  commander,
  facts,
  ownedCards,
  onOpen,
}: {
  holds: FavouriteHold<Card>[]
  /** Short commander name for "of <commander> decks on EDHREC". */
  commander: string
  facts: FavouriteHoldFacts
  ownedCards?: OwnedQuantities
  onOpen: (card: Card) => void
}) {
  if (!holds.length) return null
  const { term, kind } = appTerms.favouriteHold
  const more = holds.length - shown
  return (
    <section className="health-lane favourite-holds" aria-labelledby="favourite-holds-title">
      <div className="health-lane-heading">
        <p className="eyebrow">Why these wait</p>
        <h3 id="favourite-holds-title">{term}</h3>
        <p>
          {claimKindLabels[kind]}: in at least half of {commander} decks on EDHREC and on your
          theme. Inclusion shows popularity, not card quality.
        </p>
      </div>
      <div className="health-suggestion-list favourite-hold-list">
        {holds.slice(0, shown).map((hold) => {
          const { card, reasons } = hold
          return (
            <CardTile
              key={card.name}
              size="small"
              className="health-card favourite-hold"
              art={
                <button
                  type="button"
                  className="health-card-art"
                  aria-label={`View ${card.name} details`}
                  onClick={() => onOpen(card)}
                >
                  <SmallCardImage image={card.image} placement="reference" />
                </button>
              }
              badges={
                <>
                  <span className="health-card-role">
                    {reasons.map((reason) => favouriteHoldLabels[reason]).join(' · ')}
                  </span>
                  <OwnedBadge owned={ownedCards} name={card.name} />
                </>
              }
              name={<CardReference card={card} onOpen={() => onOpen(card)} />}
              cost={card.manaCost}
              detail={`In ${share(card.inclusion)} of ${commander} decks on EDHREC`}
            >
              {favouriteHoldSentences(hold, facts).map((sentence) => (
                <p className="favourite-hold-reason" key={sentence}>
                  {sentence}
                </p>
              ))}
            </CardTile>
          )
        })}
      </div>
      {more > 0 && <p className="favourite-holds-more">{more} more on hold.</p>}
    </section>
  )
}
