import { appTerms, claimKindLabels } from '../../domain/glossary.ts'

/**
 * Theme first's mark for an offer that matches no selected theme tag (#560). A text-matching
 * heuristic, so the copy names the claim kind and never calls the card good or bad.
 */
export function GenericPickNote() {
  const { term, definition, kind } = appTerms.genericPick
  return (
    <p className="generic-pick" title={definition}>
      <span className="generic-pick-label">{term}</span> {claimKindLabels[kind]}: matches no theme
      tag
    </p>
  )
}
