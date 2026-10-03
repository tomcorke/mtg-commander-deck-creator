import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createWorkspace } from './autosaves.ts'

const root = createRoot(document.getElementById('root')!)
void Promise.resolve()
  .then(() =>
    createWorkspace({
      storage: localStorage,
      session: sessionStorage,
      locks: navigator.locks,
      channel:
        typeof BroadcastChannel === 'undefined'
          ? undefined
          : new BroadcastChannel('commander-workspaces'),
    }),
  )
  .then((workspace) => {
    // A cached page must reacquire ownership before it can write after Back/Forward navigation.
    window.addEventListener('pagehide', () => workspace.close())
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) window.location.reload()
    })
    root.render(
      <StrictMode>
        <App workspace={workspace} />
      </StrictMode>,
    )
  })
  .catch(() => {
    root.render(
      <p role="alert">
        Could not open a safe deck workspace. Your saved decks have not been changed. Reload to try
        again.
      </p>,
    )
  })
