import { useEffect, useId, useRef } from 'react'
import { createRoot } from 'react-dom/client'

import { ModalCloseButton } from './CardDetails.tsx'

type ConfirmOptions = { title: string; message: string; confirmLabel: string }

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  resolve,
}: ConfirmOptions & { resolve: (confirmed: boolean) => void }) {
  const id = useId()
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancel.current?.focus()
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      resolve(false)
    }
    document.addEventListener('keydown', escape, true)
    return () => document.removeEventListener('keydown', escape, true)
  }, [resolve])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resolve(false)
      }}
    >
      <section
        className="export-modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <div className="export-heading">
          <h2 id={id}>{title}</h2>
          <ModalCloseButton label="Cancel" onClick={() => resolve(false)} />
        </div>
        <p>{message}</p>
        <div className="confirm-actions">
          <button ref={cancel} className="export" type="button" onClick={() => resolve(false)}>
            Cancel
          </button>
          <button className="primary" type="button" onClick={() => resolve(true)}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

/** Themed confirmation dialog; mounts inside <main> so dark and commander themes apply. */
export function confirmDialog(options: ConfirmOptions) {
  const opener = document.activeElement as HTMLElement | null
  const host = (document.querySelector('main') ?? document.body).appendChild(
    document.createElement('div'),
  )
  // A boxless host avoids page rules such as `main > div` creating a stacking context under the header.
  host.style.display = 'contents'
  const root = createRoot(host)
  return new Promise<boolean>((resolve) =>
    root.render(
      <ConfirmDialog
        {...options}
        resolve={(confirmed) => {
          root.unmount()
          host.remove()
          opener?.focus()
          resolve(confirmed)
        }}
      />,
    ),
  )
}
