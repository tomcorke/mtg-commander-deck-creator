import { useState, type Dispatch, type SetStateAction } from 'react'

// Dev pages only: useState that remembers its value in localStorage between visits.
export function useStoredState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `foil-preview:${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored === null ? initial : (JSON.parse(stored) as T)
    } catch {
      return initial
    }
  })
  const setStored: Dispatch<SetStateAction<T>> = (next) =>
    setValue((current) => {
      const resolved = next instanceof Function ? next(current) : next
      try {
        localStorage.setItem(storageKey, JSON.stringify(resolved))
      } catch {
        // Storage is a convenience; the page works without it.
      }
      return resolved
    })
  return [value, setStored]
}
