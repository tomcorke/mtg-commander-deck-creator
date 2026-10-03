import type { analyseDeck } from '../../deck-analysis.ts'

/** Fixed 0–7+ mana-value curve shared by the builder sidebar and deck review. */
export function ManaCurve({
  analysis,
  selected,
  onSelect,
}: {
  analysis: ReturnType<typeof analyseDeck>
  selected: number | null
  onSelect: (manaValue: number) => void
}) {
  const maxCurveCount = Math.max(
    1,
    ...analysis.curve.map((point) => point.permanents + point.nonPermanents),
  )
  return (
    <>
      <div className="curve-scroll">
        <div className="mana-curve" aria-label="Mana-value curve">
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
        <b>Avg {analysis.averageManaValue.toFixed(1)}</b>
      </div>
    </>
  )
}
