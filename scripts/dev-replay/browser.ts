// Imported only by the serve-only replay transform; original URLs stay in application state.
export function resourceUrl(value: string) {
  if (!value || !/^https?:\/\//.test(value)) return value
  if (new URL(value).origin === location.origin) return value
  const url = new URL('/__dev-provider', location.origin)
  url.searchParams.set('url', value)
  return url.href
}

export const replayFetch: typeof fetch = (input, init) =>
  fetch(
    input instanceof Request
      ? new Request(resourceUrl(input.url), input)
      : resourceUrl(String(input)),
    init,
  )
