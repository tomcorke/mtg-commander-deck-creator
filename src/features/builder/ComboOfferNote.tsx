import type { DeckCard } from '../../domain/card-model.ts'
import { comboPageUrl, comboSourceName, type ComboLink } from '../../domain/combo-index.ts'
import type { PowerTarget } from '../../domain/recommendation-types.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { ReviewStatus, type StatusKind } from './ReviewStatus.tsx'

// How each Power setting frames an offer that completes a known combo, matching Deck review's
// Known combos section (docs/domain/combo-data.md). Spellbook data, not a bracket verdict.
const powerTreatment: Record<PowerTarget, { kind: StatusKind; note: string }> = {
  precon: { kind: 'attention', note: 'Core power: add it only on purpose, and tell your table.' },
  upgraded: { kind: 'neutral', note: 'Worth mentioning to your table.' },
  high: { kind: 'good', note: 'High power ranks it higher.' },
}

/** An offer that alone would complete one or more known combos with cards already in the deck. */
export function ComboOfferNote({
  card,
  combos,
  deck,
  powerTarget,
  openCard,
}: {
  card: string
  combos: ComboLink[]
  deck: DeckCard[]
  powerTarget: PowerTarget
  openCard: (card: DeckCard) => void
}) {
  const [combo] = combos
  if (!combo) return null
  const { kind, note } = powerTreatment[powerTarget]
  const pieces = combo.cards
    .filter((name) => name !== card)
    .map((name) => deck.find((item) => item.name === name))
    .filter((item): item is DeckCard => Boolean(item))
  return (
    <p className="combo-offer">
      <ReviewStatus
        kind={kind}
        label={combos.length === 1 ? 'Completes a combo' : `Completes ${combos.length} combos`}
      />
      <span>
        {pieces.length > 0 && (
          <>
            {combos.length > 1 ? 'One with ' : 'With '}
            {pieces.map((piece, position) => (
              <span key={piece.name}>
                {position > 0 && ' + '}
                <CardReference card={piece} onOpen={() => openCard(piece)} />
              </span>
            ))}
            .{' '}
          </>
        )}
        {note}{' '}
        <a href={comboPageUrl(combo.id)} target="_blank" rel="noreferrer">
          View on {comboSourceName}
        </a>
      </span>
    </p>
  )
}
