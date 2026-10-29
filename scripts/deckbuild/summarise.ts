import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { reviewSchema } from './completed-review.ts'

const entry = z.strictObject({
  specId: z.string().min(1),
  split: z.enum(['development', 'holdout']),
  repeat: z.number().int().positive(),
  reviewRepeat: z.number().int().positive(),
  review: reviewSchema,
  builderFeedback: z.string(),
})
export const summaryInputSchema = z.strictObject({
  entries: z.array(entry),
  rankBench: z.record(z.string(), z.unknown()).optional(),
})
export function summarise(value: unknown) {
  const input = summaryInputSchema.parse(value)
  const identities = new Set<string>()
  const splits = new Map<string, string>()
  for (const item of input.entries) {
    const identity = JSON.stringify([item.specId, item.repeat, item.reviewRepeat])
    if (identities.has(identity)) throw new Error('Duplicate review identity')
    if (splits.has(item.specId) && splits.get(item.specId) !== item.split)
      throw new Error('Spec appears in both splits')
    identities.add(identity)
    splits.set(item.specId, item.split)
  }
  const results = (split: 'development' | 'holdout') => {
    const entries = input.entries.filter((e) => e.split === split)
    const criteria = [
      'bracketFit',
      'effectiveness',
      'themeFit',
      'ideaFit',
      'fun',
      'synergy',
    ] as const
    return {
      entries,
      scores: Object.fromEntries(
        criteria.map((criterion) => {
          const values = entries.map((e) => ({
            specId: e.specId,
            repeat: e.repeat,
            reviewRepeat: e.reviewRepeat,
            value: e.review.criteria[criterion].score,
          }))
          const numbers = values.map((v) => v.value)
          return [
            criterion,
            {
              values,
              min: numbers.length ? Math.min(...numbers) : null,
              max: numbers.length ? Math.max(...numbers) : null,
              spread: numbers.length ? Math.max(...numbers) - Math.min(...numbers) : null,
            },
          ]
        }),
      ),
      feedback: {
        builder: entries.map((e) => ({
          specId: e.specId,
          repeat: e.repeat,
          text: e.builderFeedback,
        })),
        strongest: entries.flatMap((e) => e.review.strongest),
        weakest: entries.flatMap((e) => e.review.weakest),
        swaps: entries.flatMap((e) => e.review.swaps),
        knowledgeGaps: entries.flatMap((e) => e.review.knowledgeGaps),
        limitations: entries.flatMap((e) => e.review.limitations),
      },
    }
  }
  return {
    development: results('development'),
    holdout: results('holdout'),
    rankBench: input.rankBench ?? null,
    intervals:
      'Not estimated: require a predeclared sufficiently large paired commander sample; repeats are not independent commanders. Inspect individual scores and spread.',
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(
      JSON.stringify(summarise(JSON.parse(await readFile(process.argv[2], 'utf8'))), null, 2),
    )
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}
