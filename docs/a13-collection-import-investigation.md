# A13: Collection import investigation

Investigated on 2026-10-03 against `8fb3326`. This report does not implement collection import.

## Recommendation

**No-go for implementation under A13's gate; keep set-based selection.** Parsing CSV locally is feasible, and normalizing double-face names raised the supplied sample's name match rate above 98%. However, no native collection export was obtained from any of the four providers. Compatibility layouts and exporter source code are useful evidence, but they do not prove that each current export parses correctly.

The unmodified lookup resolved **104/108 names (96.30%)**. Submitting the existing `cardNameKey(name)` instead resolved **107/108 (99.07%)**. Printing identifiers resolved **108/108**, but printing recovery does not count toward the name-only threshold. These measurements use the existing user-supplied Anikthea deck as a collection proxy, not a representative collection.

Reconsider after obtaining anonymized, untouched collection exports from all four tools, including both ManaBox export variants and an Archidekt export with optional fields changed. Repeat the checks below on those files. Approve implementation only when every native format parses without losing records and the sample collection reaches at least 98% by name, with misses visible to the player.

## Sources and sample formats

### What was verified

| Tool      | Source                                                                                                                            | Evidence and limits                                                                                                                                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moxfield  | [Archidekt's compatibility map][archidekt-app], module `77552`, `moxfield`                                                        | A 13-column import layout: quantity, ignored field, name, set code, condition, language, finish, two ignored fields, collector number, three ignored fields. This is Archidekt's compatibility assumption, not Moxfield's current export contract.             |
| Archidekt | [Collection exporter bundle][archidekt-export] and [data-viewer bundle][archidekt-data]                                           | The exporter lets players choose fields. Its default request has 13 fields; the data viewer requests 31. Both download CSV. Field order is observable; the server's actual CSV header labels and a native exported file were not obtained.                     |
| ManaBox   | [Official collection guide][manabox] and [Archidekt's compatibility map][archidekt-app], `manaBox` / `manaBoxThicc`               | The guide confirms whole-collection and individual binder/list CSV exports. Whole-collection exports include binder/list names and card properties. The compatibility map distinguishes 15-column single-binder and 17-column whole-collection layouts.        |
| Deckbox   | [Official export guide][deckbox], [export UI source][deckbox-code], and [Archidekt's compatibility map][archidekt-app], `deckbox` | Deckbox documents comma-delimited UTF-8 CSV. Its UI offers CSV and text export. The compatibility map has 19 CSV columns. A public deck's text export was obtained; a CSV request redirected to login. This does not establish a native collection CSV sample. |

Moxfield's public home/[help](https://moxfield.com/help) pages returned a Cloudflare block page. Archidekt's [collection landing page](https://archidekt.com/collection) required login; its public JavaScript supplied the field evidence above. Deckbox's CSV route required login even for the public list inspected. No login, account creation, or access-control workaround was attempted. ManaBox's guide supplied documentation, not a downloadable sample file.

Archidekt's default requested fields, in order, are:

```text
quantity, card__oracleCard__name, modifier, condition, createdAt,
language, purchasePrice, tags, card__edition__editionname,
card__edition__editioncode, card__multiverseid, card__uid,
card__collectorNumber
```

The data-viewer export adds fields such as Oracle ID, colours, types, mana value, and prices. Therefore, one fixed positional Archidekt parser would not cover both exports or player-selected fields. The names above are API field keys, not verified CSV header labels.

### Constructed CSV probes

The following are **constructed, data-only rows**, not downloaded provider exports. Unused fields are empty. Positions come from the sources above; they do not establish actual header names or the meaning of ignored columns.

Moxfield compatibility layout:

```csv
"1","","Anikthea, Hand of Erebos","cmm","","","","","","705","","",""
```

Archidekt default requested-field order:

```csv
"1","Anikthea, Hand of Erebos","","","","","","","","cmm","","","705"
```

ManaBox single binder:

```csv
"Anikthea, Hand of Erebos","cmm","","705","","","1","","","","","","","",""
```

ManaBox whole collection:

```csv
"","","Anikthea, Hand of Erebos","cmm","","705","","","1","","","","","","","",""
```

Deckbox compatibility layout:

```csv
"1","","Anikthea, Hand of Erebos","","cmm","705","","","","","","","","","","","","",""
```

Each layout was populated with all 108 entries from [`scripts/fixtures/a6-anikthea.txt`](../scripts/fixtures/a6-anikthea.txt), preserving name, quantity, set code, and collector number. A throwaway JavaScript quote-aware CSV scanner ran under Node 22.19.0. Its parsing function used only strings and arrays, with no Node, network, or server API. Input included a UTF-8 BOM, quoted fields, and CRLF record separators. Assertions checked record widths and equality of all four recovered fields, including single-slash double-face names and `PLST` collector numbers such as `CM2-235`.

| Constructed layout        | Columns | Name / quantity / set code / number positions (1-based) | Records recovered | Fields preserved |
| ------------------------- | ------: | ------------------------------------------------------- | ----------------: | ---------------- |
| Moxfield compatibility    |      13 | 3 / 1 / 4 / 10                                          |         108 / 108 | Yes              |
| Archidekt default request |      13 | 2 / 1 / 10 / 13                                         |         108 / 108 | Yes              |
| ManaBox single binder     |      15 | 1 / 7 / 2 / 4                                           |         108 / 108 | Yes              |
| ManaBox whole collection  |      17 | 3 / 9 / 4 / 6                                           |         108 / 108 | Yes              |
| Deckbox compatibility     |      19 | 3 / 1 / 5 / 6                                           |         108 / 108 | Yes              |

Separate syntax assertions passed for commas inside names, escaped quotes, embedded newlines, Unicode, LF/CRLF/CR separators, and a missing final newline. Unclosed quotes, quotes inside unquoted fields, and text after a closing quote were rejected. For example:

```csv
Name,Quantity,Note
"Jötun Grunt",2,"gift, ""foil""
keep"
```

This recovered one data record with name `Jötun Grunt`, quantity `2`, and note `gift, "foil"\nkeep`. This is a syntax probe, not a provider export. Header mapping, reordered/omitted provider columns, native finish values, and malformed quantities were not validated against real exports.

### Text formats

The existing [`parseDeckList`](../src/deck-import.ts) accepts quantity-prefixed lines, optional `x`, `(SET) number` or `[SET:number]`, finish markers, and deck section headings. It parsed the supplied fixture into **108 records / 108 copies**, retaining printing identifiers. For example:

```text
1 Anikthea, Hand of Erebos (CMM) 705 *F*
1 Accursed Witch / Infectious Curse (SOI) 97
1 Ash Barrens (PLST) CM2-235
```

The [public Deckbox text export][deckbox-text] contains lines such as `12 Forest` and `8 Swamp`, plus a `Sideboard:` heading. Copying its rendered body to plain text yielded **22 records / 76 copies**, all recovered by `parseDeckList`. It is a deck export, not proof of ownership or collection-text export support.

The app's [`deckList`](../src/app/deck-actions.ts) already produces a Moxfield-labelled deck format, but that is local evidence, not confirmation of Moxfield's collection export. ManaBox's guide documents text **import** based on MTGA syntax; it does not establish whole-collection text **export**. Archidekt's [importer bundle][archidekt-import] also advertises quantity-first text, including `1x Sol Ring (C17)`; the current app parser would treat `(C17)` without a collector number as part of the name. Do not claim generic text compatibility from the app's deck parser alone.

## Parsing and matching approach

If the gate passes later:

1. Read a selected file with [`File`/`Blob.text()`][file-api], or take pasted text. Keep file contents local; send only lookup identifiers to Scryfall. No provider API credentials or server-side proxy are needed for this workflow.
2. Use one CSV reader that handles [quoted fields, escaped quotes, and embedded record separators][csv]. JavaScript has no native CSV reader and this repo has no CSV dependency. The investigation scanner is not a production parser. Do not use `split(',')` or split records on newlines before decoding quotes.
3. Map verified header labels to name, quantity, set code, and collector number. Allow extra columns; reject duplicate/ambiguous required headers and inconsistent record widths. The positional layouts above are research clues, not production defaults. Strip a leading BOM; preserve Unicode and collector numbers as strings. Require a nonblank name and a positive safe-integer quantity. An unknown layout must produce an error, not an empty successful import.
4. For supported text dialects, reuse the deck parser's line grammar, but report every unrecognized nonblank line. It currently silently skips them. Do not assume deck/sideboard sections establish ownership; use a collection export and include only owned rows. Do not add trade/wishlist counts to owned quantities without verifying each provider's semantics.
5. Keep source rows for errors and quantity accounting. Normalize names before deduplication **and before submitting identifiers**. `cardNameKey` already collapses single-/double-slash names to the front name for local matching, but the resolver currently sends the original name to Scryfall. Apply that existing key at the import boundary; the measured improvement below requires no fuzzy guessing.
6. Call [`resolveScryfallIdentifiers`](../src/adapters/scryfall.ts) with name-only identifiers for the name-rate measurement. It batches at 75, shares cache/in-flight work, and uses the existing request scheduler. Map results by normalized identity, never by returned array position. A separate printing pass can recover misses with `{set, collector_number}` when available. Label printing recovery separately from name matches.
7. Show recovered, unresolved, and invalid rows before saving. A 98% match rate is not permission to discard the other 2%. Preserve the previous collection if parsing, lookup, or confirmation fails. Do not mutate the deck as an import side effect.

[Scryfall's collection endpoint][collection] accepts up to 75 references and returns `not_found`; missing results disrupt positional mapping. [Rate limits][rates] specify 500 ms spacing for collection requests. All measured requests below used the shared scheduler. The endpoint's live OPTIONS response allowed `POST`, `Content-Type`, and origin `*`; every measured POST also returned `Access-Control-Allow-Origin: *`. This supports client-side lookup, but no browser import workflow was built or exercised.

The existing [`ScryfallIdentifier`](../src/adapters/scryfall.ts) supports names and set/collector-number pairs, **not Scryfall IDs**. ManaBox and Archidekt can include those IDs, but using them would require extending adapter identity, validation, cache keys, and result matching. Do not assume that capability already exists.

## Match-rate evidence

### Sample and denominator

The source is the existing user-supplied [Anikthea fixture](../scripts/fixtures/a6-anikthea.txt), previously recorded in the [A6 investigation](a6-signature-card-investigation.md#supplied-anikthea-deck). It contains 100 commander/mainboard entries and eight sideboard entries. For this investigation, all 108 were treated as inventory rows. Every quantity is one; every name is distinct under `cardNameKey`. Thus unique-name, row, and copy denominators are all 108. No failed name was removed from the denominator.

Fixture SHA-256: `a7028c67eb6e7e58bb45f53c47430a666913eaebeda30f4232bf64102f41b2ef`.

| Cold-cache pass                        | Resolved / submitted | Rate   | Collection POSTs | Meaning                                   |
| -------------------------------------- | -------------------: | ------ | ---------------- | ----------------------------------------- |
| Original names                         |            104 / 108 | 96.30% | 75 + 33          | Direct reuse fails the 98% gate           |
| `cardNameKey(name)` submitted as name  |            107 / 108 | 99.07% | 75 + 33          | Name-only threshold passes on this proxy  |
| Set code and collector number, no name |            108 / 108 | 100%   | 75 + 33          | Printing recovery, not name-only evidence |

All six POSTs returned HTTP 200, without retries. Each pass used a fresh fetcher/cache identity, so later results did not inflate the earlier rate. A separate 12-identifier edge probe made one additional HTTP 200 POST. No broad collection crawl or rate-limit stress test was performed.

The original-name pass missed:

- `Accursed Witch / Infectious Curse`
- `Brightclimb Pathway / Grimclimb Pathway`
- `Katilda, Dawnhart Martyr / Katilda's Rising Dawn`
- `S.H.I.E.L.D. Spy Satellite`

Submitting front-face keys recovered the first three. `S.H.I.E.L.D. Spy Satellite` remained unresolved by name. `{set: 'msc', collector_number: '285'}` returned **Fellwar Stone**, its canonical name. This is why name membership and an owned printing cannot be treated as the same identity.

### Edge-name control

This is a diagnostic set, not an additional sample collection or part of the 98% denominator. Inputs were submitted through `cardNameKey`.

| Inputs                                                                   | Provider response                                 | Existing resolver result     |
| ------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------- |
| `Æther Adept`; `Aether Adept`                                            | Both returned `Aether Adept`                      | First missed; second matched |
| `Ajani’s Pridemate`; `Ajani's Pridemate`                                 | Both returned `Ajani's Pridemate`                 | First missed; second matched |
| `Jötun Grunt`; `Lim-Dûl's Vault`; `Fblthp, the Lost`                     | Canonical names returned                          | All three matched            |
| `Fire // Ice`; `Wear // Tear`; `Bala Ged Recovery // Bala Ged Sanctuary` | Combined names returned for submitted front names | All three matched            |
| `Anneau solaire`; `A13 deliberately nonexistent card`                    | Both in provider `not_found`                      | Both unresolved              |

The provider returned ten card objects and two `not_found` entries. The resolver accepted **8/12**: its local equality check additionally lost the historical ligature and curly-apostrophe inputs despite provider recognition. Do not equate HTTP success or provider object count with usable app matches. Broader normalization, localized names, historical names, and aliases need their own evidence; blanket accent removal or fuzzy matching could hide mistakes. No shared resolver change was made.

### Reproduce the name passes

Run from the repository root after `pnpm install`. This invokes the existing adapter and makes six paced collection POSTs with cold caches. It prints dated measurements rather than asserting provider data will never change.

```bash
node --experimental-strip-types --input-type=module <<'JS'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseDeckList } from './src/deck-import.ts'
import { cardNameKey } from './src/domain/card-model.ts'
import { resolveScryfallIdentifiers } from './src/adapters/scryfall.ts'

const rows = parseDeckList(readFileSync('scripts/fixtures/a6-anikthea.txt', 'utf8')).cards
assert.equal(rows.length, 108)
assert.equal(new Set(rows.map(row => cardNameKey(row.name))).size, 108)
const passes = [
  ['original names', rows.map(({ name }) => ({ name }))],
  ['front names', rows.map(({ name }) => ({ name: cardNameKey(name) }))],
  ['printings', rows.map(({ set, collectorNumber }) => ({ set, collector_number: collectorNumber }))],
]
for (const [label, identifiers] of passes) {
  const batches = []
  const fetcher = (url, init) => {
    batches.push(JSON.parse(init.body).identifiers.length)
    return fetch(url, {
      ...init,
      headers: { ...init.headers, 'User-Agent': 'CommanderCreator-A13-Investigation/1.0' },
    })
  }
  const result = await resolveScryfallIdentifiers(identifiers, fetcher)
  assert.deepEqual(batches, [75, 33])
  console.log(label, result.data.length, '/', rows.length, result.not_found)
  await new Promise(resolve => setTimeout(resolve, 600))
}
JS
```

The CSV layout checks can be repeated by serializing those same 108 rows into the documented widths and positions, quoting fields with doubled internal quotes, adding a BOM and CRLF separators, then comparing decoded name/quantity/set/number tuples with the fixture. Those checks only establish constructed-layout syntax, not native-provider compatibility. Research scripts and raw responses stayed outside Git; the sample rows, field positions, misses, and measurements needed for review are recorded here.

## Reusing Prefer and Only

The existing modes are reusable concepts, not a ready-made owned-card filter:

- [`collectionRecommendations`](../src/app/recommendation-actions.ts) currently builds candidates by searching selected **sets**. Imported membership must instead come from resolved card identities and quantities. Expanding imported rows into their set list would falsely claim ownership of every card in those sets.
- [`collectionScore`](../src/domain/recommendation-scoring.ts) already recognizes `collectionMatch`, so Prefer can mark genuinely owned identities and retain the existing ranking behavior. Keep printing/finish metadata separate from name-level ownership.
- Only needs to draw from the owned pool and reapply Commander legality, colour identity, exclusions, and remaining quantity. Do not silently fall back to all cards if resolution fails. [`Signature enrichment`](../src/domain/signature-recommendations.ts) currently checks allowed set codes in Only mode; it would also need the same owned-membership check.
- [`useCollectionState`](../src/app/useCollectionState.ts) and the [saved-deck schema](../src/deck-state.ts) store selected sets/groups and mode, not imported inventory. Persistence and replacement confirmation would be follow-on work. Quantities must remain meaningful for basics and cards with duplicate-copy exceptions; name deduplication must not discard them.

No candidate filtering, settings, persistence, or UI was changed. Native collection samples, full browser file/paste behavior, large-file responsiveness, and player review remain unverified.

[archidekt-app]: https://cdn.archidekt.com/_next/static/chunks/pages/_app-c6a67c1196c3426d.js
[archidekt-import]: https://cdn.archidekt.com/_next/static/chunks/pages/collections/import-b684d4f0fa9504a5.js
[archidekt-export]: https://cdn.archidekt.com/_next/static/chunks/pages/collection/v2/%5Busername%5D-811331c9bb8c2380.js
[archidekt-data]: https://cdn.archidekt.com/_next/static/chunks/pages/collection/v2/data/%5BuserId%5D-77da127b907ff4f5.js
[manabox]: https://manabox.app/guides/collection/import-export/
[deckbox]: https://deckbox.org/help/exports_and_imports
[deckbox-code]: https://s.deckbox.org/assets/main-6670b20a6ce02c05edce2d364ee27596ab528596863288e786d7de10b575171a.js
[deckbox-text]: https://deckbox.org/sets/4700/export
[file-api]: https://w3c.github.io/FileAPI/#dom-blob-text
[csv]: https://www.rfc-editor.org/rfc/rfc4180#section-2
[collection]: https://scryfall.com/docs/api/cards/collection
[rates]: https://scryfall.com/docs/api/rate-limits
