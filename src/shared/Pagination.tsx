import type { ReactNode } from 'react'

import { pageWindow } from './pagination.ts'

type Props = {
  label: string
  /** Plural result noun, such as "cards". */
  noun: string
  count: number
  pageSize: number
  page: number
  onPage: (page: number) => void
  /** The count is only what has loaded so far; more results exist. */
  partial?: boolean
  children?: ReactNode
}

/** Result range, page position, and previous/next controls shared by paginated card lists. */
export function Pagination({
  label,
  noun,
  count,
  pageSize,
  page,
  onPage,
  partial,
  children,
}: Props) {
  const window = pageWindow(count, pageSize, page)
  return (
    <nav className="pagination" aria-label={label}>
      {count > 0 && (
        <p>
          Showing {window.start + 1}–{window.end} of {count}
          {partial ? ' loaded' : ''} {noun}
          {window.pages > 1 && ` · Page ${window.page + 1} of ${window.pages}`}
        </p>
      )}
      {window.pages > 1 && (
        <>
          <button
            className="export"
            type="button"
            disabled={window.page === 0}
            onClick={() => onPage(window.page - 1)}
          >
            Previous page
          </button>
          <button
            className="export"
            type="button"
            disabled={window.page === window.pages - 1}
            onClick={() => onPage(window.page + 1)}
          >
            Next page
          </button>
        </>
      )}
      {children}
    </nav>
  )
}
