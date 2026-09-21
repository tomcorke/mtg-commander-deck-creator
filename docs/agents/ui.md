# UI consistency

Read this before changing UI, buttons, dialogs, forms, or CSS.

## Reuse first

- Search `src/App.tsx` and `src/App.css` for an existing component or class before adding markup or a selector.
- Reuse the existing component or class for the job: `.primary` for the main action, `.export` for header actions, `ModalCloseButton` for dialog dismissal, and `.actions button` for recommendation decisions.
- Put shared behavior in the shared component or class. Add a one-off class only when the element has a genuinely different job.
- Keep light and dark styles together in `src/App.css`; every new surface and control needs both states.

## Buttons

- Set `type="button"` unless the button submits a form.
- Use `ModalCloseButton`; it applies `.modal-close`, an `aria-label`, and `×` for dialog close controls. Do not create a text-only or browser-default close button.
- Use an existing action style instead of copying padding, borders, colors, or hover rules into JSX or a new selector.
- Give icon-only buttons an accessible name and keep visible keyboard focus.

## Dialogs

- Use `.modal-backdrop` plus `.export-modal` or an existing modal variant. Do not insert a dialog into normal page flow.
- Give dialogs `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`; support Escape and backdrop dismissal when the dialog allows it.
- Reuse the existing modal heading and close-button pattern so dialogs behave and look alike.

## Review gate

Before handoff, inspect the rendered path in both light and dark modes and check that new buttons use a shared class. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
