export type StatusKind = 'good' | 'attention' | 'neutral'

export function ReviewStatus({
  kind: rawKind,
  label,
  early = false,
}: {
  kind: StatusKind
  label: string
  early?: boolean
}) {
  const kind = early && rawKind === 'good' ? 'neutral' : rawKind
  return (
    <span className={`deck-review-status ${kind}`}>
      <b aria-hidden="true">{kind === 'good' ? '✓' : kind === 'attention' ? '!' : '·'}</b>
      {label}
    </span>
  )
}
