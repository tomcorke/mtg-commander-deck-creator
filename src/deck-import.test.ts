import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchScryfallCollection, matchImportedCard, missingCardNames, parseDeckList } from './deck-import.ts'

test('retries transient Scryfall collection failures', async () => {
  let attempts = 0
  const fetcher = async () => new Response('', { status: ++attempts < 3 ? 503 : 200 })
  const response = await fetchScryfallCollection([{ name: 'Tireless Provisioner' }], fetcher as typeof fetch, async () => undefined)
  assert.equal(response.status, 200)
  assert.equal(attempts, 3)
})

test('does not retry invalid Scryfall collection requests', async () => {
  let attempts = 0
  const response = await fetchScryfallCollection([{ name: 'Missing' }], (async () => { attempts++; return new Response('', { status: 400 }) }) as typeof fetch)
  assert.equal(response.status, 400)
  assert.equal(attempts, 1)
})

test('falls back from missing printing to matching card name', () => {
  const entry = { name: 'Tireless Provisioner', quantity: 1, set: 'bad', collectorNumber: '999', board: 'mainboard' as const }
  const fallback = { name: 'Tireless Provisioner', set: 'mh2', collector_number: '180' }
  assert.equal(matchImportedCard(entry, [fallback]), fallback)
  assert.equal(matchImportedCard({ ...entry, name: 'Missing' }, [fallback]), undefined)
})

test('reports missing name and printing identifiers as card names', () => {
  const cards = parseDeckList('1 Sol Ring\n1 Forest (M3C) 317').cards
  assert.deepEqual(missingCardNames([{ name: 'Sol Ring' }, { set: 'm3c', collector_number: '317' }], cards), ['Sol Ring', 'Forest'])
})

test('parses common deck-list syntax, printings, and boards', () => {
  assert.deepEqual(parseDeckList(`COMMANDER:\n1 Anikthea, Hand of Erebos (CMM) 705\n\nDeck\n2 Forest [M3C: 317]\n1 Sol Ring\nSIDEBOARD:\n1 Doomwake Giant (C15) 21`).cards, [
    { name: 'Anikthea, Hand of Erebos', quantity: 1, set: 'cmm', collectorNumber: '705', board: 'commander' },
    { name: 'Forest', quantity: 2, set: 'm3c', collectorNumber: '317', board: 'mainboard' },
    { name: 'Sol Ring', quantity: 1, set: undefined, collectorNumber: undefined, board: 'mainboard' },
    { name: 'Doomwake Giant', quantity: 1, set: 'c15', collectorNumber: '21', board: 'sideboard' },
  ])
})

