// Controlled-provider regression using the repository's sandboxed browser harness.
import assert from 'node:assert/strict'
import { button, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { baseCandidates, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'

const engine = (name: string, oracle_text: string) =>
  fixtureCard(name, { type_line: 'Enchantment', color_identity: ['G'], oracle_text })
const seeds = [
  engine(
    'Boundary engine A',
    'If a +1/+1 counter would be put on a creature, put an additional one instead.',
  ),
  engine('Boundary engine B', '{G}: Put a +1/+1 counter on target creature.'),
  engine('Boundary peer', 'Creatures with +1/+1 counters have flying.'),
]
const incoming = fixtureCard('Boundary arrival', {
  type_line: 'Creature',
  color_identity: ['G'],
  oracle_text: 'Put a +1/+1 counter on target creature.',
})
await withBrowser('PLANNED_FETCHES', 5248, async (browser, base) => {
  const scenario = await openScenario(
    browser,
    base,
    makeState({
      theme: '+1/+1 counters',
      deck: [commander, ...seeds].map(toDeckCard),
      queue: baseCandidates.map((card) => toCard(card, 'Initial')),
    }),
    [...baseCandidates, ...seeds, incoming],
  )
  const { page, context } = scenario
  const release = Promise.withResolvers<void>()
  let pages = 0,
    lookups = 0
  await context.route('https://json.edhrec.com/**', async (route) => {
    pages++
    await release.promise
    await route.fulfill({
      json: {
        container: {
          json_dict: {
            cardlists: [
              {
                tag: 'creatures',
                header: 'Creatures',
                cardviews: [{ name: incoming.name, lift: 2, num_decks: 200 }],
              },
            ],
          },
        },
      },
    })
  })
  page.on('request', (request) => {
    if (request.url().includes('/cards/collection') && request.postData()?.includes(incoming.name))
      lookups++
  })
  try {
    await page.getByText('Batch 1', { exact: true }).waitFor()
    const before = await page.locator('.card-offer .card-reference-name').allTextContents()
    assert.equal(before.length, 4)
    // Idle time cannot send signature work.
    await page.waitForTimeout(2300)
    assert.equal(pages, 0)
    await button(page, 'Next recommendations').click()
    await page.waitForRequest('https://json.edhrec.com/**').catch(() => undefined)
    assert.equal(await page.getByText('Batch 1', { exact: true }).count(), 1)
    assert.deepEqual(
      await page.locator('.card-offer .card-reference-name').allTextContents(),
      before,
    )
    // A repeated click while responses are missing cannot reserve or advance again.
    await button(page, 'Next recommendations').click()
    release.resolve()
    await page.getByText('Batch 2', { exact: true }).waitFor()
    await page
      .locator('.card-offer')
      .getByRole('button', { name: `Show details for ${incoming.name}`, exact: true })
      .waitFor()
    assert.equal(pages, 2)
    assert.equal(lookups, 1)
    assert.equal(await page.getByText('Batch 3', { exact: true }).count(), 0)
    assert.deepEqual(scenario.errors, [])
    console.log(
      'PASS: idle sends no signatures; missing responses hold batch; all pages and lookup settle before one advancement',
    )
  } finally {
    release.resolve()
    await context.close()
  }
})
