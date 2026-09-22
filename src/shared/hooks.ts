import { useEffect, useState } from 'react'

export function usePendingConfirmation<T>(empty: T) {
  const [pending, setPending] = useState(empty)
  useEffect(() => {
    if (pending === empty) return
    const timer = setTimeout(() => setPending(empty), 3000)
    return () => clearTimeout(timer)
  }, [empty, pending])
  return [pending, setPending] as const
}

export function useStoredOption<T>(key: string, fallback: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`option:${key}`)
      return stored === null ? fallback() : (JSON.parse(stored) as T)
    } catch {
      return fallback()
    }
  })
  useEffect(() => localStorage.setItem(`option:${key}`, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}
