import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { auditSuite, fixedSuiteSchema } from './fixed-suite.ts'

const caseSchema = fixedSuiteSchema.shape.cases.element
const bindingsSchema = z.strictObject({
  version: z.literal(1),
  cases: z
    .array(
      z.strictObject({
        id: caseSchema.shape.id,
        common: caseSchema.shape.common.unwrap(),
        recipe: caseSchema.shape.recipe.unwrap(),
        providers: caseSchema.shape.providers,
      }),
    )
    .min(1),
})

/** References are relative to base; supplied evidence is never copied or rewritten. */
export async function freezeInputs(input: unknown, supplied: unknown, base: string) {
  const suite = fixedSuiteSchema.parse(input)
  const bindings = bindingsSchema.parse(supplied)
  const priorProviders = suite.cases.map(({ id, providers }) => ({ id, providers: [...providers] }))
  const seen = new Set<string>()
  for (const binding of bindings.cases) {
    if (seen.has(binding.id)) throw new Error('Duplicate input binding')
    seen.add(binding.id)
    const target = suite.cases.find((c) => c.id === binding.id)
    if (!target) throw new Error('Unknown input binding')
    if (target.common || target.recipe) throw new Error('Inputs already frozen')
    Object.assign(target, binding)
  }
  const audit = await auditSuite(suite, base)
  return { suite, audit, priorProviders }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 5)
      throw new Error('Usage: freeze-inputs.ts <suite.json> <bindings.json> <evidence-root>')
    const [suite, bindings] = await Promise.all(
      process.argv.slice(2, 4).map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
    )
    console.log(
      JSON.stringify(await freezeInputs(suite, bindings, resolve(process.argv[4])), null, 2),
    )
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
