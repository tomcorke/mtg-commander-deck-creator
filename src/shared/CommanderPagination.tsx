import { commanderPageSize } from '../app/useCommanderDiscovery.ts'
import { Pagination } from './Pagination.tsx'

type Matches = {
  count: number
  more: boolean
  total?: number
  page: number
  setPage: (page: number) => void
  fetchMore?: () => void
  fetching: boolean
  moreError: string
}

/**
 * Commander result pages. Paging past the fetched commanders fetches Scryfall's next page (#485);
 * narrowing the filters is only a tip.
 */
export function CommanderPagination({ matches, label }: { matches: Matches; label: string }) {
  return (
    <Pagination
      label={label}
      noun="commanders"
      count={matches.count}
      pageSize={commanderPageSize}
      page={matches.page}
      onPage={matches.setPage}
      partial={matches.more}
      total={matches.total}
      onMore={matches.fetchMore}
    >
      {matches.fetching ? (
        <span role="status">Loading more commanders…</span>
      ) : matches.moreError ? (
        <span className="form-error" role="alert">
          {matches.moreError} Choose Next page to try again.
        </span>
      ) : (
        matches.more && <span>Tip: narrow the filters to find a commander faster.</span>
      )}
    </Pagination>
  )
}
