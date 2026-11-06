import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

const dialogOpeners = new WeakMap<HTMLElement, HTMLElement>()

export function useDialogFocus(open: boolean, onClose: () => void) {
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const active = document.activeElement as HTMLElement | null
    // StrictMode's second run finds focus already on this dialog's ×, which is no opener.
    const opener = dialog.current?.contains(active) ? null : active
    if (dialog.current && opener) dialogOpeners.set(dialog.current, opener)
    // A dialog opened from another dialog that then closes loses its opener ("Browse these cards"
    // even disables before this runs), so fall back to the outer dialog's opener.
    const outer =
      opener?.closest<HTMLElement>('[aria-modal="true"]') ??
      [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
        .filter((element) => element !== dialog.current)
        .at(-1)
    const fallback = outer && dialogOpeners.get(outer)
    // Run after outgoing dialogs restore focus, rather than competing with commit-time autoFocus.
    dialog.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus()
    return () => {
      const usable = (element?: HTMLElement | null) =>
        element?.isConnected && !element.matches(':disabled')
      ;(usable(opener) ? opener : usable(fallback) ? fallback : null)?.focus()
    }
  }, [open])
  useEffect(() => {
    // Disabled or removed controls can drop focus to the page while the dialog remains open.
    // Focus in another dialog (one stacked above this) is left alone.
    if (open && !document.activeElement?.closest('[aria-modal="true"]'))
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
      // checkVisibility also skips closed <details> content, which keeps layout boxes in Chrome.
    ].filter((control) => control.checkVisibility())
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
