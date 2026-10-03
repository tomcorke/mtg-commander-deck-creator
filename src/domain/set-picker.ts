import type { ScryfallSet } from './card-model.ts'

// Below this, Only mode rarely leaves enough real choices to fill 99 slots.
export const onlyModeMinimumPool = 150

export type SetPickerRow = { set: ScryfallSet; commander?: ScryfallSet }

const supplementalTypes = new Set(['promo', 'alchemy', 'token', 'memorabilia'])
const mainTypes = new Set(['expansion', 'core'])

export const isSupplementalSet = (set: ScryfallSet) =>
  set.digital === true || supplementalTypes.has(set.set_type ?? '')

// Rows depend only on the catalog, query, and toggle, never on the selection, so ticking a
// set never moves other rows. A main set's Commander product rides on the main set's row.
export function setPickerRows(
  sets: ScryfallSet[],
  query: string,
  showSupplemental: boolean,
  today = new Date().toISOString().slice(0, 10),
): SetPickerRow[] {
  const visible = sets.filter((set) => showSupplemental || !isSupplementalSet(set))
  const codes = new Set(visible.map((set) => set.code))
  const commanderFor = new Map<string, ScryfallSet>()
  for (const set of visible) {
    const parent = set.parent_set_code
    if (set.set_type === 'commander' && parent && codes.has(parent) && !commanderFor.has(parent))
      commanderFor.set(parent, set)
  }
  const folded = new Set([...commanderFor.values()].map((set) => set.code))
  const rows = visible
    .filter((set) => !folded.has(set.code))
    .map((set) => ({ set, commander: commanderFor.get(set.code) }))
  const search = query.trim().toLowerCase()
  if (search.length < 2)
    return rows
      .filter(({ set }) => mainTypes.has(set.set_type ?? '') && (set.released_at ?? '') <= today)
      .slice(0, 12)
  const matches = (set?: ScryfallSet) =>
    !!set && `${set.name} ${set.code}`.toLowerCase().includes(search)
  return rows.filter((row) => matches(row.set) || matches(row.commander)).slice(0, 40)
}
