import { useEffect, useState } from 'react'
import { fetchEdhrecPage } from '../adapters/edhrec.ts'
import type { ScryfallCard } from '../domain/card-model.ts'
import {
  deckCountFor,
  edhrecDeckCounts,
  edhrecIdentitySlug,
} from '../domain/commander-popularity.ts'

type Counts = ReadonlyMap<string, number>

/**
 * EDHREC deck counts for the shown commanders, from one background request per colour identity
 * shown. Counts cover each identity's top commanders only, so others stay unknown.
 */
export function useEdhrecDeckCounts(cards: readonly ScryfallCard[], fetcher: typeof fetch = fetch) {
  const [pages, setPages] = useState<ReadonlyMap<string, Counts>>(new Map())
  // Keyed by the identities shown, so a page arriving never restarts the others.
  const shown = [...new Set(cards.map((card) => edhrecIdentitySlug(card.color_identity)))]
    .filter(Boolean)
    .sort()
    .join('|')
  useEffect(() => {
    const controller = new AbortController()
    // The adapter keeps settled pages for 15 minutes, so revisiting an identity sends no request.
    for (const slug of shown.split('|').filter(Boolean))
      void fetchEdhrecPage('commanders', slug, fetcher, controller.signal, { background: true })
        .then((page) => setPages((current) => new Map(current).set(slug, edhrecDeckCounts(page))))
        // Popularity is optional context; a failed or cancelled page leaves its counts unknown.
        .catch(() => undefined)
    return () => controller.abort()
  }, [shown, fetcher])
  return (card: ScryfallCard) => {
    const slug = edhrecIdentitySlug(card.color_identity)
    return slug ? deckCountFor(pages.get(slug), card) : undefined
  }
}
