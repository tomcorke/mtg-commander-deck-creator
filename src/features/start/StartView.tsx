import { type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { colourNames, randomItems, selectableThemes } from '../../domain/commander-catalog.ts'
import type { AppModal, AppView } from '../../app/routes.ts'
import {
  toDeckCard,
  scryfallBackImage,
  scryfallImage,
  type DeckCard,
} from '../../domain/card-model.ts'
import type { DeckWorkspace } from '../../autosaves.ts'
import { useCommanderDiscovery } from '../../app/useCommanderDiscovery.ts'
import { FinishedCardImage } from '../../shared/CardArt.tsx'
import { CardImagePreview } from '../../shared/CardImagePreview.tsx'
import { CardReference } from '../../shared/CardReference.tsx'
import { showCardPreview, hideCardPreview } from '../../shared/card-preview.ts'
import { SmallCardImage } from '../../shared/SmallCardImage.tsx'
import { DisplaySettingsMenu } from '../../shared/DisplaySettingsMenu.tsx'
import { ManaSymbols, OracleText } from '../../shared/ManaSymbols.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'
import { RequestActivityIndicator } from '../../shared/RequestActivityIndicator.tsx'
import { DraftSavedTime } from '../modals/WorkspaceNotice.tsx'

type StartViewProps = {
  navigateView: (view: AppView, modal?: AppModal | null, replace?: boolean) => void
  openModal: (modal: AppModal) => void
  openSavedDecks: () => void
  openCardReference: (card: DeckCard) => void
  savedDecks: number
  savedDecksModal: ReactNode
  workspaceNotice: ReactNode
  importModal: ReactNode
  visibleThemes: string[]
  setVisibleThemes: Dispatch<SetStateAction<string[]>>
  theme: string
  setTheme: Dispatch<SetStateAction<string>>
  chooseTheme: (name: string) => void
  colours: string[]
  setColours: Dispatch<SetStateAction<string[]>>
  toggleColour: (colour: string) => void
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  chooseCommander: (name: string) => Promise<boolean>
  commander: string
  deck: DeckCard[]
  autosave: ReturnType<DeckWorkspace['getSnapshot']>
  introGuideRequested: boolean
  setIntroGuideRequested: Dispatch<SetStateAction<boolean>>
}

// eslint-disable-next-line max-lines-per-function -- Start-screen markup stays together; search helpers and render callbacks remain checked.
export function StartView(props: StartViewProps) {
  const { darkMode } = useVisualPreferences()
  const discovery = useCommanderDiscovery(props, true)
  const resume = Boolean(props.commander && props.deck.length)
  const draft =
    props.autosave.drafts.find(({ id }) => id === props.autosave.id) ?? props.autosave.notice?.draft
  const clearFilters = () => {
    props.setTheme('')
    props.setColours([])
    props.setSearch('')
  }
  const summary =
    [
      props.theme,
      ...props.colours.map((colour) => colourNames[colour]),
      props.search.trim().length >= 2 ? `Name: ${props.search.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'All commanders'

  return (
    <main className={darkMode ? 'dark' : ''}>
      <header>
        <button className="brand reset" type="button" onClick={() => props.navigateView('start')}>
          Commander Deck Creator <small>v{__APP_VERSION__}</small>
        </button>
        <div className="header-actions">
          <DisplaySettingsMenu />
          <button className="export" type="button" onClick={() => props.openModal('import')}>
            Import deck
          </button>
          <button className="export" type="button" onClick={props.openSavedDecks}>
            Drafts / saved decks ({props.savedDecks} saves)
          </button>
          <RequestActivityIndicator />
        </div>
      </header>
      {props.workspaceNotice}
      {props.savedDecksModal}
      {props.importModal}
      <section className="start">
        {resume && (
          <section className="continue-card" aria-labelledby="continue-title">
            <button
              className="continue-art reset"
              type="button"
              aria-label={`Show details for ${props.deck[0].name}`}
              onClick={() => props.openCardReference(props.deck[0])}
            >
              <SmallCardImage image={props.deck[0].image} />
            </button>
            <div>
              <h2 id="continue-title">Continue building</h2>
              <CardReference
                card={props.deck[0]}
                onOpen={() => props.openCardReference(props.deck[0])}
              />
              <p>
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
              <p>Choosing a new commander keeps this deck in Autosaved drafts.</p>
            </div>
          </section>
        )}
        <p className="eyebrow">Build from scratch</p>
        <h1>What do you want to play?</h1>
        <p className="lead">Combine a theme and colour identity, or search for a commander.</p>
        <section className="start-panel commander-filters" aria-label="Commander filters">
          <h2>Find a commander</h2>
          <div className="themes">
            {props.visibleThemes.map((name) => (
              <button
                className={props.theme === name ? 'selected' : ''}
                aria-pressed={props.theme === name}
                key={name}
                type="button"
                onClick={() => props.chooseTheme(name)}
              >
                {name}
              </button>
            ))}
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
          <h3 className="filter-heading">Colour identity</h3>
          <div className="colour-picker">
            {Object.entries(colourNames).map(([symbol, name]) => (
              <button
                className={props.colours.includes(symbol) ? 'selected' : ''}
                key={symbol}
                type="button"
                onClick={() => props.toggleColour(symbol)}
                aria-label={name}
                aria-pressed={props.colours.includes(symbol)}
              >
                <ManaSymbols symbols={[symbol]} decorative />
              </button>
            ))}
          </div>
          <label className="commander-search">
            Name
            <input
              value={props.search}
              onChange={(event) => props.setSearch(event.target.value)}
              placeholder="Search commanders…"
              aria-label="Search commanders"
              autoComplete="off"
            />
          </label>
          <div className="filter-summary">
            <p role="status">
              {summary}
              {props.theme && props.search.trim().length >= 2 && ' · Searching within this theme'}
            </p>
            <button className="export" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        </section>
        <section
          aria-labelledby="commander-discovery-title"
          aria-busy={discovery.status === 'loading'}
        >
          <h2 id="commander-discovery-title">Choose a commander</h2>
          <div className="commander-grid">
            {discovery.status === 'loading' &&
              Array.from({ length: 12 }, (_, index) => (
                <div className="commander-placeholder" aria-hidden="true" key={index} />
              ))}
            {discovery.suggestions.map(({ card, reason }, index) => {
              const converted = toDeckCard(card)
              const image = scryfallImage(card)
              const reasonId = `commander-reason-${index}`
              return (
                <article className="commander-tile" key={card.oracle_id ?? card.name}>
                  <div
                    className="commander-discovery-art card-reference"
                    tabIndex={0}
                    role="group"
                    aria-label={`Preview art for ${card.name}`}
                    onMouseEnter={({ currentTarget }) => showCardPreview(currentTarget)}
                    onFocus={({ currentTarget }) => showCardPreview(currentTarget)}
                    onMouseLeave={({ currentTarget }) => hideCardPreview(currentTarget)}
                    onBlur={({ currentTarget }) => hideCardPreview(currentTarget)}
                  >
                    <FinishedCardImage
                      image={image}
                      backImage={scryfallBackImage(card)}
                      alt={`${card.name} card`}
                      cardName={card.name}
                      showFlipButton
                    />
                    <CardImagePreview image={image} placement="reference" />
                  </div>
                  <CardReference
                    card={converted}
                    onOpen={() => props.openCardReference(converted)}
                  />
                  <p className="commander-reason" id={reasonId}>
                    {reason}
                  </p>
                  <button
                    className="export commander-choose"
                    type="button"
                    aria-describedby={reasonId}
                    onClick={() => void props.chooseCommander(card.name)}
                  >
                    <OracleText text={card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ''} />{' '}
                    Choose {card.name}
                  </button>
                </article>
              )
            })}
          </div>
          {discovery.status === 'loading' && (
            <p className="discovery-status" role="status">
              Finding legal commanders…
            </p>
          )}
          {discovery.status === 'error' && (
            <p role="alert">{discovery.error} Try changing a filter or reload to try again.</p>
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
          {discovery.status === 'idle' && discovery.suggestions.length > 0 && (
            <button className="reroll" type="button" onClick={discovery.reshuffle}>
              Show different commanders
            </button>
          )}
        </section>
        <label className="intro-guide-option">
          <input
            type="checkbox"
            checked={props.introGuideRequested}
            onChange={(event) => props.setIntroGuideRequested(event.target.checked)}
          />{' '}
          Show a quick guide when I start my next deck
        </label>
      </section>
    </main>
  )
}
