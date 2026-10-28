import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { specSchema } from './completed-review.ts'
import { settingsSchema } from './builder-contract.ts'
import { replayStore } from './data.ts'
import { prepareBuild } from './prepare.ts'
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const reference = z.strictObject({ path: z.string().min(1), sha256: hash })
const common = z.strictObject({
  today: z.iso.date(),
  seed: z.string().min(1),
  snapshotId: z.string().min(1),
  source: reference,
  policy: reference,
  kb: reference,
})
export const fixedSuiteSchema = z.strictObject({
  version: z.literal(1),
  cases: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        split: z.enum(['development', 'holdout']),
        families: z.array(z.string().min(1)).min(1),
        colors: z.string().regex(/^[BGRUW]*$/),
        spec: z.string().min(1),
        specHash: hash,
        settings: settingsSchema,
        providers: z.array(hash),
        common: common.nullable(),
        recipe: reference.nullable(),
      }),
    )
    .length(14),
})
export const digest = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')
async function checkProviders(
  ids: string[],
  pins: ReturnType<typeof prepareBuild>,
  providerRoot: string,
  verified: (ref: z.infer<typeof reference>) => Promise<Buffer>,
) {
  for (const id of ids) {
    const manifest = JSON.parse(
      (await verified({ path: `manifests/${id}.json`, sha256: id })).toString(),
    )
    const replay = await replayStore(providerRoot, id)
    if (!isDeepStrictEqual(replay.pins, pins)) throw new Error('Provider pins incompatible')
    for (const entry of manifest.entries)
      if ((await replay.request(entry.request)).status !== 'complete')
        throw new Error('Missing provider evidence')
    if (replay.finish().status !== 'complete') throw new Error('Incomplete provider evidence')
  }
}
async function checkPreparation(
  c: z.infer<typeof fixedSuiteSchema>['cases'][number],
  spec: z.infer<typeof specSchema>,
  providerRoot: string,
  verified: (ref: z.infer<typeof reference>) => Promise<Buffer>,
) {
  let status = 'not-prepared'
  if (c.common) {
    for (const ref of [c.common.source, c.common.policy, c.common.kb]) await verified(ref)
    if (c.recipe) {
      const recipe = JSON.parse((await verified(c.recipe)).toString())
      const pins = prepareBuild(recipe)
      if (
        !isDeepStrictEqual(recipe.spec, spec) ||
        !isDeepStrictEqual(recipe.settings, c.settings) ||
        pins.today !== c.common.today ||
        pins.seed !== c.common.seed ||
        pins.snapshotId !== c.common.snapshotId ||
        recipe.sourceVersion !== c.common.source.sha256 ||
        recipe.policyVersion !== c.common.policy.sha256 ||
        !c.providers.length
      )
        throw new Error('Incompatible preparation')
      await checkProviders(c.providers, pins, providerRoot, verified)
      status = 'compatible'
    }
  } else if (c.recipe) throw new Error('Missing common evidence')
  return status
}
function uniqueMembership(seen: Set<string>, value: string) {
  if (seen.has(value)) throw new Error('Commander overlap')
  seen.add(value)
}
export async function auditSuite(input: unknown, base: string) {
  const suite = fixedSuiteSchema.parse(input)
  const ids = new Set<string>()
  const specs = new Set<string>()
  const commanders = new Set<string>()
  const families = new Map<string, string>()
  const brackets = new Set<number>()
  const powers = new Set<string>()
  const styles = new Set<string>()
  let partners = false
  const reports = []
  async function verified(ref: z.infer<typeof reference>) {
    const bytes = await readFile(resolve(base, ref.path))
    if (digest(bytes) !== ref.sha256) throw new Error('Reference hash mismatch')
    return bytes
  }
  for (const c of suite.cases) {
    if (ids.has(c.id) || specs.has(c.specHash)) throw new Error('Duplicate membership')
    ids.add(c.id)
    specs.add(c.specHash)
    for (const f of c.families) {
      if (families.has(f) && families.get(f) !== c.split) throw new Error('Family leakage')
      families.set(f, c.split)
    }
    const spec = specSchema.parse(
      JSON.parse((await verified({ path: c.spec, sha256: c.specHash })).toString()),
    )
    const membership = spec.commander
      .map((name) => name.trim().toLowerCase())
      .sort()
      .join('|')
    uniqueMembership(commanders, membership)
    if (spec.constraints.perCardCap !== c.settings.maxPrice) throw new Error('Cap mismatch')
    brackets.add(spec.bracket)
    powers.add(c.settings.powerTarget)
    styles.add(c.settings.recommendationStyle)
    partners ||= spec.commander.length === 2
    const status = await checkPreparation(c, spec, base, verified)
    reports.push({ id: c.id, status, providers: c.providers, common: c.common })
  }
  if (
    suite.cases.filter((c) => c.split === 'development').length !== 8 ||
    families.size < 8 ||
    brackets.size !== 5 ||
    powers.size !== 3 ||
    styles.size !== 4 ||
    !partners ||
    !suite.cases.some((c) => c.colors === '') ||
    !suite.cases.some((c) => c.colors.length > 1)
  )
    throw new Error('Coverage incomplete')
  const ready =
    reports.every((r) => r.status === 'compatible') &&
    new Set(reports.map((r) => JSON.stringify(r.common))).size === 1
  return { frozen: true, commonReadiness: ready ? 'ready' : 'incomplete', cases: reports }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const path = resolve(process.argv[2])
    console.log(
      JSON.stringify(
        await auditSuite(JSON.parse(await readFile(path, 'utf8')), dirname(path)),
        null,
        2,
      ),
    )
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
