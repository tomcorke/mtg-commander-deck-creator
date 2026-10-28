import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { revealBatch } from './reveal-batch.ts'

export function RecommendationBatch({
  batchKey,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  batchKey: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { cardEffects, cardReveals } = useVisualPreferences()
  useLayoutEffect(() => {
    if (!ref.current || !cardEffects || !cardReveals) return
    return revealBatch(ref.current)
  }, [batchKey, cardEffects, cardReveals])
  return <div {...props} ref={ref} />
}
