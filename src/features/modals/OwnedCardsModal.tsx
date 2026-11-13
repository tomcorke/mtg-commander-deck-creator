import { useEffect, useEffectEvent, useMemo, useState } from 'react'

import { cardNameKey, type DeckCard } from '../../domain/card-model.ts'
import {
  combineOwnedCards,
  describeOwnedCards,
  parseOwnedCards,
  type OwnedCard,
  type OwnedCardList,
  type ParsedOwnedCards,
} from '../../domain/owned-cards.ts'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { confirmDialog } from '../../shared/ConfirmDialog.tsx'
import { Pagination } from '../../shared/Pagination.tsx'
import { pageWindow } from '../../shared/pagination.ts'
import { useDialogFocus } from '../../shared/hooks.ts'

const pageSize = 60
const listedProblems = 8

type Props = {
  show: boolean
  ownedCardList: OwnedCardList | null
  saveOwnedCards: (cards: OwnedCard[] | null) => void
  unrecognisedOwnedNames: (cards: OwnedCard[]) => Promise<string[] | null>
  openOwnedCard: (name: string) => Promise<boolean>
  resolveOwnedCards: (cards: OwnedCard[]) => Promise<Map<string, DeckCard> | null>
  closeModal: () => void
}

const listed = (items: string[]) =>
  items.slice(0, listedProblems).join(', ') +
  (items.length > listedProblems ? `, and ${items.length - listedProblems} more` : '')

function useUnrecognisedNames(
  cards: OwnedCard[],
  check: (cards: OwnedCard[]) => Promise<string[] | null>,
) {
  const [result, setResult] = useState<{ cards: OwnedCard[]; names: string[] | null } | null>(null)
  const run = useEffectEvent((cards: OwnedCard[]) => check(cards))
  useEffect(() => {
    if (!cards.length) return
    let current = true
    // Waits for typing to pause; the first check loads the local card index.
    const timer = setTimeout(
      () => void run(cards).then((names) => current && setResult({ cards, names })),
      400,
    )
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [cards])
  return result?.cards === cards ? result.names : null
}

/** Owned cards the local card index knows, keyed by `cardNameKey`, once the index answers. */
function useResolvedOwnedCards(
  cards: OwnedCard[],
  resolve: (cards: OwnedCard[]) => Promise<Map<string, DeckCard> | null>,
) {
  const [result, setResult] = useState<{
    cards: OwnedCard[]
    known: Map<string, DeckCard> | null
  } | null>(null)
  const run = useEffectEvent((cards: OwnedCard[]) => resolve(cards))
  useEffect(() => {
    let current = true
    void run(cards).then((known) => current && setResult({ cards, known }))
    return () => {
      current = false
    }
  }, [cards])
  return result?.cards === cards ? result.known : null
}

/** What the pasted list holds, what was skipped, and names the app does not know. */
function ImportSummary({
  source,
  parsed,
  saved,
  unrecognisedOwnedNames,
}: Pick<Props, 'unrecognisedOwnedNames'> & {
  source: string
  parsed: ParsedOwnedCards
  saved: string
}) {
  const unrecognised = useUnrecognisedNames(parsed.cards, unrecognisedOwnedNames)
  const copies = parsed.cards.reduce((total, { quantity }) => total + quantity, 0)
  return (
    <div className="import-summary" role="status">
      {saved && <p>{saved}</p>}
      {source.trim() && (
        <p>
          {parsed.cards.length
            ? `Found ${parsed.cards.length.toLocaleString()} ${parsed.cards.length === 1 ? 'card' : 'cards'} (${copies.toLocaleString()} ${copies === 1 ? 'copy' : 'copies'}) in this ${parsed.format === 'csv' ? 'CSV' : 'list'}.`
            : 'No cards found. Check the list has card names, or a CSV header with a Name column.'}
        </p>
      )}
      {parsed.skipped.length > 0 && (
        <p>
          Skipped {parsed.skipped.length} {parsed.skipped.length === 1 ? 'line' : 'lines'}:{' '}
          {listed(parsed.skipped.map(({ line, reason }) => `line ${line} (${reason})`))}.
        </p>
      )}
      {unrecognised && unrecognised.length > 0 && (
        <p>
          {unrecognised.length} {unrecognised.length === 1 ? 'name is' : 'names are'} not a
          Commander-legal card the app knows, so {unrecognised.length === 1 ? 'it' : 'they'} will
          never be recommended. Check the spelling: {listed(unrecognised)}.
        </p>
      )}
    </div>
  )
}

/** Reads a chosen list or CSV file in the browser; nothing is uploaded. */
function OwnedCardFile({ onRead }: { onRead: (text: string) => void }) {
  const [error, setError] = useState('')
  return (
    <>
      <label className="owned-cards-file">
        Or read a file
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            try {
              onRead(await file.text())
              setError('')
            } catch {
              setError(`Could not read ${file.name}.`)
            }
          }}
        />
      </label>
      {error && (
        <p className="import-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

function ImportOwnedCards({
  ownedCardList,
  saveOwnedCards,
  unrecognisedOwnedNames,
}: Pick<Props, 'ownedCardList' | 'saveOwnedCards' | 'unrecognisedOwnedNames'>) {
  const [source, setSource] = useState('')
  const [saved, setSaved] = useState('')
  const parsed = useMemo(() => parseOwnedCards(source), [source])
  const save = async (replace: boolean) => {
    if (
      replace &&
      ownedCardList &&
      !(await confirmDialog({
        title: 'Replace owned cards?',
        message: `This replaces your ${describeOwnedCards(ownedCardList)} with the ${describeOwnedCards({ cards: parsed.cards, updatedAt: '' })} in this list.`,
        confirmLabel: 'Replace owned cards',
      }))
    )
      return
    saveOwnedCards(
      replace || !ownedCardList
        ? parsed.cards
        : combineOwnedCards(ownedCardList.cards, parsed.cards),
    )
    setSaved(
      `Saved ${describeOwnedCards({ cards: parsed.cards, updatedAt: '' })}${replace || !ownedCardList ? '' : ' to your owned cards'}.`,
    )
    setSource('')
  }
  return (
    <section className="owned-cards-import" aria-labelledby="owned-cards-import-title">
      <h3 id="owned-cards-import-title">Import a list</h3>
      <p className="import-help">
        Paste one card per line, such as “4 Lightning Bolt”, or a collection CSV with a Name column
        and an optional Quantity or Count column. Copies of the same card in different printings are
        added together.
      </p>
      <textarea
        value={source}
        onChange={(event) => {
          setSource(event.target.value)
          setSaved('')
        }}
        placeholder={'4 Lightning Bolt\n1 Sol Ring\nForest'}
        aria-label="Owned card list"
      />
      <OwnedCardFile
        onRead={(text) => {
          setSource(text)
          setSaved('')
        }}
      />
      <ImportSummary
        source={source}
        parsed={parsed}
        saved={saved}
        unrecognisedOwnedNames={unrecognisedOwnedNames}
      />
      <div className="export-actions">
        {ownedCardList ? (
          <>
            <button
              type="button"
              className="export"
              disabled={!parsed.cards.length}
              onClick={() => void save(true)}
            >
              Replace owned cards
            </button>
            <button
              type="button"
              className="primary"
              disabled={!parsed.cards.length}
              onClick={() => void save(false)}
            >
              Add to owned cards
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={!parsed.cards.length}
            onClick={() => void save(true)}
          >
            Save owned cards
          </button>
        )}
      </div>
    </section>
  )
}

function OwnedCardList({
  ownedCardList,
  openOwnedCard,
  resolveOwnedCards,
}: Pick<Props, 'openOwnedCard' | 'resolveOwnedCards'> & { ownedCardList: OwnedCardList }) {
  const known = useResolvedOwnedCards(ownedCardList.cards, resolveOwnedCards)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [openError, setOpenError] = useState('')
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term
      ? ownedCardList.cards.filter(({ name }) => name.toLowerCase().includes(term))
      : ownedCardList.cards
  }, [ownedCardList, query])
  const shown = pageWindow(matches.length, pageSize, page)
  return (
    <section className="owned-cards-list" aria-labelledby="owned-cards-list-title">
      <h3 id="owned-cards-list-title">Your owned cards</h3>
      <p className="import-summary">
        {describeOwnedCards(ownedCardList)}, saved{' '}
        {new Date(ownedCardList.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}.
      </p>
      <label className="owned-cards-search">
        Find an owned card
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(0)
          }}
        />
      </label>
      {openError && (
        <p className="import-error" role="alert">
          {openError}
        </p>
      )}
      {matches.length ? (
        <ul className="owned-card-grid">
          {matches.slice(shown.start, shown.end).map(({ name, quantity }) => {
            // Names the local index knows preview their art; others open details by name.
            const card = known?.get(cardNameKey(name))
            return (
              <li key={name}>
                <CardReference
                  card={card ? { ...card, name } : { name, image: '' }}
                  preview={Boolean(card?.image)}
                  thumbnail
                  onOpen={() =>
                    void openOwnedCard(name).then((opened) =>
                      setOpenError(opened ? '' : `Card details for ${name} are unavailable.`),
                    )
                  }
                />
                <span className="owned-card-quantity" aria-label={`${quantity} owned`}>
                  ×{quantity}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="saved-decks-empty">No owned card matches “{query.trim()}”.</p>
      )}
      <Pagination
        label="Owned card pages"
        noun="cards"
        count={matches.length}
        pageSize={pageSize}
        page={shown.page}
        onPage={setPage}
      />
    </section>
  )
}

/** Import, view and clear the player's owned cards. Stored only in this browser. */
export function OwnedCardsModal({
  show,
  ownedCardList,
  saveOwnedCards,
  unrecognisedOwnedNames,
  openOwnedCard,
  resolveOwnedCards,
  closeModal,
}: Props) {
  const dialog = useDialogFocus(show, closeModal)
  if (!show) return null
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        {...dialog}
        className="export-modal import-modal owned-cards-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owned-cards-title"
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Your collection</p>
            <h2 id="owned-cards-title">Owned cards</h2>
          </div>
          <ModalCloseButton onClick={closeModal} label="Close owned cards" />
        </div>
        <p className="import-help">
          Your owned cards stay in this browser; nothing is uploaded. Recommendation settings can
          prefer them or offer only them, and Export can list the cards you still need.
        </p>
        <ImportOwnedCards
          ownedCardList={ownedCardList}
          saveOwnedCards={saveOwnedCards}
          unrecognisedOwnedNames={unrecognisedOwnedNames}
        />
        {ownedCardList && (
          <OwnedCardList
            key={ownedCardList.updatedAt}
            ownedCardList={ownedCardList}
            openOwnedCard={openOwnedCard}
            resolveOwnedCards={resolveOwnedCards}
          />
        )}
        <div className="export-actions">
          {ownedCardList ? (
            <button
              type="button"
              className="danger"
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Clear owned cards?',
                    message: `This removes your ${describeOwnedCards(ownedCardList)} from this browser. Decks are not changed.`,
                    confirmLabel: 'Clear owned cards',
                  })
                )
                  saveOwnedCards(null)
              }}
            >
              Clear owned cards
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="primary" onClick={closeModal}>
            Done
          </button>
        </div>
      </section>
    </div>
  )
}
