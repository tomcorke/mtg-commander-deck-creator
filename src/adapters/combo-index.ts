import { parseComboIndex, type ComboIndex } from '../domain/combo-index.ts'

// The generated artifact is same-origin and loads only when a combo view asks for it. A failed
// load is not cached, so the next request retries.
let pending: Promise<ComboIndex> | undefined

export function loadComboIndex(): Promise<ComboIndex> {
  pending ??= (async () => {
    const response = await fetch('/combo-index.json', { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Combo data unavailable (${response.status})`)
    return parseComboIndex(await response.json())
  })().catch((error: unknown) => {
    pending = undefined
    throw error
  })
  return pending
}
