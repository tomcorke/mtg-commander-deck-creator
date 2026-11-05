import { useEffect, useState, type RefObject } from 'react'

import { scryfallImage, type Card, type ScryfallCard } from '../../domain/card-model.ts'
import { basicLandNames } from '../../deck-analysis.ts'
import type { LandSuggestion } from '../../land-suggestions.ts'
import { ArtLoading } from '../../shared/CardArt.tsx'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import { CardReference } from '../../shared/CardReference.tsx'
import { ManaSymbols } from '../../shared/ManaSymbols.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'

const basicLandSymbols: Record<string, string> = {
  ...Object.fromEntries(Object.entries(basicLandNames).map(([colour, name]) => [name, colour])),
  Wastes: 'C',
}
const printingLabel = (printing: ScryfallCard) => printing.set_name ?? printing.set.toUpperCase()

function BasicLandGallery({
  name,
  printings,
  shown,
  selected,
  onSelect,
  onShowMore,
}: {
  name: string
  printings: ScryfallCard[]
  shown: number
  selected?: ScryfallCard
  onSelect: (printing: ScryfallCard) => void
  onShowMore: () => void
}) {
  return (
    <div className="basic-land-gallery">
      <p>
        {printings.length} {name} printings
      </p>
      <div role="group" aria-label={`${name} printings`}>
        {printings.slice(0, shown).map((printing) => (
          <button
            key={`${printing.set}-${printing.collector_number}`}
            type="button"
            className="basic-land-art-option"
            aria-label={`${printingLabel(printing)} #${printing.collector_number}`}
            aria-pressed={
              selected?.set === printing.set &&
              selected?.collector_number === printing.collector_number
            }
            onClick={() => onSelect(printing)}
          >
            <SmallCardImage image={scryfallImage(printing)} placement="reference" />
            <b>{printingLabel(printing)}</b>
            <small>
              {printing.set.toUpperCase()} #{printing.collector_number}
            </small>
          </button>
        ))}
      </div>
      {shown < printings.length && (
        <button type="button" className="export" onClick={onShowMore}>
          Show more ({printings.length - shown} left)
        </button>
      )}
    </div>
  )
}

type Props = {
  basicLandState: 'idle' | 'loading' | 'error'
  basicLands: { name: string; count: number }[]
  legalBasicNames: string[]
  commanderSet: string
  landGap: number
  calculatedLandTarget: number
  nonbasicLands: LandSuggestion<Card>[]
  cardSearchButton: RefObject<HTMLButtonElement | null>
  opener: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onAddBasicLands: (lands: { name: string; count: number; printing?: ScryfallCard }[]) => void
  onLoadBasicLandPrintings: (name: string) => Promise<ScryfallCard[]>
  onLoadBasicsFromSet: (set: string) => Promise<ScryfallCard[]>
  onAddRecommendation: (card: Card) => void
  onOpenCard: (card: Card) => void
}

// eslint-disable-next-line max-lines-per-function -- The dialog markup stays intact to preserve its established focus and accessibility behavior.
export function BasicLandDialog({
  basicLandState,
  basicLands,
  legalBasicNames,
  commanderSet,
  landGap,
  calculatedLandTarget,
  nonbasicLands,
  cardSearchButton,
  opener,
  onClose,
  onAddBasicLands,
  onLoadBasicLandPrintings,
  onLoadBasicsFromSet,
  onAddRecommendation,
  onOpenCard,
}: Props) {
  const dialog = useDialogFocus(true, () => {
    if (basicLandState !== 'loading') onClose()
  })
  const planKey = `${legalBasicNames.join('|')}:${basicLands.map(({ name, count }) => `${name}:${count}`).join('|')}`
  const defaultLandCounts = Object.fromEntries(
    legalBasicNames.map((name) => [
      name,
      basicLands.find((land) => land.name === name)?.count ?? 0,
    ]),
  )
  const [landCountState, setLandCountState] = useState({ key: planKey, counts: defaultLandCounts })
  const landCounts = landCountState.key === planKey ? landCountState.counts : defaultLandCounts
  const [printings, setPrintings] = useState<Record<string, ScryfallCard[]>>({})
  const [selectedPrintings, setSelectedPrintings] = useState<Record<string, ScryfallCard>>({})
  const [openGallery, setOpenGallery] = useState('')
  const [shownPrintings, setShownPrintings] = useState(24)
  const [styleLoading, setStyleLoading] = useState(false)
  const [styleError, setStyleError] = useState('')
  const validCounts = legalBasicNames.every(
    (name) =>
      Number.isInteger(landCounts[name]) && landCounts[name] >= 0 && landCounts[name] <= landGap,
  )
  const landCount = Object.values(landCounts).reduce(
    (sum, count) => sum + (Number.isInteger(count) ? count : 0),
    0,
  )
  const remaining = landGap - landCount
  const busy = styleLoading || basicLandState === 'loading'
  const setCount = (name: string, count: number) =>
    setLandCountState({ key: planKey, counts: { ...landCounts, [name]: count } })
  const toggleGallery = async (name: string) => {
    if (openGallery === name) {
      setOpenGallery('')
      return
    }
    setOpenGallery(name)
    setShownPrintings(24)
    if (printings[name]) return
    setStyleLoading(true)
    setStyleError('')
    try {
      const cards = await onLoadBasicLandPrintings(name)
      setPrintings((current) => ({ ...current, [name]: cards }))
    } catch {
      setStyleError(`Could not load ${name} printings.`)
    } finally {
      setStyleLoading(false)
    }
  }
  const plan = legalBasicNames.flatMap((name) =>
    Number.isInteger(landCounts[name]) && landCounts[name] > 0
      ? [{ name, count: landCounts[name], printing: selectedPrintings[name] }]
      : [],
  )

  useEffect(() => {
    const openerElement = opener.current
    const searchButton = cardSearchButton.current
    // Runs after useDialogFocus's cleanup, which restores a connected opener. Focus still on body means
    // filling removed the opener, so fall back to the card search button.
    return () => {
      if (document.activeElement === document.body)
        (openerElement?.isConnected ? openerElement : searchButton)?.focus()
    }
  }, [cardSearchButton, opener])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && basicLandState !== 'loading') onClose()
      }}
    >
      <section
        {...dialog}
        className="export-modal basic-land-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="basic-land-title"
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Complete mana base</p>
            <h2 id="basic-land-title">Choose lands</h2>
          </div>
          <ModalCloseButton
            disabled={basicLandState === 'loading'}
            onClick={onClose}
            label="Close land choices"
          />
        </div>
        <p aria-live="polite" aria-atomic="true">
          Room for {landGap} more lands toward your {calculatedLandTarget}-land target. Existing
          cards stay unchanged.
        </p>
        {nonbasicLands.length > 0 && (
          <section className="land-fill-step" aria-labelledby="nonbasic-land-title">
            <h3 id="nonbasic-land-title">Start with nonbasic lands</h3>
            <p>
              Ranked against your current colour sources; only lands that beat a basic are shown.
              Each one you add replaces a basic.
            </p>
            <ul className="nonbasic-land-list">
              {nonbasicLands.map(({ card, benefit, drawback }) => (
                <li key={card.name}>
                  <CardReference
                    card={card}
                    onOpen={() => onOpenCard(card)}
                    thumbnail
                    disabled={basicLandState === 'loading'}
                  />
                  <p className="land-trade-off">
                    <span>{benefit}.</span> <span>{drawback}.</span>
                  </p>
                  <button
                    type="button"
                    className="compact-action"
                    aria-label={`Add ${card.name} to deck`}
                    disabled={basicLandState === 'loading'}
                    onClick={(event) => {
                      const next =
                        event.currentTarget
                          .closest('li')
                          ?.nextElementSibling?.querySelector<HTMLButtonElement>(
                            '.compact-action',
                          ) ?? dialog.ref.current?.querySelector<HTMLButtonElement>('.modal-close')
                      onAddRecommendation(card)
                      next?.focus()
                    }}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section
          className="land-fill-step basic-land-split"
          aria-labelledby="basic-land-split-title"
        >
          <div className="basic-land-split-heading">
            <div>
              <h3 id="basic-land-split-title">
                {nonbasicLands.length > 0 ? 'Then fill the rest with basics' : 'Basic land split'}
              </h3>
              <p>Set the colour balance, then pick art for each basic.</p>
            </div>
            {commanderSet && (
              <button
                type="button"
                className="export"
                disabled={busy}
                title="Applies matching basic printings where available."
                onClick={async () => {
                  setStyleLoading(true)
                  setStyleError('')
                  try {
                    const cards = await onLoadBasicsFromSet(commanderSet)
                    setSelectedPrintings((current) => ({
                      ...current,
                      ...Object.fromEntries(cards.map((card) => [card.name, card])),
                    }))
                  } catch {
                    setStyleError('Could not load basics from the commander’s set.')
                  } finally {
                    setStyleLoading(false)
                  }
                }}
              >
                {styleLoading && !openGallery
                  ? 'Loading set…'
                  : `Match commander’s set (${commanderSet.toUpperCase()})`}
              </button>
            )}
          </div>
          <div className="basic-land-balance">
            <div className="colour-bar" aria-hidden="true">
              {legalBasicNames.map(
                (name) =>
                  landCounts[name] > 0 && (
                    <span
                      className={`colour-segment colour-${basicLandSymbols[name].toLowerCase()}`}
                      style={{ flexGrow: landCounts[name] }}
                      key={name}
                    >
                      <ManaSymbols symbols={[basicLandSymbols[name]]} decorative />
                      <b>{landCounts[name]}</b>
                    </span>
                  ),
              )}
              {remaining > 0 && (
                <span className="colour-segment colour-empty" style={{ flexGrow: remaining }} />
              )}
            </div>
            <p
              className={remaining === 0 ? 'balance-ok' : 'balance-off'}
              aria-live="polite"
              aria-atomic="true"
            >
              {remaining === 0
                ? `All ${landGap} basics assigned`
                : `${landCount} of ${landGap} assigned · ${remaining > 0 ? `add ${remaining} more` : `remove ${-remaining}`}`}
            </p>
          </div>
          <ul className="basic-land-plan">
            {legalBasicNames.map((name) => {
              const selected = selectedPrintings[name]
              const count = landCounts[name]
              const galleryOpen = openGallery === name
              return (
                <li key={name} className={galleryOpen ? 'open' : undefined}>
                  <span className="basic-land-art">
                    {selected ? (
                      <SmallCardImage image={scryfallImage(selected)} placement="reference" />
                    ) : (
                      <ManaSymbols symbols={[basicLandSymbols[name]]} decorative />
                    )}
                  </span>
                  <span className="basic-land-name">
                    <label htmlFor={`basic-count-${name}`}>{name}</label>
                    <small>
                      {selected
                        ? `${printingLabel(selected)} #${selected.collector_number}`
                        : 'Default printing'}
                    </small>
                  </span>
                  <span className="basic-land-stepper">
                    <button
                      type="button"
                      className="deck-add"
                      aria-label={`One fewer ${name}`}
                      disabled={busy || !(count > 0)}
                      onClick={() => setCount(name, Math.min(count, landGap) - 1)}
                    >
                      −
                    </button>
                    <input
                      id={`basic-count-${name}`}
                      type="number"
                      min="0"
                      max={landGap}
                      step="1"
                      value={Number.isFinite(count) ? count : ''}
                      aria-label={`${name} count`}
                      onChange={(event) => setCount(name, event.currentTarget.valueAsNumber)}
                    />
                    <button
                      type="button"
                      className="deck-add"
                      aria-label={`One more ${name}`}
                      disabled={busy || remaining <= 0 || !(count < landGap)}
                      onClick={() => setCount(name, (Number.isInteger(count) ? count : 0) + 1)}
                    >
                      +
                    </button>
                  </span>
                  <button
                    type="button"
                    className="compact-action"
                    aria-expanded={galleryOpen}
                    disabled={busy}
                    onClick={() => void toggleGallery(name)}
                  >
                    {galleryOpen ? 'Done' : selected ? 'Change art' : 'Choose art'}
                  </button>
                  {galleryOpen && !printings[name] && styleLoading && (
                    <div className="basic-land-gallery-loading">
                      <ArtLoading active />
                    </div>
                  )}
                  {galleryOpen && printings[name] && (
                    <BasicLandGallery
                      name={name}
                      printings={printings[name]}
                      shown={shownPrintings}
                      selected={selected}
                      onSelect={(printing) =>
                        setSelectedPrintings((current) => ({ ...current, [name]: printing }))
                      }
                      onShowMore={() => setShownPrintings((shown) => shown + 24)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {styleError && (
            <p className="form-error" role="alert">
              {styleError}
            </p>
          )}
        </section>
        {basicLandState === 'error' && (
          <p className="form-error" role="alert">
            Could not load basic lands. Try again.
          </p>
        )}
        <div className="export-actions">
          <button
            type="button"
            className="export"
            onClick={onClose}
            disabled={basicLandState === 'loading'}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={
              basicLandState === 'loading' || landGap === 0 || !validCounts || landCount !== landGap
            }
            onClick={() => onAddBasicLands(plan)}
          >
            {basicLandState === 'loading'
              ? 'Adding…'
              : `Add ${landGap} basic${landGap === 1 ? '' : 's'}`}
          </button>
        </div>
      </section>
    </div>
  )
}
