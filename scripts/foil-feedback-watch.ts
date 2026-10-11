// Waits until a ?foil-preview feedback note is marked ready, prints the ready notes, then exits.
// Run in the background and re-run after handling the notes: see docs/dev/foil-feedback-loop.md.
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'dev-feedback/foil-feedback.json'
const check = () => {
  let notes: { status?: string }[] = []
  try {
    notes = JSON.parse(readFileSync(file, 'utf8')).notes
  } catch {
    return
  }
  const ready = notes.filter((note) => note.status === 'ready')
  if (!ready.length) return
  console.log(JSON.stringify(ready, null, 2))
  process.exit(0)
}
check()
setInterval(check, 2000)
