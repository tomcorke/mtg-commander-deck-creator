import type { ActionDeps } from './recommendation-actions.ts'

// Every asynchronous deck writer captures the workspace, including same-commander forks.
export function deckJob(deps: ActionDeps, extraCurrent = () => true) {
  const workspaceId = deps.workspace?.getSnapshot().id
  const isCurrent = () =>
    extraCurrent() && (!deps.workspace || deps.workspace.getSnapshot().id === workspaceId)
  const guarded = { ...deps }
  for (const [key, value] of Object.entries(deps))
    if (
      typeof value === 'function' &&
      (/^set[A-Z]/.test(key) || ['navigateView', 'closeModal', 'loadPrintings'].includes(key))
    )
      guarded[key] = (...args: unknown[]) => (isCurrent() ? value(...args) : undefined)
  return { deps: guarded as ActionDeps, isCurrent }
}
