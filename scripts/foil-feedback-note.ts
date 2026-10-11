// Updates a ?foil-preview feedback note's status and reply, or deletes it.
// Usage: node --experimental-strip-types scripts/foil-feedback-note.ts <id> <working|done|delete> [reply]
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'dev-feedback/foil-feedback.json'
const [id, status, reply] = process.argv.slice(2)
type Note = { id: string; status: string; reply?: string; updatedAt?: string }
const feedback = JSON.parse(readFileSync(file, 'utf8')) as { notes: Note[] }
feedback.notes =
  status === 'delete'
    ? feedback.notes.filter((note) => note.id !== id)
    : feedback.notes.map((note) =>
        note.id === id
          ? { ...note, status, ...(reply ? { reply } : {}), updatedAt: new Date().toISOString() }
          : note,
      )
writeFileSync(file, JSON.stringify(feedback, null, 2))
console.log(feedback.notes.map((note) => `${note.id} ${note.status}`).join('\n'))
