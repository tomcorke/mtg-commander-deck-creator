/** Keep explicit includes and excludes for options that survive a refreshed plan. */
export function reconcileLandSelection(
  previousOptions: string[],
  selected: string[],
  options: string[],
  defaults: string[],
) {
  return options.filter((name) =>
    previousOptions.includes(name) ? selected.includes(name) : defaults.includes(name),
  )
}

/** Apply the planner's slot change to the edited split, preserving blank fields. */
export function resizeBasicCounts(
  counts: Record<string, number>,
  delta: number,
  previous: Record<string, number> = {},
  defaults: Record<string, number> = {},
) {
  const next = { ...counts }
  const names = Object.keys(next).filter((name) => Number.isInteger(next[name]))
  for (const name of names) {
    const change = (defaults[name] ?? 0) - (previous[name] ?? 0)
    const count = Math.max(0, next[name] + change)
    delta -= count - next[name]
    next[name] = count
  }
  while (delta !== 0 && names.length) {
    const name = names.reduce((best, candidate) =>
      next[candidate] > next[best] ? candidate : best,
    )
    if (delta < 0 && !(next[name] > 0)) break
    next[name] += Math.sign(delta)
    delta -= Math.sign(delta)
  }
  return next
}
