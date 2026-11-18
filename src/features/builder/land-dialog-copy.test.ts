import assert from 'node:assert/strict'
import test from 'node:test'
import { plural } from './land-dialog-copy.ts'

test('basic-land searches uses its explicit plural', () => {
  assert.equal(plural(2, 'basic-land search', 'basic-land searches'), '2 basic-land searches')
  assert.equal(plural(1, 'basic-land search', 'basic-land searches'), '1 basic-land search')
  assert.equal(plural(0, 'basic-land search', 'basic-land searches'), '0 basic-land searches')
})

test('regular land dialog plurals retain singular and plural forms', () => {
  for (const word of ['basic', 'land', 'nonbasic land']) {
    assert.equal(plural(1, word), `1 ${word}`)
    assert.equal(plural(2, word), `2 ${word}s`)
    assert.equal(plural(0, word), `0 ${word}s`)
  }
})
