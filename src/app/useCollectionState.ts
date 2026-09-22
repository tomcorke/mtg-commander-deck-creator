import { useState } from 'react'

import type { PersistedDeckState } from '../deck-state.ts'
import type { CollectionMode } from '../recommendations.ts'
import type { ScryfallCard, ScryfallSet } from '../domain/card-model.ts'

export function useCollectionState(saved: PersistedDeckState | null) {
  const [collectionSets, setCollectionSets] = useState<string[]>(saved?.collectionSets ?? [])
  const [collectionGroups, setCollectionGroups] = useState<string[]>(saved?.collectionGroups ?? [])
  const [collectionMode, setCollectionMode] = useState<CollectionMode>(
    saved?.collectionSets?.length ? (saved.collectionMode ?? 'none') : 'none',
  )
  const [setOptions, setSetOptions] = useState<ScryfallSet[]>([])
  const [collectionSearch, setCollectionSearch] = useState('')
  const [collectionPoolSize, setCollectionPoolSize] = useState<number | null>(null)
  const [collectionState, setCollectionState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [collectionError, setCollectionError] = useState('')
  const [collectionBrowserCards, setCollectionBrowserCards] = useState<ScryfallCard[]>([])
  const [collectionBrowserState, setCollectionBrowserState] = useState<
    'idle' | 'loading' | 'error'
  >('idle')
  const [collectionBrowserError, setCollectionBrowserError] = useState('')
  const [collectionBrowserType, setCollectionBrowserType] = useState('all')
  const [collectionBrowserMana, setCollectionBrowserMana] = useState('')
  const [showCollectionBrowser, setShowCollectionBrowser] = useState(false)

  return {
    collectionSets,
    setCollectionSets,
    collectionGroups,
    setCollectionGroups,
    collectionMode,
    setCollectionMode,
    setOptions,
    setSetOptions,
    collectionSearch,
    setCollectionSearch,
    collectionPoolSize,
    setCollectionPoolSize,
    collectionState,
    setCollectionState,
    collectionError,
    setCollectionError,
    collectionBrowserCards,
    setCollectionBrowserCards,
    collectionBrowserState,
    setCollectionBrowserState,
    collectionBrowserError,
    setCollectionBrowserError,
    collectionBrowserType,
    setCollectionBrowserType,
    collectionBrowserMana,
    setCollectionBrowserMana,
    showCollectionBrowser,
    setShowCollectionBrowser,
  }
}

export type CollectionState = ReturnType<typeof useCollectionState>
