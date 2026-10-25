import type { AddZone } from '../deck-analysis.ts'

/** Where the next added card goes. Shared by every add-card flow so the choice reads the same. */
export function AddZoneToggle({
  zone,
  onChange,
}: {
  zone: AddZone
  onChange: (zone: AddZone) => void
}) {
  return (
    <div className="add-zone-toggle" role="group" aria-label="Add new cards to">
      <span>Add to</span>
      {(['deck', 'sideboard'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={zone === option}
          onClick={() => onChange(option)}
        >
          {option === 'deck' ? 'Deck' : 'Sideboard'}
        </button>
      ))}
    </div>
  )
}
