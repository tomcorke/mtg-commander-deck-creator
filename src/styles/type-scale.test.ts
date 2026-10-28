import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

// Glyph sizes (× and nav arrows) are icons, not text, so they stay outside the scale.
const allowed =
  /^(var\(--type-[a-z-]+\)( !important)?|inherit|1\.15em|30px; \/\* × glyph, not text \*\/)$/

test('stylesheets size text only with the shared type scale', () => {
  const dir = new URL('./', import.meta.url)
  const stray = readdirSync(dir)
    .filter((file) => file.endsWith('.css'))
    .flatMap((file) =>
      [...readFileSync(new URL(file, dir), 'utf8').matchAll(/font-size: ([^\n]+?);?$/gm)]
        .map(([, value]) => value)
        .filter((value) => !allowed.test(value) && !allowed.test(`${value};`))
        .map((value) => `${file}: ${value}`),
    )
  assert.deepEqual(stray, [])
})
