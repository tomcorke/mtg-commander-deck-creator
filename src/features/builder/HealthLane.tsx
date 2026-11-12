import { rolesForCard, targetLabels, type TargetKey } from '../../deck-analysis.ts'
import type { Card } from '../../domain/card-model.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { CardTile } from '../../shared/CardTile.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { OwnedBadge } from '../../shared/OwnedBadge.tsx'
import type { OwnedQuantities } from '../../domain/owned-cards.ts'

/** Queued cards that fill a role below target, shown apart from Theme first picks. */
export function HealthLane({
  cards,
  missingRoles,
  ownedCards,
  onOpen,
  onAdd,
}: {
  cards: Card[]
  missingRoles: string[]
  ownedCards?: OwnedQuantities
  onOpen: (card: Card) => void
  onAdd: (card: Card) => void
}) {
  return (
    <section className="health-lane" aria-labelledby="health-lane-title">
      <div className="health-lane-heading">
        <p className="eyebrow">Optional guidance</p>
        <h3 id="health-lane-title">Deck health suggestions</h3>
        <p>The thematic goal keeps these separate from your theme picks.</p>
      </div>
      <div className="health-suggestion-list">
        {cards.map((card) => {
          const role = rolesForCard(card).find((item) => missingRoles.includes(item))
          return (
            <CardTile
              key={card.name}
              size="small"
              className="health-card"
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
                    {role ? targetLabels[role as TargetKey] : 'Deck support'}
                  </span>
                  <OwnedBadge owned={ownedCards} name={card.name} />
                </>
              }
              name={<CardReference card={card} onOpen={() => onOpen(card)} />}
              cost={card.manaCost}
              actions={
                <button type="button" className="primary" onClick={() => onAdd(card)}>
                  Add
                </button>
              }
            />
          )
        })}
      </div>
    </section>
  )
}
