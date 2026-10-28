import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { auditSuite } from './fixed-suite.ts'
const base = fileURLToPath(new URL('./specs/', import.meta.url))
const load = async () =>
  JSON.parse(await readFile(new URL('./specs/suite.json', import.meta.url), 'utf8'))
test('frozen real suite explicitly lacks common inputs', async () => {
  assert.equal((await auditSuite(await load(), base)).commonReadiness, 'incomplete')
})
for (const kind of [
  'membership',
  'hash',
  'leakage',
  'cap',
  'coverage',
  'missing',
  'corrupt',
  'false-compatible',
])
  test(kind, async () => {
    const s = await load()
    const c = s.cases[0]
    if (kind === 'membership') s.cases[1].id = c.id
    if (kind === 'hash') c.specHash = '0'.repeat(64)
    if (kind === 'leakage') s.cases[8].families = c.families
    if (kind === 'cap') c.settings.maxPrice = 2
    if (kind === 'coverage') for (const item of s.cases) item.settings.powerTarget = 'precon'
    if (['missing', 'corrupt', 'false-compatible'].includes(kind)) {
      const ref = { path: kind === 'missing' ? 'absent.json' : c.spec, sha256: '0'.repeat(64) }
      c.common = {
        today: '2026-10-28',
        seed: 'test',
        snapshotId: 'synthetic',
        source: ref,
        policy: ref,
        kb: ref,
      }
      if (kind === 'false-compatible') c.recipe = ref
    }
    await assert.rejects(auditSuite(s, base))
  })
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recordStore } from './data.ts'
import { prepareBuild } from './prepare.ts'
import { digest } from './fixed-suite.ts'
import {
  toCard,
  toDeckCardFromRecommendation,
  type ScryfallCard,
} from '../../src/domain/card-model.ts'
test('offline supplied preparation assembly and incompatible date', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fixed-suite-'))
  try {
    const s = await load()
    const bytes = 'synthetic evidence'
    const sha = digest(bytes)
    await writeFile(join(dir, 'evidence'), bytes)
    await writeFile(join(dir, `${sha}.json`), bytes)
    for (const c of s.cases) {
      const spec = JSON.parse(await readFile(join(base, c.spec), 'utf8'))
      await writeFile(join(dir, c.spec), await readFile(join(base, c.spec)))
      const card = (name: string) =>
        toDeckCardFromRecommendation(
          toCard(
            {
              name,
              type_line: 'Legendary Creature',
              color_identity: [],
              cmc: 2,
              oracle_text: 'Partner',
              set: 'tst',
              collector_number: '1',
              prints_search_uri: '',
              legalities: { commander: 'legal' },
            } as ScryfallCard,
            'Synthetic',
          ),
        )
      const recipe = {
        spec,
        settings: c.settings,
        today: '2026-10-28',
        seed: 'test',
        snapshotId: 'synthetic',
        sourceVersion: sha,
        policyVersion: sha,
        commanders: spec.commander.map(card),
        pool: [],
      }
      const raw = JSON.stringify(recipe)
      await writeFile(join(dir, c.id + '-recipe.json'), raw)
      c.recipe = { path: c.id + '-recipe.json', sha256: digest(raw) }
      c.providers = [await (await recordStore(dir, prepareBuild(recipe))).finish()]
      const ref = { path: 'evidence', sha256: sha }
      c.common = {
        today: recipe.today,
        seed: recipe.seed,
        snapshotId: recipe.snapshotId,
        source: ref,
        policy: ref,
        kb: ref,
      }
    }
    assert.equal((await auditSuite(s, dir)).commonReadiness, 'ready')
    s.cases[0].common.snapshotId = 'different-snapshot'
    await assert.rejects(auditSuite(s, dir), /Incompatible/)
    s.cases[0].common.snapshotId = 'synthetic'
    s.cases[0].common.today = '2026-10-29'
    await assert.rejects(auditSuite(s, dir), /Incompatible/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
