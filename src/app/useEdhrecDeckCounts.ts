import { useEffect, useState } from 'react'
import { fetchEdhrecPage } from '../adapters/edhrec.ts'
import type { ScryfallCard } from '../domain/card-model.ts'
import {
  deckCountFor,
  edhrecDeckCounts,
  edhrecIdentitySlug,
} from '../domain/commander-popularity.ts'

/** An identity's counts, or null when its page failed. */
type Counts = ReadonlyMap<string, number> | null

/**
 * EDHREC deck counts for `cards`, from one background request per colour identity among them,
 * requested in the order the identities first appear. Counts cover each identity's top commanders
 * only, so others stay unknown. `pending` counts the identities whose page has not settled yet.
 */
export function useEdhrecDeckCounts(cards: readonly ScryfallCard[], fetcher: typeof fetch = fetch) {
  const [pages, setPages] = useState<ReadonlyMap<string, Counts>>(new Map())
  const slugs = [...new Set(cards.flatMap((card) => edhrecIdentitySlug(card.color_identity) ?? []))]
  // Keyed by the identities wanted, so a page arriving never restarts the others.
  const wanted = slugs.join('|')
  useEffect(() => {
    const controller = new AbortController()
    // The adapter keeps settled pages for 15 minutes, so revisiting an identity sends no request.
    for (const slug of wanted.split('|').filter(Boolean))
      void fetchEdhrecPage('commanders', slug, fetcher, controller.signal, { background: true })
        .then((page) => setPages((current) => new Map(current).set(slug, edhrecDeckCounts(page))))
        // Popularity is optional context; a failed page leaves its counts unknown.
        .catch(() => {
          if (!controller.signal.aborted)
            setPages((current) => (current.get(slug) ? current : new Map(current).set(slug, null)))
        })
    return () => controller.abort()
  }, [wanted, fetcher])
  return {
    deckCount: (card: ScryfallCard) => {
      const slug = edhrecIdentitySlug(card.color_identity)
      return slug ? deckCountFor(pages.get(slug) ?? undefined, card) : undefined
    },
    pending: slugs.filter((slug) => !pages.has(slug)).length,
    /** Whether `card`'s identity page has settled, or it has none to wait for. */
    settled: (card: ScryfallCard) => {
      const slug = edhrecIdentitySlug(card.color_identity)
      return !slug || pages.has(slug)
    },
  }
}
