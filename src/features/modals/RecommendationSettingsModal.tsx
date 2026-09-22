import { type Dispatch, type SetStateAction } from 'react'

import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import type { CollectionMode, RecommendationStyle } from '../../recommendations.ts'

type PowerTarget = 'precon' | 'upgraded' | 'high'
type SetOption = { code: string; name: string }

type RecommendationSettingsModalProps = {
  show: boolean
  recommendationStyle: RecommendationStyle
  chooseRecommendationStyle: (value: RecommendationStyle) => void
  powerTarget: PowerTarget
  choosePowerTarget: (value: PowerTarget) => void
  prioritizeDeckHealth: boolean
  setPrioritizeDeckHealth: Dispatch<SetStateAction<boolean>>
  includeCreature: boolean
  setIncludeCreature: Dispatch<SetStateAction<boolean>>
  collectionSearch: string
  setCollectionSearch: Dispatch<SetStateAction<string>>
  collectionSets: string[]
  toggleCollectionSet: (code: string) => void
  collectionSetLabel: (code: string) => string
  filteredSetOptions: SetOption[]
  collectionMode: CollectionMode
  chooseCollectionMode: (value: CollectionMode) => void
  collectionBrowserState: 'idle' | 'loading' | 'error'
  browseCollection: () => void
  collectionState: 'idle' | 'loading' | 'error'
  collectionError: string
  collectionPoolSize: number | null
  excludeGameChangers: boolean
  setExcludeGameChangers: Dispatch<SetStateAction<boolean>>
  excludeTutors: boolean
  setExcludeTutors: Dispatch<SetStateAction<boolean>>
  excludeExtraTurns: boolean
  setExcludeExtraTurns: Dispatch<SetStateAction<boolean>>
  excludeUnreleased: boolean
  setExcludeUnreleased: Dispatch<SetStateAction<boolean>>
  recommendationOptionsChanged: boolean
  setRecommendationOptionsChanged: Dispatch<SetStateAction<boolean>>
  recommendationSettingsSummary: string
  closeModal: () => void
}

export function RecommendationSettingsModal({
  show,
  recommendationStyle,
  chooseRecommendationStyle,
  powerTarget,
  choosePowerTarget,
  prioritizeDeckHealth,
  setPrioritizeDeckHealth,
  includeCreature,
  setIncludeCreature,
  collectionSearch,
  setCollectionSearch,
  collectionSets,
  toggleCollectionSet,
  collectionSetLabel,
  filteredSetOptions,
  collectionMode,
  chooseCollectionMode,
  collectionBrowserState,
  browseCollection,
  collectionState,
  collectionError,
  collectionPoolSize,
  excludeGameChangers,
  setExcludeGameChangers,
  excludeTutors,
  setExcludeTutors,
  excludeExtraTurns,
  setExcludeExtraTurns,
  excludeUnreleased,
  setExcludeUnreleased,
  recommendationOptionsChanged,
  setRecommendationOptionsChanged,
  recommendationSettingsSummary,
  closeModal,
}: RecommendationSettingsModalProps) {
  if (!show) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <section
        className="export-modal recommendation-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-settings-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            closeModal()
          }
        }}
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Recommendation preferences</p>
            <h2 id="recommendation-settings-title">Recommendation settings</h2>
            <p className="settings-help">
              Changes apply when you request the next recommendations.
            </p>
          </div>
          <ModalCloseButton
            autoFocus
            onClick={() => closeModal()}
            label="Close recommendation settings"
          />
        </div>
        <div className="recommendation-options recommendation-settings-form">
          <label>
            Recommendation style{' '}
            <select
              value={recommendationStyle}
              onChange={(event) =>
                chooseRecommendationStyle(event.target.value as RecommendationStyle)
              }
            >
              <option value="story">Story deck</option>
              <option value="balanced">Balanced</option>
              <option value="optimized">Optimized</option>
            </select>
          </label>
          <label>
            Power target{' '}
            <select
              value={powerTarget}
              onChange={(event) => choosePowerTarget(event.target.value as PowerTarget)}
            >
              <option value="precon">Core (Bracket 2)</option>
              <option value="upgraded">Upgraded (Bracket 3)</option>
              <option value="high">High power / Optimized (Bracket 4)</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={prioritizeDeckHealth}
              onChange={(event) => {
                setPrioritizeDeckHealth(event.target.checked)
                setRecommendationOptionsChanged(true)
              }}
            />{' '}
            Prioritize deck health
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeCreature}
              onChange={(event) => {
                setIncludeCreature(event.target.checked)
                setRecommendationOptionsChanged(true)
              }}
            />{' '}
            Include a creature when possible
          </label>
          <fieldset className="collection-picker">
            <legend>Collection affinity</legend>
            <p className="collection-picker-help">
              Choose a set here or use the set button in any card's printing details.
            </p>
            <div className="collection-set-controls">
              <label className="collection-set-search">
                <span>Search all sets</span>
                <span className="collection-set-input">
                  <input
                    className="clearable-input"
                    value={collectionSearch}
                    onChange={(event) => setCollectionSearch(event.target.value)}
                    placeholder="Search by set name or code…"
                    aria-label="Search all sets"
                  />
                  <button
                    type="button"
                    className="clear-deck-name"
                    onClick={() => setCollectionSearch('')}
                    aria-label="Clear set search"
                  >
                    ×
                  </button>
                </span>
              </label>
              <div className="collection-selection">
                <span>Selected sets</span>
                {collectionSets.length > 0 ? (
                  <div className="collection-chips">
                    {collectionSets.map((code) => (
                      <button type="button" key={code} onClick={() => toggleCollectionSet(code)}>
                        {collectionSetLabel(code)} ×
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="collection-empty">No sets selected yet.</p>
                )}
              </div>
              {filteredSetOptions.length > 0 && (
                <div className="collection-set-results" aria-label="Set search results">
                  {filteredSetOptions.map((set) => (
                    <button
                      type="button"
                      key={set.code}
                      onClick={() => toggleCollectionSet(set.code)}
                    >
                      {set.name} <small>{set.code.toUpperCase()}</small>
                    </button>
                  ))}
                </div>
              )}
              <div className="collection-affinity-actions">
                <label>
                  Match{' '}
                  <select
                    value={collectionMode}
                    disabled={!collectionSets.length}
                    onChange={(event) => chooseCollectionMode(event.target.value as CollectionMode)}
                  >
                    <option value="none">No collection preference</option>
                    <option value="prefer">Prefer selected collection</option>
                    <option value="only">Only selected collection</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!collectionSets.length || collectionBrowserState === 'loading'}
                  onClick={() => {
                    closeModal()
                    void browseCollection()
                  }}
                >
                  {collectionBrowserState === 'loading'
                    ? 'Loading collection…'
                    : 'Browse collection'}
                </button>
              </div>
            </div>
            {collectionState === 'loading' && (
              <small role="status">Checking legal collection…</small>
            )}
            {collectionError && (
              <small className="form-error" role="alert">
                {collectionError}
              </small>
            )}
            {collectionSets.length > 0 && collectionPoolSize !== null && (
              <small>{collectionPoolSize} legal unique cards found.</small>
            )}
          </fieldset>
          <fieldset>
            <legend>Exclude from recommendations</legend>
            <label>
              <input
                type="checkbox"
                checked={excludeGameChangers}
                onChange={(event) => {
                  setExcludeGameChangers(event.target.checked)
                  setRecommendationOptionsChanged(true)
                }}
              />{' '}
              Exclude Game Changers
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludeTutors}
                onChange={(event) => {
                  setExcludeTutors(event.target.checked)
                  setRecommendationOptionsChanged(true)
                }}
              />{' '}
              Exclude tutors
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludeExtraTurns}
                onChange={(event) => {
                  setExcludeExtraTurns(event.target.checked)
                  setRecommendationOptionsChanged(true)
                }}
              />{' '}
              Exclude extra turns
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludeUnreleased}
                onChange={(event) => {
                  setExcludeUnreleased(event.target.checked)
                  setRecommendationOptionsChanged(true)
                }}
              />{' '}
              Exclude unreleased cards
            </label>
          </fieldset>
          {recommendationOptionsChanged && (
            <span className="options-pending" role="status">
              Changes apply with next recommendations.
            </span>
          )}
        </div>
        <div className="export-actions recommendation-settings-actions">
          <span>{recommendationSettingsSummary}</span>
          <button type="button" className="primary" onClick={() => closeModal()}>
            Done
          </button>
        </div>
      </section>
    </div>
  )
}
