import { useEffect, useRef, useState } from 'react'
import type { Card } from '../../domain/card-model.ts'
import { appTerms, claimKindLabels } from '../../domain/glossary.ts'
import type { ThemeAlternative } from '../../domain/theme-alternative.ts'
import { CardReference } from '../../shared/CardReference.tsx'

const roleLabels: Record<ThemeAlternative['role'], [label: string, basis: string]> = {
  ramp: ['ramp', 'ramp'],
  draw: ['card draw', 'card draw'],
  removal: ['removal', 'removal'],
  wipes: ['board wipe', 'a board wipe'],
}

const themeList = (themes: string[]) =>
  `${themes.join(' and ')} theme${themes.length > 1 ? 's' : ''}`

/**
 * A queued or Later card that shares a generic pick's role and matches a theme (#563). Both checks
 * are text heuristics, so the basis says so. Adding keeps the batch; the outcome replaces the
 * suggestion so the next pool card never slides in under the pointer.
 */
export function ThemeAlternativeNote({
  alternative,
  toSideboard,
  onOpenCard,
  onAdd,
}: {
  alternative: ThemeAlternative | null
  toSideboard: boolean
  onOpenCard: (card: Card) => void
  /** Adds the card; returns an error, or empty on success. */
  onAdd: (alternative: ThemeAlternative) => string
}) {
  // The board is kept from the moment of adding, so a later zone switch cannot relabel it.
  const [added, setAdded] = useState<{ card: Card; board: string } | null>(null)
  // An error belongs to the card it came from; it clears once the pool moves on to another.
  const [failure, setFailure] = useState({ name: '', error: '' })
  const error = failure.name === alternative?.card.name ? failure.error : ''
  const outcome = useRef<HTMLParagraphElement>(null)
  // The Add button leaves with the suggestion; keep focus in the offer, on the outcome.
  useEffect(() => {
    if (added || error) outcome.current?.focus()
  }, [added, error])
  const board = toSideboard ? 'sideboard' : 'deck'
  if (added)
    return (
      <div className="theme-alternative">
        <p ref={outcome} tabIndex={-1} role="status">
          <span className="theme-alternative-label">Added to the {added.board}:</span>{' '}
          <CardReference card={added.card} onOpen={() => onOpenCard(added.card)} />
        </p>
      </div>
    )
  if (!alternative) return null
  const { card, role, themes, source } = alternative
  const [label, basis] = roleLabels[role]
  const add = () => {
    const error = onAdd(alternative)
    if (error) setFailure({ name: card.name, error })
    else setAdded({ card, board })
  }
  return (
    <div className="theme-alternative">
      <p className="theme-alternative-pick">
        <span className="theme-alternative-label">On-theme {label}:</span>{' '}
        <CardReference card={card} onOpen={() => onOpenCard(card)} />
      </p>
      <p className="theme-alternative-basis">
        {claimKindLabels[appTerms.themeAlternative.kind]}: also {basis} and matches your{' '}
        {themeList(themes)}.{source === 'later' && ' In your Later list.'}
      </p>
      <button
        type="button"
        className="compact-action"
        aria-label={`Add ${card.name} to the ${board}`}
        onClick={add}
      >
        Add
      </button>
      {error && (
        <p ref={outcome} tabIndex={-1} role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  )
}
