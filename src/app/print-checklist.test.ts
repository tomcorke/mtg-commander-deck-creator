import assert from 'node:assert/strict'
import test from 'node:test'
import { toDeckCard, type DeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { checklistGroups } from './print-checklist.ts'

const card = (name: string, typeLine: string, collectorNumber = '1', set = 'tst'): DeckCard =>
  toDeckCard({
    name,
    type_line: typeLine,
    cmc: 1,
    legalities: { commander: 'legal' },
    color_identity: ['G'],
    set,
    collector_number: collectorNumber,
    prints_search_uri: '',
    image_uris: { normal: `https://example.test/${name}.jpg` },
  } satisfies ScryfallCard)

const commander = card('Leader', 'Legendary Creature — Elf')
const deck = [
  commander,
  card('Zebra', 'Creature — Horse'),
  card('Forest', 'Basic Land — Forest', '280'),
  card('Ant', 'Creature — Insect'),
  card('Forest', 'Basic Land — Forest', '280'),
  card('Forest', 'Basic Land — Forest', '281'),
  card('Sol Ring', 'Artifact', '3', 'c21'),
  card('Growth', 'Instant'),
]
const sideboard = [card('Spare', 'Sorcery')]
const lines = (groups: ReturnType<typeof checklistGroups>) =>
  groups.map(({ section, count, lines }) => [
    section,
    count,
    lines.map(
      ({ card, quantity }) => `${quantity} ${card.name} ${card.set} ${card.collectorNumber}`,
    ),
  ])

test('the whole-deck checklist groups printings by deck board type, then the sideboard', () => {
  const groups = checklistGroups({
    commander: 'Leader',
    deck,
    sideboard,
    ownedCards: {},
    neededOnly: false,
  })
  assert.deepEqual(lines(groups), [
    ['Commander', 1, ['1 Leader tst 1']],
    ['Creatures', 2, ['1 Ant tst 1', '1 Zebra tst 1']],
    ['Artifacts', 1, ['1 Sol Ring c21 3']],
    ['Instants', 1, ['1 Growth tst 1']],
    ['Lands', 3, ['2 Forest tst 280', '1 Forest tst 281']],
    ['Sideboard', 1, ['1 Spare tst 1']],
  ])
})

test('the still-needed checklist leaves out owned copies and the sideboard', () => {
  const groups = checklistGroups({
    commander: 'Leader',
    deck,
    sideboard,
    ownedCards: { leader: 1, forest: 2, ant: 1 },
    neededOnly: true,
  })
  assert.deepEqual(lines(groups), [
    ['Creatures', 1, ['1 Zebra tst 1']],
    ['Artifacts', 1, ['1 Sol Ring c21 3']],
    ['Instants', 1, ['1 Growth tst 1']],
    ['Lands', 1, ['1 Forest tst 281']],
  ])
})
