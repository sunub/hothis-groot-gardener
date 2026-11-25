# AGENTS.md

Operational guardrails for human contributors and AI coding agents working in `hothis-groot-gardener`.

## Repository Boundaries

| Path | Ownership & Role | Rules |
|---|---|---|
| `apps/web/src/lib/game/` | Pure TypeScript simulation engine (`rules.ts`, `engine.ts`, `rng.ts`, `timeline.ts`) | Deterministic only; zero DOM/React/network imports. |
| `apps/web/src/lib/contract/` | Shared TypeScript types + Zod v4 `strictObject` schemas | Every schema must stay synced with `types.ts` via `satisfies z.ZodType<T>`. |
| `apps/web/src/server/ai/` | Server-only crisis/event/translation pipelines & LLM/RAG clients | Keep `import 'server-only'` at entry points; LLM only writes narrative copy, never verdicts, deltas, or citations. |
| `apps/web/src/app/api/` | Next.js Route Handlers (`POST /api/crisis`, `/api/event`, `/api/diary-translate`) | Preserve `Cache-Control: no-store`, `REQUEST_BODY_MAX_BYTES` (64 KiB) streaming cap, and Zod input validation. |
| `apps/web/src/components/ui/` & `src/styles/` | SG-DS v2 Pixel UI design system | Use `@theme` tokens (`tokens.css`) or scene tokens (`scene-tokens.css`) — never raw hex in components, never `rounded-*`. |
| `apps/web/src/features/` | Feature screens (`grow-room`, `mission`, `report`, `timeline`, `event-card`) | Read screen copy from `src/lib/i18n/{en,ko}` dictionaries; keep EN & KO keys in parity (`strings.test.ts`). |
| `data/content/` | Reviewed NASA evidence, fallback crises, timeline events | Verbatim quotes only; never fabricate NASA measurements or safety/edibility claims. |
| `services/rag/` | Optional Python FastAPI BM25/Chroma retrieval server | Isolated from `apps/web`; failures must degrade gracefully without breaking gameplay. |

## Human vs. AI Delegation Boundaries

- **Human-owned decisions (do not silently alter):**
  - Simulation rules & balance constants (`rules.ts`, `docs/IMPLEMENTATION-NOTES*.md`)
  - NASA source verification, license compliance (`docs/SOURCES.md`), and non-diagnostic / non-safety wording rules
  - API & storage schema breaking changes (`schema_version`, `lib/contract/`)
  - Final WCAG 2.2 AA, security header, and release sign-off
- **Safe for AI-assisted implementation (with automated verification):**
  - UI components built from `components/ui/*` and existing CSS tokens
  - Unit/integration test expansion, type narrowing, accessibility fixes, and documentation sync
  - Copy drafting clearly flagged for human/source review

## Mandatory Verification Loop

Run from the repository root before considering any change complete:

```bash
npm run check
```

`npm run check` runs all four gates in order:
1. `npm run typecheck` (`tsc --noEmit`)
2. `npm run lint` (`eslint`)
3. `npm run test` (`vitest run` — 812+ tests across 48 files)
4. `npm run build` (`next build` production bundle + static prerender)

For any change touching UI, CSS, `next.config.ts`, or i18n, also verify against a local production server (`npx next start -H 127.0.0.1 -p 3101 apps/web`):
- `0 px` horizontal overflow at `375×812` in both English and Korean across `/`, `/mission`, `/sources`, `/design-system`.
- `0` WCAG 2.2 AA violations (`axe-core`) and working keyboard focus management (modals, tabs, drawer).
- `0` browser console / CSP errors and all 6 OWASP security headers present.

## Hygiene & Security Rules

- Keep `package.json` and `package-lock.json` synchronized; do not add unvetted dependencies.
- Never commit `.env.local`, API keys, or personal health data.
- Follow existing Korean conventional commit prefixes (`feat :`, `fix :`, `docs :`, `test :`, `chore :`) and stage explicit file paths rather than `git add -A`.
