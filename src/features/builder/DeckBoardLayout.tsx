import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  balanceColumns,
  listColumn,
  tileSpans,
  tileTrack,
  trackCapacity,
} from './deck-board-layout.ts'

/** One deck board group: its rendered section and how many entries (rows or tiles) it shows. */
export type DeckBoardGroup = { key: string; entries: number; node: ReactNode }

/**
 * Places deck board groups for the board's measured width (#499). List view balances them into
 * CSS columns with none left empty; Tiles view lets consecutive groups share rows of tile tracks.
 * Every group keeps one slot in one flat list, so re-placing or switching views never remounts a
 * group: collapsed groups, focus and hover previews survive.
 */
export function DeckBoardLayout({
  groups,
  tiles,
  busy,
}: {
  groups: DeckBoardGroup[]
  tiles: boolean
  busy: boolean
}) {
  const list = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Measure before paint, then follow resizes, so columns never flash at the wrong count.
  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const entries = groups.map((group) => group.entries)
  const tracks = trackCapacity(width, tiles ? tileTrack : listColumn)
  const columns = tiles ? [] : balanceColumns(entries, tracks)
  const columnStarts = new Set(columns.slice(1).map((column) => column[0]))
  const spans = tiles ? tileSpans(entries, tracks) : []
  return (
    <div
      ref={list}
      className={`deck-list${tiles ? ' deck-list--tiles' : ''}`}
      aria-busy={busy}
      style={{ '--deck-tracks': tiles ? tracks : columns.length || 1 } as CSSProperties}
    >
      {groups.map((group, index) => (
        <div
          className="deck-board-slot"
          key={group.key}
          data-column-start={columnStarts.has(index) || undefined}
          style={tiles ? ({ '--tile-span': spans[index] } as CSSProperties) : undefined}
        >
          {group.node}
        </div>
      ))}
    </div>
  )
}
