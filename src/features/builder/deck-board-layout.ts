// Deck board placement (#499). Groups keep their section order; List view balances them into
// columns and Tiles view lets consecutive groups share rows of tile tracks.

export const listColumn = { width: 240, gap: 32 }
// One tile track fits the longest one-word group heading, PLANESWALKERS, beside its count.
export const tileTrack = { width: 150, gap: 10 }
/** A List group heading is about one and a half rows tall. */
const headingRows = 1.5

/** How many tracks of at least `width` fit a container, at least one. */
export const trackCapacity = (available: number, { width, gap }: typeof listColumn) =>
  Math.max(1, Math.floor((available + gap) / (width + gap)))

/**
 * Splits groups, in order, into `min(capacity, groups)` columns so none is empty and the
 * tallest column is as short as possible. Ties keep more groups in earlier columns.
 */
export function balanceColumns(entries: number[], capacity: number): number[][] {
  const count = Math.min(Math.max(1, capacity), entries.length)
  if (!count) return []
  const prefix = [0]
  for (const rows of entries) prefix.push(prefix[prefix.length - 1] + rows + headingRows)
  const height = (from: number, to: number) => prefix[to] - prefix[from]
  // tallest[k][i]: the shortest possible tallest column for the first i groups in k columns.
  const tallest = [prefix.map((_, end) => height(0, end))]
  const cuts: number[][] = [prefix.map(() => 0)]
  for (let k = 1; k < count; k += 1) {
    tallest.push([])
    cuts.push([])
    for (let end = k + 1; end <= entries.length; end += 1) {
      let best = Infinity
      for (let cut = k; cut < end; cut += 1) {
        const candidate = Math.max(tallest[k - 1][cut], height(cut, end))
        if (candidate <= best) {
          best = candidate
          cuts[k][end] = cut
        }
      }
      tallest[k][end] = best
    }
  }
  const columns: number[][] = []
  let end = entries.length
  for (let k = count - 1; k >= 0; k -= 1) {
    const start = k ? cuts[k][end] : 0
    columns.unshift(Array.from({ length: end - start }, (_, offset) => start + offset))
    end = start
  }
  return columns
}

/**
 * Tile tracks each group spans when groups fill rows of `capacity` tracks in order. A group
 * shares a row when it fits or at least half the row is free; otherwise it starts the next row,
 * as CSS grid auto-placement does. It then takes the fewest tile rows, at the narrowest span for
 * that row count, so six tiles in five free tracks become 3 + 3 rather than 5 + 1.
 */
export function tileSpans(entries: number[], capacity: number) {
  let free = capacity
  return entries.map((entry) => {
    const count = Math.max(1, entry)
    if (count > free && free < Math.ceil(capacity / 2)) free = capacity
    const span = Math.ceil(count / Math.ceil(count / free))
    free = free - span || capacity
    return span
  })
}
