# Frontend Quality, Accessibility, Performance & Security Audit

> [!NOTE]
> **Measurement environment (Local Lab Benchmark — NOT RUM):**
> All browser metrics below were measured locally against a production Next.js 16.4.6 build (`npm run build` + `npx next start -H 127.0.0.1 -p 3101`, `NEXT_PUBLIC_TIMELINE=1`) using Headless Chromium via Playwright and `@axe-core/playwright` on macOS (Node.js `v24.14.1`). These numbers are **not Real User Monitoring (RUM)** data; real mobile hardware, network latency, Safari, and Firefox can differ.

## Executive Summary (Before → After)

| Check | Before | After | Action Taken |
|---|---:|---:|---|
| 375px Korean horizontal overflow (`/`, `/mission`, `/sources`, `/design-system`) | **+11 px** (`386 px` / `375 px`) | **0 px** (`375 px` / `375 px`, 13/13 checks) | Wrapped `<header>` flex row & nav spacing in [`app-shell.tsx`](../apps/web/src/components/app-shell.tsx) and raised language switch height to `min-h-7` in [`language-switch.tsx`](../apps/web/src/components/language-switch.tsx) |
| WCAG 2.2 AA (`axe-core`: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) | **3 serious rules** (6 nodes across 4 views) | **0 violations** across all 8 audited views | Fixed Recharts focusability, DiaryDrawer Label-in-Name, and danger badge contrast (details below) |
| OWASP security headers (`/`, `/mission`, `/sources`, `/design-system`) | **0 / 6** + `X-Powered-By: Next.js` | **6 / 6** + `X-Powered-By` removed, **0 CSP errors** | Added strict CSP + security headers and `poweredByHeader: false` in [`next.config.ts`](../apps/web/next.config.ts) |
| Unused background assets (`apps/web/public/bg/`) | **4.7 MB** (`public/`: 10 MB) | **1.2 MB** (`-74%`; `public/`: 6.5 MB, `-35%`) | Removed unreferenced `bay.png` (1.7 MB) and `wall.png` (1.8 MB) |
| Automated unit & integration tests (`npm run check`) | 811 tests (48 files) | **812 tests (48 files)**, typecheck + lint + build pass | Added WCAG 2.5.3 Label-in-Name regression test in [`diary-drawer.test.ts`](../apps/web/src/features/timeline/diary-drawer.test.ts) |

---

## 1. Responsive Overflow Verification (1440×900 & 375×812, EN & KO)

Baseline inspection on `375×812` in Korean pinpointed the exact `+10.9 px` (`scrollWidth = 386`) overflow reported in `README.md`: the non-wrapping `<header>` flex row in `apps/web/src/components/app-shell.tsx` combined the Korean app title (`우주 정원 시뮬레이터`) and navigation (`처음으로`, `근거와 출처`, `English`, `한국어`) on a single line.

| Route & Viewport | Locale | Before (`scrollWidth / innerWidth`) | After (`scrollWidth / innerWidth`) |
|---|---|---:|---:|
| `/` Desktop (1440×900) | EN | `1440 / 1440` (0 px) | `1440 / 1440` (0 px) |
| `/` Mobile (375×812) | EN | `375 / 375` (0 px) | `375 / 375` (0 px) |
| `/` Mobile (375×812) | KO | `386 / 375` (**+11 px**) | `375 / 375` (**0 px**) |
| `/mission` Day 1 Desktop (1440×900) | EN | `1440 / 1440` (0 px) | `1440 / 1440` (0 px) |
| `/mission` Day 1 Mobile (375×812) | EN | `375 / 375` (0 px) | `375 / 375` (0 px) |
| `/mission` Day 1 Mobile (375×812) | KO | `386 / 375` (**+11 px**) | `375 / 375` (**0 px**) |
| `/sources` Desktop (1440×900) | EN | `1440 / 1440` (0 px) | `1440 / 1440` (0 px) |
| `/sources` Mobile (375×812) | KO | `386 / 375` (**+11 px**) | `375 / 375` (**0 px**) |
| `/design-system` Desktop (1440×900) | EN | `1440 / 1440` (0 px) | `1440 / 1440` (0 px) |
| `/design-system` Mobile (375×812) | KO | `386 / 375` (**+11 px**) | `375 / 375` (**0 px**) |

---

## 2. WCAG 2.2 AA Accessibility Audit (`axe-core` + Keyboard Verification)

### Automated `axe-core` Violations Caught & Fixed (Before → After)

Tags checked: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

| # | Rule & Criterion | Impact | Affected Views (Before) | Root Cause | Fix & After Result |
|---:|---|---|---|---|---|
| 1 | `aria-hidden-focus` (WCAG 4.1.2) | Serious | `/mission` (Desktop EN & Mobile KO) | Recharts v3 enables `accessibilityLayer` by default, placing focusable elements inside `<div aria-hidden>` in [`state-history-chart.tsx`](../apps/web/src/components/state-history-chart.tsx) (which already renders an `sr-only` data `<table>`). | Set `accessibilityLayer={false}` on `<LineChart>` → **0 violations**. |
| 2 | `label-content-name-mismatch` (WCAG 2.5.3) | Serious | `/mission` (Diary Drawer open, EN) | When open, the vertical tab in [`diary-drawer.tsx`](../apps/web/src/features/timeline/diary-drawer.tsx) displayed `"Cultivation diary"` (`d.title`) while setting `aria-label="Close"` (`d.close`), omitting the visible label from the accessible name. | Set `aria-label={open ? \`${d.title} (${d.close})\` : d.open}` so the visible label is preserved in both EN and KO → **0 violations**. |
| 3 | `color-contrast` (WCAG 1.4.3) | Serious | `/sources` (3 soft danger badge nodes on `surface-2`) | `--color-danger` (`#e5806a`) over 15% tint on `surface-2` (`#1a2733` → blended `#38343b`) measured **4.42:1**, just under the 4.5:1 AA threshold for 14px text. | Adjusted `--color-danger` to `#ec8c78` in [`tokens.css`](../apps/web/src/styles/tokens.css) (**4.84:1** on `surface-2` 15% tint, **5.43:1** on `surface` 15% tint, **6.22:1** on solid `surface-2`) → **0 violations**. |

### Post-Fix `axe-core` Pass Summary (All 8 Views = 0 Violations)

| View | Passed Rules | Violations |
|---|---:|---:|
| `/` Briefing Modal open (1440×900, EN) | 31 | **0** |
| `/` Landing settled (1440×900, EN) | 26 | **0** |
| `/` Landing settled (375×812, KO) | 26 | **0** |
| `/mission` Day 1 (1440×900, EN) | 32 | **0** |
| `/mission` Day 1 with Diary Drawer open (1440×900, EN) | 32 | **0** |
| `/mission` Day 1 (375×812, KO) | 32 | **0** |
| `/sources` (1440×900, EN) | 29 | **0** |
| `/design-system` (1440×900, EN) | 31 | **0** |

### Manual / Automated Keyboard & Focus Management Verification

| Interaction | Verified Behavior | Result |
|---|---|---|
| Briefing Modal (`SceneModal`) | Initial focus lands on primary CTA (`Got it`), `Tab` & `Shift+Tab` stay trapped inside `[role="dialog"]`, `Escape` closes modal | Pass |
| Replace Mission Confirmation Modal (`SceneModal`) | Opening from `New mission` and pressing `Escape` closes modal and restores focus to `New mission` | Pass |
| Cultivation Diary Drawer (`DiaryDrawer`) | `aria-expanded` toggles `false → true → false`, closed `<aside>` is `inert`, `Escape` closes drawer and returns focus to drawer tab | Pass |
| ARIA Tabs (`Tabs` on `/design-system`) | Roving `tabIndex` with `ArrowRight`, `End`, `Home` updates active tab and focus (`mission → how → before → mission`) | Pass |
| Header nav & language switch target size | Nav links and `English`/`한국어` controls use `min-h-7` (28 px ≥ WCAG 2.2 AA 24×24 CSS px target size) | Pass |

---

## 3. OWASP UI-Boundary Security Headers

Configured globally in [`apps/web/next.config.ts`](../apps/web/next.config.ts) (`poweredByHeader: false` + `async headers()`) and verified via live HTTP responses across `/`, `/mission`, `/sources`, and `/design-system`:

| Header | Verified Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` | Restricts scripts/connections/fonts to same-origin; disallows `'unsafe-eval'` in production, plugins (`object-src 'none'`), and framing |
| `X-Frame-Options` | `DENY` | Legacy clickjacking protection alongside `frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage to third-party NASA citation links |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Disables unused browser hardware/tracking APIs |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS on production deployments |
| `X-Powered-By` | *(removed)* | Avoids exposing framework fingerprint |

- **Console & CSP error count across all audited flows (EN & KO):** `0` errors (`next/font/google` self-hosts `Pixelify Sans`, `DotGothic16`, `VT323`, and lazy `Hahmlet` chunks under `'self'`).
- **CSP tradeoff:** `'unsafe-inline'` on `script-src` is retained because all pages are statically prerendered (`cacheComponents: true`) with Next.js inline hydration scripts; moving to per-request nonces would require dynamic SSR on every route.

---

## 4. Core Web Vitals & Bundle Metrics (Local Production Build)

Measured via `PerformanceObserver` (`largest-contentful-paint`, `layout-shift`, `paint`, `navigation`, `resource`) against `next start -H 127.0.0.1 -p 3101` (loopback latency, unthrottled CPU — **lab baseline only, not RUM**):

| Route & Viewport | Locale | TTFB | FCP | LCP | CLS | JS Transfer | Total Transfer |
|---|---|---:|---:|---:|---:|---:|---:|
| `/` Desktop (1440×900) | EN | 1.4 ms | 48 ms | 108 ms | 0.0083 | 237.0 KB | 1,088.3 KB |
| `/` Mobile (375×812) | EN | 1.3 ms | 44 ms | 84 ms | 0.0269 | 237.0 KB | 1,238.2 KB |
| `/` Mobile (375×812) | KO | 1.2 ms | 28 ms | 88 ms | 0.0167 | 237.0 KB | 1,774.6 KB |
| `/sources` Desktop (1440×900) | EN | 1.7 ms | 48 ms | 48 ms | 0.0000 | 237.0 KB | 437.4 KB |
| `/sources` Mobile (375×812) | KO | 1.5 ms | 40 ms | 40 ms | **0.2720**\* | 237.0 KB | 1,173.3 KB |
| `/design-system` Desktop (1440×900) | EN | 1.7 ms | 80 ms | 80 ms | 0.0000 | 260.5 KB | 2,012.3 KB |

\* **Known unresolved tradeoff (`sources` Mobile KO CLS = 0.2720, reduced from 0.3516 before header fix):** When a returning visitor has `space-garden:locale=ko` saved in `localStorage`, static prerendered HTML paints English first (`DEFAULT_LOCALE = 'en'`), then swaps to Korean copy after hydration and downloads lazy Hangul `Hahmlet` font chunks (`preload: false`). Fixing this to `< 0.1` would require locale-prefixed routes (`/en/...`, `/ko/...`) or cookie-driven dynamic SSR. See [ADR-0001](adr/0001-frontend-architecture.md#decision-1-usesyncexternalstore--frozen-server_snapshot-vs-zustand--tanstack-query) for the static-shell tradeoff.

### Production Build Artifact Footprint (`.next/static/chunks` & `public/`)

- Total emitted JS across all routes (uncompressed on disk): `1,483.6 KB` across 20 chunks (route initial JS transferred over wire on `/`, `/sources`: `237.0 KB`; `/design-system`: `260.5 KB`).
- Total emitted CSS across all routes (uncompressed on disk): `195.4 KB` across 3 chunks.
- Static public assets (`apps/web/public/`): reduced from `10 MB` to `6.5 MB` (`public/bg/` reduced from `4.7 MB` to `1.2 MB`) by removing unused `bay.png` and `wall.png`.

---

## 5. How to Reproduce Checks

```bash
# Typecheck, ESLint, 812 Vitest tests, and production build
npm run check

# Start production server on dedicated port 3101
npx next start -H 127.0.0.1 -p 3101 apps/web

# Verify HTTP status and security headers
curl -sI http://127.0.0.1:3101/ | grep -iE 'content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security|x-powered-by'
```
