import type { DeckCard } from '../../domain/card-model.ts'
import { appTerms, claimKindLabels } from '../../domain/glossary.ts'
import { deckTagCoverage } from '../../deck-review.ts'

/** A Deck targets row's "count / [target]", shared by role and theme rows. */
export function TargetCount({
  label,
  count,
  target,
  pending,
  onTarget,
  describedBy,
}: {
  label: string
  count: number
  target: number
  pending: boolean
  onTarget: (target: number) => void
  describedBy?: string
}) {
  return (
    <b>
      {!pending && count >= target && (
        <>
          <span className="deck-target-check" aria-hidden="true">
            ✓
          </span>
          <span className="sr-only">Target met: </span>
        </>
      )}
      {pending ? '…' : count} /{' '}
      <input
        type="number"
        min="0"
        max="99"
        value={target}
        onChange={(event) => onTarget(Math.min(99, Math.max(0, Number(event.target.value) || 0)))}
        aria-label={`${label} target`}
        aria-describedby={describedBy}
      />
    </b>
  )
}

/**
 * Deck targets row for theme density (#501): main-deck cards matching the theme against an
 * editable target. It counts like Deck review's theme coverage and never changes recommendations.
 */
export function ThemeTargetRow({
  theme,
  cards,
  target,
  pending,
  onTarget,
}: {
  theme: string
  /** Main-deck cards, commanders excluded. */
  cards: DeckCard[]
  target: number
  pending: boolean
  onTarget: (target: number) => void
}) {
  const count = deckTagCoverage(cards, [theme])[0]?.cards.length ?? 0
  const label = `${theme} cards`
  return (
    <>
      <div className="bar-label deck-target-row theme-target">
        <span className="deck-target-met">
          <span>{label}</span>
          <span className="ratio-bar">
            <i
              style={{
                width: `${pending ? 0 : Math.min(100, (count / Math.max(1, target)) * 100)}%`,
              }}
            />
          </span>
        </span>
        <TargetCount
          label={label}
          count={count}
          target={target}
          pending={pending}
          onTarget={onTarget}
          describedBy="theme-target-note"
        />
      </div>
      <p className="theme-target-note" id="theme-target-note">
        {claimKindLabels[appTerms.themeCards.kind]}: {appTerms.themeCards.definition}
      </p>
    </>
  )
}
