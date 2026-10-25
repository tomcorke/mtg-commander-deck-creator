import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { parseLocalCardIndex } from '../src/domain/local-card-index.ts'

/** Keep the source snapshot as the dev fallback; production uses this build's provider catalog. */
export function generatedCreatureCatalog(): Plugin {
  return {
    name: 'generated-creature-catalog',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/domain/creature-types.ts')) return
      const { metadata } = parseLocalCardIndex(
        JSON.parse(readFileSync(resolve('public/local-card-index.json'), 'utf8')),
      )
      const declaration = /^export const creatureTypes = \[[\s\S]*?\n\]/m
      if (!declaration.test(code)) throw new Error('Creature catalog declaration not found')
      return {
        code: code.replace(
          declaration,
          `export const creatureTypes = ${JSON.stringify(metadata.creatureTypes)}`,
        ),
        map: null,
      }
    },
  }
}
