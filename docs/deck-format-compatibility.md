# Deck import and export compatibility

Checked 2026-10-26 for issue #178. These are app workflows and dated provider observations, not Commander rules.

## Moxfield to this app

Open the deck’s **Download** menu, choose **Copy for Moxfield**, and paste into **Import deck**. If the list has no commander heading, choose its commander and optional second commander in the app, then import. No text editing is required. The app still validates the chosen cards and pairing.

The public [Building The Star Fleet deck](https://moxfield.com/decks/VTmhs1V24kmLHJBYCbbWIA) supplied the untouched `178-moxfield-*.txt` fixtures in `scripts/fixtures/`. They were captured from the native Export Options dialog’s `full`, `mtga`, `mtgo`, and `plaintext` textareas through a working browser UI. The page identifies one commander and 100 total cards; these fixtures contain 91 distinct card rows including six Forests, four Islands, and two Plains. This is a mutable public sample, not an official decklist.

- **Copy for Moxfield:** 100 cards, set and collector numbers included; commander first without a role marker. Before this fix, parsing recovered the cards but import rejected them with “Mark commander with a COMMANDER section.” Explicit selection now assigns that role without changing quantities or printings.
- **Copy for MTGO / Copy Plain Text:** 100 cards, no printings, commander after a blank line. The app does not infer roles from blank lines; choose commanders explicitly.
- **Copy for Arena:** the dialog reported 33 unsupported cards; its export contained 67 cards and omitted this commander. Do not use this option to transfer a complete Commander deck. The app cannot recover cards omitted by the source.

The fixture checks exercise parsing and designation, not live Scryfall resolution of every card in this mutable deck. Synthetic tests separately cover paired selections, foil/etched markers, sideboard preservation, and invalid selections. This native sample has no sideboard or foil markers, so it does not establish those Moxfield export behaviors.

Run `node --experimental-strip-types scripts/check-deck-import-browser.ts` for the complete modal-to-action regression, including the “import found cards” retry. It uses synthetic provider records and sandboxed Chrome through the existing browser harness, and verifies a successful four-card import in the builder.

## This app to Moxfield

Choose the app’s **Moxfield** export. Create a Commander deck in Moxfield, select its commander(s), and paste the app’s mainboard list into the existing-list field. The app export omits commanders and includes a `SIDEBOARD:` section when applicable. The modal warns that commander selection is a separate action.

Moxfield’s [Creating Decks help](https://moxfield.com/help/help-articles/creating-decks), read in the live browser on 2026-10-26 (article dated 2026-06-16), documents quantity/name with optional set, collector number, and `*F*`. This agrees with the app’s mainboard serialization. The inspected browser was signed out; creating/importing a deck requires login. **A reverse live import, sideboard treatment, and etched-marker treatment were not verified.** Do not treat agreement with documented syntax or an app-only round trip as proof of that workflow. [Issue #12](https://github.com/tomcorke/mtg-commander-deck-creator/issues/12) retains the native commander-import check; #178 remains open until its external compatibility gates are satisfied.

## Other advertised formats and limitations

- **Plain text:** the app’s heading-based format preserves quantities, commander roles, sideboard, and finish markers. It omits set/collector numbers. It is not a verified universal deck-site interchange format.
- **CSV:** the app’s own `Quantity,Name,Set,Collector Number,Foil,Board` schema preserves those fields, including quoted names. A leading BOM or whitespace previously caused zero parsed cards; regression tests now cover both. Other sites’ deck/collection CSV schemas are unsupported.
- **Archidekt:** URL import is unsupported. Native custom-category text exports are not verified or supported; convert to the heading syntax shown in the import dialog. No new Archidekt compatibility is claimed. The older collection investigation in `docs/a13-collection-import-investigation.md` concerns collection formats, not proof of deck interoperability.
- **URLs:** all URL import remains unavailable in this client-only app. Paste text instead. This is an app limitation, not a claim that every provider blocks every browser request.
- Categories, tokens, companions, primers, and other metadata are outside the app’s deck-list schema. Use supported board headings; unsupported metadata is not preserved.

No claim of compatibility is made for other deck sites. Shared provider knowledge worth retaining: Moxfield’s native export layouts and Arena filtering observation; knowledge-base persistence is a follow-up and does not broaden this app change.
