import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { generatedCreatureCatalog } from './scripts/generated-creature-catalog.ts'

const publishCount = Number(
  execFileSync('git', ['rev-list', '--count', 'origin/publish'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim(),
)
const version = `0.1.${publishCount}`

// Dev-only store for notes from the ?foil-preview feedback page. Agents read and answer the
// same file, so the page shows their status and replies.
const feedbackFile = 'dev-feedback/foil-feedback.json'
type FeedbackNote = { id: string; reply?: string } & Record<string, unknown>
const readFeedback = (): { notes: FeedbackNote[] } => {
  try {
    return JSON.parse(readFileSync(feedbackFile, 'utf8'))
  } catch {
    return { notes: [] }
  }
}
const devFeedback: Plugin = {
  name: 'dev-feedback',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__dev-feedback', (request, response) => {
      if (request.method === 'PUT') {
        let body = ''
        request.on('data', (chunk) => (body += chunk))
        request.on('end', () => {
          const note = JSON.parse(body) as FeedbackNote
          const feedback = readFeedback()
          const index = feedback.notes.findIndex(({ id }) => id === note.id)
          // Merge, so a page save never drops an agent's reply.
          if (index < 0) feedback.notes.push(note)
          else feedback.notes[index] = { ...feedback.notes[index], ...note }
          mkdirSync('dev-feedback', { recursive: true })
          writeFileSync(feedbackFile, JSON.stringify(feedback, null, 2))
          response.end('{}')
        })
        return
      }
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(readFeedback()))
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), devFeedback, generatedCreatureCatalog()],
  server: {
    watch: {
      // Windows file notifications can occasionally be dropped by editors or synced folders.
      usePolling: true,
      interval: 100,
    },
  },
})
