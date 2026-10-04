import { savedDraftAge, type DeckWorkspace } from '../../autosaves.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'

export function DraftSavedTime({ updatedAt }: { updatedAt: string }) {
  return (
    <time dateTime={updatedAt} title={new Date(updatedAt).toLocaleString()}>
      {savedDraftAge(updatedAt)}
    </time>
  )
}

export function WorkspaceNotice({
  workspace,
  autosave,
  startNew,
  chooseDraft,
  hideRecovery = false,
}: {
  workspace: DeckWorkspace
  autosave: ReturnType<DeckWorkspace['getSnapshot']>
  startNew: () => void
  chooseDraft: () => void
  hideRecovery?: boolean
}) {
  const { notice, error, cleanupMessage, busy } = autosave
  if (!notice && !error && !cleanupMessage) return null
  return (
    <>
      {(error || cleanupMessage) && (
        <div className="workspace-alert" role="alert">
          {[error, cleanupMessage].filter(Boolean).join(' ')}
          {cleanupMessage && (
            <ModalCloseButton
              label="Dismiss autosave cleanup message"
              onClick={() => {
                workspace.dismissCleanupMessage()
                const main = document.querySelector<HTMLElement>('main')
                if (main) {
                  main.tabIndex = -1
                  main.focus()
                }
              }}
            />
          )}
        </div>
      )}
      {notice && !hideRecovery && (
        <section className="workspace-notice" aria-label="Draft recovery">
          <p role="status">
            {notice.latest ? 'Automatically restored your latest draft' : 'Restored your draft'}:{' '}
            <b>{notice.draft.state.commander}</b> ({notice.draft.state.deck.length} cards, saved{' '}
            <DraftSavedTime updatedAt={notice.draft.updatedAt} />
            ).
            {notice.copied && ' This tab edits its own copy.'}
          </p>
          <div className="workspace-notice-actions">
            <button className="export" type="button" disabled={busy} onClick={startNew}>
              Start a new deck
            </button>
            <button className="export" type="button" onClick={chooseDraft}>
              Choose another draft
            </button>
          </div>
          <ModalCloseButton
            label="Dismiss draft recovery notice"
            onClick={workspace.dismissNotice}
          />
        </section>
      )}
    </>
  )
}
