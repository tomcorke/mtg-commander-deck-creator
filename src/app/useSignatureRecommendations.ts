import { useEffect, useEffectEvent, useRef } from 'react'
import { executeSignatureFetch } from './signature-actions.ts'
import { fetchGeneration } from '../domain/builder-fetches.ts'
import type { ControllerState } from './useControllerState.ts'

/** Transport follows committed reservations; no polling or queue writes between boundaries. */
export function useSignatureRecommendations(state: ControllerState, onBatch: () => void) {
  const running = useRef(new Map<string, AbortController>())
  const finish = useEffectEvent(onBatch)
  const generation = fetchGeneration(state.builderState)
  const workspaceId = state.autosave.id
  useEffect(() => {
    const jobs = running.current
    return () => {
      for (const controller of jobs.values()) controller.abort()
      jobs.clear()
    }
  }, [generation, workspaceId])
  useEffect(() => {
    for (const work of state.pendingFetches) {
      if (work.response || running.current.has(work.id)) continue
      const controller = new AbortController()
      running.current.set(work.id, controller)
      void executeSignatureFetch(work, controller.signal).then((response) => {
        if (controller.signal.aborted || state.workspace.getSnapshot().id !== workspaceId) return
        const before = state.getBuilderState().batchNumber
        const result = state.dispatchBuilder({ type: 'settleFetch', id: work.id, response })
        if (result.state.batchNumber !== before) finish()
      })
    }
  }, [state, workspaceId])
}
