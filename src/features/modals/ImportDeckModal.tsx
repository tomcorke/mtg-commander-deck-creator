import { ModalCloseButton } from '../../shared/CardDetails.tsx'

type ImportDeckModalProps = {
  show: boolean
  importState: 'idle' | 'loading' | 'error'
  importSource: string
  importError: string
  setImportSource: (value: string) => void
  setImportState: (value: 'idle' | 'loading' | 'error') => void
  setImportError: (value: string) => void
  importDeck: () => void
  closeModal: () => void
}

export function ImportDeckModal({
  show,
  importState,
  importSource,
  importError,
  setImportSource,
  setImportState,
  setImportError,
  importDeck,
  closeModal,
}: ImportDeckModalProps) {
  if (!show) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && importState !== 'loading') closeModal()
      }}
    >
      <section
        className="export-modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Bring an existing deck</p>
            <h2 id="import-title">Import deck</h2>
          </div>
          <ModalCloseButton
            disabled={importState === 'loading'}
            onClick={() => closeModal()}
            label="Close import"
          />
        </div>
        <p className="import-help">
          Paste an exported deck list. Put commander cards below a <b>COMMANDER:</b> heading. Set
          and collector number syntax is preserved.
        </p>
        <p className="import-note">
          Moxfield and Archidekt URLs are not supported because this is a client-only app and those
          sites block browser access. Export the deck as text, then paste it here.
        </p>
        <textarea
          value={importSource}
          onChange={(event) => {
            setImportSource(event.target.value)
            setImportState('idle')
            setImportError('')
          }}
          placeholder={
            'COMMANDER:\n1 Commander Name (SET) 123\n\nMAINBOARD:\n1 Card Name (SET) 456'
          }
          aria-label="Exported deck list"
        />
        {importError && (
          <p className="form-error" role="alert">
            {importError}
          </p>
        )}
        <div className="export-actions">
          <button onClick={() => closeModal()} disabled={importState === 'loading'}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={!importSource.trim() || importState === 'loading'}
            onClick={() => void importDeck()}
          >
            {importState === 'loading' ? 'Importing…' : 'Import deck'}
          </button>
        </div>
      </section>
    </div>
  )
}
