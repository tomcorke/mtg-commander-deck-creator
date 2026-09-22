export type AppView = 'start' | 'builder'
export type AppModal =
  'saved' | 'import' | 'search' | 'basics' | 'export' | 'card' | 'recommendation-settings'
export type AppHistoryState = {
  app: 'commander-deck-creator'
  view: AppView
  modal: AppModal | null
  entry: boolean
}

export const appHistoryKey = 'commander-deck-creator'
export const appModals: AppModal[] = [
  'saved',
  'import',
  'search',
  'basics',
  'export',
  'card',
  'recommendation-settings',
]

export function routeHash(view: AppView, modal: AppModal | null) {
  return `#${view === 'builder' ? 'build' : 'start'}${modal ? `/${modal}` : ''}`
}

export function parseAppRoute(hashValue: string, stateValue: unknown): AppHistoryState | null {
  const state = stateValue as Partial<AppHistoryState> | null
  const hash = hashValue.replace(/^#/, '').split('/')
  const view = hash[0] === 'build' ? 'builder' : hash[0] === 'start' ? 'start' : null
  const modal = appModals.includes(hash[1] as AppModal) ? (hash[1] as AppModal) : null
  if (view) {
    return {
      app: appHistoryKey,
      view,
      modal,
      entry:
        state?.app === appHistoryKey &&
        state.view === view &&
        (state.modal ?? null) === modal &&
        state.entry === true,
    }
  }
  return state?.app === appHistoryKey && (state.view === 'start' || state.view === 'builder')
    ? {
        app: appHistoryKey,
        view: state.view,
        modal: state.modal ?? null,
        entry: state.entry === true,
      }
    : null
}

export function readAppRoute(): AppHistoryState | null {
  return parseAppRoute(window.location.hash, window.history.state)
}

export function writeAppRoute(route: AppHistoryState, replace = false) {
  const url = new URL(window.location.href)
  url.hash = routeHash(route.view, route.modal)
  window.history[replace ? 'replaceState' : 'pushState'](route, '', url.href)
}
