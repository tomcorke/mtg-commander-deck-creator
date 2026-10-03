import { colourNames } from '../../domain/commander-catalog.ts'
import { ManaSymbols } from '../../shared/ManaSymbols.tsx'

type Props = {
  commander: string
  colours: string[] | null
  headingLevel?: 'h1' | 'h2'
  onChangeCommander: () => void
  onOpenCommander: () => void
  onCompareCommanders?: () => void
}

export function CommanderSummary({
  commander,
  colours,
  headingLevel = 'h1',
  onChangeCommander,
  onOpenCommander,
  onCompareCommanders,
}: Props) {
  const Heading = headingLevel
  const identityLabel =
    colours === null
      ? 'loading'
      : colours.length
        ? colours.map((colour) => colourNames[colour]).join(', ')
        : 'Colourless'

  return (
    <div className="commander-summary">
      <p className="eyebrow">Building around</p>
      <Heading className="commander-summary-title">
        <button type="button" className="commander-name" onClick={onOpenCommander}>
          {commander}
        </button>
      </Heading>
      <div className="identity" aria-label={`Colour identity: ${identityLabel}`}>
        <span>Colour identity</span>
        {colours !== null && (
          <ManaSymbols symbols={colours.length ? colours : ['C']} className="colour" decorative />
        )}
      </div>
      <div className="commander-summary-actions">
        <button className="change" type="button" onClick={onChangeCommander}>
          Change commander
        </button>
        {onCompareCommanders && (
          <button className="export" type="button" onClick={onCompareCommanders}>
            Compare commanders
          </button>
        )}
      </div>
    </div>
  )
}
