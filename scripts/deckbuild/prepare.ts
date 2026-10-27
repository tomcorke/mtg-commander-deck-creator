import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { applyBuilderAction, createBuilderState } from '../../src/domain/builder-state.ts'
import { builderPoolKey } from '../../src/domain/builder-settings.ts'
import { initialStateSchema, settingsSchema } from './builder-contract.ts'
import { specSchema } from './completed-review.ts'
import type { Json, Pins } from './data.ts'

const name = z.string().trim().min(1)
export const preparationSchema = z.strictObject({
  spec: specSchema,
  seed: name,
  today: z.iso.date(),
  snapshotId: name,
  sourceVersion: name,
  policyVersion: name,
  settings: settingsSchema,
  commanders: initialStateSchema.shape.deck.min(1).max(2),
  pool: initialStateSchema.shape.queue.max(10000),
})
const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json

/** Supplied frozen data, not provider retrieval or a certificate of spec compliance. */
export function prepareBuild(input: unknown): Pins {
  const recipe = preparationSchema.parse(input)
  const { spec, commanders } = recipe
  if (JSON.stringify(commanders.map((card) => card.name)) !== JSON.stringify(spec.commander))
    throw new Error('Commander cards must match spec names and order exactly')
  if (recipe.settings.maxPrice !== spec.constraints.perCardCap)
    throw new Error('Explicit maxPrice must match spec perCardCap')
  const names = recipe.pool.map((card) => card.name.toLowerCase())
  if (new Set(names).size !== names.length) throw new Error('Duplicate prepared pool names')
  let state = { ...createBuilderState(recipe.today, recipe.seed), ...recipe.settings }
  const selected = applyBuilderAction(state, {
    type: 'commanders',
    cards: commanders,
    details: {
      colours: [],
      images: commanders.map((card) => card.image),
      art: [],
      printings: commanders.map((card) => card.printings ?? []),
      selections: commanders.map((card) => card.printing ?? 0),
    },
    signatureDeckKey: recipe.seed,
  })
  if (selected.error) throw new Error(selected.error)
  state = {
    ...selected.state,
    theme: spec.theme,
    collectionMode: spec.constraints.allowedSets.length ? 'only' : 'none',
    collectionSets: spec.constraints.allowedSets,
  }
  state = applyBuilderAction(state, {
    type: 'poolLoaded',
    queue: recipe.pool,
    deferredCards: [],
    poolKey: builderPoolKey(state),
  }).state
  return {
    spec: json(spec),
    seed: recipe.seed,
    today: recipe.today,
    snapshotId: recipe.snapshotId,
    sourceVersion: recipe.sourceVersion,
    policyVersion: recipe.policyVersion,
    recommenderVersion: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      encoding: 'utf8',
    }).trim(),
    resolvedOptions: json(recipe.settings),
    initialState: json(initialStateSchema.parse(state)),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: prepare.ts <recipe.json>')
    const pins = prepareBuild(JSON.parse(await readFile(process.argv[2], 'utf8')))
    process.stdout.write(`${JSON.stringify(pins, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
