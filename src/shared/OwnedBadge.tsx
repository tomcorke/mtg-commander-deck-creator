import { isOwned, type OwnedQuantities } from '../domain/owned-cards.ts'

/** Marks a card the player owns, by name; nothing when they do not own it. */
export function OwnedBadge({ owned, name }: { owned: OwnedQuantities | undefined; name: string }) {
  return isOwned(owned, name) ? <span className="owned-badge">Owned</span> : null
}
