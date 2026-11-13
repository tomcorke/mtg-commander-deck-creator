import { commanderNames } from '../../domain/commander-catalog.ts'
import type { DeckCard, ExportFormat } from '../../domain/card-model.ts'
import { DeckPrice } from '../../shared/DeckPrice.tsx'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import { stillNeededCards, type OwnedQuantities } from '../../domain/owned-cards.ts'
import type { ShareLinkState } from '../../app/share-actions.ts'
import { useEffect } from 'react'

type Props = {
  commander: string
  copied: boolean | 'failed'
  deck: DeckCard[]
  sideboard: DeckCard[]
  deckList: (format: ExportFormat) => string
  exportFormat: ExportFormat
  ownedCards: OwnedQuantities
  exportNeededOnly: boolean
  setExportNeededOnly: (neededOnly: boolean) => void
  show: boolean
  copyDeck: () => void
  downloadDeckList: () => void
  shareLinkState: ShareLinkState
  setShareLinkState: (state: ShareLinkState) => void
  copyShareLink: () => void
  closeModal: () => void
  setExportFormat: (format: ExportFormat) => void
}

/** With owned cards, the list can be only the main-deck cards the player still needs. */
function NeededChoice({
  neededOnly,
  neededCount,
  setExportNeededOnly,
}: {
  neededOnly: boolean
  neededCount: number
  setExportNeededOnly: (neededOnly: boolean) => void
}) {
  return (
    <>
      <div className="format-tabs" role="group" aria-label="Cards to list">
        <button type="button" aria-pressed={!neededOnly} onClick={() => setExportNeededOnly(false)}>
          Whole deck
        </button>
        <button type="button" aria-pressed={neededOnly} onClick={() => setExportNeededOnly(true)}>
          Still needed ({neededCount})
        </button>
      </div>
      {neededOnly && (
        <p className="moxfield-instructions">
          {neededCount
            ? `The ${neededCount} main-deck ${neededCount === 1 ? 'card' : 'cards'}, commanders included, that your owned cards do not cover. Each owned copy covers one card of that name, in any printing; the sideboard is left out.`
            : 'Your owned cards cover every card in the main deck.'}
        </p>
      )}
    </>
  )
}

/** A share link always carries the whole deck, whichever list the dialog shows. */
function ShareLinkStatus({ shareLinkState }: { shareLinkState: ShareLinkState }) {
  return (
    <div className="share-link-status" role="status">
      {shareLinkState.status === 'copied' && (
        <p className="moxfield-instructions">
          Share link copied. It holds the whole deck, sideboard included, so anyone who opens it
          sees a read-only copy they can add to their own decks.
        </p>
      )}
      {shareLinkState.status === 'failed' && (
        <>
          <p className="form-error">
            Copy failed. Select the share link below and copy it by hand.
          </p>
          <input
            readOnly
            value={shareLinkState.link}
            aria-label="Share link"
            onFocus={(event) => event.currentTarget.select()}
          />
        </>
      )}
    </div>
  )
}

function ExportActions({
  copied,
  exportFormat,
  canShare,
  canExport,
  copyDeck,
  downloadDeckList,
  copyShareLink,
}: Pick<Props, 'copied' | 'exportFormat' | 'copyDeck' | 'downloadDeckList' | 'copyShareLink'> & {
  canShare: boolean
  canExport: boolean
}) {
  return (
    <div className="export-actions">
      <a href="https://www.moxfield.com/decks/personal" target="_blank" rel="noreferrer">
        Open Moxfield decks ↗
      </a>
      <button className="export" type="button" disabled={!canShare} onClick={copyShareLink}>
        Copy share link
      </button>
      <button className="export" type="button" disabled={!canExport} onClick={downloadDeckList}>
        Download .{exportFormat === 'csv' ? 'csv' : 'txt'}
      </button>
      <button className="primary" type="button" disabled={!canExport} onClick={copyDeck}>
        {copied === true ? 'Copied' : 'Copy to clipboard'}
      </button>
      <span className={copied === 'failed' ? undefined : 'sr-only'} role="status">
        {copied === true && 'Deck list copied to clipboard'}
        {copied === 'failed' && 'Copy failed. Select the list above and copy it by hand.'}
      </span>
    </div>
  )
}

function FormatChoice({
  exportFormat,
  setExportFormat,
}: Pick<Props, 'exportFormat' | 'setExportFormat'>) {
  const formats: [ExportFormat, string][] = [
    ['moxfield', 'Moxfield'],
    ['plain', 'Plain text'],
    ['csv', 'CSV'],
  ]
  return (
    <div className="format-tabs" role="group" aria-label="Deck list format">
      {formats.map(([format, label]) => (
        <button
          key={format}
          type="button"
          aria-pressed={exportFormat === format}
          onClick={() => setExportFormat(format)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function ExportDeckModal({
  commander,
  copied,
  deck,
  sideboard,
  deckList,
  exportFormat,
  ownedCards,
  exportNeededOnly,
  setExportNeededOnly,
  show,
  copyDeck,
  downloadDeckList,
  shareLinkState,
  setShareLinkState,
  copyShareLink,
  closeModal,
  setExportFormat,
}: Props) {
  const dialog = useDialogFocus(show, closeModal)
  // Each visit starts without an earlier link's status.
  useEffect(() => {
    if (!show) setShareLinkState({ status: 'idle' })
  }, [show, setShareLinkState])
  if (!show) return null

  const names = commanderNames(commander)
  const hasOwnedCards = Object.keys(ownedCards).length > 0
  const neededOnly = exportNeededOnly && hasOwnedCards
  const neededCount = hasOwnedCards ? stillNeededCards(deck, ownedCards).length : 0
  const deckCount = neededOnly ? neededCount : deck.length

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        {...dialog}
        className="export-modal export-deck-modal"
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
        <FormatChoice exportFormat={exportFormat} setExportFormat={setExportFormat} />
        {hasOwnedCards && (
          <NeededChoice
            neededOnly={neededOnly}
            neededCount={neededCount}
            setExportNeededOnly={setExportNeededOnly}
          />
        )}
        {/* Unverified: whether Moxfield's text import accepts commanders with the mainboard.
            Rechecked 2026-10-04 in Chrome; moxfield.com/help never finished loading. */}
        {exportFormat === 'moxfield' && !neededOnly && (
          <p className="moxfield-instructions">
            This {deckCount - names.length}-card mainboard list omits your{' '}
            {names.length > 1 ? 'commanders' : 'commander'}. In Moxfield, set{' '}
            <b>{names.join(' and ')}</b> as your {names.length > 1 ? 'commanders' : 'commander'}.
          </p>
        )}
        {!deck.length && (
          <p className="saved-decks-empty">The deck is empty. Add cards to export it.</p>
        )}
        {deck.length > 0 && !neededOnly && (
          <DeckPrice deck={deck} sideboard={sideboard} showSource />
        )}
        <textarea
          readOnly
          value={deckList(exportFormat)}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={`${exportFormat} ${neededOnly ? 'still needed' : 'deck'} list`}
        />
        <ExportActions
          copied={copied}
          exportFormat={exportFormat}
          canShare={deck.length > 0}
          canExport={deckCount > 0}
          copyDeck={copyDeck}
          downloadDeckList={downloadDeckList}
          copyShareLink={copyShareLink}
        />
        <ShareLinkStatus shareLinkState={shareLinkState} />
      </section>
    </div>
  )
}
