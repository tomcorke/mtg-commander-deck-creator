import type { AnalysisCard, analyseDeck } from '../../deck-analysis.ts'
import { commanderCurveNote } from './curve-note.ts'

/** Fixed 0–7+ mana-value curve shared by the builder sidebar and deck review. */
export function ManaCurve({
  analysis,
  commanders,
  selected,
  onSelect,
}: {
  analysis: ReturnType<typeof analyseDeck>
  /** The commanders counted in `analysis`, which the note under the legend names. */
  commanders: AnalysisCard[]
  selected: number | null
  onSelect: (manaValue: number) => void
}) {
  const commanderNote = commanderCurveNote(commanders)
  // The two bars sit side by side, so the tallest single bar sets the scale.
  const maxCurveCount = Math.max(
    1,
    ...analysis.curve.map((point) => Math.max(point.permanents, point.nonPermanents)),
  )
  return (
    <>
      <div className="curve-scroll">
        <div
          className={`mana-curve${analysis.curvePending ? ' curve-pending' : ''}`}
          aria-label="Mana-value curve"
          aria-busy={analysis.curvePending}
        >
          {analysis.curve.map((point) => (
            <button
              type="button"
              className={selected === point.manaValue ? 'selected' : ''}
              onClick={() => onSelect(point.manaValue)}
              aria-pressed={selected === point.manaValue}
              aria-label={`Mana value ${point.manaValue === 7 ? '7 or more' : point.manaValue}: ${point.permanents} permanents, ${point.nonPermanents} non-permanents`}
              key={point.manaValue}
            >
              <span className="curve-bars">
                <i
                  className="permanent"
                  style={{ height: `${(point.permanents / maxCurveCount) * 100}%` }}
                />
                <i
                  className="non-permanent"
                  style={{ height: `${(point.nonPermanents / maxCurveCount) * 100}%` }}
                />
              </span>
              <b>{point.manaValue === 7 ? '7+' : point.manaValue}</b>
              {selected === point.manaValue && <span className="sr-only">Selected</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="curve-legend">
        <span>
          <i className="permanent" /> Permanent
        </span>
        <span>
          <i className="non-permanent" /> Non-permanent
        </span>
        <b>Avg {analysis.curvePending ? '…' : analysis.averageManaValue.toFixed(1)}</b>
      </div>
      {commanderNote && <p className="curve-commander-note">{commanderNote}</p>}
    </>
  )
}
