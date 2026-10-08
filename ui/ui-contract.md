# UI kit contract

Copy the `ui/` directory into another static project. Load the kit with:

```html
<link rel="stylesheet" href="ui/ui.css">
```

The kit has three layers:

1. **Design language** — `styles/tokens.css`, `styles/base.css`, `styles/components.css`
2. **Theme** — `themes/*.css` color values only
3. **Application** — this editor's shell lives in `styles/app.css` and `scenePalette.js`. Load `styles/app.css` from the app, not from `example.html`.

## Themes

`ui.css` loads `light` (default) and `dark`. Switch with `data-theme` on `<html>`:

```html
<html data-theme="light">
<html data-theme="dark">
```

Use `ui-theme-toggle` for an icon-only light/dark switch. Add a theme by creating `themes/<name>.css` with `[data-theme="<name>"] { ... }`, defining every `--ui-*` color listed in `styles/tokens.css`, then importing the file from `ui.css`.

Do not put colors in components. Override theme values, not class rules.

## Components

Use `ui-button`, `ui-button--secondary`, `ui-button--ghost`, `ui-panel`, `ui-hint`, `ui-kicker`, `ui-input`, `ui-textarea`, `ui-icon`, `ui-icon-button`, `ui-pane-heading`, `ui-pane-heading-meta`, `ui-prose`, `ui-segment`, `ui-segment__btn`, `ui-segment__btn--active`, `ui-chip-group`, `ui-chip`, `ui-chip--active`, and `ui-theme-toggle`.

Open `example.html` for a product-neutral preview with a theme switch.
