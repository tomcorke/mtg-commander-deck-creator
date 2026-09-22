import { type Dispatch, type ReactNode, type SetStateAction } from 'react'

import {
  colourNames,
  commanderNames,
  randomItems,
  randomThree,
  selectableThemes,
} from '../../domain/commander-catalog.ts'
import type { AppModal, AppView } from '../../app/routes.ts'
import { OracleText } from '../../shared/ManaSymbols.tsx'

type StartViewProps = {
  darkMode: boolean
  commanderStyling: boolean
  cardEffects: boolean
  setDarkMode: Dispatch<SetStateAction<boolean>>
  setCommanderStyling: Dispatch<SetStateAction<boolean>>
  setCardEffects: Dispatch<SetStateAction<boolean>>
  navigateView: (view: AppView, modal?: AppModal | null, replace?: boolean) => void
  openModal: (modal: AppModal) => void
  openSavedDecks: () => void
  savedDecks: number
  savedDecksModal: ReactNode
  importModal: ReactNode
  visibleThemes: string[]
  setVisibleThemes: Dispatch<SetStateAction<string[]>>
  theme: string
  setTheme: Dispatch<SetStateAction<string>>
  chooseTheme: (name: string) => void
  colours: string[]
  toggleColour: (colour: string) => void
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  start: (name: string) => void | Promise<boolean | undefined>
  matches: string[]
  suggestions: string[]
  commanderCosts: Record<string, string>
  commanderImages: Record<string, string[]>
  commanderNames: (name: string) => string[]
  suggestionPool: string[]
  setSuggestions: Dispatch<SetStateAction<string[]>>
}

export function StartView({
  darkMode,
  commanderStyling,
  cardEffects,
  setDarkMode,
  setCommanderStyling,
  setCardEffects,
  navigateView,
  openModal,
  openSavedDecks,
  savedDecks,
  savedDecksModal,
  importModal,
  visibleThemes,
  setVisibleThemes,
  theme,
  setTheme,
  chooseTheme,
  colours,
  toggleColour,
  search,
  setSearch,
  start,
  matches,
  suggestions,
  commanderCosts,
  commanderImages,
  suggestionPool,
  setSuggestions,
}: StartViewProps) {
  return (
    <main className={darkMode ? 'dark' : ''}>
      <header>
        <button className="brand reset" type="button" onClick={() => navigateView('start')}>
          Commander Deck Creator <small>v{__APP_VERSION__}</small>
        </button>
        <div className="header-actions">
          <label className="theme-option">
            <input
              type="checkbox"
              checked={commanderStyling}
              onChange={(event) => setCommanderStyling(event.target.checked)}
            />{' '}
            Commander art and colours
          </label>
          <label
            className="theme-option"
            title="Enable card movement and foil or etched finish effects"
          >
            <input
              type="checkbox"
              checked={cardEffects}
              onChange={(event) => setCardEffects(event.target.checked)}
            />{' '}
            Motion and finishes
          </label>
          <button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>
            {darkMode ? '◐ Dark' : '☀ Light'}
          </button>
          <button className="export" type="button" onClick={() => openModal('import')}>
            Import deck
          </button>
          <button className="export" type="button" onClick={openSavedDecks}>
            Saved decks ({savedDecks})
          </button>
        </div>
      </header>
      {savedDecksModal}
      {importModal}
      <section className="start">
        <p className="eyebrow">Build from scratch</p>
        <h1>What do you want to play?</h1>
        <p className="lead">Start with an idea, browse suggestions, or find any commander.</p>

        <div className="start-grid">
          <article className="start-panel">
            <span className="step">01</span>
            <h2>Start with a theme</h2>
            <p>Pick something you enjoy. We'll suggest commanders next.</p>
            <div className="themes">
              {visibleThemes.map((name) => (
                <button
                  className={theme === name ? 'selected' : ''}
                  key={name}
                  type="button"
                  onClick={() => chooseTheme(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            {visibleThemes.length < selectableThemes.length && (
              <div className="theme-actions">
                <button
                  className="reroll"
                  type="button"
                  onClick={() =>
                    setVisibleThemes((current) => [
                      ...current,
                      ...randomItems(
                        selectableThemes.filter((name) => !current.includes(name)),
                        6,
                      ),
                    ])
                  }
                >
                  + Show more themes
                </button>
                <button
                  className="reroll"
                  type="button"
                  onClick={() => {
                    setTheme('')
                    setVisibleThemes(randomItems(selectableThemes, 6))
                  }}
                >
                  ↻ Show different themes
                </button>
              </div>
            )}
            <h3 className="filter-heading">Or choose colours</h3>
            <div className="colour-picker">
              {Object.entries(colourNames).map(([symbol, name]) => (
                <button
                  className={colours.includes(symbol) ? 'selected' : ''}
                  key={symbol}
                  onClick={() => toggleColour(symbol)}
                  aria-label={name}
                >
                  <img src={`https://svgs.scryfall.io/card-symbols/${symbol}.svg`} alt="" />
                </button>
              ))}
            </div>
          </article>

          <article className="start-panel">
            <span className="step">02</span>
            <h2>Choose a commander</h2>
            <p>
              {theme
                ? `${theme} commanders selected for you.`
                : colours.length
                  ? `${colours.map((colour) => colourNames[colour]).join(' + ')} commanders.`
                  : "Search by name, or try today's suggestions."}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                start(search)
              }}
            >
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search commanders…"
                aria-label="Search commanders"
                autoComplete="off"
              />
              <button className="primary" type="submit">
                Choose
              </button>
            </form>
            <div className="suggestions" aria-live="polite">
              {(search.trim().length >= 2 ? matches : suggestions).map((name) => (
                <button key={name} onClick={() => start(name)}>
                  <span className="commander-option">
                    <span
                      className={`commander-cost ${commanderCosts[name] === undefined ? 'loading' : 'loaded'}`}
                    >
                      {commanderCosts[name] === undefined ? (
                        <span className="cost-placeholder" aria-label="Loading mana cost" />
                      ) : (
                        <OracleText text={commanderCosts[name]} />
                      )}
                    </span>
                    <span>{name}</span>
                  </span>
                  <span>→</span>
                  {commanderImages[name]?.length > 0 && (
                    <span
                      className={`suggestion-preview ${commanderImages[name].length > 1 ? 'pair' : ''}`}
                    >
                      {commanderImages[name].map((image, index) => (
                        <img src={image} alt={`${commanderNames(name)[index]} card`} key={image} />
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {search.trim().length < 2 && (
              <button
                className="reroll"
                onClick={() => setSuggestions(randomThree(suggestionPool))}
              >
                ↻ Show different commanders
              </button>
            )}
          </article>
        </div>
      </section>
    </main>
  )
}
