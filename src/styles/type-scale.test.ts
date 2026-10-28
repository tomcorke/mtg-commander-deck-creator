import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const allowed = new Set([
  ...['page-title', 'section', 'card-name', 'body', 'data', 'caption'].map(
    (t) => `var(--type-${t})`,
  ),
  // Glyph sizes (× and nav arrows) are icons, not text, so they stay outside the scale.
  '1.15em',
  '30px',
])

test('stylesheets size text only with the shared type scale', () => {
  const dir = new URL('./', import.meta.url)
  const stray: string[] = []
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.css'))) {
    const css = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    // Every length or var() used as a size, in font-size or the font shorthand.
    for (const [, value] of css.matchAll(/\bfont(?:-size)?:\s*([^;]+);/g))
      for (const [size] of value.matchAll(/var\(--[\w-]+\)|(?<![\w-])[\d.]+(?:px|em|rem)\b/g))
        if (!allowed.has(size)) stray.push(`${file}: ${size}`)
  }
  assert.deepEqual(stray, [])
})
