import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const publishCount = Number(
  execFileSync('git', ['rev-list', '--count', 'origin/publish'], { encoding: 'utf8' }).trim(),
)
const version = `0.1.${publishCount}`

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  server: {
    watch: {
      // Windows file notifications can occasionally be dropped by editors or synced folders.
      usePolling: true,
      interval: 100,
    },
  },
})
