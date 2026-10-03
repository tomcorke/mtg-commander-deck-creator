# A14: autosave design and browser handoff

## Storage and ownership

Each workspace writes only `commander-autosave:<workspace-id>`. The current id lives in `sessionStorage` under `commander-workspace`. Manual saves remain under `commander-saved-decks`; autosaving, migration, and retention never write that key.

A fresh tab copies the latest draft. Reload reuses the tab's workspace. A duplicated tab that inherits the same session id copies that workspace into a new id before writing. Opening any draft from the picker also makes a copy, whether its original is active or inactive. Copies lose their manual-save association, so editing a copy cannot silently become an overwrite of the original named save. Starting a new deck or loading a manual save creates another workspace and retains the previous autosave subject to the configured limits.

Two changes from the coordinator's suggested mechanism address concrete races:

- **Web Locks own workspaces.** A BroadcastChannel ownership ping can miss a frozen tab, and two simultaneous duplicate startups can both time out before either answers. An exclusive, non-waiting Web Lock makes ownership atomic. BroadcastChannel is used only to refresh other tabs' draft lists; storage events and focus provide additional refresh paths. Cleanup must acquire the candidate's lock before deleting it, so a stale presence list cannot authorize deletion. No liveness timeout is used.
- **Session recovery covers reload handover.** Reload releases the old page's lock before the new page claims it. Another tab could prune that temporarily inactive autosave in between. One validated recovery copy in `commander-workspace-recovery` survives that gap and restores the tab's own deck, not the origin's latest deck. A new empty workspace clears that copy. A cached page reloads on `pageshow` before it can write again.

Without Web Locks, every page load forks into a fresh id and automatic cleanup is disabled. The picker explains that cleanup is unavailable; writes are never shared. Failed storage writes display an export warning. Legacy migration writes and validates its replacement before removing `commander-deck-state`; a failed migration retains and restores the legacy deck.

Retention defaults to 10 drafts and seven days. Limits are shared across tabs and apply at startup, after new or changed autosaves, and when applied in the picker. Live workspaces can exceed both limits. The picker lists drafts separately from manual saves, with commander previews, card counts, relative saved times, and exact timestamp tooltips. Unchanged reloads do not advance the saved time.

## Automated gate

`src/autosaves.test.ts` uses independent session stores, shared origin storage, an atomic Web Locks stub, and BroadcastChannel stubs. Its go/no-go check passed before retention was added. Tests cover concurrent edits and reloads, simultaneous duplicate startup, active and inactive draft copies, migration and failed writes, retention boundaries, suspended owners, reload/prune handover, manual-save separation, picker notifications, and recovery after a previous recommendation error.

Pi did not run interactive browser checks or verify rendered appearance. The browser portion of the go/no-go gate remains mandatory before merge.

Existing out-of-scope boundary: the commander-printing effect does not cancel its foreground requests when decks change. This branch disables picker deck opens during recommendation loading but does not add general foreground-request cancellation.

## Opus browser scenarios

Use an unused port in 5200–5299. Use a disposable browser profile or back up existing storage before migration and retention tests.

1. Build deck A and add cards. Open a fresh tab B at the same origin. Check B's notice names the automatically restored commander, card count, and saved time, and offers both another draft and a new deck before editing. Verify notice dismissal does not remove recovery data.
2. In B, start a different deck and make different additions/decisions. Alternate edits between A and B. Reload both tabs, including simultaneous reloads. Each must recover its own commander, main deck, sideboard, and recommendation choices. Check session ids differ and each tab updates only its own autosave key.
3. Use the browser's Duplicate tab command on A. Verify the duplicate says it edits its own copy and receives a new id. Edit both copies and reload them. Repeat while A is hidden, and with a browser-frozen original if available. Neither may overwrite the other.
4. In B's picker, open A's active draft. Confirm the active label explains copying, the new copy edits independently, and B's previous deck remains listed. Close A and open its inactive draft; this must also make a copy rather than reuse A's key.
5. Create a named manual save. Confirm manual saves have their own section and explicit overwrite/delete controls. Auto-edit, copy, start a new deck, apply retention, and reload. None of those operations may change the manual-save record. Loading a manual save must create a workspace without erasing the prior draft.
6. With A and B live, set the maximum to one. Both live recovery points must remain, even if older than the age limit. Create several inactive drafts, close their owners, then apply limits or edit a live deck. Eligible oldest/expired drafts should disappear; live drafts and manual saves must remain. Confirm the settings survive reload and appear in the other tab.
7. Exercise reload handover with the maximum at one: release a tab's workspace, let another tab prune its origin record, then reload the original tab with its session storage intact. The session recovery point must restore its own deck and recreate its autosave, not load the other tab's deck.
8. Seed a valid legacy `commander-deck-state` record and load two tabs together. Verify one migrated recovery entry, distinct working copies, and deletion of the legacy key only after the migrated entry exists. Repeat with writes denied/quota exhausted: the legacy recovery must survive and an export warning must appear.
9. Check the notice and picker in light, dark, commander-themed, and narrow layouts. Tab/Shift+Tab must stay inside the picker, Escape/backdrop/close must dismiss it, and focus must return to the opener. Commander thumbnails must enlarge from hover/focus and open card details, including when the picker is opened from the start screen. The current draft's Open action must also work from the start screen. Check number-input labels, limits, validation, and saved-time tooltips.
10. Navigate away and back, including browser Back/Forward cache restoration. Ownership must be reacquired before edits. Disable Web Locks in a disposable test context: duplicate/reload must fork safely, and cleanup must remain disabled with an explanation.
