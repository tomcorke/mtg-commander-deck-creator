import type { BuilderSettings } from '../../domain/builder-state.ts'
import { type Dispatch, type SetStateAction, useEffect } from 'react'
import { useDialogFocus } from '../../shared/hooks.ts'

import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { SetPicker } from '../../shared/SetPicker.tsx'
import type { ScryfallSet } from '../../domain/card-model.ts'
import { onlyModeMinimumPool, type SetPickerRow } from '../../domain/set-picker.ts'
import { normalizeMaxPrice, priorityLabels } from '../../domain/recommendation-tuning.ts'
import { priceSourceNote } from '../../domain/deck-price.ts'
import type { CollectionMode, RecommendationStyle } from '../../recommendations.ts'

type PowerTarget = 'precon' | 'upgraded' | 'high'

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
      <span className="action-help setting-help-popover" id={id} role="tooltip">
        {description}
      </span>
    </span>
  )
}

type RecommendationSettingsModalProps = {
  show: boolean
  chooseOptions: (settings: Partial<BuilderSettings>) => void
  focusSets?: boolean
  recommendationStyle: RecommendationStyle
  chooseRecommendationStyle: (value: RecommendationStyle) => void
  powerTarget: PowerTarget
  choosePowerTarget: (value: PowerTarget) => void
  maxPrice: number | null
  chooseMaxPrice: (value: number | null) => void
  deckBudget: number | null
  includeCreature: boolean
  collectionSearch: string
  setCollectionSearch: Dispatch<SetStateAction<string>>
  collectionSets: string[]
  toggleCollectionSet: (code: string) => void
  /** Sets chosen while browsing commanders; never applied here without an explicit click. */
  browsingSets: string[]
  collectionSetLabel: (code: string) => string
  setOptions: ScryfallSet[]
  setRows: SetPickerRow[]
  showSupplementalSets: boolean
  setShowSupplementalSets: Dispatch<SetStateAction<boolean>>
  collectionMode: CollectionMode
  chooseCollectionMode: (value: CollectionMode) => void
  collectionBrowserState: 'idle' | 'loading' | 'error'
  browseCollection: () => void
  collectionError: string
  collectionPoolSize: number | null
  excludeGameChangers: boolean
  limitGameChangers: boolean
  excludeTutors: boolean
  excludeExtraTurns: boolean
  excludeUnreleased: boolean
  recommendationOptionsChanged: boolean
  recommendationSettingsSummary: string
  closeModal: () => void
}

// eslint-disable-next-line max-lines-per-function -- The settings form markup stays together.
export function RecommendationSettingsModal({
  show,
  chooseOptions,
  focusSets = false,
  recommendationStyle,
  chooseRecommendationStyle,
  powerTarget,
  choosePowerTarget,
  maxPrice,
  chooseMaxPrice,
  deckBudget,
  includeCreature,
  collectionSearch,
  setCollectionSearch,
  collectionSets,
  toggleCollectionSet,
  browsingSets,
  collectionSetLabel,
  setOptions,
  setRows,
  showSupplementalSets,
  setShowSupplementalSets,
  collectionMode,
  chooseCollectionMode,
  collectionBrowserState,
  browseCollection,
  collectionError,
  collectionPoolSize,
  excludeGameChangers,
  limitGameChangers,
  excludeTutors,
  excludeExtraTurns,
  excludeUnreleased,
  recommendationOptionsChanged,
  recommendationSettingsSummary,
  closeModal,
}: RecommendationSettingsModalProps) {
  const dialog = useDialogFocus(show, closeModal)
  useEffect(() => {
    if (!show || !focusSets) return
    const sets = document.getElementById('recommendation-sets')
    sets?.scrollIntoView({ block: 'start' })
    sets?.focus()
  }, [show, focusSets])
  if (!show) return null
  const smallOnlyPool =
    collectionMode === 'only' &&
    collectionSets.length > 0 &&
    collectionPoolSize !== null &&
    collectionPoolSize < onlyModeMinimumPool

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
        ref={dialog.ref}
        onKeyDown={dialog.onKeyDown}
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">Recommendation preferences</p>
            <h2 id="recommendation-settings-title">Recommendation settings</h2>
            <details className="recommendation-disclosure">
              <summary>How recommendations work</summary>
              <p className="settings-help">
                Priority controls ranking, not deck legality. Power, price, and exclusions filter
                the cards offered; a deck budget only moves cards that would exceed it later. No
                setting guarantees a bracket or competitive strength.
              </p>
            </details>
          </div>
          <ModalCloseButton onClick={() => closeModal()} label="Close recommendation settings" />
        </div>
        <div className="recommendation-options recommendation-settings-form">
          <div className="recommendation-setting">
            <label htmlFor="recommendation-style">Priority</label>
            <select
              id="recommendation-style"
              value={recommendationStyle}
              onChange={(event) =>
                chooseRecommendationStyle(event.target.value as RecommendationStyle)
              }
            >
              {(['thematic', 'balanced', 'competitive', 'fun'] as const).map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
            <SettingHelp
              id="recommendation-style-help"
              label="Priority"
              description="Theme first favors themes and selected sets; Balanced mixes theme and deck needs; Deck needs first favors missing roles and mana fit; Surprise me boosts interesting new picks."
            />
          </div>
          <div className="recommendation-setting">
            <label htmlFor="power-target">Power</label>
            <select
              id="power-target"
              value={powerTarget}
              onChange={(event) => choosePowerTarget(event.target.value as PowerTarget)}
            >
              <option value="precon">Core (Bracket 2)</option>
              <option value="upgraded">Upgraded (Bracket 3)</option>
              <option value="high">High power (Bracket 4)</option>
            </select>
            <SettingHelp
              id="power-target-help"
              label="Power"
              description="Core excludes a short list of fast-mana cards as an app preference. Upgraded and High power allow them. These settings do not verify a bracket."
            />
          </div>
          <div className="recommendation-setting">
            <label htmlFor="max-price">Max price per card</label>
            <span className="price-limit-input">
              <span aria-hidden="true">$</span>
              <input
                id="max-price"
                type="number"
                min="0"
                step="0.01"
                value={maxPrice ?? ''}
                placeholder="No limit"
                onChange={(event) => chooseMaxPrice(normalizeMaxPrice(event.target.value))}
                aria-describedby="max-price-help"
              />
            </span>
            <SettingHelp
              id="max-price-help"
              label="Max price per card"
              description="Limits recommendations by their displayed US dollar price. Leave empty for no limit. Cards without a price are still offered."
            />
          </div>
          <div className="recommendation-setting">
            <label htmlFor="deck-budget">Deck budget</label>
            <span className="price-limit-input">
              <span aria-hidden="true">$</span>
              <input
                id="deck-budget"
                type="number"
                min="0"
                step="1"
                value={deckBudget ?? ''}
                placeholder="No budget"
                onChange={(event) =>
                  chooseOptions({ deckBudget: normalizeMaxPrice(event.target.value) })
                }
                aria-describedby="deck-budget-help"
              />
            </span>
            <SettingHelp
              id="deck-budget-help"
              label="Deck budget"
              description={`Recommendations that would take the main deck past this total come later. ${priceSourceNote}`}
            />
          </div>
          <div className="recommendation-setting-toggle">
            <label htmlFor="include-creature">
              <input
                id="include-creature"
                type="checkbox"
                checked={includeCreature}
                onChange={(event) => {
                  chooseOptions({ includeCreature: event.target.checked })
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
          <fieldset id="recommendation-sets" className="collection-picker" tabIndex={-1}>
            <legend>
              <span>Sets to build from</span>
              <SettingHelp
                id="collection-affinity-help"
                label="Sets to build from"
                description="Tick sets you own or want to play. Prefer ranks their cards first; Only limits recommendations to them."
              />
            </legend>
            <p className="collection-picker-help">
              Tick sets here, or use “Prefer this set” in any card’s printing details.
            </p>
            {(() => {
              const missing = browsingSets.filter((code) => !collectionSets.includes(code))
              return missing.length > 0 ? (
                <p className="collection-picker-help" role="note">
                  You browsed commanders in {missing.map(collectionSetLabel).join(', ')}. Those sets
                  are not applied to recommendations unless you add them.{' '}
                  <button
                    type="button"
                    className="compact-action"
                    onClick={() => missing.forEach(toggleCollectionSet)}
                  >
                    Add {missing.length === 1 ? 'this set' : 'these sets'}
                  </button>
                </p>
              ) : null
            })()}
            <div className="collection-set-controls">
              <SetPicker
                query={collectionSearch}
                setQuery={setCollectionSearch}
                showSupplemental={showSupplementalSets}
                setShowSupplemental={setShowSupplementalSets}
                setOptions={setOptions}
                rows={setRows}
                selected={collectionSets}
                toggle={toggleCollectionSet}
                label={collectionSetLabel}
                emptySelection="No sets selected. Recommendations draw from every set."
              />
              <div className="collection-affinity-actions">
                <div className="collection-mode-setting">
                  <label htmlFor="collection-mode">Use</label>
                  <select
                    id="collection-mode"
                    value={collectionMode}
                    disabled={!collectionSets.length}
                    onChange={(event) => chooseCollectionMode(event.target.value as CollectionMode)}
                  >
                    <option value="none">Every set (clear selection)</option>
                    <option value="prefer">Prefer these sets</option>
                    <option value="only">Only these sets</option>
                  </select>
                  <SettingHelp
                    id="collection-mode-help"
                    label="Set matching"
                    description="Prefer ranks cards from the selected sets first. Only removes cards from every other set."
                  />
                </div>
                <button
                  type="button"
                  className="compact-action"
                  disabled={!collectionSets.length || collectionBrowserState === 'loading'}
                  onClick={() => {
                    closeModal()
                    void browseCollection()
                  }}
                >
                  {collectionBrowserState === 'loading' ? 'Loading cards…' : 'Browse these cards'}
                </button>
              </div>
            </div>
            {collectionSets.length > 0 && (
              <p className="collection-pool" role="status">
                {collectionPoolSize === null
                  ? 'Counting legal cards…'
                  : `${collectionPoolSize.toLocaleString()} legal ${collectionPoolSize === 1 ? 'card' : 'cards'} for this commander in the selected sets.`}
              </p>
            )}
            {smallOnlyPool && (
              <p className="collection-pool-warning" role="alert">
                Only these sets leaves too few cards to finish a 100-card deck with room to choose.
                Add more sets or switch to Prefer.
              </p>
            )}
            {collectionError && (
              <small className="form-error" role="alert">
                {collectionError}
              </small>
            )}
          </fieldset>
          <fieldset>
            <legend>Optional recommendation filters</legend>
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-game-changers">
                <input
                  id="exclude-game-changers"
                  type="checkbox"
                  checked={excludeGameChangers}
                  onChange={(event) => {
                    chooseOptions({ excludeGameChangers: event.target.checked })
                  }}
                />{' '}
                Exclude Game Changers
              </label>
              <SettingHelp
                id="exclude-game-changers-help"
                label="Exclude Game Changers"
                description="Wizards' bracket guidance allows zero in Brackets 1–2 (Bracket 1 exceptions need pregame agreement), up to three in Bracket 3, and no limit in Brackets 4–5. This optional filter removes all Game Changers."
              />
            </div>
            <div className="recommendation-setting-toggle">
              <label htmlFor="limit-game-changers">
                <input
                  id="limit-game-changers"
                  type="checkbox"
                  checked={limitGameChangers || excludeGameChangers}
                  disabled={excludeGameChangers}
                  onChange={(event) => {
                    chooseOptions({ limitGameChangers: event.target.checked })
                  }}
                />{' '}
                Limit to 3 Game Changers
              </label>
              <SettingHelp
                id="limit-game-changers-help"
                label="Limit to 3 Game Changers"
                description="Bracket 3 allows up to three Game Changers. Once the main deck holds three, no more are recommended or added from recommendations."
              />
            </div>
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-tutors">
                <input
                  id="exclude-tutors"
                  type="checkbox"
                  checked={excludeTutors}
                  onChange={(event) => {
                    chooseOptions({ excludeTutors: event.target.checked })
                  }}
                />{' '}
                Exclude tutors (preference)
              </label>
              <SettingHelp
                id="exclude-tutors-help"
                label="Exclude tutors (preference)"
                description="Personal preference, not a Commander Bracket restriction. Wizards removed tutor restrictions in October 2025. This filter uses card tags and text."
              />
            </div>
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-extra-turns">
                <input
                  id="exclude-extra-turns"
                  type="checkbox"
                  checked={excludeExtraTurns}
                  onChange={(event) => {
                    chooseOptions({ excludeExtraTurns: event.target.checked })
                  }}
                />{' '}
                Exclude extra turns (preference)
              </label>
              <SettingHelp
                id="exclude-extra-turns-help"
                label="Exclude extra turns (preference)"
                description="Personal preference. Removes cards identified as granting extra turns; this does not analyse quantity, chaining, loops, or intent."
              />
            </div>
            <div className="recommendation-setting-toggle">
              <label htmlFor="exclude-unreleased">
                <input
                  id="exclude-unreleased"
                  type="checkbox"
                  checked={excludeUnreleased}
                  onChange={(event) => {
                    chooseOptions({ excludeUnreleased: event.target.checked })
                  }}
                />{' '}
                Exclude unreleased cards (preference)
              </label>
              <SettingHelp
                id="exclude-unreleased-help"
                label="Exclude unreleased cards (preference)"
                description="Removes cards that are not released yet."
              />
            </div>
          </fieldset>
        </div>
        <div className="export-actions recommendation-settings-actions">
          <p>
            <span>{recommendationSettingsSummary}</span>
            {/* Stays mounted so screen readers announce the text when it appears. */}
            <span role="status">
              {recommendationOptionsChanged && 'Changes apply when you close settings.'}
            </span>
          </p>
          <button type="button" className="primary" onClick={() => closeModal()}>
            Done
          </button>
        </div>
      </section>
    </div>
  )
}
