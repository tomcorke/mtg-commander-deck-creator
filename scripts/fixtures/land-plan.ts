// The #589 land plan fixture: a Simic landfall deck 18 lands short, so Choose lands opens with
// picks in three role groups and an over-budget alternative. Shared by the land plan, contrast
// and card-reference browser gates.
import type { Page } from 'playwright-core'
import { fixtureCard, makeState } from './b10-browser.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../../src/domain/card-model.ts'

// Synthetic records exercise the planner; they make no claims about real cards.
const simic = { color_identity: ['G', 'U'] }
const planCommander = fixtureCard('Plan Commander', {
  ...simic,
  type_line: 'Legendary Creature — Elemental',
  cmc: 3,
  mana_cost: '{1}{G}{U}',
  power: '2',
  toughness: '3',
  oracle_text:
    'Landfall — Whenever a land you control enters, put a +1/+1 counter on this creature.',
})
const forest = fixtureCard('Forest', {
  type_line: 'Basic Land — Forest',
  cmc: 0,
  mana_cost: '',
  color_identity: ['G'],
  produced_mana: ['G'],
  prices: { usd: '0.10' },
})
const island = fixtureCard('Island', {
  type_line: 'Basic Land — Island',
  cmc: 0,
  mana_cost: '',
  color_identity: ['U'],
  produced_mana: ['U'],
  prices: { usd: '0.10' },
})
const greenSpell = fixtureCard('Plan green spell', {
  type_line: 'Creature — Elf',
  mana_cost: '{1}{G}',
  color_identity: ['G'],
})
const blueSpell = fixtureCard('Plan blue spell', {
  type_line: 'Instant',
  mana_cost: '{1}{U}',
  color_identity: ['U'],
})
const cultivate = fixtureCard('Plan Cultivate', {
  type_line: 'Sorcery',
  cmc: 3,
  mana_cost: '{2}{G}',
  color_identity: ['G'],
  oracle_text:
    'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
})
const land = (name: string, overrides: Partial<ScryfallCard>) =>
  fixtureCard(name, { type_line: 'Land', cmc: 0, mana_cost: '', ...overrides })
export const landPlanLands = [
  land('Plan Shockland', {
    ...simic,
    type_line: 'Land — Forest Island',
    produced_mana: ['G', 'U'],
    oracle_text:
      '({T}: Add {G} or {U}.)\nAs this land enters, you may pay 2 life. If you don’t, it enters tapped.',
  }),
  land('Plan Tapped Dual', {
    ...simic,
    produced_mana: ['G', 'U'],
    oracle_text: 'This land enters tapped.\n{T}: Add {G} or {U}.',
  }),
  land('Plan Bounce Land', {
    ...simic,
    produced_mana: ['G', 'U'],
    oracle_text:
      'This land enters tapped.\nWhen this land enters, return a land you control to its owner’s hand.\n{T}: Add {G}{U}.',
  }),
  land('Plan Landfall Grove', {
    color_identity: ['G'],
    produced_mana: ['G'],
    oracle_text:
      '{T}: Add {G}.\n{2}{G}, {T}, Sacrifice this land: Search your library for a land card, put it onto the battlefield tapped, then shuffle.',
  }),
  land('Plan Saproling Grove', {
    color_identity: ['G'],
    produced_mana: ['G'],
    oracle_text: '{T}: Add {G}.\n{3}{G}, {T}: Create a 1/1 green Saproling creature token.',
  }),
  land('Plan Passage', {
    produced_mana: ['C'],
    oracle_text: '{T}: Add {C}.\n{4}, {T}: Target creature can’t be blocked this turn.',
  }),
  land('Plan Pricey Dual', {
    ...simic,
    type_line: 'Land — Forest Island',
    produced_mana: ['G', 'U'],
    oracle_text: '({T}: Add {G} or {U}.)',
    prices: { usd: '300.00' },
  }),
]
export const landPlanRecords = [
  planCommander,
  forest,
  island,
  greenSpell,
  blueSpell,
  cultivate,
  ...landPlanLands,
]

// 80 cards at about $1 each: commander, 10 Forests, 10 Islands, Cultivate and 58 spells. A
// 38-land target leaves 18 land slots.
export const landPlanState = makeState({
  commander: planCommander.name,
  commanderDetails: {
    images: [planCommander.image_uris!.normal],
    art: [planCommander.image_uris!.normal],
    colours: ['G', 'U'],
    printings: [[]],
    selections: [0],
  },
  theme: 'Counters',
  deck: [
    toDeckCard(planCommander),
    ...Array.from({ length: 10 }, () => toDeckCard(forest)),
    ...Array.from({ length: 10 }, () => toDeckCard(island)),
    toDeckCard(cultivate),
    ...Array.from({ length: 29 }, () => toDeckCard(greenSpell)),
    ...Array.from({ length: 29 }, () => toDeckCard(blueSpell)),
  ],
  queue: landPlanLands.map((record) => toCard(record, 'Lands')),
  deckTargets: { lands: 38, ramp: 0, draw: 0, removal: 0, wipes: 0 },
  deckBudget: 150,
})

/** Upgraded power, which the plan's tapped-land limit reads. */
export const upgraded = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('option:powerTarget', JSON.stringify('upgraded')))

// Two more colourless utility lands pass the two-colour deck's colourless-only limit, so the gate
// variant also shows an unticked alternative with a hold label beside the over-budget one.
const heldLands = [
  land('Plan Watchtower', {
    produced_mana: ['C'],
    oracle_text: '{T}: Add {C}.\n{2}, {T}: Scry 1.',
  }),
  land('Plan Vault', {
    produced_mana: ['C'],
    oracle_text: '{T}: Add {C}.\n{3}, {T}: Draw a card, then discard a card.',
  }),
]
/** Choose lands with picks, a held alternative and an over-budget land, for the shared gates. */
export const landPlanGateRecords = [...landPlanRecords, ...heldLands]
export const landPlanGateState = {
  ...landPlanState,
  queue: [...landPlanState.queue, ...heldLands.map((record) => toCard(record, 'Lands'))],
}
