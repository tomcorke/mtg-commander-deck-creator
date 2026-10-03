import { colourNames } from '../../domain/commander-catalog.ts'

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
        {colours?.length === 0 && (
          <img
            className="colour"
            src="https://svgs.scryfall.io/card-symbols/C.svg"
            alt="Colourless"
          />
        )}
        {colours?.map((colour) => (
          <img
            className="colour"
            src={`https://svgs.scryfall.io/card-symbols/${colour}.svg`}
            alt={colourNames[colour]}
            key={colour}
          />
        ))}
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
