import { commanderNames } from '../../domain/commander-catalog.ts'
import type { ExportFormat } from '../../domain/card-model.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'

type Props = {
  commander: string
  copied: boolean
  deckCount: number
  deckList: (format: ExportFormat) => string
  exportFormat: ExportFormat
  show: boolean
  copyDeck: () => void
  closeModal: () => void
  setExportFormat: (format: ExportFormat) => void
}

export function ExportDeckModal({
  commander,
  copied,
  deckCount,
  deckList,
  exportFormat,
  show,
  copyDeck,
  closeModal,
  setExportFormat,
}: Props) {
  if (!show) return null

  const names = commanderNames(commander)

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Export deck</p>
            <h2 id="export-title">Copy your deck list</h2>
          </div>
          <ModalCloseButton onClick={closeModal} label="Close export" />
        </div>
        <div className="format-tabs" role="group" aria-label="Deck list format">
          <button
            type="button"
            className={exportFormat === 'moxfield' ? 'selected' : ''}
            onClick={() => setExportFormat('moxfield')}
          >
            Moxfield
          </button>
          <button
            type="button"
            className={exportFormat === 'plain' ? 'selected' : ''}
            onClick={() => setExportFormat('plain')}
          >
            Plain text
          </button>
          <button
            type="button"
            className={exportFormat === 'csv' ? 'selected' : ''}
            onClick={() => setExportFormat('csv')}
          >
            CSV
          </button>
        </div>
        {exportFormat === 'moxfield' && (
          <p className="moxfield-instructions">
            This {deckCount - names.length}-card mainboard list omits your{' '}
            {names.length > 1 ? 'commanders' : 'commander'}: <b>{names.join(' and ')}</b>.
          </p>
        )}
        <textarea
          readOnly
          value={deckList(exportFormat)}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={`${exportFormat} deck list`}
        />
        <div className="export-actions">
          <a href="https://www.moxfield.com/decks/personal" target="_blank" rel="noreferrer">
            Open Moxfield decks ↗
          </a>
          <button className="primary" type="button" onClick={copyDeck}>
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
        </div>
      </section>
    </div>
  )
}
