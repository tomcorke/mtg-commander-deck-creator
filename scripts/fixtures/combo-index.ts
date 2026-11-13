import type { Page } from 'playwright-core'
import type { ComboIndex } from '../../src/domain/combo-index.ts'

// Synthetic Spellbook-shaped rows over the B10 fixture cards; they make no claims about real combos.
const image = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}?1`
export const fixtureComboIndex: ComboIndex = {
  version: 1,
  metadata: {
    exportedAt: '2026-11-13T14:13:00+00:00',
    exportVersion: 'fixture',
    generatedAt: '2026-11-13T16:00:00.000Z',
  },
  cards: [
    ['B10 Commander', 'b10:B10 Commander', image(1)],
    ['B10 Existing ramp A', 'b10:B10 Existing ramp A', image(2)],
    ['B10 Last draw', 'b10:B10 Last draw', image(3)],
    ['B10 Cut A', 'b10:B10 Cut A', image(4)],
    ['B10 Theme 0', 'b10:B10 Theme 0', image(5)],
    ['B10 Theme 1', 'b10:B10 Theme 1', image(6)],
    ['B10 Ramp draw', 'b10:B10 Ramp draw', image(7)],
    ['B10 Red outsider', 'b10:B10 Red outsider', image(8)],
  ],
  results: [
    'Infinite colored mana',
    'Infinite card draw',
    'Infinite creature tokens',
    'Win the game',
  ],
  combos: [
    ['fixture-two', [1, 2], [0, 1], 'G', 40],
    ['fixture-commander', [~0, 3, 4], [2, 3, 0, 1], 'G', 10],
    ['fixture-near', [5, 6], [1], 'G', 5],
    ['fixture-off-colour', [5, 7], [3], 'GR', 99],
  ],
}

/** An `openScenario` hook that serves this combo index instead of the harness's 404. */
export const withComboIndex =
  (index: ComboIndex = fixtureComboIndex) =>
  (page: Page) =>
    page.route('**/combo-index.json', (route) => route.fulfill({ json: index }))
