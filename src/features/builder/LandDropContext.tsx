import { landDropContext } from '../../land-drop-context.ts'
import type { AnalysisCard } from '../../deck-analysis.ts'

export function LandDropContext({
  deck,
  commanderCount,
}: {
  deck: AnalysisCard[]
  commanderCount: number
}) {
  const context = landDropContext(deck, commanderCount)
  return (
    <section aria-label="Land-drop context">
      <h4>Land-drop context</h4>
      {context.turns ? (
        <>
          <p>
            {context.size} library cards; {context.lands} land opportunities. Your editable target
            is separate.
          </p>
          {context.optionalLands > 0 && (
            <p>
              All-land-mode scenario: all {context.optionalLands} spell/land double-faced cards are
              reserved for land plays, never spells.
            </p>
          )}
          <p>Chance of making every land drop through each turn:</p>
          <ul>
            {context.turns.map(({ turn, label }) => (
              <li key={turn}>
                Turn {turn}: {label}
              </li>
            ))}
          </ul>
          <p>
            Opening seven plus one draw each turn, including turn one. No mulligans, extra draws,
            ramp, land search, or extra land plays. Every counted land is assumed playable. This
            estimates land drops, not untapped mana, colour access, or spell castability.
          </p>
          <details>
            <summary>About these likelihood labels</summary>
            <p>
              Very unlikely: below 20%; Unlikely: 20% to below 40%; About even: 40% to below 60%;
              Likely: 60% to below 80%; Very likely: 80% to below 95%; Almost certain: 95% or more.
              These broad bands describe this simplified model, not deck quality or a recommended
              land target.
            </p>
          </details>
        </>
      ) : (
        <p>{context.message}</p>
      )}
    </section>
  )
}
