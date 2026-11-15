# Space Garden UI: conventions

Dark pixel UI for a lettuce-growing simulator. Components are React; styling is Tailwind v4 utility classes plus a small set of `pixel-*` utilities. There is no light theme.

## Setup

- Load `styles.css` first. It brings the tokens, the `pixel-*` utilities, the Google pixel fonts (Pixelify Sans, VT323, DotGothic16, Noto Sans KR) and the compiled component CSS. Without it everything renders as unstyled boxes in a system font.
- Set the page to the dark ground: `className="bg-bg text-ink"` on the root. Components assume this ground; on white they look broken.
- Wrap the app in `SpaceGarden.LocaleProvider`. `ZoneBadge`, `ValueTypeTag`, `VerdictBanner` and `SourceCitation` read their words from it and throw without it.
- `PixelIcon` loads `/icons/<name>.png` from the site root. Serve the 12 PNGs there, or icons (and the icon in `VerdictBanner`) show as broken images.

```jsx
const { LocaleProvider, Card, CardHeader, CardTitle, ValueTypeTag, Meter, Button } = window.SpaceGarden;
<LocaleProvider>
  <div className="bg-bg p-6 text-ink">
    <Card tone="accent" className="flex w-96 flex-col gap-4">
      <CardHeader>
        <CardTitle>Plant status</CardTitle>
        <ValueTypeTag type="game_value" />
      </CardHeader>
      <Meter value={78} tone="health" aria-label="Plant health" />
      <Button variant="primary">End day</Button>
    </Card>
  </div>
</LocaleProvider>
```

## Styling idiom

Utility classes on tokens, not raw hex. Layout glue uses ordinary Tailwind (`flex`, `grid`, `gap-4`, `p-6`); color and type use the token names below.

- Color utilities: `bg-bg`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `text-accent`, `text-normal`, `text-caution`, `text-danger`, `text-measured`, `text-game`. Meter and data hues: `health`, `water`, `humidity`, `micro`.
- Type: `font-title` (Pixelify, headings and body), `font-data` (VT323, numbers and tags). Sizes: `text-caption`, `text-body`, `text-control`, `text-heading`, `text-display`, and `text-data-sm`, `text-data`, `text-data-lg`, `text-data-xl` for VT323. Never go below `text-data-sm` on VT323.
- Frames are not borders. Use `pixel-frame` (notched), `pixel-frame-flat`, `pixel-frame-thin` with a tone: `pixel-tone-line`, `pixel-tone-accent`, `pixel-tone-normal`, `pixel-tone-caution`, `pixel-tone-danger`, `pixel-tone-measured`. Other pieces: `pixel-raised`, `pixel-bar`, `pixel-dashed`, `pixel-segments`, `pixel-hatch`, `pixel-art` (crisp image scaling).
- Panels carry a 4px outer margin for the frame (`m-1`); keep it, or frames get clipped.
- A state is never told by color alone: pair zone and verdict colors with a symbol and words (`✓ △ ✕`), as `ZoneBadge` and `VerdictBanner` do.

## Where the truth lives

Read `styles.css` and `_ds_bundle.css` for the tokens and utilities, and each component's `<Name>.d.ts` and `<Name>.prompt.md` for its props and usage. Screen copy is English; Korean swaps Noto Sans KR for the pixel faces.
