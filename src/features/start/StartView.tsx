import {
  useEffect,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  type SyntheticEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { toDeckCard, type ScryfallCard, type ScryfallSet } from '../../domain/card-model.ts'
import { canAddPartner } from '../../domain/commander-pairing.ts'
import { PartnerDialog } from './PartnerDialog.tsx'
import { ColourIdentityFilter } from './ColourIdentityFilter.tsx'
import { identitySummary, type ColourMatch } from '../../domain/colour-identity.ts'
import { setPickerRows } from '../../domain/set-picker.ts'
import { SetPicker } from '../../shared/SetPicker.tsx'
import { colourNames, selectableThemes } from '../../domain/commander-catalog.ts'
import {
  collapsedThemeCount,
  themeChoiceGroups,
  themeDescription,
  themeMatchCount,
  type ThemeGroupName,
} from '../../domain/theme-guide.ts'
import {
  chooseCuratedTheme as nextCuratedTheme,
  creatureTypeForTheme,
  creatureTypeThemes,
} from '../../domain/creature-types.ts'

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
          <ThemeChip key={name} name={name} selected remove onPress={() => remove(name)} />
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
import { useEdhrecDeckCounts } from '../../app/useEdhrecDeckCounts.ts'
import type { CommanderSort } from '../../domain/commander-discovery.ts'
import { Pagination } from '../../shared/Pagination.tsx'
import { CommanderChoiceTile, CommanderTilePlaceholders } from '../../shared/CommanderChoice.tsx'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { DisplaySettingsMenu } from '../../shared/DisplaySettingsMenu.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { RequestActivityIndicator } from '../../shared/RequestActivityIndicator.tsx'
import { DraftSavedTime } from '../modals/WorkspaceNotice.tsx'
import { CommanderSummary } from '../builder/CommanderSummary.tsx'
import { RandomCommanderDialog } from './RandomCommanderDialog.tsx'
import { CommanderPrimerDialog, NewToCommanderCard } from '../../shared/CommanderPrimer.tsx'
import { useStoredOption } from '../../shared/hooks.ts'

/** Moves a theme chip's popover sideways so it stays inside the theme groups. */
function placeThemeHelp(event: SyntheticEvent<HTMLElement>) {
  const chip = event.currentTarget
  const help = chip.querySelector<HTMLElement>('.theme-help')
  const bounds = chip.closest('.theme-groups')?.getBoundingClientRect()
  if (!help || !bounds) return
  const box = chip.getBoundingClientRect()
  const left = Math.max(bounds.left, Math.min(box.left, bounds.right - help.offsetWidth))
  help.style.setProperty('--theme-help-left', `${left - box.left}px`)
}

const themeId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * A theme chip whose description shows as a popover on hover and keyboard focus. A `remove` chip
 * is a chosen creature type whose press removes it rather than toggling it.
 */
function ThemeChip({
  name,
  selected,
  onPress,
  remove = false,
}: {
  name: string
  selected: boolean
  onPress: () => void
  remove?: boolean
}) {
  const help = `theme-help-${remove ? 'remove-' : ''}${themeId(name)}`
  return (
    <span className="theme-chip" onPointerEnter={placeThemeHelp} onFocus={placeThemeHelp}>
      <button
        className={selected ? 'selected' : ''}
        aria-pressed={remove ? undefined : selected}
        aria-label={remove ? `Remove ${name}` : undefined}
        aria-describedby={help}
        type="button"
        onClick={onPress}
      >
        {name}
        {remove && <span aria-hidden="true"> ×</span>}
      </button>
      <span className="action-help theme-help" id={help} role="tooltip">
        {themeDescription(name)}
      </span>
    </span>
  )
}

/**
 * A labelled group of theme chips with its own Show all toggle while not searching. An empty
 * group is hidden, except Creature types, which keeps its creature-type picker.
 */
function ThemeGroup({
  name,
  total,
  themes,
  open,
  toggle,
  children,
}: {
  name: ThemeGroupName
  total: number
  themes: string[]
  open: boolean
  toggle?: () => void
  children: ReactNode
}) {
  if (!themes.length && name !== 'Creature types') return null
  const heading = `theme-group-${themeId(name)}`
  return (
    <div className="theme-group">
      <div className="theme-group-heading">
        <h4 id={heading}>{name}</h4>
        {toggle && total > collapsedThemeCount && (
          <button className="reroll" type="button" aria-expanded={open} onClick={toggle}>
            {open ? `Show fewer ${name.toLowerCase()}` : `Show all ${total} ${name.toLowerCase()}`}
          </button>
        )}
      </div>
      <div className="themes" role="group" aria-labelledby={heading}>
        {children}
      </div>
    </div>
  )
}

/** Theme search over every theme, and themes grouped as strategies, mechanics and creature types. */
function ThemeFilter({
  theme,
  extras,
  choose,
  declareTheme,
  setExtras,
}: {
  theme: string
  extras: string[]
  choose: (name: string) => void
  declareTheme: (name: string) => void
  setExtras: (extras: string[]) => void
}) {
  const [themeQuery, setThemeQuery] = useState('')
  const [expanded, setExpanded] = useState<ThemeGroupName[]>([])
  const searching = Boolean(themeQuery.trim())
  const groups = themeChoiceGroups(themeQuery, theme, expanded)
  const themeMatches = themeMatchCount(themeQuery)
  const description = themeDescription(theme)
  const clearThemeSearch = () => {
    setThemeQuery('')
    document.getElementById('theme-search')?.focus()
  }
  const toggleGroup = (name: ThemeGroupName) =>
    setExpanded((open) =>
      open.includes(name) ? open.filter((group) => group !== name) : [...open, name],
    )
  return (
    <>
      <input
        className="theme-search"
        id="theme-search"
        type="search"
        value={themeQuery}
        onChange={(event) => setThemeQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && themeQuery) {
            event.preventDefault()
            setThemeQuery('')
          }
        }}
        placeholder={`Search all ${selectableThemes.length} themes…`}
        aria-label="Search themes"
        aria-describedby="theme-search-status"
        autoComplete="off"
      />
      <div className="theme-groups" role="group" aria-labelledby="theme-filter-heading">
        {groups.map((group) => (
          <ThemeGroup
            key={group.name}
            {...group}
            open={expanded.includes(group.name)}
            toggle={searching ? undefined : () => toggleGroup(group.name)}
          >
            {group.themes.map((choice) => (
              <ThemeChip
                key={choice}
                name={choice}
                selected={theme === choice}
                onPress={() => choose(choice)}
              />
            ))}
            {group.name === 'Creature types' && (
              <CreatureTypeChips
                theme={theme}
                extras={extras}
                curated={group.themes}
                declareTheme={declareTheme}
                setExtras={setExtras}
              />
            )}
          </ThemeGroup>
        ))}
      </div>
      {description && (
        <p className="theme-description">
          <strong>{theme}:</strong> {description}
        </p>
      )}
      {searching && (
        <p className="theme-search-status">
          <span id="theme-search-status" role="status">
            {themeMatches
              ? `${themeMatches} ${themeMatches === 1 ? 'theme matches' : 'themes match'} “${themeQuery.trim()}”`
              : `No themes match “${themeQuery.trim()}”`}
          </span>
          <button className="export" type="button" onClick={clearThemeSearch}>
            Clear theme search
          </button>
        </p>
      )}
    </>
  )
}

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
  theme: string
  declareTheme: (name: string) => void
  chooseTheme: (name: string) => void
  colours: string[]
  setColours: Dispatch<SetStateAction<string[]>>
  toggleColour: (colour: string) => void
  colourMatch: ColourMatch
  setColourMatch: Dispatch<SetStateAction<ColourMatch>>
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  rulesText: string
  setRulesText: Dispatch<SetStateAction<string>>
  maxManaValue: number | null
  setMaxManaValue: Dispatch<SetStateAction<number | null>>
  commanderSets: string[]
  setCommanderSets: Dispatch<SetStateAction<string[]>>
  setOptions: ScryfallSet[]
  chooseCommander: (name: string) => Promise<boolean>
  commander: string
  commanderDetails: CommanderDetails | null
  deck: DeckCard[]
  autosave: ReturnType<DeckWorkspace['getSnapshot']>
  introGuideRequested: boolean
  setIntroGuideRequested: Dispatch<SetStateAction<boolean>>
}

/**
 * Sort choices, each with the phrase the grid header uses to name its order. Popularity is
 * Scryfall's EDHREC rank, which counts every deck a card is in, not only decks it leads.
 */
const commanderSorts: Record<CommanderSort, { label: string; order: string }> = {
  popularity: { label: 'Popularity (EDHREC rank)', order: 'EDHREC rank' },
  name: { label: 'Name', order: 'name, A to Z' },
  manaValue: { label: 'Mana value', order: 'mana value, lowest first' },
  newest: { label: 'Newest printing', order: 'newest printing' },
}

type Discovery = ReturnType<typeof useCommanderDiscovery>
type BroaderDiscovery = NonNullable<Discovery['broader']>

const countLabel = ({ count, more }: { count: number; more: boolean }) =>
  `${count}${more ? ' loaded' : ''} ${count === 1 ? 'commander' : 'commanders'}`

/** The grid's heading: count, shared reason and order, the sort control and the insight note. */
function DiscoveryHeading({
  discovery,
  sort,
  setSort,
}: {
  discovery: Discovery
  sort: CommanderSort
  setSort: (sort: CommanderSort) => void
}) {
  const reason = discovery.status === 'idle' ? discovery.suggestions[0]?.reason : undefined
  // Several creature types rank commanders covering more of them first.
  const order =
    discovery.suggestions[0]?.coverage === undefined
      ? `Sorted by ${commanderSorts[sort].order}`
      : `Most chosen creature types first, then by ${commanderSorts[sort].order}`
  return (
    <>
      <div className="commander-discovery-heading">
        <div>
          <h2 id="commander-discovery-title" tabIndex={-1}>
            Choose a commander
          </h2>
          {/* Every suggestion in a batch shares one reason, so it is shown once. */}
          <p aria-hidden="true">
            {discovery.status === 'loading' && 'Finding legal commanders…'}
            {/* The empty state names the zero itself. */}
            {discovery.status === 'idle' &&
              discovery.count > 0 &&
              [countLabel(discovery), reason, order].filter(Boolean).join(' · ')}
          </p>
        </div>
        <label className="commander-sort">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as CommanderSort)}>
            {Object.entries(commanderSorts).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="commander-insight-note">
          Themes are app estimates from card type and rules text; other strategies may fit. Deck
          counts are EDHREC decks led by that commander, shown for the most-built commanders in each
          colour identity. EDHREC rank also counts decks using a card in the 99.
        </p>
      </div>
      <p id="commander-result-count" className="sr-only" role="status">
        {discovery.status === 'loading' && 'Finding legal commanders…'}
        {discovery.status === 'idle' &&
          `${discovery.suggestions.length}${discovery.count > discovery.suggestions.length ? ` of ${discovery.count}${discovery.more ? ' loaded' : ''}` : ''} ${discovery.count === 1 ? 'commander' : 'commanders'} shown${reason ? `. ${reason}` : ''}${discovery.count > 1 ? `. ${order}` : ''}${discovery.broader?.count ? `. ${discovery.broader.heading}: ${countLabel(discovery.broader)}` : ''}. Press Down to move through them.`}
      </p>
    </>
  )
}

/**
 * Colour widening for the match mode (#482). Exactly widens to Within or Including, and dropping a
 * colour shows the remaining colours' commanders rather than a superset. Including widens by
 * dropping a colour. Within narrows when a colour is dropped, so it offers clearing the colours.
 */
function colourWidening({
  colours,
  colourMatch,
  toggleColour,
  setColours,
  setColourMatch,
}: StartViewProps) {
  const remove = colours.map((colour) => ({
    label: `Remove ${colourNames[colour]}`,
    widen: () => toggleColour(colour),
  }))
  if (!colours.length || colourMatch === 'including') return remove
  if (colourMatch === 'within')
    return [{ label: 'Clear colour identity', widen: () => setColours([]) }]
  return [
    { label: 'Allow fewer colours', widen: () => setColourMatch('within') },
    ...(colours.length < 5
      ? [{ label: 'Allow more colours', widen: () => setColourMatch('including') }]
      : []),
    ...remove,
  ]
}

/**
 * One-click ways to widen a near-empty result (#481): change the colour match or colours, drop
 * the theme, or clear another active criterion.
 */
function widenActions(props: StartViewProps, setLabel: (code: string) => string) {
  const theme = [props.theme, ...props.extraCreatureTypes].filter(Boolean).join(' + ')
  return [
    ...colourWidening(props),
    theme && {
      label: `Remove ${theme} theme`,
      widen: () => (props.setExtraCreatureTypes([]), props.declareTheme('')),
    },
    props.search.trim().length >= 2 && {
      label: 'Clear name search',
      widen: () => props.setSearch(''),
    },
    props.rulesText.trim().length >= 2 && {
      label: 'Clear rules text',
      widen: () => props.setRulesText(''),
    },
    props.maxManaValue != null && {
      label: 'Remove mana value limit',
      widen: () => props.setMaxManaValue(null),
    },
    props.commanderSets.length > 0 && {
      label: `Remove ${props.commanderSets.length === 1 ? setLabel(props.commanderSets[0]) : 'set filter'}`,
      widen: () => props.setCommanderSets([]),
    },
  ].filter((action): action is { label: string; widen: () => void } => Boolean(action))
}

/** The widening buttons; each moves focus to the grid heading, since the results reload. */
function WidenButtons({ actions }: { actions: ReturnType<typeof widenActions> }) {
  return actions.map(({ label, widen }) => (
    <button
      key={label}
      className="export"
      type="button"
      onClick={() => {
        widen()
        document.getElementById('commander-discovery-title')?.focus()
      }}
    >
      {label}
    </button>
  ))
}

/**
 * A curated theme's rules-text matches beyond its picks, under their own heading and count so they
 * never read as "Picked for" (#481).
 */
function BroaderCommanders({
  broader,
  order,
  renderTile,
}: {
  broader: BroaderDiscovery
  order: string
  renderTile: (suggestion: Discovery['suggestions'][number]) => ReactNode
}) {
  if (!broader.count) return null
  return (
    <section className="commander-broader" aria-labelledby="commander-broader-title">
      <div className="commander-discovery-heading">
        <div>
          <h3 id="commander-broader-title">{broader.heading}</h3>
          <p>
            {countLabel(broader)} · Found by rules text or type, not picked for this theme · Sorted
            by {order}
          </p>
        </div>
      </div>
      <div className="commander-grid">{broader.suggestions.map(renderTile)}</div>
      <Pagination
        label="More commander result pages"
        noun="commanders"
        count={broader.count}
        pageSize={commanderPageSize}
        page={broader.page}
        onPage={broader.setPage}
        partial={broader.more}
      >
        {broader.more && <span>Narrow the filters to reach more commanders.</span>}
      </Pagination>
    </section>
  )
}

/** Active commander criteria as one line, or "All commanders" when none apply. */
function filterSummary(props: StartViewProps, setLabel: (code: string) => string) {
  return (
    [
      [props.theme, ...props.extraCreatureTypes].filter(Boolean).join(' + '),
      identitySummary(props.colours, props.colourMatch),
      props.search.trim().length >= 2 ? `Name: ${props.search.trim()}` : '',
      props.rulesText.trim().length >= 2 ? `Rules text: ${props.rulesText.trim()}` : '',
      props.maxManaValue != null ? `Mana value ${props.maxManaValue} or less` : '',
      props.commanderSets.length ? `Sets: ${props.commanderSets.map(setLabel).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'All commanders'
  )
}

// eslint-disable-next-line max-lines-per-function -- Start-screen markup stays together; search helpers and render callbacks remain checked.
export function StartView(props: StartViewProps) {
  const [randomCommanderOpen, setRandomCommanderOpen] = useState(false)
  const [partnerFor, setPartnerFor] = useState<ScryfallCard | null>(null)
  const [primerOpen, setPrimerOpen] = useState(false)
  const [primerDismissed, setPrimerDismissed] = useStoredOption(
    'primerDismissed',
    () => false,
    (value) => value === true,
  )
  const [sort, setSort] = useState<CommanderSort>('popularity')
  const { darkMode } = useVisualPreferences()
  const discovery = useCommanderDiscovery(
    { ...props, creatureTypes: props.extraCreatureTypes, sets: props.commanderSets, sort },
    true,
  )
  const deckCount = useEdhrecDeckCounts(
    [...discovery.suggestions, ...(discovery.broader?.suggestions ?? [])].map(({ card }) => card),
  )
  // Leaving the start screen opens the next view at the top, not at the old scroll position.
  useEffect(() => () => scrollTo({ top: 0 }), [])
  const resume = Boolean(props.commander && props.deck.length)
  const draft =
    props.autosave.drafts.find(({ id }) => id === props.autosave.id) ?? props.autosave.notice?.draft
  const chooseCuratedTheme = (name: string) => {
    const next = nextCuratedTheme(props.theme, props.extraCreatureTypes, name)
    if (!next) return props.chooseTheme(name)
    props.setExtraCreatureTypes(next.extras)
    if (name === props.theme) props.declareTheme(next.theme)
    else props.chooseTheme(name)
  }
  const clearFilters = () => {
    props.setExtraCreatureTypes([])
    props.declareTheme('')
    props.setColours([])
    props.setSearch('')
    props.setRulesText('')
    props.setMaxManaValue(null)
    props.setCommanderSets([])
    // Clear filters disables itself, so hand focus to the Name search; below 600px it must be unfolded first.
    flushSync(() => setFiltersOpen(true))
    document.getElementById('commander-search-name')?.focus()
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
  const [setQuery, setSetQuery] = useState('')
  const [showSupplementalSets, setShowSupplementalSets] = useState(false)
  const setLabel = (code: string) =>
    props.setOptions.find((set) => set.code === code)?.name ?? code.toUpperCase()
  const toggleSet = (code: string) =>
    props.setCommanderSets((sets) =>
      sets.includes(code) ? sets.filter((set) => set !== code) : [...sets, code],
    )
  const summary = filterSummary(props, setLabel)
  const filtered = summary !== 'All commanders' || Boolean(props.search || props.rulesText)
  const total = discovery.count + (discovery.broader?.count ?? 0)
  // The empty grid carries its own Clear filters, so the panel's steps aside to keep one on screen.
  const noMatches = discovery.status === 'idle' && !total
  const widen = widenActions(props, setLabel)
  const renderTile = ({ card }: Discovery['suggestions'][number]) => (
    <CommanderChoiceTile
      key={card.oracle_id ?? card.name}
      card={card}
      openCard={props.openCardReference}
      insights={{ deckCount: deckCount(card) }}
      action={
        <button
          className="export commander-choose"
          type="button"
          aria-label={`Choose ${card.name}`}
          onClick={() =>
            canAddPartner(toDeckCard(card))
              ? setPartnerFor(card)
              : void props.chooseCommander(card.name)
          }
        >
          Choose
        </button>
      }
    />
  )
  // Below 600px the controls fold away; start open only when nothing is filtered yet.
  const [filtersOpen, setFiltersOpen] = useState(!filtered)

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
          <button className="export" type="button" onClick={() => setPrimerOpen(true)}>
            Commander basics
          </button>
          <RequestActivityIndicator />
        </div>
      </header>
      {props.workspaceNotice}
      {props.savedDecksModal}
      {props.importModal}
      {randomCommanderOpen && (
        <RandomCommanderDialog
          onClose={() => setRandomCommanderOpen(false)}
          chooseCommander={props.chooseCommander}
          openCard={props.openCardReference}
        />
      )}
      {partnerFor && (
        <PartnerDialog
          first={partnerFor}
          onClose={() => setPartnerFor(null)}
          chooseCommander={props.chooseCommander}
          openCard={props.openCardReference}
        />
      )}
      {primerOpen && <CommanderPrimerDialog onClose={() => setPrimerOpen(false)} />}
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
        {!primerDismissed && (
          <NewToCommanderCard
            open={() => setPrimerOpen(true)}
            dismiss={() => {
              setPrimerDismissed(true)
              document.getElementById('start-title')?.focus()
            }}
          />
        )}
        <p className="eyebrow">Build from scratch</p>
        <h1 id="start-title" tabIndex={-1}>
          What do you want to play?
        </h1>
        <p className="lead">
          Combine a theme and colour identity, or search for a commander.
          {resume && ' Choosing a new commander keeps this deck in Autosaved drafts.'}
        </p>
        <div className="export-actions">
          <button className="export" type="button" onClick={() => setRandomCommanderOpen(true)}>
            Random commander
          </button>
        </div>
        <section
          className={`start-panel commander-filters${filtersOpen ? '' : ' collapsed'}`}
          aria-label="Commander filters"
        >
          <div className="filter-panel-heading">
            <h2>Find a commander</h2>
            <button
              className="export filter-toggle"
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="commander-filter-controls"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? 'Hide filters' : 'Show filters'}
            </button>
          </div>
          <div className="commander-filter-controls" id="commander-filter-controls">
            <h3 className="filter-heading" id="theme-filter-heading">
              Theme
            </h3>
            <ThemeFilter
              theme={props.theme}
              extras={props.extraCreatureTypes}
              choose={chooseCuratedTheme}
              declareTheme={props.declareTheme}
              setExtras={props.setExtraCreatureTypes}
            />
            <h3 className="filter-heading" id="colour-filter-heading">
              Colour identity
            </h3>
            <ColourIdentityFilter
              colours={props.colours}
              toggleColour={props.toggleColour}
              match={props.colourMatch}
              setMatch={props.setColourMatch}
            />
            <label className="commander-search">
              <span className="filter-heading">Name</span>
              <input
                id="commander-search-name"
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
            <label className="commander-search">
              <span className="filter-heading">Rules text or ability</span>
              <input
                id="commander-search-rules"
                value={props.rulesText}
                onChange={(event) => props.setRulesText(event.target.value)}
                placeholder="e.g. Eminence, draw a card…"
                aria-describedby="commander-result-count"
                autoComplete="off"
              />
            </label>
            <label className="commander-search commander-max-mana-value">
              <span className="filter-heading">Max mana value</span>
              <select
                value={props.maxManaValue ?? ''}
                onChange={(event) =>
                  props.setMaxManaValue(
                    event.target.value === '' ? null : Number(event.target.value),
                  )
                }
              >
                <option value="">Any</option>
                {Array.from({ length: 11 }, (_, value) => (
                  <option key={value} value={value}>
                    {value} or less
                  </option>
                ))}
              </select>
            </label>
            <details className="commander-set-filter collection-picker">
              <summary className="filter-heading">
                Sets{props.commanderSets.length ? ` (${props.commanderSets.length} selected)` : ''}
              </summary>
              <div className="collection-set-controls">
                <SetPicker
                  query={setQuery}
                  setQuery={setSetQuery}
                  showSupplemental={showSupplementalSets}
                  setShowSupplemental={setShowSupplementalSets}
                  setOptions={props.setOptions}
                  rows={setPickerRows(props.setOptions, setQuery, showSupplementalSets)}
                  selected={props.commanderSets}
                  toggle={toggleSet}
                  label={setLabel}
                  emptySelection="No sets selected. Commanders from every set are shown."
                />
                <p className="collection-picker-help">
                  These sets only filter this commander list. Choose recommendation sets later in
                  Recommendation settings, where you can add these.
                </p>
              </div>
            </details>
          </div>
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
        {/* Arrow keys move through the Choose buttons of both grids. */}
        <section
          className="commander-discovery"
          aria-labelledby="commander-discovery-title"
          aria-busy={discovery.status === 'loading'}
          onKeyDown={moveBetweenChoices}
        >
          <DiscoveryHeading discovery={discovery} sort={sort} setSort={setSort} />
          {discovery.status === 'idle' && !discovery.count && total > 0 && (
            <p className="discovery-status">
              None of the commanders picked for {props.theme} decks match these filters.
            </p>
          )}
          <div className="commander-grid">
            {discovery.status === 'loading' && <CommanderTilePlaceholders />}
            {discovery.suggestions.map(renderTile)}
          </div>
          {discovery.status === 'error' && (
            <p className="form-error discovery-error" role="alert">
              {discovery.error} Change a filter, or reload the page.
            </p>
          )}
          {noMatches && (
            <div className="empty">
              <h3>No commanders match these filters</h3>
              <p>
                Change the colour identity or its match, remove a theme, set or mana value limit, or
                try different name or rules text. Curated themes are a limited selection.
              </p>
              <div className="commander-widen-actions">
                <WidenButtons actions={widen} />
                <button className="export" type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
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
          {discovery.status === 'idle' && discovery.broader && (
            <BroaderCommanders
              broader={discovery.broader}
              order={commanderSorts[sort].order}
              renderTile={renderTile}
            />
          )}
          {discovery.status === 'idle' && total > 0 && total <= 3 && widen.length > 0 && (
            <div className="commander-widen" role="group" aria-labelledby="commander-widen-title">
              <p id="commander-widen-title">
                Only {total} {total === 1 ? 'commander matches' : 'commanders match'}. Widen the
                search:
              </p>
              <div className="commander-widen-actions">
                <WidenButtons actions={widen} />
              </div>
              {props.colours.length > 0 && props.colourMatch === 'exactly' && (
                <p className="commander-widen-note">
                  Colour identity matches exactly, so removing a colour shows commanders of the
                  colours that remain.
                </p>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
