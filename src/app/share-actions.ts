import { commanderNames } from '../domain/commander-catalog.ts'
import type { DeckCard } from '../domain/card-model.ts'
import type { ImportBoard, ImportedCard, ImportedDeck } from '../deck-import.ts'
import {
  decodeSharedDeck,
  deckListFile,
  encodeSharedDeck,
  shareLinkFor,
  sharedDeckFromCards,
  SharedDeckError,
} from '../domain/share-link.ts'
import {
  applyImportedDeck,
  deckList,
  importedDeckCard,
  resolveImportedCards,
} from './deck-actions.ts'
import type { AppActionContext } from './recommendation-actions.ts'

export type SharedDeckEntry = { card: DeckCard; quantity: number; board: ImportBoard }
type SharedDeckPreview = {
  deck: ImportedDeck
  entries: SharedDeckEntry[]
  missing: string[]
  error?: string
}
/** A share link opened in this browser: a read-only preview until the player copies it (#504). */
export type SharedDeckView =
  | { status: 'loading'; payload: string }
  | { status: 'error'; payload: string; error: string; retryable: boolean }
  | ({ status: 'ready' | 'confirming' | 'copying' } & SharedDeckPreview)

export type ShareLinkState =
  { status: 'idle' } | { status: 'copied'; link: string } | { status: 'failed'; link: string }

let sharedDeckRequest = 0

/** Saves the export list as a file in the current format. */
export function downloadDeckList(deps: AppActionContext) {
  const neededOnly = deps.exportNeededOnly && Object.keys(deps.ownedCards ?? {}).length > 0
  const { fileName, type } = deckListFile(
    deps.deckName || deps.commander,
    deps.exportFormat,
    neededOnly,
  )
  const blob = new Blob([`${deckList(deps, deps.exportFormat)}\n`], {
    type: `${type};charset=utf-8`,
  })
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName })
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Revoke after the click has handed the blob to the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The whole deck, commanders and sideboard included, as a link to this app. */
export async function shareLink(deps: AppActionContext) {
  const deck = sharedDeckFromCards(
    commanderNames(deps.commander).length,
    deps.deck,
    deps.sideboard,
    deps.deckName,
  )
  return shareLinkFor(window.location.href, await encodeSharedDeck(deck))
}

export async function copyShareLink(deps: AppActionContext) {
  const link = await shareLink(deps)
  // Clipboard access can be denied; the dialog then shows the link to copy by hand.
  const copied = await Promise.resolve()
    .then(() => navigator.clipboard.writeText(link))
    .then(
      () => true,
      () => false,
    )
  deps.setShareLinkState({ status: copied ? 'copied' : 'failed', link })
}

function previewEntries(
  expanded: { entry: ImportedCard; card: Parameters<typeof importedDeckCard>[0]['card'] }[],
) {
  const entries = new Map<ImportedCard, SharedDeckEntry>()
  for (const item of expanded)
    if (!entries.has(item.entry))
      entries.set(item.entry, {
        card: importedDeckCard(item),
        quantity: item.entry.quantity,
        board: item.entry.board,
      })
  return [...entries.values()]
}

// A damaged link stays damaged; a provider or network failure can succeed on a retry.
const loadError = (error: unknown) =>
  error instanceof SharedDeckError
    ? { error: error.message, retryable: false }
    : {
        error: `Could not load this shared deck. ${error instanceof Error ? error.message : 'Try again.'}`,
        retryable: true,
      }

/** Decodes and resolves a share link without touching the player's current deck. */
export async function openSharedDeck(deps: AppActionContext, payload: string) {
  const request = ++sharedDeckRequest
  deps.setSharedDeck({ status: 'loading', payload })
  try {
    const deck = await decodeSharedDeck(payload)
    const { expanded } = await resolveImportedCards(deck, AbortSignal.timeout(30_000), true)
    const found = new Set(expanded.map(({ entry }) => entry))
    if (request !== sharedDeckRequest) return
    deps.setSharedDeck({
      status: 'ready',
      deck,
      entries: previewEntries(expanded),
      missing: deck.cards.filter((card) => !found.has(card)).map(({ name }) => name),
    })
  } catch (error) {
    if (request !== sharedDeckRequest) return
    deps.setSharedDeck({ status: 'error', payload, ...loadError(error) })
  }
}

export function closeSharedDeck(deps: AppActionContext) {
  sharedDeckRequest++
  deps.setSharedDeck(null)
}

/** Makes the shared deck the current deck; a deck in progress needs confirmation first. */
export async function copySharedDeck(deps: AppActionContext) {
  const shared = deps.sharedDeck as SharedDeckView | null
  if (shared?.status !== 'ready') return
  const preview = { deck: shared.deck, entries: shared.entries, missing: shared.missing }
  if (deps.commander && deps.deck.length > 0) {
    deps.setSharedDeck({ status: 'confirming', ...preview })
    const confirmed = await (
      await import('../shared/ConfirmDialog.tsx')
    ).confirmDialog({
      title: 'Replace the current deck?',
      message: `"${deps.deckName || deps.commander}" (${deps.deck.length} cards) stays in Saved decks under Autosaved drafts. Manual saves are unchanged.`,
      confirmLabel: 'Copy and replace',
    })
    if (!confirmed) {
      deps.setSharedDeck({ status: 'ready', ...preview })
      return
    }
  }
  deps.setSharedDeck({ status: 'copying', ...preview })
  try {
    await applyImportedDeck(deps, shared.deck, true)
    deps.setSharedDeck(null)
  } catch (error) {
    deps.setSharedDeck({
      status: 'ready',
      ...preview,
      error: error instanceof Error ? error.message : 'Could not copy this deck.',
    })
  }
}

/** Card details for a shared card stay read-only, even when the player's deck has that card. */
export function openSharedCard(deps: AppActionContext, card: DeckCard) {
  deps.manualPrintingRequest.current?.abort()
  deps.setSelectedManualCard(null)
  deps.setSelectedDeckCardLocation(null)
  deps.setSelectedCollectionCard(null)
  deps.setSelectedGuidanceCard(null)
  deps.setSelectedCardReference(card)
  deps.openModal(deps, 'card')
}
