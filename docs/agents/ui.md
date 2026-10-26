# UI consistency

Read this before changing UI, buttons, dialogs, forms, or CSS.

## Reuse first

- Search `src/features/` and `src/shared/` for an existing component, and `src/styles/` for an existing class before adding UI. Reuse complete components across screens; if the same section exists only as inline markup, extract it once and render it in both places.
- Reuse the existing component or class for the job: `.primary` for the main action, `.export` for header actions, `ModalCloseButton` from `src/shared/CardDetails.tsx` for dialog dismissal, and `.actions button` for recommendation decisions.
- Model content or semantic differences, such as heading level or available actions, as props. Keep shared structure and base sizing in the component; add screen-specific styles only for deliberate visual variants.
- Compare shared components across routes during rendered review. Typography and spacing stay consistent unless an intentional variant requires otherwise.
- Keep styles in the owning `src/styles/` file; every new surface and control needs light and dark states.
- Text inputs, selects and textareas take border, background, text colour and font from the `--input-*` tokens in `src/styles/base.css`. Component rules set only size, spacing and radius; never set an input's colours per component unless it is a deliberate themed variant built on CSS variables.

## Card references and layouts

- Render card names with the shared `CardReference` component: hover or keyboard focus previews the card image; activation opens that card's details. Use the deck/sideboard location when the card is present and a read-only detail view otherwise.
- Card-centric screens show card art and mana context with `ManaSymbols` or `OracleText`; present groups as compact wrapping grids or rails instead of vertical name-only lists.
- Render every displayed mana cost with all its symbols—including generic mana—as icons through `OracleText`. When a full cost is shown, omit separate colour-identity icons. Findings show the full cost rather than identity-only symbols. If identity appears without a cost, use icons without repeating colour names; keep names in icon alt text. Omit derived `MV` totals when full costs are shown.
- Full-page builder modes reuse `CommanderCardArt` and `CommanderSummary` for commander context; preserve shared sizing, printing switches, and face-flip controls.
- Small card images enlarge on hover or keyboard focus, triggered from the image itself as well as card-name references.
- Show both card images in comparisons and label which card is currently in the deck. Reflow the pair on narrow screens.

## Buttons

- Set `type="button"` unless the button submits a form.
- Use `ModalCloseButton`; it applies `.modal-close`, an `aria-label`, and `×` for dialog close controls. Do not create a text-only or browser-default close button.
- Use an existing action style instead of copying padding, borders, colors, or hover rules into JSX or a new selector. `.primary` is a filled theme-accent action in light, dark, and commander-themed states; verify its rendered colors, not only its class name.
- Give icon-only buttons an accessible name and keep visible keyboard focus.
- Choose the style by what the button does:
  - `.primary`: the main action in a region, such as the confirming action in a dialog, Search, or Add on a recommendation offer.
  - `.nav-back` and `.nav-forward`: leaving the page or moving to the next step, such as "Back to builder" or "Next recommendations". Never use `.primary` for navigation. The CSS adds the direction arrow, so leave arrows out of the label.
  - `.export`: secondary actions.
  - Destructive actions such as Delete and Remove: their red outline style, never filled.
  - Toggles and segmented choices: a selected state, not `.primary`.

## Dialogs and modes

- Use `.modal-backdrop` plus `.export-modal` or an existing modal variant for focused tasks. Do not insert a dialog into normal page flow.
- Dense workflows use a full-page mode with direct entry from the related builder screen and clear navigation back; do not squeeze them into a small modal.
- Keep recommendation preferences in the `Recommendation settings` modal; the page should show only its button and a compact summary.
- Give dialogs `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`; support Escape and backdrop dismissal when the dialog allows it.
- Reuse the existing modal heading and close-button pattern so dialogs behave and look alike.

## Popovers

- Reuse the `.action-help-wrap` / `.action-help` pattern when possible.
- Keep each trigger and popover in a real `position: relative` wrapper or its local positioned setting row. Position the popover with `position: absolute` so showing it never changes layout or pushes nearby content.
- Show popovers on wrapper hover and trigger `:focus-visible`; use `role="tooltip"` and `aria-describedby` for keyboard and screen-reader users.
- Match existing flat surfaces, borders, colors, and motion. Add no gradients or entrance animation unless the design explicitly calls for them.
- Check placement against nearby labels in light, dark, and narrow layouts. Anchor the popover away from the setting text and keep it inside the modal viewport.

## Review gate

Before handoff, inspect the rendered path in light and dark modes and at a narrow viewport. Verify card names preview and open details, small images enlarge from image hover/focus, comparisons show both images and identify the in-deck card, and buttons use shared theme styles. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`. When a change renders card names, also run `pnpm check:card-references:browser`; it fails on any visible card name outside `CardReference`.
