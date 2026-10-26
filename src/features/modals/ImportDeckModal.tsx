import { useState } from 'react'

import { mainDeckCardCount, parseDeckList } from '../../deck-import.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'

type ImportDeckModalProps = {
  show: boolean
  importState: 'idle' | 'loading' | 'error' | 'missing'
  importSource: string
  importError: string
  importFoundCount: number
  setImportSource: (value: string) => void
  setImportState: (value: 'idle' | 'loading' | 'error' | 'missing') => void
  setImportError: (value: string) => void
  importDeck: (openReviewAfterImport: boolean, skipMissing?: boolean, commanders?: string[]) => void
  closeModal: () => void
}

// eslint-disable-next-line max-lines-per-function -- The import flow markup stays together.
export function ImportDeckModal({
  show,
  importState,
  importSource,
  importError,
  importFoundCount,
  setImportSource,
  setImportState,
  setImportError,
  importDeck,
  closeModal,
}: ImportDeckModalProps) {
  const [openReviewAfterImport, setOpenReviewAfterImport] = useState(true)
  const [commanders, setCommanders] = useState(['', ''])
  const parsed = parseDeckList(importSource)
  const needsCommander =
    parsed.cards.length > 0 && !parsed.cards.some((card) => card.board === 'commander')
  const choices = [
    ...new Set(parsed.cards.filter((card) => card.board === 'mainboard').map((card) => card.name)),
  ]
  const selectedCommanders = needsCommander
    ? commanders.filter((name) => choices.includes(name))
    : []
  const mainDeckCount = mainDeckCardCount(parsed)
  const completeMainDeck = mainDeckCount === 100

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
          Paste a text deck list or this app’s CSV. Commander headings are read automatically; for
          lists without them, choose your commander below. Set and collector numbers are preserved
          when included. Other sites’ CSV and custom categories are not supported.
        </p>
        <p className="import-note">
          Deck URLs are not supported. In Moxfield, use Download → Copy for Moxfield to keep
          printings. Arena exports can omit cards that Arena does not support. Archidekt exports
          with custom categories need conversion to the heading format shown below.
        </p>
        <textarea
          value={importSource}
          onChange={(event) => {
            setImportSource(event.target.value)
            setImportState('idle')
            setImportError('')
            setCommanders(['', ''])
          }}
          placeholder={
            'COMMANDER:\n1 Commander Name (SET) 123\n\nMAINBOARD:\n1 Card Name (SET) 456'
          }
          aria-label="Exported deck list"
        />
        {needsCommander && (
          <fieldset className="import-commanders">
            <legend>This list has no commander designation</legend>
            <p className="import-help">
              Choose the commander and optional second commander. The app checks whether they can
              lead the deck together.
            </p>
            {commanders.map((name, index) => (
              <label key={index}>
                {index === 0 ? 'Commander' : 'Second commander (optional)'}
                <select
                  aria-label={index === 0 ? 'Commander' : 'Second commander (optional)'}
                  value={choices.includes(name) ? name : ''}
                  onChange={(event) =>
                    setCommanders(
                      commanders.map((value, slot) =>
                        slot === index ? event.target.value : value,
                      ),
                    )
                  }
                >
                  <option value="">{index === 0 ? 'Choose commander' : 'None'}</option>
                  {choices
                    .filter((choice) => choice !== commanders[1 - index])
                    .map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </fieldset>
        )}
        {importSource.trim() && (
          <div className="import-review-option">
            <p className="import-note" role="status">
              {completeMainDeck
                ? 'This list has a complete 100-card main deck, including the commander. After a successful import, we’ll open Deck review. Sideboard cards do not count.'
                : `This list has ${mainDeckCount}/100 main-deck cards, including the commander; sideboard is excluded. Review opens automatically only for a complete deck. You can review a partial import from the builder.`}
            </p>
            {completeMainDeck && (
              <>
                <label className="import-review-checkbox">
                  <input
                    type="checkbox"
                    checked={openReviewAfterImport}
                    disabled={importState === 'loading'}
                    onChange={(event) => setOpenReviewAfterImport(event.currentTarget.checked)}
                  />
                  <span>Open Deck review after this import</span>
                </label>
                {!openReviewAfterImport && (
                  <p className="import-review-opt-out">
                    You’ll stay in the builder. Open Deck review any time for findings and changes.
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {importError && (
          <p className="form-error" role="alert">
            {importError}
          </p>
        )}
        <div className="export-actions">
          <button
            className="export"
            type="button"
            onClick={() => closeModal()}
            disabled={importState === 'loading'}
          >
            Cancel
          </button>
          {importState === 'missing' && (
            <button
              className="export"
              type="button"
              onClick={() => importDeck(openReviewAfterImport, true, selectedCommanders)}
            >
              Import {importFoundCount} found cards
            </button>
          )}
          <button
            className="primary"
            disabled={
              !importSource.trim() ||
              importState === 'loading' ||
              (needsCommander && !selectedCommanders.length)
            }
            type="button"
            onClick={() => importDeck(openReviewAfterImport, false, selectedCommanders)}
          >
            {importState === 'loading'
              ? 'Importing…'
              : completeMainDeck
                ? openReviewAfterImport
                  ? 'Import and review'
                  : 'Import without review'
                : 'Import deck'}
          </button>
        </div>
      </section>
    </div>
  )
}
