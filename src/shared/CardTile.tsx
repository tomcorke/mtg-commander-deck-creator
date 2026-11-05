import type { ReactNode } from 'react'
import { OracleText } from './ManaSymbols.tsx'

/**
 * Shared card tile for the start, search and review grids. Every tile puts the
 * selection control on top, then art, state badges, one name + cost line, one
 * muted detail line, extras and actions, so the screens read as one tool.
 * Recommendation offers stay separate.
 */
export function CardTile({
  size = 'medium',
  className = '',
  selected = false,
  selection,
  art,
  badges,
  name,
  cost,
  detail,
  children,
  actions,
}: {
  size?: 'small' | 'medium'
  className?: string
  selected?: boolean
  selection?: ReactNode
  art: ReactNode
  badges?: ReactNode
  name: ReactNode
  cost?: string
  /** One muted line: type line, reason or fit. */
  detail?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <article
      className={`card-tile card-tile--${size}${selected ? ' selected' : ''} ${className}`.trim()}
    >
      {selection && <div className="card-tile-select">{selection}</div>}
      {art}
      <div className="card-tile-caption">
        {badges && <div className="card-tile-badges">{badges}</div>}
        <div className="card-tile-title">
          {name}
          <span className="card-tile-cost">{cost && <OracleText text={cost} />}</span>
        </div>
        {detail && <p className="card-tile-detail">{detail}</p>}
        {children}
      </div>
      {actions && <div className="card-tile-actions">{actions}</div>}
    </article>
  )
}
