import assert from 'node:assert/strict'
import test from 'node:test'
import { selectableThemes } from './commander-catalog.ts'
import { creatureTypeForTheme } from './creature-types.ts'
import {
  collapsedThemeCount,
  themeChoiceGroups,
  themeDescription,
  themeGroups,
  themeMatchCount,
} from './theme-guide.ts'

test('every selectable theme sits in exactly one group', () => {
  const grouped = themeGroups.flatMap(({ themes }) => themes)
  assert.deepEqual([...grouped].sort(), [...selectableThemes].sort())
  assert.equal(new Set(grouped).size, grouped.length)
})

test('the Creature types group holds creature types and nothing else does', () => {
  for (const { name, themes } of themeGroups)
    for (const theme of themes)
      assert.equal(Boolean(creatureTypeForTheme(theme)), name === 'Creature types', theme)
})

test('every theme, curated or picked by creature type, has a one-line description', () => {
  for (const theme of [...selectableThemes, 'Cats', 'Pirates']) {
    const description = themeDescription(theme)
    assert.ok(description, theme)
    assert.ok(description.length <= 130, theme)
  }
  assert.equal(themeDescription('Not a theme'), undefined)
})

test('collapsed groups show the same first chips on every call', () => {
  const groups = themeChoiceGroups('', '', [])
  assert.deepEqual(groups, themeChoiceGroups('', '', []))
  assert.deepEqual(
    groups.map(({ themes }) => themes),
    themeGroups.map(({ themes }) => themes.slice(0, collapsedThemeCount)),
  )
})

test('an expanded group shows all its themes while the others stay collapsed', () => {
  const [strategies, mechanics] = themeChoiceGroups('', '', ['Strategies'])
  assert.deepEqual(strategies.themes, themeGroups[0].themes)
  assert.equal(mechanics.themes.length, collapsedThemeCount)
})

test('the selected theme stays visible in its collapsed group', () => {
  const mechanics = themeChoiceGroups('', 'Goad', [])[1]
  assert.equal(mechanics.themes[0], 'Goad')
  assert.equal(mechanics.themes.length, collapsedThemeCount + 1)
})

test('search matches across every group, ignoring collapse', () => {
  const groups = themeChoiceGroups(' blink ', '', [])
  assert.deepEqual(
    groups.map(({ themes }) => themes),
    [[], ['Blink'], []],
  )
  assert.ok(themeChoiceGroups('TOK', '', [])[0].themes.includes('Tokens'))
  assert.deepEqual(themeChoiceGroups('zzz', 'Tokens', [])[0].themes, ['Tokens'])
})

test('the match count ignores a selected theme kept visible without matching', () => {
  assert.equal(themeMatchCount('zzz'), 0)
  assert.equal(themeMatchCount('blink'), 1)
})
