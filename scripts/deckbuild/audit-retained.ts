import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { specSchema } from './completed-review.ts'
import { settingsSchema } from './builder-contract.ts'

// External retained evidence is deliberately not represented as portable input.
const manifest = JSON.parse(
  (await readFile(new URL('./specs/retained-provenance.json', import.meta.url), 'utf8')).replace(
    /^\uFEFF/,
    '',
  ),
)
for (const entry of manifest.retainedRecipes) {
  const bytes = await readFile(entry.path)
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256)
    throw new Error(`Recipe integrity failure: ${entry.path}`)
  const recipe = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
  specSchema.parse(recipe.spec)
  settingsSchema.parse(recipe.settings)
  for (const key of ['spec', 'settings', 'snapshotId', 'sourceVersion', 'policyVersion'])
    if (JSON.stringify(recipe[key]) !== JSON.stringify(entry[key]))
      throw new Error(`Recipe identity mismatch: ${entry.path}: ${key}`)
  if (recipe.settings.maxPrice !== recipe.spec.constraints.perCardCap)
    throw new Error(`Cap mismatch: ${entry.path}`)
}
process.stdout.write(
  'Retained recipes verified; suite incomplete; common inputs not established.\n',
)
