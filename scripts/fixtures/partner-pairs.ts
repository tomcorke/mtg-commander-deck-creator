// Synthetic partner fixtures for the #487 browser check. The pairing rules they exercise are
// CR 702.124h and 702.124k; the cards make no claims about real cards.
import type { Page, Route } from 'playwright-core'
import type { ScryfallCard } from '../../src/domain/card-model.ts'
import { fixtureCard } from './b10-browser.ts'

const legend = (name: string, colours: string[], oracle_text: string, cost: string) =>
  fixtureCard(name, {
    type_line: 'Legendary Creature — Elf',
    cmc: 3,
    mana_cost: cost,
    color_identity: colours,
    power: '2',
    toughness: '2',
    oracle_text,
  })
const enchantment = (name: string, type_line: string) =>
  fixtureCard(name, {
    type_line,
    cmc: 2,
    mana_cost: '{1}{B}',
    color_identity: ['B'],
    oracle_text: 'Commander creatures you own have deathtouch.',
  })

const partnerText = 'Partner (You can have two commanders if both have partner.)'
export const partnerLeader = legend('Pair Fixture Elf', ['G'], partnerText, '{2}{G}')
export const partnerMage = legend('Pair Fixture Mage', ['U'], partnerText, '{2}{U}')
/** A different partner ability, so never a legal partner for the Elf (702.124f). */
export const friendsForever = legend(
  'Pair Fixture Friend',
  ['G'],
  'Partner—Friends forever (You can have two commanders if both have this ability.)',
  '{1}{G}',
)
export const backgroundChooser = legend(
  'Pair Fixture Wanderer',
  ['G'],
  'Choose a Background (You can have a Background as a second commander.)',
  '{1}{G}{G}',
)
export const background = enchantment(
  'Pair Fixture Upbringing',
  'Legendary Enchantment — Background',
)
/** Found by the type search's neighbours, but not a Background. */
export const notBackground = enchantment('Pair Fixture Relic', 'Legendary Enchantment')
/** One commander whose own name contains " & ", stored unsplit (#517). */
export const ampersandSolo = legend('Pair Fixture Rogue & Hamster', ['G'], 'Haste', '{1}{G}{G}')
/** A Partner with pair where one name contains " & ", like Bebop and Rocksteady (#517). */
export const ampersandPartner = legend(
  'Pair Fixture Skull & Crossbones',
  ['G'],
  'Partner with Pair Fixture Rhino',
  '{2}{G}',
)
export const ampersandPartnerMate = legend(
  'Pair Fixture Rhino',
  ['R'],
  'Partner with Pair Fixture Skull & Crossbones',
  '{2}{R}',
)
export const pairRecords = [
  partnerLeader,
  partnerMage,
  friendsForever,
  backgroundChooser,
  background,
  notBackground,
  ampersandSolo,
  ampersandPartner,
  ampersandPartnerMate,
]

const list = (data: ScryfallCard[]) => ({
  object: 'list',
  data,
  has_more: false,
  total_cards: data.length,
})

/** Answers the partner searches; every other search falls through to the shared harness. */
export async function mockPartnerSearches(page: Page, queries: string[]) {
  await page.route('https://api.scryfall.com/cards/search?*', (route: Route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? ''
    if (query.includes('(keyword:partner)')) {
      queries.push(query)
      return route.fulfill({ json: list([partnerLeader, partnerMage, friendsForever]) })
    }
    if (query.includes(`(!"${ampersandPartnerMate.name}")`)) {
      queries.push(query)
      return route.fulfill({ json: list([ampersandPartnerMate]) })
    }
    if (query.includes('(t:background)')) {
      queries.push(query)
      return route.fulfill({ json: list([background, notBackground]) })
    }
    return route.fallback()
  })
}
