import { useState } from 'react'
import { appStorage } from '../app-storage.ts'
import { readOwnedCardList } from '../domain/owned-cards.ts'

/** The full owned list for viewing; the builder keeps only per-name quantities. */
export function useOwnedCardsState() {
  const [ownedCardList, setOwnedCardList] = useState(() => readOwnedCardList(appStorage))
  return { ownedCardList, setOwnedCardList }
}
