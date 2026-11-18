import { plural } from './land-dialog-copy.ts'
import { useEffect, useRef, useState, type RefObject } from 'react'

import { scryfallImage, type Card, type ScryfallCard } from '../../domain/card-model.ts'
import { basicLandNames } from '../../deck-analysis.ts'
import { appTerms, claimKindLabels } from '../../domain/glossary.ts'
import {
  landPlanGroup,
  landPlanHoldLabels,
  landPlanReason,
  type BasicLandCount,
  type LandPlan,
  type LandPlanPick,
} from '../../domain/land-plan.ts'
import { reconcileLandSelection, resizeBasicCounts } from './land-dialog-state.ts'
import { ArtLoading } from '../../shared/CardArt.tsx'
import { CardPriceLink, ModalCloseButton } from '../../shared/CardDetails.tsx'
import { useDialogFocus } from '../../shared/hooks.ts'
import { ManaSymbols, OracleText } from '../../shared/ManaSymbols.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { ReviewCardTile } from './DeckReviewCard.tsx'

const basicLandSymbols: Record<string, string> = {
  ...Object.fromEntries(Object.entries(basicLandNames).map(([colour, name]) => [name, colour])),
  Wastes: 'C',
}
const printingsPage = 24
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
          Show {Math.min(printingsPage, printings.length - shown)} more ({printings.length - shown}{' '}
          left)
        </button>
      )}
    </div>
  )
}

/** Plan options in dialog groups: fill order, then each group's picks before its alternatives. */
function planGroups(plan: LandPlan<Card>) {
  const groups: { label: string; options: LandPlanPick<Card>[] }[] = []
  const steps = ['fixing', 'earned', 'utility']
  const options = [...plan.picks, ...plan.alternatives].sort(
    (a, b) => steps.indexOf(a.step) - steps.indexOf(b.step),
  )
  for (const option of options) {
    const label = landPlanGroup(option)
    const group = groups.find((entry) => entry.label === label)
    if (group) group.options.push(option)
    else groups.push({ label, options: [option] })
  }
  return groups
}

/**
 * The planned nonbasic lands (#589), grouped by role and pre-selected. Unticking one gives its
 * slot back to basics; alternatives the plan left out can be ticked while slots remain.
 */
function LandPlanSection({
  plan,
  landGap,
  selected,
  disabled,
  onToggle,
  onOpenCard,
}: {
  plan: LandPlan<Card>
  landGap: number
  selected: string[]
  disabled: boolean
  onToggle: (name: string) => void
  onOpenCard: (card: Card) => void
}) {
  const { term, kind } = appTerms.landPlan
  const full = selected.length >= landGap
  const reserve = plan.fetchers
    ? `keeps ${plural(plan.reserve, 'basic')} for your ${plural(plan.fetchers, 'basic-land search', 'basic-land searches')}`
    : `keeps at least ${plural(plan.reserve, 'basic')}`
  return (
    <section className="land-fill-step land-plan" aria-labelledby="nonbasic-land-title">
      <h3 id="nonbasic-land-title">Planned nonbasic lands</h3>
      <p>
        The plan uses up to {plural(plan.cap, 'nonbasic land')} for your colours and {reserve}.
        Untick a land to give its slot to a basic.
      </p>
      <p className="generic-pick land-plan-note">
        <span className="generic-pick-label">{term}</span> {claimKindLabels[kind]}: reasons quote
        the text that matched, not how well the land does the job.
      </p>
      {full && plan.alternatives.length > 0 && (
        <p className="land-plan-full" aria-live="polite">
          Every land slot is planned. Untick a land to swap in another.
        </p>
      )}
      {planGroups(plan).map(({ label, options }) => (
        <section key={label} className="land-plan-group" aria-label={label}>
          <h4>{label}</h4>
          <div className="doctor-card-grid">
            {options.map((option) => {
              const { card } = option
              const checked = selected.includes(card.name)
              return (
                <ReviewCardTile
                  key={card.name}
                  card={card}
                  openCard={(item) => onOpenCard(item as Card)}
                  status={
                    option.held && option.held !== 'budget' && !checked
                      ? landPlanHoldLabels[option.held]
                      : undefined
                  }
                  note={
                    <OracleText text={[landPlanReason(option), ...option.drawbacks].join(' · ')} />
                  }
                  selection={{
                    checked,
                    label: 'Include',
                    disabled: disabled || (!checked && full),
                    onChange: () => onToggle(card.name),
                  }}
                >
                  <p className="land-price">
                    {card.price ? <CardPriceLink card={card} /> : <span>Unpriced</span>}
                    {option.overBudget && <strong>Over budget</strong>}
                  </p>
                </ReviewCardTile>
              )
            })}
          </div>
        </section>
      ))}
    </section>
  )
}

type Props = {
  basicLandState: 'idle' | 'loading' | 'error'
  /** A check the plan failed on confirm; empty when basics failed to load. */
  basicLandError?: string
  legalBasicNames: string[]
  commanderSet: string
  landGap: number
  calculatedLandTarget: number
  landPlan: LandPlan<Card> | null
  /** Basics for the slots the chosen nonbasics leave. */
  planBasics: (chosen: Card[]) => BasicLandCount[]
  cardSearchButton: RefObject<HTMLButtonElement | null>
  opener: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onAddBasicLands: (
    lands: { name: string; count: number; printing?: ScryfallCard }[],
    nonbasics: Card[],
  ) => void
  onLoadBasicLandPrintings: (
    name: string,
    onPage: (loaded: ScryfallCard[], total: number) => void,
  ) => Promise<ScryfallCard[]>
  onLoadBasicsFromSet: (set: string) => Promise<ScryfallCard[]>
  onOpenCard: (card: Card) => void
}

// eslint-disable-next-line max-lines-per-function -- The dialog markup stays intact to preserve its established focus and accessibility behavior.
export function BasicLandDialog({
  basicLandState,
  basicLandError,
  legalBasicNames,
  commanderSet,
  landGap,
  calculatedLandTarget,
  landPlan,
  planBasics,
  cardSearchButton,
  opener,
  onClose,
  onAddBasicLands,
  onLoadBasicLandPrintings,
  onLoadBasicsFromSet,
  onOpenCard,
}: Props) {
  const dialog = useDialogFocus(true, () => {
    if (basicLandState !== 'loading') onClose()
  })
  const options = landPlan ? [...landPlan.picks, ...landPlan.alternatives] : []
  const optionNames = options.map(({ card }) => card.name)
  const selectionKey = JSON.stringify(optionNames)
  const defaultSelection = landPlan?.picks.map(({ card }) => card.name) ?? []
  const [selectionState, setSelectionState] = useState({
    key: selectionKey,
    options: optionNames,
    names: defaultSelection,
  })
  const selected =
    selectionState.key === selectionKey
      ? selectionState.names
      : reconcileLandSelection(
          selectionState.options,
          selectionState.names,
          optionNames,
          defaultSelection,
        )
  if (selectionState.key !== selectionKey) {
    setSelectionState({ key: selectionKey, options: optionNames, names: selected })
  }
  const chosen = options.filter(({ card }) => selected.includes(card.name)).map(({ card }) => card)
  const basicLands = planBasics(chosen)
  const basicGap = landGap - chosen.length
  const defaultLandCounts = Object.fromEntries(
    legalBasicNames.map((name) => [
      name,
      basicLands.find((land) => land.name === name)?.count ?? 0,
    ]),
  )
  const [landCountState, setLandCountState] = useState({
    gap: basicGap,
    counts: defaultLandCounts,
    defaults: defaultLandCounts,
  })
  const defaultsChanged =
    JSON.stringify(landCountState.defaults) !== JSON.stringify(defaultLandCounts)
  const countsChanged = landCountState.gap !== basicGap || defaultsChanged
  const landCounts = !countsChanged
    ? landCountState.counts
    : resizeBasicCounts(
        landCountState.counts,
        basicGap - landCountState.gap,
        landCountState.defaults,
        defaultLandCounts,
      )
  if (countsChanged) {
    setLandCountState({ gap: basicGap, counts: landCounts, defaults: defaultLandCounts })
  }
  const toggleNonbasic = (name: string) =>
    setSelectionState({
      key: selectionKey,
      options: optionNames,
      names: selected.includes(name)
        ? selected.filter((other) => other !== name)
        : [...selected, name],
    })
  const [printings, setPrintings] = useState<Record<string, ScryfallCard[]>>({})
  const [selectedPrintings, setSelectedPrintings] = useState<Record<string, ScryfallCard>>({})
  const [openGallery, setOpenGallery] = useState('')
  const [shownPrintings, setShownPrintings] = useState(printingsPage)
  const [styleLoading, setStyleLoading] = useState(false)
  const [styleError, setStyleError] = useState('')
  const [partial, setPartial] = useState<{ name: string; cards: ScryfallCard[]; total: number }>()
  const [retryName, setRetryName] = useState('')
  const validCounts = legalBasicNames.every(
    (name) =>
      Number.isInteger(landCounts[name]) && landCounts[name] >= 0 && landCounts[name] <= basicGap,
  )
  const landCount = Object.values(landCounts).reduce(
    (sum, count) => sum + (Number.isInteger(count) ? count : 0),
    0,
  )
  const remaining = basicGap - landCount
  const busy = styleLoading || basicLandState === 'loading'
  const setCount = (name: string, count: number) =>
    setLandCountState({
      gap: basicGap,
      defaults: defaultLandCounts,
      counts: { ...landCounts, [name]: count },
    })
  // One gallery load at a time: loading and progress state are shared across lands.
  const galleryLoading = useRef(false)
  const loadGallery = async (name: string) => {
    if (galleryLoading.current) return
    galleryLoading.current = true
    setStyleLoading(true)
    setStyleError('')
    setRetryName('')
    try {
      // Show each page of art as it arrives; basics have hundreds of printings across several pages.
      const cards = await onLoadBasicLandPrintings(name, (loaded, total) =>
        setPartial({ name, cards: loaded, total }),
      )
      setPrintings((current) => ({ ...current, [name]: cards }))
    } catch {
      setStyleError(`Could not load ${name} printings.`)
      setRetryName(name)
    } finally {
      galleryLoading.current = false
      setPartial(undefined)
      setStyleLoading(false)
    }
  }
  const toggleGallery = async (name: string) => {
    if (openGallery === name) {
      setOpenGallery('')
      return
    }
    setOpenGallery(name)
    setShownPrintings(printingsPage)
    if (!printings[name]) await loadGallery(name)
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
        {options.length > 0 && landPlan && (
          <LandPlanSection
            plan={landPlan}
            landGap={landGap}
            selected={selected}
            disabled={busy}
            onToggle={toggleNonbasic}
            onOpenCard={onOpenCard}
          />
        )}
        <section
          className="land-fill-step basic-land-split"
          aria-labelledby="basic-land-split-title"
        >
          <div className="basic-land-split-heading">
            <div>
              <h3 id="basic-land-split-title">
                {options.length > 0 ? 'Then fill the rest with basics' : 'Basic land split'}
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
                ? `All ${basicGap} basics assigned`
                : `${landCount} of ${basicGap} assigned · ${remaining > 0 ? `add ${remaining} more` : `remove ${-remaining}`}`}
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
                      onClick={() => setCount(name, Math.min(count, basicGap) - 1)}
                    >
                      −
                    </button>
                    <input
                      id={`basic-count-${name}`}
                      type="number"
                      min="0"
                      max={basicGap}
                      step="1"
                      value={Number.isFinite(count) ? count : ''}
                      aria-label={`${name} count`}
                      onChange={(event) => setCount(name, event.currentTarget.valueAsNumber)}
                    />
                    <button
                      type="button"
                      className="deck-add"
                      aria-label={`One more ${name}`}
                      disabled={busy || remaining <= 0 || !(count < basicGap)}
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
                      {partial?.name === name ? (
                        <span className="art-loading" role="status">
                          <i />
                          Loaded {partial.cards.length} of {partial.total} printings…
                        </span>
                      ) : (
                        <ArtLoading active />
                      )}
                    </div>
                  )}
                  {galleryOpen &&
                    (printings[name] ?? (partial?.name === name && partial.cards)) && (
                      <BasicLandGallery
                        name={name}
                        printings={printings[name] ?? partial?.cards ?? []}
                        shown={shownPrintings}
                        selected={selected}
                        onSelect={(printing) =>
                          setSelectedPrintings((current) => ({ ...current, [name]: printing }))
                        }
                        onShowMore={() => setShownPrintings((shown) => shown + printingsPage)}
                      />
                    )}
                </li>
              )
            })}
          </ul>
          {styleError && (
            <p className="form-error" role="alert">
              {styleError}{' '}
              {retryName && (
                <button
                  type="button"
                  className="compact-action"
                  disabled={busy}
                  onClick={() => void loadGallery(retryName)}
                >
                  Retry
                </button>
              )}
            </p>
          )}
        </section>
        {basicLandState === 'error' && (
          <p className="form-error" role="alert">
            {basicLandError || 'Could not load basic lands. Try again.'}
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
              basicLandState === 'loading' ||
              landGap === 0 ||
              !validCounts ||
              landCount !== basicGap
            }
            onClick={() => onAddBasicLands(plan, chosen)}
          >
            {basicLandState === 'loading'
              ? 'Adding…'
              : chosen.length
                ? `Add ${plural(landGap, 'land')}`
                : `Add ${plural(landGap, 'basic')}`}
          </button>
        </div>
      </section>
    </div>
  )
}
