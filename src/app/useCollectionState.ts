import { useState } from 'react'

import type { ScryfallCard, ScryfallSet } from '../domain/card-model.ts'

export function useCollectionState() {
  const [setOptions, setSetOptions] = useState<ScryfallSet[]>([])
  const [collectionSearch, setCollectionSearch] = useState('')
  const [showSupplementalSets, setShowSupplementalSets] = useState(false)
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
    setOptions,
    setSetOptions,
    collectionSearch,
    setCollectionSearch,
    showSupplementalSets,
    setShowSupplementalSets,
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
