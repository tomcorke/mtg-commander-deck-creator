import type { SavedDeck } from '../../deck-state.ts'
import { DisplaySettingsMenu } from '../../shared/DisplaySettingsMenu.tsx'
import { RequestActivityIndicator } from '../../shared/RequestActivityIndicator.tsx'

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
  return (
    <header>
      <span className="brand">
        Commander Deck Creator <small>v{__APP_VERSION__}</small>
      </span>
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
        <DisplaySettingsMenu />
        <div className="header-destructive">
          <button className="start-over" type="button" onClick={startOver}>
            Start over
          </button>
        </div>
        <button className="export" type="button" onClick={onImport}>
          Import
        </button>
        <button className="export" type="button" onClick={onSaveLoad}>
          Save / load
        </button>
        <button className="export" type="button" onClick={onExport}>
          Export deck
        </button>
        <RequestActivityIndicator />
      </div>
    </header>
  )
}
