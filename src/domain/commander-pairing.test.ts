import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchEdhrecPage } from '../adapters/edhrec.ts'
import { toDeckCard, type ScryfallCard } from './card-model.ts'
import { commanderConstructionError } from './commander-construction.ts'
import { discoverPartners } from './commander-discovery.ts'
import { partnerPairError, pairingAbilities, partnerSearchScope } from './commander-pairing.ts'

// Synthetic records; the pairing rules they exercise are CR 702.124h–m.
const raw = (name: string, changes: Partial<ScryfallCard> = {}): ScryfallCard => ({
  name,
  oracle_id: name,
  type_line: 'Legendary Creature — Human',
  color_identity: ['B'],
  cmc: 2,
  legalities: { commander: 'legal' },
  set: 'tst',
  collector_number: '1',
  prints_search_uri: '',
  ...changes,
})
const card = (name: string, changes: Partial<ScryfallCard> = {}) => toDeckCard(raw(name, changes))
const background = (name: string) =>
  raw(name, {
    type_line: 'Legendary Enchantment — Background',
    oracle_text: 'Commander creatures you own have menace.',
  })

test('pairing abilities come from whole ability lines, not mentions or reminder text', () => {
  assert.deepEqual(
    pairingAbilities(
      card('A', { oracle_text: 'Partner (You can have two commanders if both have partner.)' }),
    ),
    [{ kind: 'partner' }],
  )
  // Akroma, Vision of Ixidor mentions partner in another ability and has it on its own line.
  assert.deepEqual(
    pairingAbilities(card('A', { oracle_text: '… vigilance, and partner.\nPartner' })),
    [{ kind: 'partner' }],
  )
  assert.deepEqual(
    pairingAbilities(card('A', { oracle_text: 'Partner with B (When this enters…)' })),
    [{ kind: 'partner-with', name: 'B' }],
  )
  assert.deepEqual(pairingAbilities(card('A', { oracle_text: 'Partner—Character select' })), [
    { kind: 'partner-variant', variant: 'character select' },
  ])
  assert.deepEqual(pairingAbilities(card('A', { oracle_text: 'Partner—Unknown' })), [])
  assert.deepEqual(
    pairingAbilities(card('A', { oracle_text: 'Whenever a partner attacks, draw.' })),
    [],
  )
  assert.deepEqual(pairingAbilities(toDeckCard(background('Bg'))), [{ kind: 'background' }])
  assert.deepEqual(
    pairingAbilities(card('Doc', { type_line: 'Legendary Creature — Time Lord Doctor' })),
    [{ kind: 'doctor' }],
  )
  assert.deepEqual(
    pairingAbilities(card('Doc', { type_line: 'Legendary Creature — Human Time Lord Doctor' })),
    [],
  )
  // Partner abilities on a card that cannot be a commander do not count.
  assert.deepEqual(
    pairingAbilities(card('A', { type_line: 'Creature — Human', oracle_text: 'Partner' })),
    [],
  )
})

test('a Background pairs only with Choose a Background, and never leads alone', () => {
  const chooser = card('Chooser', {
    oracle_text: 'Choose a Background (You can have a Background as a second commander.)',
  })
  const bg = toDeckCard(background('Bg'))
  assert.equal(commanderConstructionError([chooser, bg]), '')
  assert.equal(commanderConstructionError([bg, chooser]), '')
  assert.match(commanderConstructionError([bg]), /cannot/)
  assert.match(commanderConstructionError([card('Plain'), bg]), /partner ability/)
  assert.match(
    commanderConstructionError([
      chooser,
      card('Enchantment', { type_line: 'Legendary Enchantment' }),
    ]),
    /ineligible|partner ability/,
  )
  // A Time Lord Doctor with another creature type is not "the Doctor" (702.124m).
  const companion = card('Companion', { oracle_text: "Doctor's companion" })
  assert.match(
    commanderConstructionError([
      card('Doc', { type_line: 'Legendary Creature — Human Time Lord Doctor' }),
      companion,
    ]),
    /partner ability/,
  )
})

test('partner search scopes cover each ability, and Partner with names its card', () => {
  assert.equal(partnerSearchScope(card('A', { oracle_text: 'Partner' })), 'keyword:partner')
  assert.equal(partnerSearchScope(card('A', { oracle_text: 'Partner with B' })), '!"B"')
  assert.equal(
    partnerSearchScope(card('A', { oracle_text: 'Choose a Background' })),
    't:background',
  )
  assert.equal(
    partnerSearchScope(card('Doc', { type_line: 'Legendary Creature — Time Lord Doctor' })),
    `o:"doctor's companion"`,
  )
  assert.equal(
    partnerSearchScope(card('A', { oracle_text: "Doctor's companion" })),
    '(t:"time lord" t:doctor)',
  )
  assert.equal(partnerSearchScope(card('A', { oracle_text: 'Flying' })), '')
})

test('a Partner with pair may have " & " in a name (#517)', () => {
  // Oracle text from Scryfall, checked 2026-11-13; reminder text trimmed.
  const bebop = card('Bebop, Skull & Crossbones', {
    oracle_text: 'Partner with Rocksteady, Mutant Marauder\nDeathtouch',
  })
  const rocksteady = card('Rocksteady, Mutant Marauder', {
    oracle_text: 'Partner with Bebop, Skull & Crossbones\nTrample',
    color_identity: ['G'],
  })
  assert.equal(partnerPairError(bebop, rocksteady), '')
  assert.equal(partnerSearchScope(bebop), '!"Rocksteady, Mutant Marauder"')
})

test('partner discovery keeps only legal second commanders, most popular first', async () => {
  const leader = raw('Leader', { oracle_text: 'Partner' })
  const queries: string[] = []
  const found = await discoverPartners(leader, undefined, async (query) => {
    queries.push(query)
    return [
      raw('Leader', { oracle_text: 'Partner' }),
      raw('Friend', {
        oracle_text: 'Partner (You can have two commanders.)',
        color_identity: ['U'],
      }),
      raw('Named', { oracle_text: 'Partner with Someone' }),
      raw('Survivor', { oracle_text: 'Partner—Survivors' }),
      raw('Banned partner', { oracle_text: 'Partner', legalities: { commander: 'banned' } }),
      raw('Ampersand & Co', { oracle_text: 'Partner' }),
    ]
  })
  assert.deepEqual(queries, ['legal:commander date<=today (keyword:partner)'])
  assert.deepEqual(
    found.commanders.map(({ card }) => card.name),
    ['Friend', 'Ampersand & Co'],
  )
  const plain = await discoverPartners(raw('Plain'), undefined, async () =>
    assert.fail('no search'),
  )
  assert.deepEqual(plain.commanders, [])
})

test('EDHREC pair pages follow a redirect body to the canonical order once', async () => {
  const urls: string[] = []
  const page = { container: { json_dict: { cardlists: [] } } }
  const fetcher: typeof fetch = async (input) => {
    urls.push(String(input))
    return String(input).includes('/rose-tyler-the-tenth-doctor.')
      ? Response.json({ redirect: '/commanders/the-tenth-doctor-rose-tyler' })
      : Response.json(page)
  }
  assert.deepEqual(
    await fetchEdhrecPage('commanders', 'rose-tyler-the-tenth-doctor', fetcher),
    page,
  )
  assert.deepEqual(urls, [
    'https://json.edhrec.com/pages/commanders/rose-tyler-the-tenth-doctor.json',
    'https://json.edhrec.com/pages/commanders/the-tenth-doctor-rose-tyler.json',
  ])
  const looping: typeof fetch = async () => Response.json({ redirect: '/commanders/elsewhere' })
  await assert.rejects(fetchEdhrecPage('commanders', 'loop', looping), /moved/)
})
