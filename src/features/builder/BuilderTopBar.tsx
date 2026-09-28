import type { SavedDeck } from '../../deck-state.ts'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'

export type BuilderTopBarProps = {
  activeDeckDelta: { added: number; removed: number } | null
  activeSavedDeck: SavedDeck | undefined
  deckCount: number
  onExport: () => void
  onImport: () => void
  onSaveLoad: () => void
  startOver: () => void
}

export function BuilderTopBar({
  activeDeckDelta,
  activeSavedDeck,
  deckCount,
  onExport,
  onImport,
  onSaveLoad,
  startOver,
}: BuilderTopBarProps) {
  const {
    cardEffects,
    commanderStyling,
    darkMode,
    setCardEffects,
    setCommanderStyling,
    setDarkMode,
  } = useVisualPreferences()

  return (
    <header>
      <button className="brand reset" type="button" onClick={startOver}>
        Commander Deck Creator <small>v{__APP_VERSION__}</small>
      </button>
      <div className="deck-status">
        {activeSavedDeck && (
          <div className="saved-status">
            <b>{activeSavedDeck.name}</b>
            <small>
              Saved {new Date(activeSavedDeck.updatedAt).toLocaleString()}{' '}
              <span className="delta-added">+{activeDeckDelta?.added}</span>{' '}
              <span className="delta-removed">−{activeDeckDelta?.removed}</span>
            </small>
          </div>
        )}
        <div className="progress">
          <span
            style={{
              background: `linear-gradient(90deg, var(--commander-accent, #7650ae) ${deckCount}%, #dedcea ${deckCount}%)`,
            }}
          />
          {deckCount} / 100 cards
        </div>
      </div>
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
        <button
          className="theme-toggle"
          type="button"
          aria-pressed={darkMode}
          onClick={() => setDarkMode((current) => !current)}
        >
          {darkMode ? '◐ Dark' : '☀ Light'}
        </button>
        <button className="start-over" type="button" onClick={startOver}>
          Start over
        </button>
        <button className="export" type="button" onClick={onImport}>
          Import
        </button>
        <button className="export" type="button" onClick={onSaveLoad}>
          Save / load
        </button>
        <button className="export" type="button" onClick={onExport}>
          Export deck
        </button>
      </div>
    </header>
  )
}
