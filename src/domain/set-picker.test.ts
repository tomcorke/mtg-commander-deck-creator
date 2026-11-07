import assert from 'node:assert/strict'
import test from 'node:test'

import { colourLeanings, setPickerRows } from './set-picker.ts'
import { setGuides } from './set-guides.ts'

const sets = [
  { code: 'fdn', name: 'Foundations', set_type: 'core', released_at: '2024-11-15' },
  {
    code: 'ydsk',
    name: 'Alchemy: Duskmourn',
    set_type: 'alchemy',
    digital: true,
    parent_set_code: 'dsk',
    released_at: '2024-10-15',
  },
  {
    code: 'dsk',
    name: 'Duskmourn: House of Horror',
    set_type: 'expansion',
    released_at: '2024-09-27',
  },
  {
    code: 'dsc',
    name: 'Duskmourn: House of Horror Commander',
    set_type: 'commander',
    parent_set_code: 'dsk',
    released_at: '2024-09-27',
  },
  {
    code: 'pdsk',
    name: 'Duskmourn: House of Horror Promos',
    set_type: 'promo',
    parent_set_code: 'dsk',
    released_at: '2024-09-27',
  },
  { code: 'c13', name: 'Commander 2013', set_type: 'commander', released_at: '2013-11-01' },
  { code: 'zzz', name: 'Future Set', set_type: 'expansion', released_at: '2099-01-01' },
]

test('search folds the Commander product into its main set and hides digital and promo sets', () => {
  const rows = setPickerRows(sets, 'dusk', false)
  assert.deepEqual(
    rows.map((row) => [row.set.code, row.commander?.code]),
    [['dsk', 'dsc']],
  )
})

test('the toggle reveals digital and promo sets', () => {
  const codes = setPickerRows(sets, 'dusk', true).map((row) => row.set.code)
  assert.deepEqual(codes, ['ydsk', 'dsk', 'pdsk'])
})

test('a Commander product search still shows its main set row', () => {
  assert.equal(setPickerRows(sets, 'dsc', false)[0]?.set.code, 'dsk')
})

test('an empty search lists released main sets only', () => {
  const codes = setPickerRows(sets, '', false, '2026-01-01').map((row) => row.set.code)
  assert.deepEqual(codes, ['fdn', 'dsk'])
})

test('standalone Commander products stay searchable', () => {
  assert.equal(setPickerRows(sets, 'commander 2013', false)[0]?.set.code, 'c13')
})

test('colour leanings keep up to three colours most legends share', () => {
  const legends = [['G', 'W'], ['G'], ['G', 'U'], ['W'], ['B']].map((color_identity) => ({
    color_identity,
  }))
  assert.deepEqual(colourLeanings(legends), ['G', 'W'])
  assert.deepEqual(colourLeanings([{ color_identity: [] }]), [])
})

test('every set guide cites an https source', () => {
  for (const guide of Object.values(setGuides)) assert.match(guide.source, /^https:\/\//)
})
