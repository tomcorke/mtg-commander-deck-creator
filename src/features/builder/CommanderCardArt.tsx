import { commanderNames } from '../../domain/commander-catalog.ts'
import type { CommanderDetails } from '../../domain/card-model.ts'
import { FinishedCardImage } from '../../shared/CardArt.tsx'

type Props = {
  commander: string
  commanderDetails: CommanderDetails | null
  loadingArt: string
  openCommanderCard: (index: number) => void
  cycleCommanderPrinting: (index: number) => void | Promise<void>
}

export function CommanderCardArt({
  commander,
  commanderDetails,
  loadingArt,
  openCommanderCard,
  cycleCommanderPrinting,
}: Props) {
  if (!commanderDetails) {
    return <span className="commander-card commander-placeholder" aria-hidden="true" />
  }

  const names = commanderNames(commander)

  return (
    <figure
      className={`commander-card ${commanderDetails.images.length > 1 ? 'pair' : ''}`}
      tabIndex={0}
      aria-label={`View ${commander} card${commanderDetails.images.length > 1 ? 's' : ''}`}
    >
      {commanderDetails.images.map((image, index) => (
        <img
          src={image}
          alt={`${names[index]} card`}
          onClick={() => openCommanderCard(index)}
          key={names[index]}
        />
      ))}
      {commanderDetails.printings.some((printings) => printings.length > 1) && (
        <span className="printing-indicator" aria-hidden="true">
          ↻ Art
        </span>
      )}
      <span className="card-zoom">
        {commanderDetails.images.map((image, index) => (
          <span className="commander-printing" key={names[index]}>
            <FinishedCardImage
              image={image}
              backImage={
                commanderDetails.printings[index][commanderDetails.selections[index]]?.backImage
              }
              alt={`${names[index]} full card`}
              cardName={names[index]}
              finish={commanderDetails.printings[index][commanderDetails.selections[index]]?.finish}
              showFlipButton
              printing={{
                count: commanderDetails.printings[index].length,
                index: commanderDetails.selections[index],
                loading: Boolean(loadingArt),
                name: names[index],
                onClick: () => void cycleCommanderPrinting(index),
              }}
            />
          </span>
        ))}
      </span>
    </figure>
  )
}
