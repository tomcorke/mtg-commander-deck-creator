import assert from 'node:assert/strict'
import test from 'node:test'
import {
  identityLabel,
  identityName,
  identitySummary,
  identityTerm,
  matchesIdentity,
} from './colour-identity.ts'

test('each match mode sends its Scryfall identity operator', () => {
  assert.equal(identityTerm(['G', 'B']), 'id=bg')
  assert.equal(identityTerm(['G', 'B'], 'exactly'), 'id=bg')
  assert.equal(identityTerm(['G', 'B'], 'within'), 'id<=bg')
  assert.equal(identityTerm(['G', 'B'], 'including'), 'id>=bg')
  assert.equal(identityTerm([], 'within'), '', 'no colours, no term')
})

test('local matching agrees with each mode', () => {
  const golgari = ['B', 'G']
  const identities = { black: ['B'], golgari: ['G', 'B'], sultai: ['U', 'B', 'G'], none: [] }
  const matching = (match: 'exactly' | 'within' | 'including') =>
    Object.entries(identities)
      .filter(([, identity]) => matchesIdentity(identity, golgari, match))
      .map(([name]) => name)
  assert.deepEqual(matching('exactly'), ['golgari'])
  assert.deepEqual(matching('within'), ['black', 'golgari', 'none'])
  assert.deepEqual(matching('including'), ['golgari', 'sultai'])
  assert(matchesIdentity(['R'], [], 'including'), 'no chosen colours match everything')
})

test('combinations are named the way EDHREC lists them; single colours are not', () => {
  assert.equal(identityName(['G', 'B']), 'Golgari')
  assert.equal(identityName(['U', 'W']), 'Azorius')
  assert.equal(identityName(['W', 'B', 'G']), 'Abzan')
  assert.equal(identityName(['R', 'U', 'B', 'W']), 'Yore-Tiller')
  assert.equal(identityName(['G', 'W', 'U', 'B']), 'Witch-Maw')
  assert.equal(identityName(['W', 'U', 'B', 'R', 'G']), 'Five-colour')
  assert.equal(identityName(['B']), undefined)
  assert.equal(identityName([]), undefined)
  assert.equal(identityLabel(['G', 'B']), 'Golgari · Black, Green')
  assert.equal(identityLabel(['B']), 'Black')
})

test('the filter summary names the mode and the combination', () => {
  assert.equal(
    identitySummary(['G', 'B'], 'exactly'),
    'Colour identity exactly Golgari (Black, Green)',
  )
  assert.equal(identitySummary(['B'], 'including'), 'Colour identity including Black')
  assert.equal(identitySummary([], 'within'), '')
})
