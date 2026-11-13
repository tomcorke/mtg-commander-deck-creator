// Expected opponents (#503): the player picks opposing strategies in Recommendation settings, the
// choice persists with the deck, offers that answer one lead with a heuristic "Answers …" reason,
// and Deck review shows answer coverage for each selected strategy.
// OPPOSING_SCREENSHOTS=<dir> saves settings, offers and Deck review in light, dark and 390px
// layouts. OPPOSING_CAPTURE_ONLY=1 captures the same states without assertions (before evidence).
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.OPPOSING_SCREENSHOTS
const prefix = process.env.OPPOSING_PREFIX ?? 'after'
const captureOnly = Boolean(process.env.OPPOSING_CAPTURE_ONLY)

const graveyardHate = fixtureCard('Opposing fixture crypt', {
  type_line: 'Artifact',
  color_identity: [],
  mana_cost: '{0}',
  cmc: 0,
  oracle_text: 'When this artifact enters, exile target player’s graveyard.',
})
const artifactAnswer = fixtureCard('Opposing fixture shatter', {
  type_line: 'Instant',
  color_identity: ['G'],
  mana_cost: '{1}{G}',
  cmc: 2,
  oracle_text: 'Destroy target artifact or enchantment.',
})
const deckAnswer = fixtureCard('Opposing fixture ooze', {
  type_line: 'Creature — Ooze',
  color_identity: ['G'],
  mana_cost: '{1}{G}',
  cmc: 2,
  power: '2',
  toughness: '2',
  oracle_text: '{G}: Exile target card from a graveyard.',
})
const spares = Array.from({ length: 6 }, (_, index) =>
  fixtureCard(`Opposing fixture spare ${index}`, {
    type_line: 'Creature — Elf',
    color_identity: ['G'],
    mana_cost: '{2}{G}',
    cmc: 3,
    power: '2',
    toughness: '2',
    oracle_text: 'Trample',
  }),
)
const records = [commander, basic, graveyardHate, artifactAnswer, deckAnswer, ...spares]
// The answers queue behind the spares, so only a re-rank brings them into the first batch.
const state = makeState({
  theme: '',
  queue: [...spares, artifactAnswer, graveyardHate].map((record) =>
    toCard(record, 'Commander synergy'),
  ),
  deck: [commander, ...Array.from({ length: 30 }, () => basic), deckAnswer].map(toDeckCard),
  deckTargets: { lands: 30, ramp: 0, draw: 0, removal: 0, wipes: 0 },
})

const offer = (page: Page, name: string) => page.locator('.card-offer').filter({ hasText: name })
const settingsDialog = (page: Page) => page.getByRole('dialog', { name: 'Recommendation settings' })
const opponents = (page: Page) => settingsDialog(page).locator('.expected-opponents')

async function openSettings(page: Page) {
  await button(page, 'Recommendation settings').click()
  await settingsDialog(page).waitFor()
}

async function capture(page: Page, name: string, shoot: (mode: string) => Promise<void>) {
  if (!output) return
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await shoot(`${prefix}-${name}-${dark ? 'dark' : 'light'}-${width}`)
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

async function captureSettings(page: Page) {
  await capture(page, 'settings', async (file) => {
    await openSettings(page)
    const section = captureOnly ? settingsDialog(page).locator('fieldset').last() : opponents(page)
    await section.scrollIntoViewIfNeeded()
    await settingsDialog(page).screenshot({ path: join(output!, `${file}.png`) })
    await page.keyboard.press('Escape')
  })
}

async function captureOffers(page: Page) {
  await capture(page, 'offers', async (file) => {
    const batch = page.locator('.card-grid').first()
    await batch.scrollIntoViewIfNeeded()
    await batch.screenshot({ path: join(output!, `${file}.png`) })
  })
}

async function captureReview(page: Page) {
  await capture(page, 'review', async (file) => {
    const section = captureOnly
      ? page.locator('.deck-review-section').filter({ has: heading(page, 'Role coverage') })
      : page.locator('.deck-review-section.expected-opponents-review')
    await section.scrollIntoViewIfNeeded()
    await section.screenshot({ path: join(output!, `${file}.png`) })
  })
}

if (output) await mkdir(output, { recursive: true })
await withBrowser('OPPOSING', 5283, async (browser, base) => {
  const { page, context, errors } = await openScenario(browser, base, state, records)
  await offer(page, spares[0].name).waitFor()

  if (captureOnly) {
    await captureSettings(page)
    await captureOffers(page)
    await button(page, 'Deck review').click()
    await heading(page, 'Diagnose').waitFor()
    await captureReview(page)
    await context.close()
    return
  }

  // Settings: pick graveyard decks; closing applies it and re-ranks the queue without a refetch.
  assert.equal(await offer(page, graveyardHate.name).count(), 0, 'answer queued behind spares')
  await openSettings(page)
  const graveyard = opponents(page).getByRole('checkbox', { name: 'Graveyard decks', exact: true })
  assert.equal(await graveyard.isChecked(), false)
  await graveyard.check()
  await opponents(page).getByRole('checkbox', { name: 'Artifact decks', exact: true }).check()
  assert.match(await opponents(page).innerText(), /heuristic/i)
  await button(settingsDialog(page), 'Done').click()

  // Offers: answers lead with a heuristic "Answers …" reason quoting the matching text.
  const hate = offer(page, graveyardHate.name)
  await hate.waitFor()
  assert.equal(await hate.locator('.suggestion-type').innerText(), 'ANSWERS GRAVEYARD DECKS')
  assert.equal(
    await hate.locator('.offer-reason').innerText(),
    'Heuristic text match for graveyard decks: “When this artifact enters, exile target player’s graveyard.”',
  )
  assert.equal(
    await offer(page, artifactAnswer.name).locator('.suggestion-type').innerText(),
    'ANSWERS ARTIFACT DECKS',
  )
  await captureSettings(page)
  await captureOffers(page)

  // The choice persists with the deck.
  await page.reload()
  await offer(page, graveyardHate.name).waitFor()
  // Saved cards keep no rules text; Deck review counts answers once current data loads.
  await page.getByText('Checking card data…').waitFor({ state: 'detached' })
  await openSettings(page)
  assert.equal(
    await opponents(page)
      .getByRole('checkbox', { name: 'Graveyard decks', exact: true })
      .isChecked(),
    true,
  )
  await page.keyboard.press('Escape')

  // Deck review: one coverage row per selected strategy, labelled as a heuristic.
  await button(page, 'Deck review').click()
  await heading(page, 'Diagnose').waitFor()
  const review = page.locator('.deck-review-section.expected-opponents-review')
  assert.match(await review.locator('p').first().innerText(), /heuristic/i)
  const rows = review.locator('.deck-review-opponent-filter')
  assert.deepEqual(
    (await rows.locator('.deck-review-row-heading b').allInnerTexts()).map((text) => text.trim()),
    ['Graveyard decks', 'Artifact decks'],
  )
  assert.match(await rows.first().innerText(), /1 \/ 3/)
  assert.match(await rows.nth(1).innerText(), /0 \/ 3/)
  await captureReview(page)

  // A phone-width review never scrolls the page sideways.
  await page.setViewportSize({ width: 390, height: 1000 })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    true,
    'no horizontal page scroll at 390px',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await rows.first().click()
  await page.locator('.deck-review-filter-status').waitFor()
  assert.match(await page.locator('.deck-review-filter-status').innerText(), /Graveyard decks/)
  assert.deepEqual(errors, [])
  await context.close()
})
console.log(
  captureOnly
    ? 'Expected opponents: captured before evidence'
    : 'Expected opponents: settings persist, answers lead offers and Deck review shows coverage',
)
