import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const base = readFileSync(new URL('./base.css', import.meta.url), 'utf8')
const tokens = (selector: string) =>
  Object.fromEntries(
    [...base.matchAll(new RegExp(`^${selector} \\{([^}]*)\\}`, 'gm'))]
      .flatMap(([, body]) => [...body.matchAll(/(--text-[\w-]+): (#[0-9a-f]{6});/g)])
      .map(([, name, value]) => [name, value]),
  )
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const c = parseInt(hex.slice(index, index + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}
// Page, header, panel, deck-board and dialog surfaces in each theme.
const surfaces = {
  ':root': ['#f2f3fb', '#f8f8ff', '#e9eaf7', '#ffffff'],
  '\\.dark': ['#111123', '#19182d', '#17162a', '#1d2833'],
}

test('every secondary text token meets WCAG AA on every app surface', () => {
  const light = tokens(':root')
  assert.deepEqual(Object.keys(tokens('\\.dark')).sort(), Object.keys(light).sort())
  assert.ok(Object.keys(light).length >= 4)
  for (const [selector, backgrounds] of Object.entries(surfaces))
    for (const [name, colour] of Object.entries(tokens(selector)))
      for (const background of backgrounds)
        assert.ok(
          contrast(colour, background) >= 4.5,
          `${selector} ${name} ${colour} on ${background}: ${contrast(colour, background).toFixed(2)}:1`,
        )
})
