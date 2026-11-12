import type { ReactNode } from 'react'

import { commanderPageSize, type usePartnerDiscovery } from '../app/useCommanderDiscovery.ts'
import { toDeckCard, type DeckCard, type ScryfallCard } from '../domain/card-model.ts'
import { pairingLabel } from '../domain/commander-pairing.ts'
import { CommanderChoiceTile, CommanderTilePlaceholders } from './CommanderChoice.tsx'
import { ManaSymbols } from './ManaSymbols.tsx'
import { Pagination } from './Pagination.tsx'

/**
 * Legal second commanders for one commander: a count line, the tile grid and its pages. Each tile
 * shows the pair's combined colour identity. Shared by Start's partner step and Change commander.
 */
export function PartnerChoices({
  first,
  discovery,
  openCard,
  action,
  note,
  selected,
}: {
  first: ScryfallCard
  discovery: ReturnType<typeof usePartnerDiscovery>
  openCard: (card: DeckCard) => void
  action: (card: ScryfallCard) => ReactNode
  note?: (card: ScryfallCard) => ReactNode
  selected?: string
}) {
  const leader = toDeckCard(first)
  const together = (card: ScryfallCard) =>
    ['W', 'U', 'B', 'R', 'G'].filter(
      (colour) => first.color_identity.includes(colour) || card.color_identity.includes(colour),
    )
  return (
    <>
      <p className="change-commander-count" role="status">
        {discovery.status === 'loading' && 'Finding legal partners…'}
        {discovery.status === 'idle' &&
          discovery.count > 0 &&
          `${discovery.count}${discovery.more ? ' loaded' : ''} legal ${discovery.count === 1 ? 'partner' : 'partners'} for ${pairingLabel(leader)}`}
      </p>
      <div className="commander-grid" aria-busy={discovery.status === 'loading'}>
        {discovery.status === 'loading' && <CommanderTilePlaceholders />}
        {discovery.suggestions.map(({ card }) => (
          <CommanderChoiceTile
            key={card.oracle_id ?? card.name}
            selected={selected === card.name}
            card={card}
            openCard={openCard}
            action={action(card)}
            note={
              <>
                <p className="partner-identity">
                  Together{' '}
                  {together(card).length ? <ManaSymbols symbols={together(card)} /> : 'colourless'}
                </p>
                {note?.(card)}
              </>
            }
          />
        ))}
      </div>
      {discovery.status === 'error' && (
        <p className="form-error discovery-error" role="alert">
          {discovery.error} Skip the partner, or reload the page.
        </p>
      )}
      {discovery.status === 'idle' && !discovery.count && (
        <p className="discovery-status" role="status">
          No legal partners found. Skip to lead alone.
        </p>
      )}
      {discovery.status === 'idle' && (
        <Pagination
          label="Partner result pages"
          noun="partners"
          count={discovery.count}
          pageSize={commanderPageSize}
          page={discovery.page}
          onPage={discovery.setPage}
          partial={discovery.more}
        />
      )}
    </>
  )
}
