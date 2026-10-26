/** The page to show, clamped into range, and the zero-based `[start, end)` slice it covers. */
export function pageWindow(count: number, pageSize: number, page: number) {
  const pages = Math.ceil(count / pageSize)
  const current = Math.min(Math.max(0, page), Math.max(0, pages - 1))
  const start = current * pageSize
  return { page: current, pages, start, end: Math.min(count, start + pageSize) }
}
