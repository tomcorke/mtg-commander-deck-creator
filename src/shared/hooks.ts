import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export function useDialogFocus(open: boolean, onClose: () => void) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    // Run after outgoing dialogs restore focus, rather than competing with commit-time autoFocus.
    dialog.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [open])
  useEffect(() => {
    // Disabled or removed controls can drop focus to the page while the dialog remains open.
    if (open && !dialog.current?.contains(document.activeElement))
      dialog.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus()
  })
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    if (event.key !== 'Tab') return
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((control) => control.getClientRects().length)
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  return { ref: dialog, onKeyDown }
}

export function usePendingConfirmation<T>(empty: T) {
  const [pending, setPending] = useState(empty)
  useEffect(() => {
    if (pending === empty) return
    const timer = setTimeout(() => setPending(empty), 3000)
    return () => clearTimeout(timer)
  }, [empty, pending])
  return [pending, setPending] as const
}

export function useStoredOption<T>(
  key: string,
  fallback: () => T,
  parse: (value: unknown) => T = (value) => value as T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`option:${key}`)
      return stored === null ? fallback() : parse(JSON.parse(stored))
    } catch {
      return fallback()
    }
  })
  useEffect(() => localStorage.setItem(`option:${key}`, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}
