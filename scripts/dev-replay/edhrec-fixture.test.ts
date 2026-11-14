import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fetchEdhrecPage } from '../../src/adapters/edhrec.ts'
import { edhrecFixture, fixtureCardNames, manaRocks } from './edhrec-fixture.ts'

const fixtureFetch =
  (requests: string[]): typeof fetch =>
  async (input) => {
    const url = new URL(String(input))
    requests.push(url.pathname)
    const body = edhrecFixture(url.pathname)
    return body ? Response.json(body) : new Response('missing', { status: 404 })
  }

test('synthetic commander and card pages pass the adapter schema with several lists', async () => {
  const requests: string[] = []
  const fetcher = fixtureFetch(requests)
  const commander = await fetchEdhrecPage('commanders', 'meren-of-clan-nel-toth', fetcher)
  const card = await fetchEdhrecPage('cards', 'sol-ring', fetcher)
  const tags = (page: typeof commander) => page.container.json_dict.cardlists.map(({ tag }) => tag)
  for (const tag of [
    'newcards',
    'topcards',
    'highliftcards',
    'manaartifacts',
    'utilitylands',
    'lands',
  ])
    assert(tags(commander).includes(tag), tag)
  for (const tag of ['newcommanders', 'topcommanders', 'creatures', 'manaartifacts', 'lands'])
    assert(tags(card).includes(tag), tag)
  for (const page of [commander, card])
    for (const view of page.container.json_dict.cardlists.flatMap((entry) => entry.cardviews)) {
      assert(view.num_decks! > 0 && view.num_decks! <= view.potential_decks!, view.name)
      assert.equal(typeof (view.synergy ?? view.lift), 'number', view.name)
    }
  assert.deepEqual(requests, [
    '/pages/commanders/meren-of-clan-nel-toth.json',
    '/pages/cards/sol-ring.json',
  ])
})

test('the land and mana-artifact case puts Sol Ring beside lands in competing lists', () => {
  const body = edhrecFixture('/pages/commanders/meren-of-clan-nel-toth.json')
  assert(body && 'container' in body)
  const lists = body.container.json_dict.cardlists
  const named = (tag: string) => lists.find((list) => list.tag === tag)!.cardviews
  assert.deepEqual(
    named('manaartifacts').map(({ name }) => name),
    manaRocks.split('; '),
  )
  assert(named('topcards').some(({ name }) => name === 'Sol Ring'))
  assert(named('lands').length >= 4 && named('utilitylands').length >= 2)
})

test('a non-canonical pair slug answers with a redirect body the adapter follows once', async () => {
  const requests: string[] = []
  const page = await fetchEdhrecPage(
    'commanders',
    'pair-fixture-elf-pair-fixture-mage',
    fixtureFetch(requests),
  )
  assert.deepEqual(requests, [
    '/pages/commanders/pair-fixture-elf-pair-fixture-mage.json',
    '/pages/commanders/pair-fixture-mage-pair-fixture-elf.json',
  ])
  assert(page.container.json_dict.cardlists.length > 5)
  assert(
    !('redirect' in edhrecFixture('/pages/commanders/pair-fixture-mage-pair-fixture-elf.json')!),
  )
})

test('only EDHREC page paths get a fixture', () => {
  for (const path of [
    '/pages/commanders/Meren.json',
    '/pages/decks/x.json',
    '/pages/cards/a/b.json',
  ])
    assert.equal(edhrecFixture(path), undefined, path)
})

test('every fixture card is in the review corpus, so recording can fetch its Scryfall data', async () => {
  const convention = await readFile(
    resolve(import.meta.dirname, '../../docs/agents/design-conventions.md'),
    'utf8',
  )
  const corpus = new Set([...convention.matchAll(/^\d+ (.+)$/gm)].map((match) => match[1].trim()))
  for (const name of fixtureCardNames()) assert(corpus.has(name), name)
})
