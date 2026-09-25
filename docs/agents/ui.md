# UI consistency

Read this before changing UI, buttons, dialogs, forms, or CSS.

## Reuse first

- Search `src/features/` and `src/shared/` for an existing component, and `src/styles/` for an existing class before adding markup or a selector.
- Reuse the existing component or class for the job: `.primary` for the main action, `.export` for header actions, `ModalCloseButton` from `src/shared/CardDetails.tsx` for dialog dismissal, and `.actions button` for recommendation decisions.
- Put shared behavior in the shared component or class. Add a one-off class only when the element has a genuinely different job.
- Keep styles in the owning `src/styles/` file; every new surface and control needs light and dark states.

## Buttons

- Set `type="button"` unless the button submits a form.
- Use `ModalCloseButton`; it applies `.modal-close`, an `aria-label`, and `×` for dialog close controls. Do not create a text-only or browser-default close button.
- Use an existing action style instead of copying padding, borders, colors, or hover rules into JSX or a new selector.
- Give icon-only buttons an accessible name and keep visible keyboard focus.

## Dialogs

- Use `.modal-backdrop` plus `.export-modal` or an existing modal variant. Do not insert a dialog into normal page flow.
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

Before handoff, inspect the rendered path in both light and dark modes and check that new buttons use a shared class. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
