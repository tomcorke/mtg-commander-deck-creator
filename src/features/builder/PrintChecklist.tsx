import { createPortal } from 'react-dom'
import { checklistGroups } from '../../app/print-checklist.ts'
import { commanderLabel } from '../../domain/commander-catalog.ts'

const finishLabel = (finish: string | undefined) =>
  finish === 'foil' ? ' · Foil' : finish === 'etched' ? ' · Etched' : ''

/**
 * The card-gathering checklist that Export prints (#547). It renders beside the app root, outside
 * the themed shell, and only shows in print, where it replaces the app: a light page on any theme.
 * Card names are plain text here, since paper has no previews or details to open.
 */
export function PrintChecklist({
  deckName,
  ...list
}: Parameters<typeof checklistGroups>[0] & { deckName: string }) {
  const { commander, neededOnly } = list
  const groups = checklistGroups(list)
  const total = groups.reduce((sum, { count }) => sum + count, 0)
  return createPortal(
    <div className="print-checklist">
      <header>
        <h1>{deckName || commanderLabel(commander) || 'Deck'}</h1>
        <p>
          {neededOnly ? 'Still needed' : 'Whole deck'}: {total} {total === 1 ? 'card' : 'cards'}
          {neededOnly ? ', commanders included, that your owned cards do not cover' : ''}. Tick each
          line as you gather it.
        </p>
      </header>
      <div className="print-checklist-groups">
        {groups.map(({ section, count, lines }) => (
          <section key={section} className="print-checklist-group">
            <h2>
              {section} <span>{count}</span>
            </h2>
            <ul>
              {lines.map(({ card, quantity }) => (
                <li key={`${card.name}-${card.set}-${card.collectorNumber}-${card.finish}`}>
                  <span className="print-checklist-box" />
                  <span className="print-checklist-quantity">{quantity}</span>
                  <span className="print-checklist-name">{card.name}</span>
                  <span className="print-checklist-printing">
                    {card.set.toUpperCase()} {card.collectorNumber}
                    {finishLabel(card.finish)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  )
}
