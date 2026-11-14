/**
 * Committed EDHREC response bodies are forbidden (#309). This finds them in tracked text.
 *
 * - A page body has the quoted `json_dict` key, raw or JSON-escaped inside a stored envelope.
 *   Hand-authored fixtures pass only when the file says `synthetic EDHREC fixture`.
 * - A dev-replay entry stores an EDHREC URL beside base64 `bytes`; it is never exempt.
 */
const pageBody = /\\?"json_dict\\?"\s*:/
const replayEntry = /"url"\s*:\s*"https:\/\/json\.edhrec\.com\//
export const syntheticMarker = /synthetic EDHREC fixture/i

export function edhrecBodyReason(text: string) {
  if (replayEntry.test(text) && /"bytes"\s*:/.test(text)) return 'dev-replay EDHREC entry'
  if (pageBody.test(text) && !syntheticMarker.test(text)) return 'EDHREC page body'
}
