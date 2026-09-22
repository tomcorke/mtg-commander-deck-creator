import { type Dispatch, type SetStateAction } from 'react'

import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import type { CollectionMode, RecommendationStyle } from '../../recommendations.ts'

type PowerTarget = 'precon' | 'upgraded' | 'high'
type SetOption = { code: string; name: string }

type SettingHelpProps = {
  id: string
  label: string
  description: string
}

function SettingHelp({ id, label, description }: SettingHelpProps) {
  return (
    <span className="setting-help-wrap">
      <button
        type="button"
        className="setting-help-button"
        aria-label={`Explain ${label}`}
        aria-describedby={id}
      >
        ?
      </button>
      <span className="setting-help-popover" id={id} role="tooltip">
        {description}
      </span>
    </span>
  )
}

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
          <div className="recommendation-setting">
            <label htmlFor="recommendation-style">Recommendation style</label>
            <select
              id="recommendation-style"
              value={recommendationStyle}
              onChange={(event) =>
                chooseRecommendationStyle(event.target.value as RecommendationStyle)
              }
            >
              <option value="story">Story deck</option>
              <option value="balanced">Balanced</option>
              <option value="optimized">Optimized</option>
            </select>
            <SettingHelp
              id="recommendation-style-help"
              label="Recommendation style"
              description="Controls how cards are ranked. Story favors your theme, Balanced mixes theme and deck needs, and Optimized favors cards that fill deck needs."
            />
          </div>
          <div className="recommendation-setting">
            <label htmlFor="power-target">Power target</label>
            <select
              id="power-target"
              value={powerTarget}
              onChange={(event) => choosePowerTarget(event.target.value as PowerTarget)}
            >
              <option value="precon">Core (Bracket 2)</option>
              <option value="upgraded">Upgraded (Bracket 3)</option>
              <option value="high">High power / Optimized (Bracket 4)</option>
            </select>
            <SettingHelp
              id="power-target-help"
              label="Power target"
              description="Sets the target power band. Core filters out fast-mana cards that are uncommon in precon-style decks. Higher targets allow them."
            />
          </div>
          <div className="recommendation-setting">
            <label htmlFor="prioritize-deck-health">
              <input
                id="prioritize-deck-health"
                type="checkbox"
                checked={prioritizeDeckHealth}
                onChange={(event) => {
                  setPrioritizeDeckHealth(event.target.checked)
                  setRecommendationOptionsChanged(true)
                }}
              />{' '}
              Prioritize deck health
            </label>
            <SettingHelp
              id="deck-health-help"
              label="Prioritize deck health"
              description="Boosts cards that fill missing deck roles such as lands, ramp, card draw, removal, and board wipes."
            />
          </div>
          <div className="recommendation-setting">
            <label htmlFor="include-creature">
              <input
                id="include-creature"
                type="checkbox"
                checked={includeCreature}
                onChange={(event) => {
                  setIncludeCreature(event.target.checked)
                  setRecommendationOptionsChanged(true)
                }}
              />{' '}
              Include a creature when possible
            </label>
            <SettingHelp
              id="include-creature-help"
              label="Include a creature when possible"
              description="Keeps a creature in each recommendation batch when one is available. Turn it off for a deck that does not need creatures."
            />
          </div>
          <fieldset className="collection-picker">
            <legend>
              <span>Collection affinity</span>
              <SettingHelp
                id="collection-affinity-help"
                label="Collection affinity"
                description="Choose sets to prefer or limit recommendations to. Select sets below, then choose how strongly to match them."
              />
            </legend>
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
                <div className="collection-mode-setting">
                  <label htmlFor="collection-mode">Match</label>
                  <select
                    id="collection-mode"
                    value={collectionMode}
                    disabled={!collectionSets.length}
                    onChange={(event) => chooseCollectionMode(event.target.value as CollectionMode)}
                  >
                    <option value="none">No collection preference</option>
                    <option value="prefer">Prefer selected collection</option>
                    <option value="only">Only selected collection</option>
                  </select>
                  <SettingHelp
                    id="collection-mode-help"
                    label="Collection matching"
                    description="Prefer puts cards from selected sets first. Only removes cards from other sets."
                  />
                </div>
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
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-game-changers">
                <input
                  id="exclude-game-changers"
                  type="checkbox"
                  checked={excludeGameChangers}
                  onChange={(event) => {
                    setExcludeGameChangers(event.target.checked)
                    setRecommendationOptionsChanged(true)
                  }}
                />{' '}
                Exclude Game Changers
              </label>
              <SettingHelp
                id="exclude-game-changers-help"
                label="Exclude Game Changers"
                description="Removes cards marked as Game Changers from recommendations."
              />
            </div>
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-tutors">
                <input
                  id="exclude-tutors"
                  type="checkbox"
                  checked={excludeTutors}
                  onChange={(event) => {
                    setExcludeTutors(event.target.checked)
                    setRecommendationOptionsChanged(true)
                  }}
                />{' '}
                Exclude tutors
              </label>
              <SettingHelp
                id="exclude-tutors-help"
                label="Exclude tutors"
                description="Removes cards that search your library for specific cards."
              />
            </div>
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-extra-turns">
                <input
                  id="exclude-extra-turns"
                  type="checkbox"
                  checked={excludeExtraTurns}
                  onChange={(event) => {
                    setExcludeExtraTurns(event.target.checked)
                    setRecommendationOptionsChanged(true)
                  }}
                />{' '}
                Exclude extra turns
              </label>
              <SettingHelp
                id="exclude-extra-turns-help"
                label="Exclude extra turns"
                description="Removes cards that grant extra turns."
              />
            </div>
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-unreleased">
                <input
                  id="exclude-unreleased"
                  type="checkbox"
                  checked={excludeUnreleased}
                  onChange={(event) => {
                    setExcludeUnreleased(event.target.checked)
                    setRecommendationOptionsChanged(true)
                  }}
                />{' '}
                Exclude unreleased cards
              </label>
              <SettingHelp
                id="exclude-unreleased-help"
                label="Exclude unreleased cards"
                description="Removes cards that are not released yet."
              />
            </div>
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
