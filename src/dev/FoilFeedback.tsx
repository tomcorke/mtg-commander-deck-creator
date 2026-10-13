import { useCallback, useEffect, useState } from 'react'

// Dev feedback notes for ?foil-preview, stored by the dev-feedback Vite plugin. An agent watches
// the store for notes marked ready, updates the effect, then sets the status and a reply.
export type FeedbackSide = 'css' | 'webgl'
export type FeedbackStatus = 'draft' | 'ready' | 'working' | 'done'
export type FeedbackNote = {
  id: string
  foil: string
  side: FeedbackSide
  text: string
  status: FeedbackStatus
  reply?: string
  updatedAt?: string
}

const endpoint = '/__dev-feedback'
export const noteId = (foil: string, side: FeedbackSide) => `${foil}:${side}`

export function useFeedback() {
  const [notes, setNotes] = useState<FeedbackNote[]>([])
  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint)
      setNotes(((await response.json()) as { notes: FeedbackNote[] }).notes)
    } catch {
      // The store is optional; the page still works without it.
    }
  }, [])
  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 3000)
    return () => clearInterval(timer)
  }, [load])
  const save = async (note: FeedbackNote) => {
    await fetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ ...note, updatedAt: new Date().toISOString() }),
    })
    await load()
  }
  return { notes, save }
}

const statusLabels: Record<FeedbackStatus, string> = {
  draft: 'Draft (not sent)',
  ready: 'Waiting for the agent',
  working: 'Agent is working on it',
  done: 'Agent replied',
}

export function NotePanel({
  foil,
  side,
  note,
  save,
}: {
  foil: string
  side: FeedbackSide
  note?: FeedbackNote
  save: (note: FeedbackNote) => Promise<void>
}) {
  const [text, setText] = useState(note?.text ?? '')
  // Load the stored text when switching cards; keep local edits otherwise.
  useEffect(() => setText(note?.text ?? ''), [foil, note?.text])
  const submit = (status: FeedbackStatus) =>
    void save({ id: noteId(foil, side), foil, side, text, status })

  return (
    <div className="foil-note">
      <textarea
        aria-label={`${side === 'css' ? 'CSS' : 'WebGL'} notes for ${foil}`}
        value={text}
        placeholder="Notes for this effect"
        onChange={(event) => setText(event.target.value)}
        rows={4}
      />
      <div className="foil-note-actions">
        <button type="button" onClick={() => submit('draft')}>
          Save draft
        </button>
        <button type="button" disabled={!text.trim()} onClick={() => submit('ready')}>
          Ready for review
        </button>
        {note && (
          <span className={`foil-note-status ${note.status}`}>{statusLabels[note.status]}</span>
        )}
      </div>
      {note?.reply && <p className="foil-note-reply">{note.reply}</p>}
    </div>
  )
}

export function noteSummary(notes: FeedbackNote[], foil: string) {
  return notes
    .filter((note) => note.foil === foil && note.status !== 'draft')
    .map((note) => `${note.side === 'css' ? 'CSS' : 'WebGL'}: ${statusLabels[note.status]}`)
    .join(' · ')
}
