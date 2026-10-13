import type { DeckCard } from '../domain/card-model.ts'
import {
  commanderPromotionWarning,
  missingColourNames,
  type CommanderPromotionInfo,
} from '../domain/commander-promotion.ts'
import { CardReference } from './CardReference.tsx'

type CommanderPromotionProps = {
  info: CommanderPromotionInfo<DeckCard>
  onPromote: () => void
  onOpenCard: (card: DeckCard) => void
}

export function CommanderPromotion({ info, onPromote, onOpenCard }: CommanderPromotionProps) {
  const cards = [...new Map(info.dependentCards.map((card) => [card.name, card])).values()]
  return (
    <div className="commander-promotion">
      <button
        type="button"
        className="commander-promotion-button"
        disabled={!info.canPromote}
        onClick={onPromote}
      >
        Use as commander
      </button>
      {!info.canPromote && (
        <div className="commander-warning form-error">
          <p>{commanderPromotionWarning(info)}</p>
          {cards.length > 0 && (
            <details>
              <summary>
                {cards.length} {cards.length === 1 ? 'card uses' : 'cards use'}{' '}
                {missingColourNames(info, 'or')}
              </summary>
              <p>
                {cards.map((card, index) => (
                  <span key={card.name}>
                    {index > 0 && ', '}
                    <CardReference card={card} onOpen={() => onOpenCard(card)} />
                  </span>
                ))}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
