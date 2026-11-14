// On-theme alternatives (#563): in Theme first, a generic pick with a detected role names a queued or
// Later card that has the same role and matches a theme. The alternative previews, opens details and
// adds without leaving the batch. Offers without a pool match, theme matches and other priorities
// show none. THEME_ALTERNATIVE_SCREENSHOTS=<dir> saves the first batch in light, dark and 390px
// layouts; THEME_ALTERNATIVE_PREFIX=before stops after the screenshots.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from 'playwright-core'
import { toCard, toDeckCard } from '../src/domain/card-model.ts'
import { openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { basic, commander, fixtureCard, makeState } from './fixtures/b10-browser.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.THEME_ALTERNATIVE_SCREENSHOTS
const prefix = process.env.THEME_ALTERNATIVE_PREFIX ?? 'after'
const green = { color_identity: ['G'] }
// Offered: two generic picks with an on-theme match in the pool, one without, and a theme match.
const plainRamp = fixtureCard('Alternative check plain ramp', {
  ...green,
  produced_mana: ['G'],
  oracle_text: '{T}: Add {G}.',
})
const plainDraw = fixtureCard('Alternative check plain draw', {
  ...green,
  type_line: 'Sorcery',
  oracle_text: 'Draw two cards.',
})
const plainRemoval = fixtureCard('Alternative check plain removal', {
  ...green,
  type_line: 'Instant',
  oracle_text: 'Destroy target artifact or enchantment.',
})
const themeDrawOffer = fixtureCard('Alternative check token draw offer', {
  ...green,
  type_line: 'Creature — Elf',
  power: '1',
  toughness: '1',
  oracle_text:
    'When this creature enters, create a 1/1 green Elf creature token and draw two cards.',
})
// The pool: on-theme ramp queued after the batch, on-theme draw waiting in Later.
const themeRamp = fixtureCard('Alternative check token ramp', {
  ...green,
  produced_mana: ['G'],
  oracle_text:
    '{T}: Add {G}.\nWhenever you cast a creature spell, create a 1/1 green Saproling creature token.',
})
const themeDraw = fixtureCard('Alternative check token draw', {
  ...green,
  type_line: 'Sorcery',
  oracle_text: 'Draw two cards, then create a 1/1 green Saproling creature token.',
})
const offered = [plainRamp, plainDraw, plainRemoval, themeDrawOffer]
const records = [commander, basic, ...offered, themeRamp, themeDraw]
const stateFor = (recommendationStyle: 'thematic' | 'balanced') =>
  makeState({
    theme: 'Tokens',
    recommendationStyle,
    // Restore reads Balanced without deck health as Theme first.
    prioritizeDeckHealth: recommendationStyle !== 'thematic',
    queue: [...offered, themeRamp].map((record) => toCard(record, 'Commander synergy')),
    deferredCards: [
      { card: toCard(themeDraw, 'Commander synergy'), eligibleBatch: 4, later: true },
    ],
    deck: [commander, ...Array.from({ length: 10 }, () => basic)].map(toDeckCard),
    deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
  })

const offer = (page: Page, name: string) => page.locator('.card-offer').filter({ hasText: name })
const alternative = (page: Page, name: string) => offer(page, name).locator('.theme-alternative')
const offerNames = (page: Page) =>
  page.locator('.card-offer .card-copy h3').evaluateAll((nodes) => nodes.map((n) => n.textContent))

async function capture(page: Page) {
  if (!output) return
  for (const dark of [false, true]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      // The phone batch is a sideways rail, so capture a generic offer rather than the first.
      const batch = width < 600 ? offer(page, plainRamp.name) : page.locator('.card-grid').first()
      await batch.scrollIntoViewIfNeeded()
      await batch.screenshot({
        path: join(output, `${prefix}-offers-${dark ? 'dark' : 'light'}-${width}.png`),
      })
    }
  }
  await setDisplayPreferences(page, { 'Dark mode': false })
  await page.setViewportSize({ width: 1440, height: 1000 })
}

async function addAlternative(page: Page, offerName: string, cardName: string) {
  const note = alternative(page, offerName)
  await note.getByRole('button', { name: `Add ${cardName} to the deck` }).click()
  const status = note.getByRole('status')
  await status.filter({ hasText: `Added to the deck: ${cardName}` }).waitFor()
  // Focus stays in the offer, on the outcome, rather than falling back to the page.
  assert.equal(await status.evaluate((node) => node === document.activeElement), true)
  // The added card is a CardReference too.
  assert.equal(
    await status.getByRole('button', { name: `Show details for ${cardName}` }).count(),
    1,
  )
}

if (output) await mkdir(output, { recursive: true })
await withBrowser('THEME_ALTERNATIVE', 5276, async (browser, base) => {
  {
    const { page, context, errors } = await openScenario(
      browser,
      base,
      stateFor('thematic'),
      records,
    )
    // Wait until offers hydrate and the theme match leads its reason.
    await offer(page, themeDrawOffer.name)
      .locator('.suggestion-type', { hasText: /tokens theme/i })
      .waitFor()
    await capture(page)
    if (prefix === 'before') {
      await context.close()
      return
    }
    const batch = await offerNames(page)
    assert.deepEqual(
      batch.toSorted(),
      offered.map(({ name }) => name).toSorted(),
      'the pool cards stay out of the batch',
    )

    // A generic pick with a role names the queued on-theme card with that role, as a heuristic.
    const ramp = alternative(page, plainRamp.name)
    assert.match(await ramp.innerText(), /On-theme ramp/)
    assert.match(await ramp.innerText(), /Heuristic: also ramp and matches your Tokens theme/)
    assert.equal(
      await ramp.getByRole('button', { name: `Show details for ${themeRamp.name}` }).count(),
      1,
    )
    // A Later card counts, and says where it waits.
    const draw = alternative(page, plainDraw.name)
    assert.match(await draw.innerText(), /On-theme card draw/)
    assert.match(await draw.innerText(), /In your Later list/)
    assert.equal(
      await draw.getByRole('button', { name: `Show details for ${themeDraw.name}` }).count(),
      1,
    )
    // No on-theme removal in the pool: the generic mark stays, with no alternative.
    assert.equal(await offer(page, plainRemoval.name).locator('.generic-pick').count(), 1)
    assert.equal(await alternative(page, plainRemoval.name).count(), 0)
    // A theme-matching offer never shows one, even with on-theme draw waiting in Later.
    assert.equal(await alternative(page, themeDrawOffer.name).count(), 0)

    // Hover previews the alternative; activation opens its details over the same batch.
    const reference = ramp.locator('.card-reference')
    await reference.hover()
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('.theme-alternative .card-reference')].some(
          (node) =>
            node.textContent?.includes(name) &&
            node.querySelector('.card-image-preview')?.matches(':popover-open'),
        ),
      themeRamp.name,
    )
    await ramp.getByRole('button', { name: `Show details for ${themeRamp.name}` }).click()
    const details = page.getByRole('dialog')
    await details.filter({ hasText: themeRamp.name }).waitFor()
    await page.keyboard.press('Escape')
    await details.waitFor({ state: 'detached' })

    // Adding from the queue and from Later keeps the batch in place.
    await addAlternative(page, plainRamp.name, themeRamp.name)
    await addAlternative(page, plainDraw.name, themeDraw.name)
    assert.deepEqual((await offerNames(page)).toSorted(), batch.toSorted(), 'same batch')
    if (output)
      await page
        .locator('.card-grid')
        .first()
        .screenshot({ path: join(output, `${prefix}-added-light-1440.png`) })
    const deckList = page.locator('.deck-board')
    for (const name of [themeRamp.name, themeDraw.name])
      assert.equal((await deckList.getByText(name, { exact: true }).count()) > 0, true, name)
    // The Later card left the Later list.
    assert.equal(await page.getByRole('button', { name: /^Later & ignored/ }).count(), 0)

    // A phone-width batch never scrolls the page sideways.
    await page.setViewportSize({ width: 390, height: 1000 })
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
      'no horizontal page scroll at 390px',
    )
    assert.deepEqual(errors, [])
    await context.close()
  }
  // Other priorities show no generic pick, so no alternative.
  {
    const { page, context, errors } = await openScenario(
      browser,
      base,
      stateFor('balanced'),
      records,
    )
    await offer(page, plainRamp.name)
      .locator('.offer-reason', { hasText: /^Adds ramp/ })
      .waitFor()
    assert.equal(await page.locator('.card-offer .theme-alternative').count(), 0)
    assert.deepEqual(errors, [])
    await context.close()
  }
})
console.log('On-theme alternatives: shown for generic picks with a pool match, addable in place')
