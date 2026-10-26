import type { BuilderAction, BuilderActionResult, BuilderState } from '../domain/builder-state.ts'

export type BuilderActionHost = {
  builderState: BuilderState
  getBuilderState: () => BuilderState
  dispatchBuilder: (action: BuilderAction) => BuilderActionResult
}

export type AppActionContext = BuilderState & BuilderActionHost & Record<string, any>

export function builderAction(
  host: BuilderActionHost,
  action: BuilderAction | ((state: BuilderState) => BuilderAction),
) {
  return host.dispatchBuilder(
    typeof action === 'function' ? action(host.getBuilderState()) : action,
  )
}
