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
}: {
  workspace: DeckWorkspace
  autosave: ReturnType<DeckWorkspace['getSnapshot']>
  startNew: () => void
  chooseDraft: () => void
}) {
  const { notice, error, busy } = autosave
  if (!notice && !error) return null
  return (
    <section className="workspace-notice" aria-label="Draft recovery">
      {error && <p role="alert">{error}</p>}
      {notice && (
        <>
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
        </>
      )}
    </section>
  )
}
