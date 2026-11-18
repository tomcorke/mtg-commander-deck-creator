import assert from 'node:assert/strict'
import test from 'node:test'
import { commanderTriggerLink } from './commander-trigger-links.ts'

const commander = (detail: string) => [{ name: 'Commander', detail }]
const link = (
  detail: string,
  trigger = 'Whenever it deals combat damage to a player, draw a card.',
) => commanderTriggerLink({ name: 'Payoff', detail }, commander(trigger))

test('combat damage payoffs and explicit repeaters link to a commander trigger', () => {
  for (const detail of [
    'Whenever one or more creatures you control deal combat damage to a player, draw a card.',
    'Whenever a creature you control deals combat damage to a player, draw a card.',
    'Whenever a creature deals combat damage to one of your opponents, its controller exiles a card.',
    'If a creature you control dealing combat damage to a player causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.',
  ])
    assert.ok(link(detail), detail)
  assert.ok(
    link(
      'Whenever a creature you control deals combat damage to a player, draw.',
      'Whenever Commander deals combat damage to a player, exile cards.',
    ),
  )
})

test('land entry and friendly creature death triggers generalise beyond combat', () => {
  for (const trigger of [
    'Whenever a land enters under your control, draw a card.',
    'Whenever another creature you control dies, draw a card.',
  ])
    assert.ok(link(trigger, trigger))
})

test('unrelated conditions, reminder text, enemy triggers and self-only payoffs do not link', () => {
  for (const text of [
    'Whenever a creature an opponent controls deals combat damage to a player, draw.',
    'Whenever Payoff deals combat damage to a player, draw.',
    'Whenever a creature you control deals damage to a player, draw.',
    'Whenever a creature you control attacks, draw.',
    '(Whenever a creature you control deals combat damage to a player, draw.)',
    'If a permanent entering causes an ability to trigger, it triggers an additional time.',
  ])
    assert.equal(link(text), undefined, text)
  assert.equal(
    link(
      'Whenever a creature you control deals combat damage to a player, draw.',
      'Creatures you control deal combat damage to a player.',
    ),
    undefined,
  )
  assert.equal(link('Whenever a land enters under your control, draw.'), undefined)
})

test('Oracle short self-name in Kotis is recognised', () => {
  assert.ok(
    commanderTriggerLink(
      {
        name: 'Toski',
        detail: 'Whenever a creature you control deals combat damage to a player, draw a card.',
      },
      [
        {
          name: 'Kotis, the Fangkeeper',
          detail: 'Whenever Kotis deals combat damage to a player, exile cards.',
        },
      ],
    ),
  )
})
