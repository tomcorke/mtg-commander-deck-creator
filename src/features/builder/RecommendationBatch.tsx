import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { captureBatch, type BatchSnapshot } from './batch-snapshot.ts'
import { revealBatch } from './reveal-batch.ts'

export function RecommendationBatch({
  batchKey,
  batchNumber,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  batchKey: string
  batchNumber: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const previous = useRef<{ number: number; cards: BatchSnapshot[] } | undefined>(undefined)
  const { cardEffects, cardReveals } = useVisualPreferences()
  useLayoutEffect(() => {
    if (!ref.current || !cardEffects || !cardReveals) return
    return revealBatch(
      ref.current,
      previous.current?.number !== batchNumber ? previous.current?.cards : undefined,
    )
  }, [batchKey, batchNumber, cardEffects, cardReveals])
  useLayoutEffect(() => {
    if (ref.current) previous.current = { number: batchNumber, cards: captureBatch(ref.current) }
  })
  return <div {...props} ref={ref} />
}
