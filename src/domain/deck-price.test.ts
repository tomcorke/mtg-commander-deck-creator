import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeDeckPrice,
  describeRemainingBudget,
  deckPriceTotal,
  exceedsDeckBudget,
  remainingDeckBudget,
} from './deck-price.ts'

test('deck total sums each entry in cents and counts unpriced cards', () => {
  const total = deckPriceTotal([
    { price: '0.10' },
    { price: '0.20' },
    { price: '12.35' },
    { price: '' },
    {},
    { price: 'n/a' },
  ])
  assert.deepEqual(total, { total: 12.65, priced: 3, unpriced: 3 })
  assert.equal(describeDeckPrice(total), '$12.65 · 3 cards unpriced')
  assert.equal(describeDeckPrice(deckPriceTotal([{}])), '$0.00 · 1 card unpriced')
  assert.equal(describeDeckPrice(deckPriceTotal([{ price: '1234.5' }])), '$1,234.50')
})

test('repeated entries such as basics each count once', () => {
  assert.equal(deckPriceTotal(Array.from({ length: 30 }, () => ({ price: '0.25' }))).total, 7.5)
})

test('remaining budget subtracts the priced deck total', () => {
  const deck = [{ price: '40.00' }, { price: '35.50' }, {}]
  assert.equal(remainingDeckBudget(null, deck), null)
  assert.equal(remainingDeckBudget(100, deck), 24.5)
  assert.equal(remainingDeckBudget(50, deck), -25.5)
  assert.equal(describeRemainingBudget(100, 24.5), '$24.50 left of $100.00 budget')
  assert.equal(describeRemainingBudget(50, -25.5), '$25.50 over $50.00 budget')
})

test('only a priced card above the remaining budget exceeds it', () => {
  assert.equal(exceedsDeckBudget({ price: '25' }, 24.5), true)
  assert.equal(exceedsDeckBudget({ price: '24.50' }, 24.5), false)
  assert.equal(exceedsDeckBudget({}, 0), false)
  assert.equal(exceedsDeckBudget({ price: '0' }, -3), false)
  assert.equal(exceedsDeckBudget({ price: '99' }, null), false)
})
