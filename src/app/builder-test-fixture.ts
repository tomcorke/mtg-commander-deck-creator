import {
  applyBuilderAction,
  createBuilderState,
  type BuilderAction,
  type BuilderState,
} from '../domain/builder-state.ts'
import { builderPoolKey } from '../domain/builder-settings.ts'
import type { BuilderActionHost, AppActionContext } from './builder-action.ts'

/** Keep effect-test spies while exercising the same reducer as the controller. */
export function withBuilderActions<T extends Record<string, any>>(deps: T): T & BuilderActionHost {
  if ('dispatchBuilder' in deps) return deps as T & BuilderActionHost
  const initial = createBuilderState('2026-10-26', 'fixture-build')
  let cached = initial
  const snapshot = (): BuilderState => {
    const next = {
      ...initial,
      ...Object.fromEntries(
        Object.keys(initial)
          .filter((key) => key in deps)
          .map((key) => [key, deps[key]]),
      ),
      excludeGameChangers: deps.excludeGameChangers ?? false,
    }
    if ((Object.keys(initial) as (keyof BuilderState)[]).some((key) => next[key] !== cached[key]))
      cached = next
    return cached
  }
  if (!('committedPoolKey' in deps))
    (deps as Record<string, unknown>).committedPoolKey = builderPoolKey(snapshot())
  Object.defineProperty(deps, 'getBuilderState', {
    value: snapshot,
    enumerable: true,
    configurable: true,
  })
  Object.defineProperty(deps, 'builderState', {
    get: snapshot,
    configurable: true,
    enumerable: true,
  })
  Object.defineProperty(deps, 'dispatchBuilder', {
    value: (action: BuilderAction) => {
      const before = snapshot()
      const result = applyBuilderAction(before, action)
      const after = result.state
      for (const key of Object.keys(before) as (keyof BuilderState)[]) {
        if (after[key] === before[key]) continue
        const setter = deps[`set${key[0].toUpperCase()}${key.slice(1)}`]
        if (setter)
          setter(
            key === 'commanderDetails' || typeof after[key] !== 'object'
              ? after[key]
              : () => after[key],
          )
        ;(deps as Record<string, unknown>)[key] = after[key]
      }
      cached = after
      return result
    },
    configurable: true,
    enumerable: true,
  })
  return deps as T & BuilderActionHost
}

export function withBuilderFixture<A extends unknown[], R>(
  effect: (deps: AppActionContext, ...args: A) => R,
) {
  return (deps: Record<string, any>, ...args: A) =>
    effect(withBuilderActions(deps) as AppActionContext, ...args)
}
