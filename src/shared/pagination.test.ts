import assert from 'node:assert/strict'
import test from 'node:test'

import { pageWindow } from './pagination.ts'

test('page windows cover every result once and clamp out-of-range pages', () => {
  assert.deepEqual(pageWindow(0, 12, 3), { page: 0, pages: 0, start: 0, end: 0 })
  assert.deepEqual(pageWindow(12, 12, 0), { page: 0, pages: 1, start: 0, end: 12 })
  assert.deepEqual(pageWindow(30, 12, 2), { page: 2, pages: 3, start: 24, end: 30 })
  assert.deepEqual(pageWindow(30, 12, 9), { page: 2, pages: 3, start: 24, end: 30 })
  assert.deepEqual(pageWindow(30, 12, -1), { page: 0, pages: 3, start: 0, end: 12 })
  const seen = Array.from({ length: 3 }, (_, page) => pageWindow(30, 12, page)).flatMap(
    ({ start, end }) => Array.from({ length: end - start }, (_, index) => start + index),
  )
  assert.deepEqual(
    seen,
    Array.from({ length: 30 }, (_, index) => index),
  )
})
