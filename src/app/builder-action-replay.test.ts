import assert from 'node:assert/strict'
import test from 'node:test'
import { applyBuilderAction, createBuilderState, type BuilderAction } from '../recommendations.ts'
import { toCard, type ScryfallCard } from '../domain/card-model.ts'
import {
  addSearchCards,
  chooseAddZone,
  decide,
  moveSideboardCard,
  removeDeckCard,
} from './deck-actions.ts'
import { nextBatch } from '../features/builder/interactions.ts'
import type { AppActionContext } from './builder-action.ts'

const raw = (name: string): ScryfallCard => ({
  name,
  type_line: 'Artifact',
  color_identity: [],
  cmc: 2,
  legalities: { commander: 'legal' },
  game_changer: false,
  set: 'tst',
  collector_number: name,
})

test('app deck handlers and batch boundaries emit data-only actions that a Node script can replay', async () => {
  const queue = Array.from({ length: 12 }, (_, index) =>
    toCard(raw(`Candidate ${index}`), 'Commander synergy'),
  )
  let current = { ...createBuilderState('2026-10-26', 'app'), queue }
  let replay = structuredClone(current)
  const log: BuilderAction[] = []
  const host: AppActionContext = {
    ...current,
    builderState: current,
    getBuilderState: () => current,
    dispatchBuilder: (action) => {
      const result = applyBuilderAction(current, action)
      log.push(structuredClone(action))
      const expected = applyBuilderAction(replay, log[log.length - 1])
      assert.deepEqual(result, expected)
      current = result.state
      replay = expected.state
      Object.assign(host, current, { builderState: current })
      return result
    },
    setBatchAnnouncement: () => undefined,
    setPendingRemoval: () => undefined,
    skipCompletionReviewDecks: { current: new WeakSet() },
    recommendationState: 'idle',
    recommendationRefreshInFlight: { current: false },
    loadPrintings: async () => undefined,
    start: async () => assert.fail('No pool refresh expected'),
  }
  chooseAddZone(host, 'sideboard')
  decide(host, queue[0], 'add')
  assert.equal(current.sideboard[0].name, queue[0].name)
  moveSideboardCard(host, 0)
  decide(host, queue[0], 'later')
  chooseAddZone(host, 'deck')
  assert.equal(addSearchCards(host, [raw('Searched')]), '')
  assert.ok(host.skipCompletionReviewDecks.current.has(current.deck))
  removeDeckCard(host, 0)
  decide(host, queue[1], 'ignore')
  await nextBatch(host)
  assert.equal(current.batchNumber, 2)
  assert.ok(current.deferredCards.some((entry) => entry.card.name === queue[0].name))
  assert.deepEqual(current.queue, replay.queue)
  assert.deepEqual(
    log.map((action) => action.type),
    [
      'chooseZone',
      'decide',
      'moveCard',
      'decide',
      'chooseZone',
      'addSearch',
      'removeCard',
      'decide',
      'nextBatch',
    ],
  )
})
