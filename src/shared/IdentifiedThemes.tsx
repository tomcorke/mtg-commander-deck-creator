import type { DeckCard } from '../domain/card-model.ts'
import { supportedThemes } from '../domain/recommendation-themes.ts'

/** Shown once wherever identified themes appear. */
export const identifiedThemesNote =
  'App estimates from card type and rules text; other strategies may fit.'

/**
 * Themes the app detects in a commander's type line and rules text, as chips. The full form
 * (random commander) has a heading, an empty state and the estimate note; the compact form
 * (commander tiles) shows at most `limit` chips and leaves the note to its page.
 */
export function IdentifiedThemes({
  card,
  limit,
  compact = false,
}: {
  card: DeckCard
  limit?: number
  compact?: boolean
}) {
  const themes = card.tags.filter((theme) => supportedThemes.includes(theme)).slice(0, limit)
  const chips = themes.length > 0 && (
    <ul className="identified-themes-list" aria-label={compact ? 'Identified themes' : undefined}>
      {themes.map((theme) => (
        <li key={theme}>{theme}</li>
      ))}
    </ul>
  )
  if (compact) return chips || null
  return (
    <section className="identified-themes" aria-labelledby="identified-themes-heading">
      <h3 id="identified-themes-heading">Identified themes</h3>
      {chips || <p>No themes identified for this commander.</p>}
      <p className="card-type-line">{identifiedThemesNote}</p>
    </section>
  )
}
