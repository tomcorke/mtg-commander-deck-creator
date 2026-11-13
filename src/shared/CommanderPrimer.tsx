import { defaultDeckTargets, targetKeys } from '../deck-analysis.ts'
import {
  appTerms,
  claimKindLabels,
  formatTerms,
  roleTerms,
  type GlossaryEntry,
} from '../domain/glossary.ts'
import { ModalCloseButton } from './CardDetails.tsx'
import { useDialogFocus } from './hooks.ts'

export function GlossaryList({
  entries,
  counts,
  compact = false,
}: {
  entries: GlossaryEntry[]
  /** A number shown before each term, such as a default role target. */
  counts?: number[]
  compact?: boolean
}) {
  return (
    <dl className={`glossary-list${compact ? ' compact' : ''}`}>
      {entries.map(({ term, definition, kind, citation }, index) => (
        <div key={term}>
          <dt>
            {counts && <span className="glossary-count">{counts[index]}</span>}
            {term}
            {!compact && <span className="glossary-kind">{claimKindLabels[kind]}</span>}
          </dt>
          <dd>
            {definition}
            {citation && !compact && <small className="glossary-citation">{citation}</small>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const roles = targetKeys.map((key) => roleTerms[key])

/** The role skeleton for the intro guide; default counts are heuristics. */
export function RoleSkeleton() {
  return (
    <>
      <GlossaryList entries={roles} compact />
      <p>Counts are app estimates and common starting points, not rules. Edit them here.</p>
    </>
  )
}

export function CommanderPrimerDialog({ onClose }: { onClose: () => void }) {
  const dialog = useDialogFocus(true, onClose)
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="export-modal commander-primer"
        {...dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="commander-primer-title"
      >
        <div className="export-heading">
          <div>
            <p className="eyebrow">New to Commander?</p>
            <h2 id="commander-primer-title">Commander basics</h2>
          </div>
          <ModalCloseButton label="Close Commander basics" onClick={onClose} />
        </div>
        <p>
          A short guide to the format and how this builder helps. Each point is labelled as a game
          rule, Wizards policy, a heuristic or an app setting.
        </p>
        <h3>The format</h3>
        <GlossaryList
          entries={[
            formatTerms.commander,
            formatTerms.deckSize,
            formatTerms.singleton,
            formatTerms.colourIdentity,
          ]}
        />
        <h3>The deck skeleton</h3>
        <p>
          Most decks start from a set of role counts and fill the remaining slots with their theme.
          These counts are common starting points, not rules; change them in the builder sidebar.
        </p>
        <GlossaryList entries={roles} counts={targetKeys.map((key) => defaultDeckTargets[key])} />
        <h3>Power and brackets</h3>
        <GlossaryList
          entries={[
            formatTerms.bracket,
            formatTerms.gameChanger,
            appTerms.power,
            appTerms.priority,
          ]}
        />
        <h3>How this app helps</h3>
        <p>
          Choose a commander and theme, then build in batches. The sidebar tracks your role targets,
          and Deck review looks for possible gaps.
        </p>
        <GlossaryList entries={[appTerms.theme, appTerms.extraTheme, appTerms.batch]} />
        <div className="export-actions">
          <span />
          <button className="primary" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  )
}

/** Start's dismissible invitation to the primer. */
export function NewToCommanderCard({ open, dismiss }: { open: () => void; dismiss: () => void }) {
  return (
    <section className="primer-card" aria-labelledby="primer-card-title">
      <div>
        <h2 id="primer-card-title">New to Commander?</h2>
        <p>Learn the format basics, the usual deck skeleton and how this builder helps.</p>
        <button className="primary" type="button" onClick={open}>
          Read Commander basics
        </button>
      </div>
      <ModalCloseButton label="Dismiss New to Commander" onClick={dismiss} />
    </section>
  )
}
