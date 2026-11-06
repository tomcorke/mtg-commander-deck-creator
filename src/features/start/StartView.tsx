import {
  useEffect,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { colourNames, randomItems, selectableThemes } from '../../domain/commander-catalog.ts'
import { creatureTypeForTheme, creatureTypeThemes } from '../../domain/creature-types.ts'

const creatureThemeNames = [...new Set(creatureTypeThemes.values())].sort()

/**
 * Chosen creature types as chips, plus a dashed "+ Creature type" placeholder that opens a search.
 * The first type is the theme; up to two more become sub-themes.
 */
function CreatureTypeChips({
  theme,
  extras,
  curated,
  declareTheme,
  setExtras,
}: {
  theme: string
  extras: string[]
  /** Visible curated chips; a creature-type theme with one already shows as pressed there. */
  curated: string[]
  declareTheme: (name: string) => void
  setExtras: (names: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = [...(creatureTypeForTheme(theme) ? [theme] : []), ...extras]
  const choose = (name: string) => {
    if (chosen.includes(name)) return
    if (!theme) declareTheme(name)
    else setExtras([...extras, name].slice(0, 2))
  }
  const remove = (name: string) => {
    if (name !== theme) return setExtras(extras.filter((extra) => extra !== name))
    declareTheme(extras[0] ?? '')
    setExtras(extras.slice(1))
  }
  return (
    <>
      {chosen
        .filter((name) => name !== theme || !curated.includes(name))
        .map((name) => (
          <button
            className="selected"
            type="button"
            key={name}
            aria-label={`Remove ${name}`}
            onClick={() => remove(name)}
          >
            {name} <span aria-hidden="true">×</span>
          </button>
        ))}
      {chosen.length < 3 &&
        (open ? (
          <input
            className="creature-type-search"
            list="creature-type-themes"
            aria-label="Creature type"
            placeholder="Creature type, e.g. Cats"
            autoComplete="off"
            autoFocus
            value={query}
            onBlur={() => (setOpen(false), setQuery(''))}
            onKeyDown={(event) => event.key === 'Escape' && (setOpen(false), setQuery(''))}
            onChange={(event) => {
              const typed = event.target.value.trim().toLowerCase()
              const match = [...creatureTypeThemes].find(([word]) => word.toLowerCase() === typed)
              if (!match) return setQuery(event.target.value)
              choose(match[1])
              setQuery('')
              setOpen(false)
            }}
          />
        ) : (
          <button className="theme-placeholder" type="button" onClick={() => setOpen(true)}>
            + Creature type
          </button>
        ))}
      <datalist id="creature-type-themes">
        {creatureThemeNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  )
}
import type { AppModal, AppView } from '../../app/routes.ts'
import type { CommanderDetails, DeckCard } from '../../domain/card-model.ts'
import type { DeckWorkspace } from '../../autosaves.ts'
import { commanderPageSize, useCommanderDiscovery } from '../../app/useCommanderDiscovery.ts'
import { Pagination } from '../../shared/Pagination.tsx'
import {
  ColourPicker,
  CommanderChoiceTile,
  CommanderTilePlaceholders,
} from '../../shared/CommanderChoice.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { DisplaySettingsMenu } from '../../shared/DisplaySettingsMenu.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { RequestActivityIndicator } from '../../shared/RequestActivityIndicator.tsx'
import { DraftSavedTime } from '../modals/WorkspaceNotice.tsx'
import { CommanderSummary } from '../builder/CommanderSummary.tsx'

type StartViewProps = {
  extraCreatureTypes: string[]
  setExtraCreatureTypes: Dispatch<SetStateAction<string[]>>
  navigateView: (view: AppView, modal?: AppModal | null, replace?: boolean) => void
  openModal: (modal: AppModal) => void
  openSavedDecks: () => void
  openCardReference: (card: DeckCard) => void
  savedDecksModal: ReactNode
  workspaceNotice: ReactNode
  importModal: ReactNode
  visibleThemes: string[]
  setVisibleThemes: Dispatch<SetStateAction<string[]>>
  theme: string
  declareTheme: (name: string) => void
  chooseTheme: (name: string) => void
  colours: string[]
  setColours: Dispatch<SetStateAction<string[]>>
  toggleColour: (colour: string) => void
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  chooseCommander: (name: string) => Promise<boolean>
  commander: string
  commanderDetails: CommanderDetails | null
  deck: DeckCard[]
  autosave: ReturnType<DeckWorkspace['getSnapshot']>
  introGuideRequested: boolean
  setIntroGuideRequested: Dispatch<SetStateAction<boolean>>
}

// eslint-disable-next-line max-lines-per-function -- Start-screen markup stays together; search helpers and render callbacks remain checked.
export function StartView(props: StartViewProps) {
  const { darkMode } = useVisualPreferences()
  const discovery = useCommanderDiscovery(
    { ...props, creatureTypes: props.extraCreatureTypes },
    true,
  )
  const reason = discovery.status === 'idle' ? discovery.suggestions[0]?.reason : undefined
  // Leaving the start screen opens the next view at the top, not at the old scroll position.
  useEffect(() => () => scrollTo({ top: 0 }), [])
  const resume = Boolean(props.commander && props.deck.length)
  const draft =
    props.autosave.drafts.find(({ id }) => id === props.autosave.id) ?? props.autosave.notice?.draft
  // A curated theme becomes the main theme; a creature-type theme it replaces moves to the extras,
  // and clearing the theme promotes the first extra creature type.
  const chooseCuratedTheme = (name: string) => {
    const extras = props.extraCreatureTypes
    if (name === props.theme && extras.length) {
      props.declareTheme(extras[0])
      return props.setExtraCreatureTypes(extras.slice(1))
    }
    if (creatureTypeForTheme(props.theme) && name !== props.theme)
      props.setExtraCreatureTypes([props.theme, ...extras].slice(0, 2))
    props.chooseTheme(name)
  }
  const clearFilters = () => {
    props.setExtraCreatureTypes([])
    props.declareTheme('')
    props.setColours([])
    props.setSearch('')
  }
  const moveBetweenChoices = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step || !(event.target instanceof HTMLButtonElement)) return
    const choices = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('.commander-choose'),
    ]
    const index = choices.indexOf(event.target)
    if (index < 0) return
    event.preventDefault()
    choices[Math.min(choices.length - 1, Math.max(0, index + step))]?.focus()
  }
  const summary =
    [
      [props.theme, ...props.extraCreatureTypes].filter(Boolean).join(' + '),
      ...props.colours.map((colour) => colourNames[colour]),
      props.search.trim().length >= 2 ? `Name: ${props.search.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'All commanders'
  const filtered = Boolean(
    props.theme || props.extraCreatureTypes.length || props.colours.length || props.search,
  )
  // The empty grid carries its own Clear filters, so the panel's steps aside to keep one on screen.
  const noMatches = discovery.status === 'idle' && !discovery.suggestions.length

  return (
    <main className={darkMode ? 'dark' : ''}>
      <header>
        <span className="brand">
          Commander Deck Creator <small>v{__APP_VERSION__}</small>
        </span>
        <div className="header-actions">
          <DisplaySettingsMenu />
          <button className="export" type="button" onClick={() => props.openModal('import')}>
            Import deck
          </button>
          <button className="export" type="button" onClick={props.openSavedDecks}>
            Saved decks
          </button>
          <RequestActivityIndicator />
        </div>
      </header>
      {props.workspaceNotice}
      {props.savedDecksModal}
      {props.importModal}
      <section className="start">
        {resume && (
          <section className="continue-card" aria-label="Deck in progress">
            <button
              className="continue-art reset"
              type="button"
              aria-label={`Show details for ${props.deck[0].name}`}
              onClick={() => props.openCardReference(props.deck[0])}
            >
              <SmallCardImage image={props.deck[0].image} placement="reference" />
            </button>
            <div>
              <CommanderSummary
                commander={props.commander}
                colours={props.commanderDetails?.colours ?? null}
                headingLevel="h2"
                eyebrow="Deck in progress"
                onOpenCommander={() => props.openCardReference(props.deck[0])}
              />
              <p className="continue-meta">
                {props.deck.length} of 100 cards
                {draft && (
                  <>
                    {' '}
                    · Saved <DraftSavedTime updatedAt={draft.updatedAt} />
                  </>
                )}
              </p>
              <div className="export-actions">
                <button
                  className="primary"
                  type="button"
                  onClick={() => props.navigateView('builder')}
                >
                  Continue building
                </button>
                <button className="export" type="button" onClick={props.openSavedDecks}>
                  Choose another draft
                </button>
              </div>
            </div>
          </section>
        )}
        <p className="eyebrow">Build from scratch</p>
        <h1>What do you want to play?</h1>
        <p className="lead">
          Combine a theme and colour identity, or search for a commander.
          {resume && ' Choosing a new commander keeps this deck in Autosaved drafts.'}
        </p>
        <section className="start-panel commander-filters" aria-label="Commander filters">
          <h2>Find a commander</h2>
          <h3 className="filter-heading" id="theme-filter-heading">
            Theme
          </h3>
          <div className="themes" role="group" aria-labelledby="theme-filter-heading">
            {props.visibleThemes.map((name) => (
              <button
                className={props.theme === name ? 'selected' : ''}
                aria-pressed={props.theme === name}
                key={name}
                type="button"
                onClick={() => chooseCuratedTheme(name)}
              >
                {name}
              </button>
            ))}
            <CreatureTypeChips
              theme={props.theme}
              extras={props.extraCreatureTypes}
              curated={props.visibleThemes}
              declareTheme={props.declareTheme}
              setExtras={props.setExtraCreatureTypes}
            />
          </div>
          {props.visibleThemes.length < selectableThemes.length && (
            <button
              className="reroll"
              type="button"
              onClick={() =>
                props.setVisibleThemes((current) => [
                  ...current,
                  ...randomItems(
                    selectableThemes.filter((name) => !current.includes(name)),
                    6,
                  ),
                ])
              }
            >
              Show more themes
            </button>
          )}
          <h3 className="filter-heading" id="colour-filter-heading">
            Colour identity
          </h3>
          <div role="group" aria-labelledby="colour-filter-heading">
            <ColourPicker colours={props.colours} toggleColour={props.toggleColour} />
          </div>
          <label className="commander-search">
            <span className="filter-heading">Name</span>
            <input
              value={props.search}
              onChange={(event) => props.setSearch(event.target.value)}
              placeholder="Search commanders…"
              aria-label="Search commanders"
              aria-describedby="commander-result-count"
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return
                event.preventDefault()
                document.querySelector<HTMLButtonElement>('.commander-choose')?.focus()
              }}
            />
          </label>
          <div className="filter-summary">
            <p role="status">
              {summary}
              {props.theme && props.search.trim().length >= 2 && ' · Searching within this theme'}
            </p>
            {!noMatches && (
              <button className="export" type="button" disabled={!filtered} onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
          <label className="intro-guide-option">
            <input
              type="checkbox"
              checked={props.introGuideRequested}
              onChange={(event) => props.setIntroGuideRequested(event.target.checked)}
            />{' '}
            Walk me through the builder for this deck
          </label>
        </section>
        <section
          className="commander-discovery"
          aria-labelledby="commander-discovery-title"
          aria-busy={discovery.status === 'loading'}
        >
          <div className="commander-discovery-heading">
            <h2 id="commander-discovery-title">Choose a commander</h2>
            {/* Every suggestion in a batch shares one reason, so it is shown once. */}
            <p aria-hidden="true">
              {discovery.status === 'loading' && 'Finding legal commanders…'}
              {/* The empty state names the zero itself. */}
              {discovery.status === 'idle' &&
                discovery.count > 0 &&
                [
                  `${discovery.count}${discovery.more ? ' loaded' : ''} ${discovery.count === 1 ? 'commander' : 'commanders'}`,
                  reason,
                ]
                  .filter(Boolean)
                  .join(' · ')}
            </p>
          </div>
          <p id="commander-result-count" className="sr-only" role="status">
            {discovery.status === 'loading' && 'Finding legal commanders…'}
            {discovery.status === 'idle' &&
              `${discovery.suggestions.length}${discovery.count > discovery.suggestions.length ? ` of ${discovery.count}${discovery.more ? ' loaded' : ''}` : ''} ${discovery.count === 1 ? 'commander' : 'commanders'} shown${reason ? `. ${reason}` : ''}. Press Down to move through them.`}
          </p>
          <div className="commander-grid" onKeyDown={moveBetweenChoices}>
            {discovery.status === 'loading' && <CommanderTilePlaceholders />}
            {discovery.suggestions.map(({ card }) => (
              <CommanderChoiceTile
                key={card.oracle_id ?? card.name}
                card={card}
                openCard={props.openCardReference}
                action={
                  <button
                    className="export commander-choose"
                    type="button"
                    aria-label={`Choose ${card.name}`}
                    onClick={() => void props.chooseCommander(card.name)}
                  >
                    Choose
                  </button>
                }
              />
            ))}
          </div>
          {discovery.status === 'error' && (
            <p className="form-error discovery-error" role="alert">
              {discovery.error} Change a filter, or reload the page.
            </p>
          )}
          {discovery.status === 'idle' && !discovery.suggestions.length && (
            <div className="empty">
              <h3>No commanders match these filters</h3>
              <p>
                Remove a colour or theme, or try a different name. Curated themes are a limited
                selection.
              </p>
              <button className="export" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
          {discovery.status === 'idle' && (
            <Pagination
              label="Commander result pages"
              noun="commanders"
              count={discovery.count}
              pageSize={commanderPageSize}
              page={discovery.page}
              onPage={discovery.setPage}
              partial={discovery.more}
            >
              {discovery.more && <span>Narrow the filters to reach more commanders.</span>}
            </Pagination>
          )}
        </section>
      </section>
    </main>
  )
}
