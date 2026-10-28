import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { captureBatch, type BatchSnapshot } from './batch-snapshot.ts'
import { revealBatch, type BatchRevealState } from './reveal-batch.ts'

export function RecommendationBatch({
  batchKey,
  batchNumber,
  onRevealStateChange,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  batchKey: string
  batchNumber: number
  onRevealStateChange?: (state: BatchRevealState) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const previous = useRef<{ number: number; cards: BatchSnapshot[] } | undefined>(undefined)
  const { cardEffects, cardReveals } = useVisualPreferences()
  useLayoutEffect(() => {
    if (!ref.current || !cardEffects || !cardReveals) {
      onRevealStateChange?.('idle')
      return
    }
    return revealBatch(
      ref.current,
      previous.current?.number !== batchNumber ? previous.current?.cards : undefined,
      onRevealStateChange,
    )
  }, [batchKey, batchNumber, cardEffects, cardReveals, onRevealStateChange])
  useLayoutEffect(() => {
    if (ref.current) previous.current = { number: batchNumber, cards: captureBatch(ref.current) }
  })
  return <div {...props} ref={ref} />
}
