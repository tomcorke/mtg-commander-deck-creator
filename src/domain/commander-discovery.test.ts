import assert from 'node:assert/strict'
import test from 'node:test'
import type { ScryfallCard } from './card-model.ts'
import {
  discoverCommanders,
  discoveryNames,
  discoveryQueries,
  filterCommanders,
  orderCommanders,
  scryfallPageSize,
} from './commander-discovery.ts'
import { selectableThemes } from './commander-catalog.ts'

const card = (name: string, changes: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  oracle_id: name,
  type_line: 'Legendary Creature — Human',
  cmc: 2,
  color_identity: ['W', 'G'],
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: '1',
  prints_search_uri: '',
  ...changes,
})

test('combined exact identity/name filters fail closed and deduplicate Oracle identities', () => {
  const good = card('Token leader')
  const cards = [
    good,
    card('Reprint', { oracle_id: good.oracle_id }),
    card('Green only', { color_identity: ['G'] }),
    card('Naya', { color_identity: ['W', 'G', 'R'] }),
    card('Banned', { legalities: { commander: 'banned' } }),
    card('Unknown', { color_identity: undefined } as unknown as Partial<ScryfallCard>),
    card('Unknown mana', { cmc: undefined }),
    card('Not legendary', { type_line: 'Creature' }),
    card('Back-face legend', {
      type_line: 'Land // Legendary Creature',
      card_faces: [
        { name: 'Front', type_line: 'Land' },
        { name: 'Back', type_line: 'Legendary Creature' },
      ],
    }),
  ]
  assert.deepEqual(
    filterCommanders(cards, { theme: 'Tokens', colours: ['G', 'W'], search: 'token' }),
    [good],
  )
  const pool = Array.from({ length: 20 }, (_, n) => ({ card: card(String(n)), reason: 'Test' }))
  assert.deepEqual(orderCommanders(pool), pool, 'search order is kept so pages never repeat')
})

test('every start theme has a bounded query or an expanded curated fallback', () => {
  for (const theme of selectableThemes) {
    if (discoveryQueries[theme]) continue
    assert.ok(discoveryNames(theme).length > 6, theme)
    assert.ok(discoveryNames(theme).length <= 12, theme)
  }
})

test('source labels are honest and name search never bypasses theme/identity', async () => {
  const queries: string[] = []
  const providers = {
    search: async (query: string) => {
      queries.push(query)
      return [card('Equipment leader')]
    },
    hydrate: async (identifiers: { name?: string }[]) => {
      assert.ok(identifiers.length <= 12)
      return [card('Token leader'), card('Other colour', { color_identity: ['B'] })]
    },
  }
  const result = await discoverCommanders(
    { theme: 'Tokens', colours: ['G', 'W'], search: 'Token' },
    undefined,
    providers,
  )
  assert.deepEqual(
    result.commanders.map(({ card: c, reason }) => [c.name, reason]),
    [['Token leader', 'Picked for Tokens decks']],
  )
  assert.equal(queries.length, 0)
  const query = await discoverCommanders(
    { theme: 'Equipment', colours: ['G', 'W'], search: 'Equipment leader' },
    undefined,
    providers,
  )
  assert.match(queries[0], /is:commander legal:commander/)
  assert.match(queries[0], /id=gw/)
  assert.match(queries[0], /name:"Equipment leader"/)
  assert.match(queries[0], /o:equipment/)
  assert.equal(query.more, false)
  assert.equal(query.commanders[0].reason, 'Commanders whose rules text mentions Equipment')
  const aborted = new AbortController()
  aborted.abort()
  await assert.rejects(
    discoverCommanders({ theme: 'Tokens', colours: [], search: '' }, aborted.signal, providers),
    { name: 'AbortError' },
  )
})

test('several creature types find commanders for any of them, covering more types first', async () => {
  const queries: string[] = []
  const providers = {
    search: async (query: string) => {
      queries.push(query)
      return [
        card('Cat leader', { type_line: 'Legendary Creature — Cat', oracle_text: '' }),
        card('Both leader', {
          type_line: 'Legendary Creature — Cat',
          oracle_text: 'Dogs you control get +1/+1.',
        }),
      ]
    },
    hydrate: async () => [],
  }
  const found = await discoverCommanders(
    { theme: 'Cats', colours: [], search: '', creatureTypes: ['Dogs'] },
    undefined,
    providers,
  )
  assert.match(queries[0], /\(t:"Cat" .*\) or \(t:"Dog" .*\)/)
  assert.deepEqual(
    found.commanders.map(({ card: { name }, reason }) => [name, reason]),
    [
      ['Both leader', 'Covers Cats and Dogs'],
      ['Cat leader', 'Covers Cats'],
    ],
  )
})

test('a search filling the Scryfall page limit reports that more commanders match', async () => {
  const full = Array.from({ length: scryfallPageSize }, (_, n) => card(`Leader ${n}`))
  const providers = { search: async () => full, hydrate: async () => full }
  const searched = await discoverCommanders(
    { theme: '', colours: [], search: '' },
    undefined,
    providers,
  )
  assert.equal(searched.more, true)
  assert.deepEqual(
    searched.commanders.map(({ card: { name } }) => name),
    full.map(({ name }) => name),
  )
  const curated = await discoverCommanders(
    { theme: 'Tokens', colours: [], search: '' },
    undefined,
    providers,
  )
  assert.equal(curated.more, false)
})
