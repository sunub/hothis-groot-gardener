# ADR-0001: Frontend Architecture, State Boundaries & UI System

- **Status:** Accepted
- **Date:** 2026-11-25
- **Scope:** `apps/web/` (Next.js 16.4.6 App Router, React 19, TypeScript strict, Tailwind CSS v4)

## Context

Space Garden Simulator is a 7-day ISS Veggie lettuce cultivation training simulation with:
- Zero-login, browser-persisted game state (`localStorage`) that must stay synchronized across browser tabs.
- Optional server-side LLM narrative generation (`POST /api/crisis`, `POST /api/event`, `POST /api/diary-translate`) paired with deterministic NASA-cited evidence rules.
- A custom pixel-art visual system (`SG-DS v2 · Pixel UI`) spanning both a 1600×900 scaled grow-room illustration scene and responsive data-dense dashboards, in English and Korean.

This ADR records the key frontend architectural decisions, the alternatives evaluated, and the resulting tradeoffs.

---

## Decision 1: `useSyncExternalStore` + Frozen `SERVER_SNAPSHOT` vs. Zustand / TanStack Query

**Decision:** Manage mission state ([`apps/web/src/features/mission/mission-store.ts`](../../apps/web/src/features/mission/mission-store.ts)) and locale state ([`apps/web/src/lib/i18n/index.tsx`](../../apps/web/src/lib/i18n/index.tsx)) with React 19's built-in `useSyncExternalStore`, using a frozen `SERVER_SNAPSHOT` (`ready: false, mission: null`) during SSR/hydration and persisting directly to `localStorage`.

**Why:**
- **Zero hydration mismatch on static shells:** All page routes (`/`, `/mission`, `/harvest`, `/report`, `/sources`, `/design-system`) prerender statically with `cacheComponents: true`. Returning a frozen `SERVER_SNAPSHOT` from `getServerSnapshot` guarantees identical SSR and initial client markup before reading `localStorage`.
- **Single-responsibility async control:** Only two client→server mutations exist (`POST /api/crisis`, `POST /api/event`), both explicitly uncacheable (`Cache-Control: no-store`) because responses carry hidden verdicts for the active step. The store owns `AbortController` race cancellation, request-key deduplication (`requestedKey`), a 600 ms post-transition double-click guard (`CLICK_GUARD_MS`), and cross-tab `window.addEventListener('storage', ...)` synchronization in ~380 lines with zero extra dependencies.

**Alternatives considered:**
- *Zustand + `persist`:* Still requires custom hydration-ready flags, custom `AbortController` deduplication, and custom `storage` event listeners to avoid cross-tab overwrites.
- *TanStack Query:* Optimized for cacheable server state (stale-while-revalidate, background refetch); here the browser is the source of truth and crisis/event endpoints must never be cached or refetched behind the engine's back.

**Tradeoff:**
- Returning Korean visitors (`space-garden:locale=ko`) hydrate in `en` first and then swap to `ko` + lazy `Hahmlet` font chunks, causing measurable layout shift on text-heavy pages (e.g., `/sources` mobile KO lab CLS = `0.272`; see [`docs/QUALITY-AUDIT.md`](../QUALITY-AUDIT.md)). Eliminating that shift would require URL-prefixed locale routes (`/en`, `/ko`) or cookie-based dynamic rendering.

---

## Decision 2: Trust-Boundary Enforcement (`import 'server-only'`, 64 KiB Streaming Body Guard, Zod `strictObject`)

**Decision:** Enforce three layered boundaries between client UI and server/AI logic:
1. **Compile-time isolation:** Every server AI entry module (`apps/web/src/server/ai/{crisis,crisis/llm,event-cards}/index.ts`) starts with `import 'server-only'`, preventing Next.js from bundling LLM API keys, prompts, or server pipelines into client chunks.
2. **Streaming body cap (`64 KiB`):** `POST /api/crisis` and `POST /api/event` reject declared oversized `Content-Length` headers early and count bytes via `request.body.getReader()`, canceling the stream immediately if bytes exceed `REQUEST_BODY_MAX_BYTES` (`65,536` bytes) without buffering unbounded payloads.
3. **Runtime contract validation:** Shared schemas in [`apps/web/src/lib/contract/schemas.ts`](../../apps/web/src/lib/contract/schemas.ts) use Zod v4 `z.strictObject()` (rejecting unknown keys) coupled with TypeScript `satisfies z.ZodType<T>` so compile-time types and runtime parsers cannot drift. All request IDs are restricted to `/^[a-z0-9_]+$/` (max 64 chars) to block prompt-injection characters from entering generation inputs.

**Alternatives considered:**
- *TypeScript interfaces only (`as CrisisResponse`):* Rejected; cannot guard untrusted HTTP bodies, malformed LLM outputs, or stale/edited `localStorage` payloads.
- *`request.json()` without streaming cap:* Rejected; allows arbitrarily large payloads to allocate memory before validation.

**Tradeoff:**
- Adding a field to any API payload or evidence JSON requires updating both `types.ts` and `schemas.ts` (verified by `schemas.test.ts` and `fixtures.test.ts`).

---

## Decision 3: Tailwind CSS v4 `@theme` + `@utility` + `@container` + CVA (`SG-DS v2`)

**Decision:** Build the pixel UI design system ([`docs/DESIGN.md`](../DESIGN.md)) using CSS-first Tailwind v4 tokens (`src/styles/tokens.css`, `scene-tokens.css`), notched-frame `@utility pixel-*` primitives (`utilities.css`), container queries (`@container` on the mission action panel in `mission-screen.tsx`), and `class-variance-authority` + custom `tailwind-merge` (`src/lib/utils/cn.ts`).

**Why:**
- **Zero runtime CSS-in-JS overhead:** Tokens compile to native CSS custom properties. `--radius-*: initial` structurally removes `rounded-*` utilities so rounded corners cannot creep into the pixel aesthetic.
- **Token separation:** Page UI tokens (`@theme` in `tokens.css`) and warm grow-room scene tokens (`:root` in `scene-tokens.css`) stay strictly decoupled; components never use raw hex values.
- **Composable primitives:** `components/ui/*` exposes thin, accessible primitives (`Button`, `Card`, `Badge`, `Tabs`, `Disclosure`, `Meter`, `ChoiceButton`, `Stepper`, `PlantSpeech`) paired with a live `/design-system` catalog.

**Alternatives considered:**
- *Off-the-shelf component kit (MUI / Chakra / shadcn defaults):* Rejected; rounded defaults and generic shadows conflict with pixel-art visual constraints and would require overriding nearly every primitive.

**Tradeoff:**
- Four-side `box-shadow` pixel frames draw outside the layout box, requiring consistent `m-1` outer spacing and `flex`/`grid` `gap-*` instead of `space-y-*`.

---

## Decision 4: Deterministic Game Engine vs. Optional LLM Narrative Boundary

**Decision:** Keep all simulation rules, crisis triggers, verdicts, state deltas, microbial scoring, and NASA citations deterministic in pure TypeScript ([`apps/web/src/lib/game/`](../../apps/web/src/lib/game/)) and verified JSON ([`data/content/evidence.json`](../../data/content/evidence.json)). Restrict the optional LLM exclusively to narrative presentation (scene prose, plant speech, option phrasing) behind a double-validated pipeline with automatic fallback.

**Why:**
- **Verifiability & testability:** Seeded PRNG (`rng.ts`) lets 812 Vitest tests validate game balance, minimum-crisis invariants, demo scripts, and schema integrity in ~1 second without network or GPU dependencies.
- **Safety against hallucination:** Every LLM reply passes `validateAiOutput` (ID allowlists, counts, one appropriate option, no duplicate actions) and wording/structure guards (`guard.ts`: no off-stage symptoms, no answer-revealing phrasing, no safety/edibility claims, no gravity-breaking water drips). Failures trigger a targeted rewrite, 1 retry, and then instant fallback to reviewed text in `data/content/fallback-crises.json`. Verdicts and NASA quotes are attached deterministically *after* text validation (`attach.ts`).

**Tradeoff:**
- Without `LLM_MODEL` configured (including the public Vercel demo), crises use pre-made reviewed text rather than dynamically generated wording.

---

## Consequences

- **Positive:** Fast static prerendering (`cacheComponents: true`), 0 runtime state/CSS-in-JS libraries, strict compile + runtime trust boundaries, deterministic testability, and 6/6 OWASP security headers in [`apps/web/next.config.ts`](../../apps/web/next.config.ts).
- **Follow-up opportunities:** If Korean first-load CLS (`0.272` on `/sources`) becomes a priority, introduce `/[locale]/...` static routes so both English and Korean prerender natively without a post-hydration locale swap.
