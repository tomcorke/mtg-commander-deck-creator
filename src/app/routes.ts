export type AppView = 'start' | 'builder'
export type AppModal =
  | 'saved'
  | 'import'
  | 'search'
  | 'basics'
  | 'export'
  | 'card'
  | 'review'
  | 'review-changes'
  | 'review-confirm'
  | 'doctor'
  | 'doctor-history'
  | 'recommendation-settings'
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
  'review',
  'review-changes',
  'review-confirm',
  'doctor',
  'doctor-history',
  'recommendation-settings',
]

export const reviewSteps = ['Diagnose', 'Choose changes', 'Confirm'] as const
export type DeckReviewStep = (typeof reviewSteps)[number]
export const reviewRoutes = ['review', 'review-changes', 'review-confirm'] as const

export function reviewStepForModal(modal: AppModal | null): DeckReviewStep | null {
  if (modal === 'doctor') return 'Diagnose'
  const index = reviewRoutes.findIndex((route) => route === modal)
  return index < 0 ? null : reviewSteps[index]
}

export function reviewBackModal(step: DeckReviewStep): AppModal | null {
  return step === 'Confirm' ? 'review-changes' : step === 'Choose changes' ? 'review' : null
}

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
