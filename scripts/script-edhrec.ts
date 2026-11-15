import { edhrecRefused, formatRunLog, liveEdhrecSession } from './live-edhrec.ts'

/** Opt-in transport for standalone investigation scripts. Non-EDHREC traffic is unchanged. */
export function scriptEdhrecFetch(mode: string, enabled: boolean, fetcher: typeof fetch = fetch) {
  if (!enabled) throw edhrecRefused(`${mode}; pass --live-edhrec`)
  const session = liveEdhrecSession({ mode, fetcher })
  process.once('exit', (code) => {
    process.stderr.write(
      `EDHREC run log: ${formatRunLog(session.finish(code === 0 ? 'completed' : 'error'))}\n`,
    )
  })
  return ((input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    if (url.hostname !== 'json.edhrec.com') return fetcher(input, init)
    const headers = new Headers(init?.headers)
    headers.delete('User-Agent')
    return session.fetch(url, { ...init, headers })
  }) as typeof fetch
}
