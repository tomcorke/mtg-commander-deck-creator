import assert from 'node:assert/strict'
import { test } from 'node:test'
import { targetKeys, targetLabels } from '../deck-analysis.ts'
import {
  appTerms,
  formatTerms,
  powerLabels,
  powerTerms,
  priorityLabels,
  priorityTerms,
  roleTerms,
  type GlossaryEntry,
} from './glossary.ts'

const groups: Record<string, Record<string, GlossaryEntry>> = {
  formatTerms,
  roleTerms,
  priorityTerms,
  powerTerms,
  appTerms,
}

test('every rule and policy claim cites a knowledge-base topic', () => {
  for (const [group, entries] of Object.entries(groups))
    for (const [key, entry] of Object.entries(entries)) {
      if (entry.kind !== 'rule' && entry.kind !== 'policy') continue
      assert.match(
        entry.source ?? '',
        /^mtg-knowledge-base knowledge\/topics\/commander\/\S+\.md/,
        `${group}.${key}`,
      )
      assert.ok(entry.citation, `${group}.${key} shows a citation`)
    }
})

test('role targets are heuristics; Priority and Power are app settings', () => {
  for (const key of targetKeys) assert.equal(roleTerms[key].kind, 'heuristic')
  for (const entry of [...Object.values(priorityTerms), ...Object.values(powerTerms)])
    assert.equal(entry.kind, 'app')
  assert.equal(formatTerms.bracket.kind, 'policy')
  assert.equal(formatTerms.gameChanger.kind, 'policy')
})

test('labels across the app come from the glossary', () => {
  for (const key of targetKeys) assert.equal(targetLabels[key], roleTerms[key].term)
  assert.deepEqual(priorityLabels, {
    thematic: 'Theme first',
    balanced: 'Balanced',
    competitive: 'Deck needs first',
    fun: 'Surprise me',
  })
  assert.deepEqual(powerLabels, { precon: 'Core', upgraded: 'Upgraded', high: 'High power' })
})
