import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { loadDeckState, persistedDeckStateSchema, saveDeckState } from '../deck-state.ts'
import { toCard, toDeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { decide } from './deck-actions.ts'
import type { ActionDeps } from './recommendation-actions.ts'
import { useRecommendationState, type RecommendationState } from './useRecommendationState.ts'

const raw = (name: string): ScryfallCard => ({
  name,
  type_line: 'Planeswalker',
  color_identity: ['B'],
  set: 'akh',
  collector_number: '275',
  prints_search_uri: '',
})

function restore(saved: Parameters<typeof useRecommendationState>[0]) {
  let restored: RecommendationState | undefined
  function Snapshot() {
    restored = useRecommendationState(saved)
    return null
  }
  renderToString(createElement(Snapshot))
  assert(restored)
  return restored
}

test('reload restores current-batch choices and the first Add click removes an already-added card from a full deck', () => {
  const liliana = 'Liliana, Death Wielder'
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
  const state = persistedDeckStateSchema.parse({
    commander: 'Commander',
    commanderDetails: { images: [], art: [], colours: ['B'], printings: [], selections: [] },
    theme: '',
    queue: [liliana, 'Later card', 'Ignored card', 'Sideboard card'].map((name) =>
      toCard(raw(name), 'Fixture'),
    ),
    maxPrice: 5,
    ignoreReasons: { 'Ignored card': 'Off-theme' },
    recommendationStyle: 'thematic',
    prioritizeDeckHealth: false,
    decisions: {
      [liliana]: 'add',
      'Later card': 'later',
      'Ignored card': 'ignore',
      'Sideboard card': 'add',
    },
    deck: [
      toDeckCard(raw(liliana)),
      ...Array.from({ length: 99 }, (_, index) => toDeckCard(raw(`Existing ${index}`))),
    ],
    sideboard: [toDeckCard(raw('Sideboard card'))],
    limitedRecommendations: false,
    ignoredCards: ['Ignored card'],
    liked: [],
    activeSubThemes: [],
    dismissedSubThemes: [],
    preferenceScores: {},
    commanderSubThemes: [],
    deferredCards: [],
    batchNumber: 1,
    preferredPrintSet: '',
    deckTargets: { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 },
  })
  saveDeckState(state, storage)
  const saved = loadDeckState(storage)
  assert(saved)
  assert.deepEqual(saved.decisions, state.decisions)
  const restored = restore(saved)
  assert.deepEqual(restored.decisions, state.decisions)
  assert.deepEqual(restored.queue, saved.queue)
  assert.equal(restored.maxPrice, 5)
  assert.deepEqual(restored.ignoreReasons, { 'Ignored card': 'Off-theme' })
  assert.equal(restored.recommendationStyle, 'thematic')
  assert.equal(restored.prioritizeDeckHealth, false)
  assert.equal(
    restore({ ...saved, recommendationStyle: 'thematic', prioritizeDeckHealth: true })
      .recommendationStyle,
    'balanced',
  )
  assert.equal(
    restore({ ...saved, recommendationStyle: 'balanced', prioritizeDeckHealth: false })
      .recommendationStyle,
    'thematic',
  )
  const deps: Record<string, any> = {
    decisions: restored.decisions,
    deck: saved.deck,
    sideboard: saved.sideboard,
    ignoredCards: saved.ignoredCards,
    liked: saved.liked,
  }
  for (const key of ['Decisions', 'Deck', 'Sideboard', 'IgnoredCards', 'Liked']) {
    const name = key[0].toLowerCase() + key.slice(1)
    deps[`set${key}`] = (update: (value: unknown) => unknown) => {
      deps[name] = update(deps[name])
    }
  }
  decide(deps as ActionDeps, restored.queue[0], 'add')
  assert.equal(deps.deck.length, 99)
  assert(!deps.deck.some(({ name }: { name: string }) => name === liliana))
  assert.deepEqual(deps.sideboard, saved.sideboard)
  assert.equal(deps.decisions[liliana], undefined)
  assert.equal(deps.decisions['Later card'], 'later')
  assert.equal(deps.decisions['Ignored card'], 'ignore')
  decide(deps as ActionDeps, restored.queue[3], 'add')
  assert.equal(deps.sideboard.length, 0)
  assert.equal(deps.decisions['Sideboard card'], undefined)
  const damagedSave = { ...saved, decisions: {} }
  const damaged = restore(damagedSave)
  assert.deepEqual(damaged.decisions, { [liliana]: 'add', 'Sideboard card': 'add' })
  assert.deepEqual(damagedSave.decisions, {})
  assert.deepEqual(restore({ ...saved, decisions: { 'Later card': 'later' } }).decisions, {
    [liliana]: 'add',
    'Sideboard card': 'add',
    'Later card': 'later',
  })
})

test('a fresh session has no recommendation decisions', () => {
  assert.deepEqual(restore(null).decisions, {})
})
