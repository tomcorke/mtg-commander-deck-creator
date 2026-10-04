import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core'

import { a14BaseState, printingHeavyFixture } from './fixtures/a14.ts'
import {
  deckStateVersion,
  loadSavedDecks,
  persistedDeckStateSchema,
  savedDecksKey,
  deckStateKey,
  encodeDeckState,
  storedDeckStateSchema,
} from '../src/deck-state.ts'
import {
  autosavePrefix,
  retentionKey,
  workspaceSessionKey,
  workspaceRecoveryKey,
  savedDraftAge,
  type AutosavedDraft,
} from '../src/autosaves.ts'

assert.ok(!process.argv[2] || /^[1-6]$/.test(process.argv[2]), 'Optional case must be 1–6')
const fixture = printingHeavyFixture().state
for (const card of [...fixture.deck, ...fixture.queue])
  Object.assign(card, { commanderLegality: 'legal', manaValue: 2, manaValueKnown: true })
const updatedAt = new Date().toISOString()
const manual = { id: 'manual', name: 'Legacy manual', updatedAt, state: fixture }
const draft = { version: deckStateVersion, id: 'seed', name: 'Draft A', updatedAt, state: fixture }

// Playwright's browser launcher does not expose windowsHide. Keep every child in this check hidden.
const spawn = childProcess.spawn
childProcess.spawn = ((command, args, options) =>
  Array.isArray(args)
    ? spawn(command, args, { ...options, windowsHide: true })
    : spawn(command, { ...args, windowsHide: true })) as typeof spawn

async function mockProviders(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    if (url.hostname === 'cards.scryfall.io')
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"/>',
      })
    if (url.hostname === 'api.scryfall.com') {
      if (url.pathname === '/sets') return route.fulfill({ json: { data: [] } })
      const card = (name: string) => ({
        name,
        type_line: 'Creature',
        color_identity: [],
        cmc: 1,
        mana_cost: '{1}',
        oracle_text: 'Test card',
        set: 'tst',
        set_name: 'Test Commander Set',
        collector_number: '0',
        legalities: { commander: 'legal' },
        finishes: ['nonfoil'],
        prints_search_uri: `https://api.scryfall.com/cards/search?q=${encodeURIComponent(name)}`,
        scryfall_uri: 'https://scryfall.com/card/tst/0/test-card',
        image_uris: { normal: fixture.deck[0].image },
        prices: { usd: '2.50' },
      })
      if (url.pathname === '/cards/collection') {
        const identifiers = route.request().postDataJSON().identifiers as { name?: string }[]
        return route.fulfill({
          json: { data: identifiers.map(({ name }) => card(name ?? fixture.commander)) },
        })
      }
      if (url.pathname === '/cards/named')
        return route.fulfill({ json: card(url.searchParams.get('exact') ?? fixture.commander) })
      const candidate =
        fixture.queue.find((entry) => entry.printsUri === url.href) ?? fixture.queue[0]
      return route.fulfill({
        json: {
          data: candidate.printings!.map((printing) => ({
            ...card(candidate.name),
            set: printing.set,
            collector_number: printing.collectorNumber,
            image_uris: { normal: printing.image },
            finishes: [printing.finish],
            prices: { usd: printing.price, usd_foil: printing.price },
          })),
        },
      })
    }
    if (url.hostname === 'json.edhrec.com')
      return route.fulfill({ json: { container: { json_dict: { cardlists: [] } } } })
    return route.fulfill({ body: '' })
  })
}

async function openPicker(page: Page) {
  await page.getByRole('button', { name: /Save \/ load|Drafts \/ saved decks/ }).click()
  await page.getByRole('dialog', { name: 'Drafts and saved decks' }).waitFor()
}

async function currentDraft(page: Page): Promise<AutosavedDraft> {
  const raw = await page.evaluate(
    ({ prefix, sessionKey, recoveryKey }) =>
      localStorage.getItem(prefix + sessionStorage.getItem(sessionKey)) ??
      sessionStorage.getItem(recoveryKey),
    { prefix: autosavePrefix, sessionKey: workspaceSessionKey, recoveryKey: workspaceRecoveryKey },
  )
  assert.ok(raw, 'Workspace must have a recovery point')
  const value = JSON.parse(raw)
  return { ...value, state: storedDeckStateSchema.parse(value.state) }
}

async function draftNames(page: Page) {
  return page.evaluate(
    (prefix) =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({
          id: key.slice(prefix.length),
          name: JSON.parse(localStorage.getItem(key)!).name,
        })),
    autosavePrefix,
  )
}

async function waitForName(page: Page, name: string) {
  await page.waitForFunction(
    ({ prefix, sessionKey, name }) => {
      const raw = localStorage.getItem(prefix + sessionStorage.getItem(sessionKey))
      return raw && JSON.parse(raw).name === name
    },
    { prefix: autosavePrefix, sessionKey: workspaceSessionKey, name },
  )
}

async function rename(page: Page, name: string) {
  await openPicker(page)
  await page.getByRole('textbox', { name: 'Deck name', exact: true }).fill(name)
  await waitForName(page, name)
  await page.keyboard.press('Escape')
  await page.locator('.saved-decks-modal').waitFor({ state: 'hidden' })
}

async function storedManuals(page: Page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), savedDecksKey)
  return loadSavedDecks({ getItem: () => raw, setItem: () => {}, removeItem: () => {} })
}

async function respondToConfirmation(page: Page, action: () => Promise<unknown>, accept: boolean) {
  const response = page.waitForEvent('dialog')
  const clicking = action()
  const dialog = await response
  const message = dialog.message()
  if (accept) await dialog.accept()
  else await dialog.dismiss()
  await clicking
  return message
}

async function switchPrinting(page: Page) {
  const name = fixture.queue[0].name
  const image = page.getByAltText(`${name} card`, { exact: true })
  const before = await image.getAttribute('src')
  const button = page.getByRole('button', {
    name: `Show alternate printing of ${name}`,
    exact: true,
  })
  await button.waitFor()
  await button.click()
  await page.waitForFunction(
    ({ prefix, sessionKey, name, before }) => {
      const queue = JSON.parse(localStorage.getItem(prefix + sessionStorage.getItem(sessionKey))!)
        .state.queue
      const row = queue.rows.find(
        (entry: unknown[]) => entry[queue.fields.indexOf('name')] === name,
      )
      return row[queue.fields.indexOf('image')] !== before
    },
    { prefix: autosavePrefix, sessionKey: workspaceSessionKey, name, before },
  )
  const selected = (await currentDraft(page)).state.queue[0]
  assert.equal(await image.getAttribute('src'), selected.image)
  assert.equal(selected.printingManuallySelected, true)
  return selected
}

async function pickerPresentation(page: Page) {
  const result = await page.locator('.saved-deck-list article').evaluateAll(
    (rows, narrow) => {
      const errors: string[] = []
      const times: { text: string; stamp: string; exact: boolean }[] = []
      for (const row of rows) {
        const details = row.querySelector<HTMLElement>('.saved-deck-details')!
        const primary = getComputedStyle(details).color
        if (
          [...details.querySelectorAll('b, .card-reference-name')].some(
            (name) => getComputedStyle(name).color !== primary,
          )
        )
          errors.push('deck/card names must use primary text colour')
        if (narrow) {
          const bounds = details.getBoundingClientRect()
          const actions = row.querySelectorAll(':scope > button, :scope > .saved-deck-delete-wrap')
          if (
            bounds.width < row.getBoundingClientRect().width - 1 ||
            [...actions].some((action) => action.getBoundingClientRect().top < bounds.bottom)
          )
            errors.push('narrow row actions must sit below full-width details')
        }
        if (!row.closest('.autosaved-draft-list')) {
          const time = details.querySelector('time')
          if (!time) errors.push('manual saves need relative time and exact tooltip')
          else
            times.push({
              text: time.textContent!,
              stamp: time.dateTime,
              exact: time.title === new Date(time.dateTime).toLocaleString(),
            })
        }
      }
      return { errors, times }
    },
    (page.viewportSize()?.width ?? 1280) <= 600,
  )
  assert.deepEqual(result.errors, [], `Picker presentation: ${result.errors.join('; ')}`)
  for (const time of result.times) {
    assert.equal(
      time.text,
      savedDraftAge(time.stamp),
      'Manual timestamp must reuse draft relative time',
    )
    assert.equal(time.exact, true, 'Manual timestamp must retain exact-time tooltip')
  }
}

async function unchangedSaveNotice(page: Page) {
  await page.locator('.saved-deck-list:not(.autosaved-draft-list) article').first().waitFor()
  assert.equal(
    await page.locator('.overwrite-notice').count(),
    0,
    'An unchanged manual save must not show a zero-delta overwrite notice',
  )
}

async function compactSaves(page: Page) {
  await rename(page, 'Compact save')
  await openPicker(page)
  await page.getByRole('button', { name: 'Save deck', exact: true }).click()
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), savedDecksKey)
  const sizes = await page.evaluate(
    ({ prefix, sessionKey, manualKey }) => ({
      autosave: localStorage.getItem(prefix + sessionStorage.getItem(sessionKey))!.length,
      manual: JSON.stringify(JSON.parse(localStorage.getItem(manualKey)!).decks[0]).length,
    }),
    { prefix: autosavePrefix, sessionKey: workspaceSessionKey, manualKey: savedDecksKey },
  )
  assert.ok(
    sizes.autosave < 60_000 && sizes.manual < 60_000,
    'Fixture saves must stay under 60K characters',
  )
  console.log(`  storage characters: autosave=${sizes.autosave}, manual=${sizes.manual}`)
  const saved = (await storedManuals(page))[0]
  await page.setViewportSize({ width: 390, height: 844 })
  await pickerPresentation(page)
  await unchangedSaveNotice(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  assert.equal(saved.state.queue[0].printings?.length, 1)
  assert.equal(saved.state.deferredCards[0].card.printings?.length, 1)
  await page.keyboard.press('Escape')
  const firstPrinting = await switchPrinting(page)
  assert.equal(firstPrinting.finish, 'nonfoil')
  await openPicker(page)
  await page.locator('.overwrite-notice').waitFor()
  await page.keyboard.press('Escape')
  const offer = (index: number) =>
    page
      .locator('.card-offer')
      .filter({ has: page.getByAltText(`${fixture.queue[index].name} card`, { exact: true }) })
  await offer(1).getByRole('button', { name: 'Add', exact: true }).click()
  await offer(2).getByRole('button', { name: 'Later', exact: true }).click()
  await offer(3).getByRole('button', { name: 'Ignore', exact: true }).click()
  await offer(0).getByRole('button', { name: 'More like this', exact: true }).click()
  await page.waitForFunction(
    ({ prefix, sessionKey, name }) =>
      JSON.parse(
        localStorage.getItem(prefix + sessionStorage.getItem(sessionKey))!,
      ).state.liked.includes(name),
    { prefix: autosavePrefix, sessionKey: workspaceSessionKey, name: fixture.queue[0].name },
  )
  const before = (await currentDraft(page)).state
  for (const [index, choice] of [
    [1, 'add'],
    [2, 'later'],
    [3, 'ignore'],
  ] as const)
    assert.equal(
      before.decisions[fixture.queue[index].name],
      choice,
      `Stored ${choice} choice for candidate ${index}`,
    )
  assert.ok(before.deck.some(({ name }) => name === fixture.queue[1].name))
  await page.reload()
  await page
    .getByRole('button', {
      name: `Show alternate printing of ${fixture.queue[0].name}`,
      exact: true,
    })
    .waitFor()
  const after = (await currentDraft(page)).state
  assert.deepEqual(
    after,
    before,
    'Reload must keep deck, queue order, choices, deferred cards and preferences',
  )
  assert.equal(
    await page.getByAltText(`${fixture.queue[0].name} card`, { exact: true }).getAttribute('src'),
    before.queue[0].image,
  )
  assert.equal((await switchPrinting(page)).finish, 'foil')
  await openPicker(page)
  await page.locator('.overwrite-notice').waitFor()
  await page.getByRole('button', { name: 'Overwrite save', exact: true }).click()
  await unchangedSaveNotice(page)
  const manualRow = page
    .locator('.saved-deck-list article')
    .filter({ hasText: 'Compact save' })
    .last()
  await manualRow.getByRole('button', { name: 'Load', exact: true }).click()
  const image = page.getByAltText(`${fixture.queue[0].name} card`, { exact: true })
  await image.waitFor()
  const manualState = (await storedManuals(page))[0].state
  assert.equal(await image.getAttribute('src'), manualState.queue[0].image)
  assert.equal(manualState.queue[0].finish, 'foil')
  await openPicker(page)
  await unchangedSaveNotice(page)
  await page.keyboard.press('Escape')
  assert.equal((await switchPrinting(page)).finish, 'nonfoil')
}

async function fillQuota(page: Page) {
  return page.evaluate(() => {
    let value = localStorage.getItem('a14-junk') ?? ''
    let chunk = 'x'.repeat(1_000_000)
    while (chunk.length) {
      try {
        localStorage.setItem('a14-junk', value + chunk)
        value += chunk
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error
        chunk = chunk.slice(0, Math.floor(chunk.length / 2))
      }
    }
    return value.length
  })
}

async function seedDraft(page: Page, id: string, ageDays = 0, state = fixture) {
  const value = {
    ...draft,
    id,
    name: id,
    updatedAt: new Date(Date.now() - ageDays * 86_400_000).toISOString(),
    state: encodeDeckState(state),
  }
  storedDeckStateSchema.parse(value.state)
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: autosavePrefix + id,
    raw: JSON.stringify(value),
  })
}

async function protectedBytes(page: Page, ids: string[]) {
  return page.evaluate(
    ({ prefix, ids, manualKey }) => ({
      drafts: ids.map((id) => localStorage.getItem(prefix + id)),
      manual: localStorage.getItem(manualKey),
      junk: localStorage.getItem('a14-junk')?.length ?? 0,
    }),
    { prefix: autosavePrefix, ids, manualKey: savedDecksKey },
  )
}

async function quotaSafety(page: Page, context: BrowserContext) {
  const peer = await context.newPage()
  await peer.goto(page.url())
  await rename(peer, 'Live B')
  const peerId = (await currentDraft(peer)).id
  await seedDraft(page, 'recent')
  await seedDraft(page, 'expired', 8)
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: savedDecksKey,
    raw: JSON.stringify({
      version: deckStateVersion,
      decks: [{ ...manual, state: encodeDeckState(fixture) }],
    }),
  })
  const quota = await fillQuota(page)
  assert.ok(quota > 4_000_000, 'Exercise real Chrome localStorage quota, not a mocked setter')
  const protectedBefore = await protectedBytes(page, ['recent', peerId])
  await openPicker(page)
  const name = page.getByRole('textbox', { name: 'Deck name', exact: true })
  await name.fill('')
  await name.pressSequentially('Rapid edits under quota pressure')
  await waitForName(page, 'Rapid edits under quota pressure')
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), autosavePrefix + 'expired'),
    null,
  )
  assert.deepEqual(await protectedBytes(page, ['recent', peerId]), protectedBefore)
  await page.locator('.workspace-alert').filter({ hasText: 'Deleted 1 inactive draft' }).waitFor()
  await page.keyboard.press('Escape')
  await page.reload()
  await waitForName(page, 'Rapid edits under quota pressure')
  await openPicker(page)
  await seedDraft(peer, 'tiny-expired', 8, a14BaseState)
  await fillQuota(page)
  const fullBefore = await protectedBytes(page, ['recent', peerId])
  await page.setViewportSize({ width: 390, height: 844 })
  const headingBefore = await page
    .locator('.saved-decks-modal h2')
    .evaluate((heading) => (heading as HTMLElement).offsetTop)
  await name.fill('An edit too large to save without deleting a retained draft ' + 'x'.repeat(4096))
  await page.locator('.workspace-alert').filter({ hasText: 'Autosave unavailable' }).waitFor()
  const alert = await page.locator('.workspace-alert').evaluate((element) => ({
    position: getComputedStyle(element).position,
    left: element.getBoundingClientRect().left,
    right: document.documentElement.clientWidth - element.getBoundingClientRect().right,
  }))
  assert.equal(alert.position, 'fixed')
  assert.ok(
    Math.abs(alert.left - 16) < 1 && Math.abs(alert.right - 16) < 1,
    `Narrow quota alert needs 16px gutters, got ${alert.left}/${alert.right}`,
  )
  assert.deepEqual(
    await page
      .locator('.saved-decks-modal h2')
      .evaluate((heading) => (heading as HTMLElement).offsetTop),
    headingBefore,
    'Quota alert must not shift picker content',
  )
  await page.locator('.workspace-alert').filter({ hasText: 'Deleted 1 inactive draft' }).waitFor()
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), autosavePrefix + 'tiny-expired'),
    null,
  )
  assert.deepEqual(await protectedBytes(page, ['recent', peerId]), fullBefore)
  await fillQuota(page)
  await page.getByLabel('Maximum drafts', { exact: true }).fill('5')
  await page.getByRole('button', { name: 'Apply limits', exact: true }).click()
  await page.locator('.workspace-alert').filter({ hasText: 'Storage is full' }).waitFor()
  assert.doesNotMatch(await page.locator('.workspace-alert').innerText(), /Use a count/)
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), retentionKey), null)
  await page.evaluate(() => localStorage.removeItem('a14-junk'))
  await name.fill('Recovered after freeing space')
  await waitForName(page, 'Recovered after freeing space')
  await page.waitForFunction(
    () =>
      !/Autosave unavailable|Storage is full/.test(
        document.querySelector('.workspace-alert')?.textContent ?? '',
      ),
  )
  assert.match(await page.locator('.workspace-alert').innerText(), /Deleted 1 inactive draft/)
  await page.getByRole('button', { name: 'Dismiss autosave cleanup message', exact: true }).click()
  assert.equal(await page.locator('.workspace-alert').count(), 0)
  await peer.reload()
  await waitForName(peer, 'Live B')
  console.log(
    `  real quota filled with ${quota} junk characters; retained/live/manual records unchanged`,
  )
}

async function unchangedCopies(page: Page, context: BrowserContext) {
  const initial = await draftNames(page)
  const inherited = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)))
  const peers: Page[] = []
  for (let index = 0; index < 3; index++) {
    const peer = await context.newPage()
    if (index === 2)
      await peer.addInitScript(
        ({ values, origin }) => {
          if (location.origin !== origin || sessionStorage.getItem('__a14_inherited')) return
          for (const [key, value] of Object.entries(values)) sessionStorage.setItem(key, value)
          sessionStorage.setItem('__a14_inherited', 'true')
        },
        { values: inherited, origin: new URL(page.url()).origin },
      )
    await peer.goto(page.url())
    await peer.locator('.workspace-notice').waitFor()
    const copy = await currentDraft(peer)
    assert.notEqual(copy.id, (await currentDraft(page)).id)
    assert.equal(copy.state.savedDeckId, '')
    await peer.reload()
    await peer.getByRole('button', { name: 'Save / load', exact: true }).waitFor()
    assert.equal(
      await peer.locator('.workspace-notice').count(),
      0,
      'Undismissed copy notices must stay hidden on reload',
    )
    peers.push(peer)
  }
  assert.deepEqual(
    await draftNames(page),
    initial,
    'Unedited fresh/inherited reloads must not evict a distinct draft',
  )
  const original = await protectedBytes(page, [draft.id])
  await rename(peers[0], 'Only edited copy')
  const names = await draftNames(page)
  assert.equal(names.filter(({ id }) => !initial.some((entry) => entry.id === id)).length, 1)
  assert.deepEqual(await protectedBytes(page, [draft.id]), original)
  for (const peer of peers.slice(1)) assert.equal((await currentDraft(peer)).name, draft.name)
}

async function legacyLinks(page: Page, context: BrowserContext) {
  const url = new URL('/', page.url()).href
  const pages = context.pages()
  await Promise.all(
    pages.map((peer) => peer.getByRole('button', { name: 'Save / load', exact: true }).waitFor()),
  )
  const states = await Promise.all(pages.map(currentDraft))
  const owner = pages[states.findIndex(({ state }) => state.savedDeckId === manual.id)]
  const copy = pages.find((peer) => peer !== owner)!
  assert.ok(owner, 'One concurrent startup must own the linked migrated draft')
  await legacySave(owner)
  const originalManual = (await protectedBytes(owner, [])).manual
  assert.equal(await owner.evaluate((key) => localStorage.getItem(key), deckStateKey), null)
  assert.equal(
    (await draftNames(owner)).length,
    1,
    'Concurrent migration must leave one origin draft',
  )
  await owner.keyboard.press('Escape')
  await copy.locator('.workspace-notice').waitFor()
  assert.equal((await currentDraft(copy)).state.savedDeckId, '')
  await openPicker(copy)
  const overwrite = copy.getByRole('button', { name: 'Overwrite save', exact: true })
  assert.match(
    await respondToConfirmation(copy, () => overwrite.click(), false),
    /Overwrite the manual save/,
  )
  assert.equal((await protectedBytes(copy, [])).manual, originalManual)
  await respondToConfirmation(copy, () => overwrite.click(), true)
  await copy.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)!).decks[0].state.savedDeckId === 'manual',
    savedDecksKey,
  )
  assert.equal((await storedManuals(copy)).length, 1)
  assert.equal((await storedManuals(copy))[0].id, manual.id)
  await owner.close()
  await copy.close()
  const restored = await context.newPage()
  await restored.goto(url)
  await restored.getByRole('button', { name: 'Save / load', exact: true }).waitFor()
  assert.equal((await currentDraft(restored)).state.savedDeckId, manual.id)
  assert.equal((await currentDraft(restored)).name, manual.name)
  assert.doesNotMatch(
    await restored.title(),
    /^\*/,
    'An untouched linked legacy draft must not look modified',
  )
  await openPicker(restored)
  await unchangedSaveNotice(restored)
  await restored.keyboard.press('Escape')
  await restored
    .locator('.card-offer')
    .first()
    .getByRole('button', { name: 'More like this', exact: true })
    .click()
  await restored.waitForFunction(() => document.title.startsWith('*'))
  await openPicker(restored)
  await restored.getByRole('button', { name: 'Overwrite save', exact: true }).click()
  assert.equal((await storedManuals(restored))[0].id, manual.id)
  assert.equal((await storedManuals(restored)).length, 1)
}

async function deletionSafety(page: Page, context: BrowserContext) {
  const peer = await context.newPage()
  await peer.goto(page.url())
  await rename(peer, 'Live B')
  const peerId = (await currentDraft(peer)).id
  await seedDraft(page, 'closed')
  await openPicker(page)
  assert.equal(
    await page.getByRole('button', { name: 'Delete draft Draft A', exact: true }).isDisabled(),
    true,
  )
  assert.equal(
    await page.getByRole('button', { name: 'Delete draft Live B', exact: true }).isDisabled(),
    true,
  )
  await page.getByRole('button', { name: 'Delete draft closed', exact: true }).click()
  await page
    .locator('.autosaved-draft-list article')
    .filter({ hasText: 'closed' })
    .getByRole('tooltip')
    .waitFor()
  await peer.evaluate((key) => {
    const hold = new Promise<void>((release) => Reflect.set(window, 'a14Release', release))
    return new Promise<void>((ready) => {
      void navigator.locks.request(key, () => {
        ready()
        return hold
      })
    })
  }, autosavePrefix + 'closed')
  await page
    .getByRole('button', { name: 'Confirm deletion of draft closed', exact: true })
    .press('Enter')
  await page
    .getByRole('status')
    .filter({ hasText: 'Draft is in use or changed; try again.' })
    .waitFor()
  assert.ok(await page.evaluate((key) => localStorage.getItem(key), autosavePrefix + 'closed'))
  await assertFocusInside(page, '.saved-decks-modal')
  await peer.evaluate(() => Reflect.get(window, 'a14Release')())
  await page
    .getByRole('button', { name: 'Delete draft closed', exact: true })
    .waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await page.locator('.saved-decks-modal').waitFor({ state: 'hidden' })
  await openPicker(page)
  await page.getByRole('button', { name: 'Delete draft closed', exact: true }).click()
  await seedDraft(page, 'closed')
  await page
    .getByRole('button', { name: 'Confirm deletion of draft closed', exact: true })
    .press('Enter')
  await page
    .getByRole('status')
    .filter({ hasText: 'Draft is in use or changed; try again.' })
    .waitFor()
  const before = await protectedBytes(page, [draft.id, peerId, 'closed'])
  await seedDraft(peer, 'delete-me')
  await page.getByRole('button', { name: 'Delete draft delete-me', exact: true }).click()
  await page
    .getByRole('button', { name: 'Confirm deletion of draft delete-me', exact: true })
    .click()
  await page.waitForFunction(
    (key) => localStorage.getItem(key) === null,
    autosavePrefix + 'delete-me',
  )
  assert.deepEqual(await protectedBytes(page, [draft.id, peerId, 'closed']), before)
  await assertFocusInside(page, '.saved-decks-modal')
  await page.getByLabel('Maximum drafts', { exact: true }).fill('1')
  assert.match(
    await respondToConfirmation(
      page,
      () => page.getByRole('button', { name: 'Apply limits', exact: true }).click(),
      false,
    ),
    /delete 1 inactive draft/,
  )
  assert.deepEqual(await protectedBytes(page, [draft.id, peerId, 'closed']), before)
  await respondToConfirmation(
    page,
    () => page.getByRole('button', { name: 'Apply limits', exact: true }).click(),
    true,
  )
  await page
    .getByRole('status')
    .filter({ hasText: 'Limits applied. Deleted 1 inactive draft.' })
    .waitFor()
  const remaining = await draftNames(page)
  assert.deepEqual(remaining.map(({ id }) => id).sort(), [draft.id, peerId].sort())
  assert.equal(
    await page.getByRole('button', { name: 'Delete draft Live B', exact: true }).isDisabled(),
    true,
  )
  await validateBounds(page)
}

async function validateBounds(page: Page) {
  const before = await page.evaluate((key) => localStorage.getItem(key), retentionKey)
  for (const [label, invalidValues] of [
    ['Maximum drafts', ['0', '201']],
    ['Age limit (days)', ['0', '366']],
  ] as const) {
    const input = page.getByLabel(label, { exact: true })
    const original = await input.inputValue()
    for (const value of invalidValues) {
      await input.fill(value)
      await page.getByRole('button', { name: 'Apply limits', exact: true }).click()
      assert.equal(await input.evaluate((input: HTMLInputElement) => input.checkValidity()), false)
    }
    await input.fill(original)
  }
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), retentionKey), before)
}

async function assertFocusInside(page: Page, selector: string) {
  await page.waitForFunction(
    (selector) => Boolean(document.activeElement?.closest(selector)),
    selector,
  )
  assert.equal(
    await page.evaluate((selector) => Boolean(document.activeElement?.closest(selector)), selector),
    true,
    `Keyboard focus must stay in ${selector}`,
  )
}

async function trapKeyboard(page: Page, selector: string) {
  await assertFocusInside(page, selector)
  await page.keyboard.press('Shift+Tab')
  await assertFocusInside(page, selector)
  await page.keyboard.press('Tab')
  await assertFocusInside(page, selector)
  for (let index = 0; index < 24; index++) {
    await page.keyboard.press('Tab')
    await assertFocusInside(page, selector)
  }
}

async function noticeAndKeyboard(page: Page) {
  await page.locator('.workspace-notice').waitFor()
  const recovery = await page.evaluate((key) => sessionStorage.getItem(key), workspaceRecoveryKey)
  await page.getByRole('button', { name: 'Dismiss draft recovery notice', exact: true }).click()
  assert.equal(
    await page.evaluate((key) => sessionStorage.getItem(key), workspaceRecoveryKey),
    recovery,
  )
  await page.reload()
  await page.getByRole('button', { name: 'Save / load', exact: true }).waitFor()
  assert.equal(await page.locator('.workspace-notice').count(), 0)
  await openPicker(page)
  const currentRow = page
    .locator('.autosaved-draft-list article')
    .filter({ hasText: 'Current workspace' })
  assert.equal(
    await currentRow.getByRole('button', { name: 'Open in this tab', exact: true }).count(),
    0,
    'Current workspace must not offer redundant Open in the builder',
  )
  await page.keyboard.press('Escape')
  for (const mode of ['dark', 'light', 'commander', 'narrow', 'tablet']) {
    if (mode === 'light') {
      await page.getByRole('button', { name: /Dark/, exact: false }).click()
      await page.getByRole('checkbox', { name: 'Commander art and colours', exact: true }).uncheck()
    }
    if (mode === 'commander')
      await page.getByRole('checkbox', { name: 'Commander art and colours', exact: true }).check()
    if (mode === 'narrow') await page.setViewportSize({ width: 390, height: 844 })
    if (mode === 'tablet') await page.setViewportSize({ width: 760, height: 1024 })
    await dialogFocus(page)
    await pickerPresentation(page)
    await trapKeyboard(page, '.saved-decks-modal')
    await page.keyboard.press('Escape')
    await page.locator('.saved-decks-modal').waitFor({ state: 'hidden' })
    await assertFocusInside(page, 'header')
    await openPicker(page)
    await page.getByRole('button', { name: 'Close saved decks', exact: true }).press('Tab')
    assert.equal(
      await page
        .locator('.autosaved-draft-list .card-image-preview')
        .first()
        .evaluate((preview) => preview.matches(':popover-open')),
      true,
    )
    await page.keyboard.press('Enter')
    await page.locator('.deck-card-modal').waitFor()
    await trapKeyboard(page, '.deck-card-modal')
    await page.keyboard.press('Escape')
    await page.locator('.saved-decks-modal').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('.saved-decks-modal').waitFor({ state: 'hidden' })
  }
  const source = page.locator('.deck-card-name').filter({ hasText: fixture.commander }).first()
  await source.click()
  await page.locator('.deck-card-modal').waitFor()
  await trapKeyboard(page, '.deck-card-modal')
  await page.keyboard.press('Escape')
  await page.locator('.deck-card-modal').waitFor({ state: 'hidden' })
  assert.equal(
    await source.evaluate((button) => document.activeElement === button),
    true,
    'Builder card details must return focus to its opener',
  )
  const before = (await currentDraft(page)).state
  await page.evaluate(() => {
    window.location.hash = '#start'
  })
  await openPicker(page)
  await currentRow.getByRole('button', { name: 'Open in this tab', exact: true }).click()
  await page.getByRole('button', { name: 'Save / load', exact: true }).waitFor()
  assert.deepEqual(
    (await currentDraft(page)).state,
    before,
    'Start-screen resume must preserve all deck state',
  )
}

async function legacySave(page: Page) {
  await openPicker(page)
  const rows = page
    .locator('.saved-deck-list:not(.autosaved-draft-list) article')
    .filter({ hasText: 'Legacy manual' })
  assert.equal(await rows.count(), 1, 'Old full-object save must appear')
  await page.reload()
  await page.getByRole('dialog', { name: 'Drafts and saved decks' }).waitFor()
  assert.equal(await rows.count(), 1, 'Old save must still appear after reload')
}

async function dialogFocus(page: Page) {
  await openPicker(page)
  await page.getByRole('button', { name: 'Close saved decks', exact: true }).press('Tab')
  await page.keyboard.press('Enter')
  await page.locator('.deck-card-modal').waitFor()
  const active = await page.evaluate(() => ({
    inside: Boolean(document.activeElement?.closest('.deck-card-modal')),
    label:
      document.activeElement?.getAttribute('aria-label') ??
      document.activeElement?.textContent?.trim(),
  }))
  assert.equal(active.inside, true, `Card details must take focus; active=${active.label}`)
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Drafts and saved decks' }).waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'Close saved decks', exact: true })
      .evaluate((button) => button === document.activeElement),
    true,
  )
}

async function runCase(
  browser: Browser,
  url: string,
  name: string,
  seeds: Record<string, string>,
  run: (page: Page, context: BrowserContext) => Promise<void>,
  simultaneous = false,
) {
  if (process.argv[2] && !name.startsWith(process.argv[2])) return
  const context = await browser.newContext()
  context.setDefaultTimeout(15_000)
  const errors: string[] = []
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)))
  try {
    await mockProviders(context)
    await context.addInitScript(
      ({ values, origin }) => {
        if (location.origin !== origin || localStorage.getItem('__a14_seeded')) return
        for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
        localStorage.setItem('__a14_seeded', 'true')
        localStorage.setItem('option:cardEffects', 'false')
      },
      { values: seeds, origin: new URL(url).origin },
    )
    const page = await context.newPage()
    if (simultaneous) {
      const peer = await context.newPage()
      await Promise.all([page.goto(url), peer.goto(url)])
    } else await page.goto(url)
    await run(page, context)
    assert.deepEqual(errors, [], `No uncaught app errors: ${errors[0] ?? ''}`)
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(
      `FAIL ${name}: ${
        error instanceof Error
          ? [
              error.message.split('\n')[0],
              ...error.message
                .split('\n')
                .filter((line) => /intercepts|not visible|not stable/.test(line))
                .slice(0, 3),
              error.stack
                ?.split('\n')
                .filter((line) => /check-a14-browser\.ts:\d/.test(line))
                .slice(0, 2)
                .join(' '),
            ]
              .filter(Boolean)
              .join(' | ')
          : String(error)
      }`,
    )
    process.exitCode = 1
  } finally {
    await context.close()
  }
}

const server = await createServer({
  configFile: false,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('functional-check') },
  server: { host: '127.0.0.1', port: Number(process.env.A14_PORT ?? 5264), strictPort: true },
  logLevel: 'error',
})
let browser: Browser | undefined
try {
  await server.listen()
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    chromiumSandbox: true,
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--enable-automation'],
  })
  const processInfo = await (
    await browser.newBrowserCDPSession()
  ).send('Browser.getBrowserCommandLine')
  assert.equal(
    processInfo.arguments.includes('--no-sandbox'),
    false,
    'Chrome sandbox must remain enabled',
  )
  console.log(`Chrome ${browser.version()} (headless, sandbox enabled, disposable contexts)`)
  const url = server.resolvedUrls!.local[0]
  // Match the existing v1 legacy fixture: omit only fields with documented schema defaults.
  const oldState = Object.fromEntries(
    Object.entries(fixture).filter(
      ([key]) =>
        ![
          'savedDeckId',
          'sideboard',
          'recommendationStyle',
          'collectionSets',
          'collectionGroups',
          'collectionMode',
          'prioritizeDeckHealth',
        ].includes(key),
    ),
  )
  assert.equal(persistedDeckStateSchema.safeParse(oldState).success, true)
  const oldSave = JSON.stringify({
    version: deckStateVersion,
    decks: [{ ...manual, state: oldState }],
  })
  assert.equal(
    loadSavedDecks({ getItem: () => oldSave, setItem: () => {}, removeItem: () => {} }).length,
    1,
  )
  const compactDraft = JSON.stringify({ ...draft, state: encodeDeckState(fixture) })
  await runCase(
    browser,
    url,
    '1 compact saves, choices and printing restoration',
    { [autosavePrefix + draft.id]: compactDraft },
    compactSaves,
  )
  await runCase(
    browser,
    url,
    '2 real quota, retention safety and rapid-edit retries',
    { [autosavePrefix + draft.id]: compactDraft },
    quotaSafety,
  )
  await runCase(
    browser,
    url,
    '3 unchanged fresh/inherited tabs under a low limit',
    {
      [autosavePrefix + draft.id]: compactDraft,
      [autosavePrefix + 'distinct']: JSON.stringify({
        ...draft,
        id: 'distinct',
        name: 'Distinct draft',
        updatedAt: new Date(Date.now() - 60_000).toISOString(),
        state: encodeDeckState(fixture),
      }),
      [retentionKey]: JSON.stringify({ maxCount: 2, maxAgeDays: 7 }),
    },
    unchangedCopies,
  )
  await runCase(
    browser,
    url,
    '4 valid legacy saves, migration, links and overwrite',
    {
      [savedDecksKey]: oldSave,
      [deckStateKey]: JSON.stringify({
        version: deckStateVersion,
        state: { ...oldState, savedDeckId: manual.id },
      }),
    },
    legacyLinks,
    true,
  )
  await runCase(
    browser,
    url,
    '5 protected deletion, limits and failure status',
    { [autosavePrefix + draft.id]: compactDraft },
    deletionSafety,
  )
  await runCase(
    browser,
    url,
    '6 notices, nested/dialog keyboard focus and previews',
    {
      [autosavePrefix + draft.id]: compactDraft,
      [savedDecksKey]: JSON.stringify({
        version: deckStateVersion,
        decks: [{ ...manual, state: encodeDeckState(fixture) }],
      }),
    },
    noticeAndKeyboard,
  )
} finally {
  await browser?.close()
  await server.close()
  childProcess.spawn = spawn
}
