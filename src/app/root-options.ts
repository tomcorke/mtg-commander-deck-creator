import type { RootOptions } from 'react-dom/client'

export const rootOptions: RootOptions = {
  // Boundaries report allowlisted diagnostics. React's default logs the raw error payload.
  onCaughtError: () => {},
}
