import { colourMatches, identityLabel, type ColourMatch } from '../../domain/colour-identity.ts'
import { ColourPicker } from '../../shared/CommanderChoice.tsx'

const matchLabels: Record<ColourMatch, string> = {
  exactly: 'Exactly',
  within: 'Within',
  including: 'Including',
}

/**
 * Colour pips with the Exactly / Within / Including match beside them, the chosen combination's
 * name, and a short explainer that states the default (#482).
 */
export function ColourIdentityFilter({
  colours,
  toggleColour,
  match,
  setMatch,
}: {
  colours: string[]
  toggleColour: (colour: string) => void
  match: ColourMatch
  setMatch: (match: ColourMatch) => void
}) {
  return (
    <div className="colour-identity-filter" role="group" aria-labelledby="colour-filter-heading">
      <div className="colour-identity-controls">
        <ColourPicker colours={colours} toggleColour={toggleColour} />
        <div
          className="add-zone-toggle colour-match"
          role="group"
          aria-label="Colour identity match"
          aria-describedby="colour-identity-help"
        >
          {colourMatches.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={match === option}
              onClick={() => setMatch(option)}
            >
              {matchLabels[option]}
            </button>
          ))}
        </div>
      </div>
      <p id="colour-identity-name" className="colour-identity-name">
        {colours.length ? identityLabel(colours) : 'Any colour identity'}
      </p>
      <p id="colour-identity-help" className="colour-identity-help">
        A commander’s colour identity is every colour in its cost and rules text; your deck must fit
        within it. Exactly, the default, finds only these colours; Within adds commanders with
        fewer, Including ones with more.
      </p>
    </div>
  )
}
