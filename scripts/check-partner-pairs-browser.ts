// Partner pairs (#487): Start's Choose offers legal partners, then Skip or a pair; Change commander
// offers the same step. Covers one Partner pair (702.124h) and one Background pair (702.124k).
// Names containing " & " (#517): one alone, and one in a Partner with pair (702.124j).
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Locator, Page } from 'playwright-core'
import { button, heading, openScenario, withBrowser } from './fixtures/browser-harness.ts'
import { baseCandidates, themeFirstState } from './fixtures/b10-browser.ts'
import {
  ampersandPartner,
  ampersandPartnerMate,
  ampersandSolo,
  background,
  backgroundChooser,
  friendsForever,
  mockPartnerSearches,
  notBackground,
  pairRecords,
  partnerLeader,
  partnerMage,
} from './fixtures/partner-pairs.ts'
import { setDisplayPreferences } from './browser-display.ts'

const output = process.env.PARTNER_PAIRS_SCREENSHOTS
const choose = (scope: Page | Locator, name: string) => button(scope, `Choose ${name}`)
const tileNames = (scope: Locator) =>
  scope.locator('.commander-tile .card-reference-name').allInnerTexts()
const summary = (page: Page) => page.locator('.commander-summary').first()

/** Clears the saved Tokens theme so Start searches every commander, then names the fixtures. */
async function showFixtureCommanders(page: Page) {
  const clear = button(page, 'Clear filters').first()
  if (await clear.isEnabled()) await clear.click()
  await page.getByRole('textbox', { name: 'Search commanders', exact: true }).fill('Pair Fixture')
}

async function openStartPartner(page: Page) {
  await page.goto(`${page.url().split('#')[0]}#start`)
  await heading(page, 'What do you want to play?').waitFor()
  await showFixtureCommanders(page)
  await choose(page, partnerLeader.name).click()
  const dialog = page.getByRole('dialog', { name: 'Add a partner', exact: true })
  await choose(dialog, `${partnerMage.name} as partner`).waitFor()
  return dialog
}

async function startPartnerPair(page: Page, edhrec: string[]) {
  const dialog = await (output
    ? capture(page, 'start-partner', openStartPartner)
    : openStartPartner(page))
  assert.deepEqual(await tileNames(dialog), [partnerMage.name], 'only the legal Partner')
  assert(!(await dialog.innerText()).includes(friendsForever.name), 'no other partner ability')
  assert.match(await dialog.innerText(), /1 legal partner for Partner/)
  // Closing the step starts nothing and returns to the grid.
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert(await choose(page, partnerLeader.name).evaluate((node) => node === document.activeElement))
  await choose(page, partnerLeader.name).click()
  await choose(dialog, `${partnerMage.name} as partner`).click()
  await page
    .getByRole('button', { name: `${partnerLeader.name} & ${partnerMage.name}` })
    .first()
    .waitFor()
  await summary(page).locator('.identity[aria-label="Colour identity: Green, Blue"]').waitFor()
  // The first batch loads after the play-style step, from the pair's EDHREC page.
  await playFirstBatch(page, edhrec, 'pair-fixture-elf-pair-fixture-mage')
}

async function startWithSkip(page: Page) {
  await page.goto(`${page.url().split('#')[0]}#start`)
  await heading(page, 'What do you want to play?').waitFor()
  await showFixtureCommanders(page)
  await choose(page, backgroundChooser.name).click()
  const dialog = page.getByRole('dialog', { name: 'Add a partner', exact: true })
  await choose(dialog, `${background.name} as partner`).waitFor()
  assert.deepEqual(await tileNames(dialog), [background.name], 'only the legal Background')
  assert(!(await dialog.innerText()).includes(notBackground.name))
  await button(dialog, 'Skip').click()
  await page.getByRole('button', { name: backgroundChooser.name, exact: true }).first().waitFor()
}

/** Plays the first batch, which needs every commander card loaded, from the expected page. */
async function playFirstBatch(page: Page, edhrec: string[], slug: string) {
  await page.getByRole('button', { name: /^Keep current settings/ }).click()
  await page.locator('.play-style-step').waitFor({ state: 'detached' })
  await page.locator('.card-offer').first().waitFor()
  assert(
    edhrec.some((url) => url.endsWith(`/${slug}.json`)),
    `recommendations come from ${slug}`,
  )
}

async function startAmpersandSolo(page: Page, edhrec: string[]) {
  await page.goto(`${page.url().split('#')[0]}#start`)
  await heading(page, 'What do you want to play?').waitFor()
  await showFixtureCommanders(page)
  await choose(page, ampersandSolo.name).click()
  await page.getByRole('button', { name: ampersandSolo.name, exact: true }).first().waitFor()
  await summary(page).locator('.identity[aria-label="Colour identity: Green"]').waitFor()
  await playFirstBatch(page, edhrec, 'pair-fixture-rogue-hamster')
  if (output) await page.screenshot({ path: join(output, 'ampersand-solo-builder.png') })
}

async function startAmpersandPair(page: Page, edhrec: string[]) {
  await page.goto(`${page.url().split('#')[0]}#start`)
  await heading(page, 'What do you want to play?').waitFor()
  await showFixtureCommanders(page)
  await choose(page, ampersandPartner.name).click()
  const dialog = page.getByRole('dialog', { name: 'Add a partner', exact: true })
  await choose(dialog, `${ampersandPartnerMate.name} as partner`).click()
  await page
    .getByRole('button', { name: `${ampersandPartner.name} & ${ampersandPartnerMate.name}` })
    .first()
    .waitFor()
  await summary(page).locator('.identity[aria-label="Colour identity: Green, Red"]').waitFor()
  await playFirstBatch(page, edhrec, 'pair-fixture-skull-crossbones-pair-fixture-rhino')
  if (output) await page.screenshot({ path: join(output, 'ampersand-pair-builder.png') })
}

async function openChangePartner(page: Page) {
  await button(page, 'Change commander').first().click()
  // The heading, and so the dialog's name, follows the step.
  const dialog = page.locator('section.change-commander-modal[role="dialog"]')
  await choose(dialog, backgroundChooser.name).click()
  await heading(page, 'Add a partner').waitFor()
  await choose(dialog, `${background.name} as partner`).waitFor()
  assert.deepEqual(await tileNames(dialog), [background.name])
  await choose(dialog, `${background.name} as partner`).click()
  return dialog
}

async function changeToBackgroundPair(page: Page) {
  const dialog = await (output
    ? capture(page, 'change-background', openChangePartner)
    : openChangePartner(page))
  assert.match(
    (await dialog.locator('.change-commander-confirm').innerText()).replace(/\s+/g, ' '),
    new RegExp(`New commanders: ${backgroundChooser.name} and ${background.name}`),
  )
  // Back keeps the pair; the commander step offers to change it.
  await button(dialog, 'Back to commanders').click()
  await button(dialog, 'Change partner').waitFor()
  await dialog.locator('.change-commander-confirm button.primary').click()
  await page
    .getByRole('button', { name: `${backgroundChooser.name} & ${background.name}` })
    .first()
    .waitFor()
  await summary(page).locator('.identity[aria-label="Colour identity: Green, Black"]').waitFor()
}

await withBrowser('PARTNER_PAIRS', 5298, async (browser, base) => {
  const queries: string[] = []
  const edhrec: string[] = []
  const { page, context, errors } = await openScenario(
    browser,
    base,
    themeFirstState(),
    [...baseCandidates, ...pairRecords],
    undefined,
    async (page) => {
      await mockPartnerSearches(page, queries)
      page.on('request', (request) => {
        if (request.url().startsWith('https://json.edhrec.com/')) edhrec.push(request.url())
      })
    },
  )
  try {
    await changeToBackgroundPair(page)
    await startPartnerPair(page, edhrec)
    await startWithSkip(page)
    await startAmpersandSolo(page, edhrec)
    await startAmpersandPair(page, edhrec)
    assert(queries.every((query) => query.startsWith('legal:commander date<=today (')))
    assert.deepEqual(errors, [], 'no browser exceptions')
  } finally {
    await context.close()
  }
  console.log(
    'Partner pairs browser check passed: Start Partner pair, Start Skip, Change commander Background pair, " & " names alone and paired.',
  )
})

/** Screenshots the dialog in both themes and widths, reopening it after each theme change. */
async function capture(page: Page, name: string, open: (page: Page) => Promise<Locator>) {
  await mkdir(output!, { recursive: true })
  for (const dark of [true, false]) {
    await setDisplayPreferences(page, { 'Dark mode': dark })
    const dialog = await open(page)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await dialog.screenshot({
        path: join(output!, `${name}-${dark ? 'dark' : 'light'}-${width}.png`),
      })
      const overflow = await dialog.evaluate((node) => node.scrollWidth > node.clientWidth)
      assert(!overflow, `${name} has no horizontal overflow at ${width}px`)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    if (!dark) return dialog
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
  }
  throw new Error('unreachable')
}
