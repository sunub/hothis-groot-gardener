# design-sync notes

Project: https://claude.ai/design/p/86e68d77-7951-41ee-9223-102fa3aef808 (Space Garden UI). Config home is the repo root; the package dir is `apps/web`.

## How this repo is built for sync

- No `dist/` and no Storybook, so the converter bundles `apps/web/src/ds-entry.ts` (a barrel of the 19 reusable UI exports). Pass it with `--entry apps/web/src/ds-entry.ts` and `--node-modules node_modules` (repo root, where `react` is hoisted).
- `componentSrcMap` pins every component; without it the synth scan would pull in screens and server code. Add a new component to both `ds-entry.ts` and `componentSrcMap`.
- No shipped types, so `dtsPropsFor` holds the hand-written props for all 19 components. Update it when a component's props change.
- Tailwind v4 CSS is compiled before the build: `cd apps/web && ../../.ds-sync/node_modules/.bin/tailwindcss -i src/styles/ds-entry.css -o .ds-css/compiled.css`. `cssEntry` points at that output (gitignored). Rerun it whenever component classes or `.design-sync/previews/` change, since the `@source` globs include both.
- Fonts come from a Google Fonts `@import` in `ds-entry.css` (`[FONT_REMOTE]` is expected). The app loads them with next/font; the variables `--font-pixelify`, `--font-dot`, `--font-vt323`, `--font-noto-kr` are set in `ds-entry.css`.
- Staged tools live in `.ds-sync/` (gitignored); playwright is installed there for the render check.

## Manual step before every upload

`PixelIcon` loads `/icons/<name>.png`, which does not exist in a card. The two icon previews rewrite those paths to `../../../_preview/icons/`, so copy the icons into the bundle after each build and upload them with it:

`mkdir -p ds-bundle/_preview/icons && cp apps/web/public/icons/*.png ds-bundle/_preview/icons/`

Without this the reconciliation step deletes them from the project and the icon cards break.

## Known render warns

- Skeleton blinks in steps, so its screenshot can be faint.
- Unauthored floor cards: none. All 19 components have authored previews.

## Re-sync risks

- Icons: Claude Design designs that use `PixelIcon` or `VerdictBanner` show broken images unless `/icons/*.png` is served at the site root. Documented in `conventions.md`.
- `LocaleProvider` is in `cfg.provider` and exported from `ds-entry.ts` but excluded from the component list (`componentSrcMap: null`). The i18n dictionaries are bundled, so a large dictionary change grows `_ds_bundle.js`.
- Grades live in `.design-sync/.cache/review/` (gitignored). The uploaded `_ds_sync.json` is what lets another machine skip re-verification.
- Not synced: `AppShell` (uses next/link), `StateHistoryChart` (recharts), `LanguageSwitch`, and all grow-room screens.
- Verified only at the component level. No screen composition (grow room, crisis, harvest) is in the project.
