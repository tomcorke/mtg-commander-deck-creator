import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import { buildComboIndex, readSpellbookExport, type SpellbookVariant } from './build-combo-index.ts'

// Synthetic export rows in Spellbook's bulk shape; they test filtering, not real combos.
const cardUse = (name: string, mustBeCommander = false, quantity = 1) => ({
  card: {
    name,
    oracleId: `oracle-${name}`,
    imageUriFrontNormal: `https://cards.scryfall.io/grid/front/6/4/64513f0a-067d-4b70-bb23-9ebe606bda1a.webp?17`,
  },
  quantity,
  mustBeCommander,
})
const variant = (id: string, overrides: Partial<SpellbookVariant> = {}): SpellbookVariant => ({
  id,
  status: 'OK',
  uses: [cardUse('Altar'), cardUse('Witness {"}')],
  requires: [],
  produces: [
    { feature: { name: 'Hidden', status: 'HU' } },
    { feature: { name: 'Helper', status: 'H' } },
    { feature: { name: 'Standalone', status: 'S' } },
  ],
  identity: 'B',
  popularity: 3,
  legalities: { commander: true },
  ...overrides,
})
const exportText = (variants: SpellbookVariant[]) =>
  JSON.stringify({
    timestamp: '2026-11-13T14:13:00+00:00',
    version: '7.4.1',
    variants,
    aliases: [{ id: 'old', variant: '1' }],
  })
// Tiny chunks prove elements and strings may span stream chunk boundaries.
const chunked = (text: string) =>
  Readable.from(text.match(/[\s\S]{1,7}/g)!.map((part) => Buffer.from(part)))

test('streams each variant across chunk boundaries and reads the export header', async () => {
  const seen: string[] = []
  const header = await readSpellbookExport(
    chunked(exportText([variant('1'), variant('2', { uses: [cardUse('Brace } [ "x"')] })])),
    (item) => seen.push(item.id),
  )
  assert.deepEqual(seen, ['1', '2'])
  assert.deepEqual(header, { timestamp: '2026-11-13T14:13:00+00:00', version: '7.4.1' })
})

test('rejects a truncated export', async () => {
  const text = exportText([variant('1')])
  await assert.rejects(
    readSpellbookExport(chunked(text.slice(0, -20)), () => {}),
    /Truncated/,
  )
})

test('keeps public, Commander-legal, named single-card combos in a compact index', async () => {
  const kept = Array.from({ length: 1000 }, (_, position) => variant(`keep-${position}`))
  const index = await buildComboIndex(
    chunked(
      exportText([
        variant('commander', { uses: [cardUse('Leader', true), cardUse('Altar')], status: 'E' }),
        ...kept,
        variant('draft', { status: 'D' }),
        variant('not-legal', { legalities: { commander: false } }),
        variant('template', { requires: [{ template: { name: 'Sac outlet' } }] }),
        variant('two-copies', { uses: [cardUse('Rats', false, 2)] }),
        variant('spoiler', { spoiler: true }),
      ]),
    ),
    new Date('2026-11-13T16:00:00Z'),
  )
  assert.equal(index.combos.length, 1001)
  assert.deepEqual(index.metadata, {
    exportedAt: '2026-11-13T14:13:00+00:00',
    exportVersion: '7.4.1',
    generatedAt: '2026-11-13T16:00:00.000Z',
  })
  assert.deepEqual(index.cards.slice(0, 3), [
    ['Leader', 'oracle-Leader', '64513f0a-067d-4b70-bb23-9ebe606bda1a?17'],
    ['Altar', 'oracle-Altar', '64513f0a-067d-4b70-bb23-9ebe606bda1a?17'],
    ['Witness {"}', 'oracle-Witness {"}', '64513f0a-067d-4b70-bb23-9ebe606bda1a?17'],
  ])
  // A must-be-commander card is stored as ~index; hidden utilities are dropped, standalone first.
  assert.deepEqual(index.combos[0], ['commander', [~0, 1], [0, 1], 'B', 3])
  assert.deepEqual(index.results, ['Standalone', 'Helper'])
  assert(
    !index.combos.some(([id]) => ['draft', 'not-legal', 'template', 'two-copies'].includes(id)),
  )
})

test('refuses an export too small to be complete', async () => {
  await assert.rejects(buildComboIndex(chunked(exportText([variant('1')]))), /unexpectedly small/)
})
