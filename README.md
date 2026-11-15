# Hothis Groot Gardner

**Space Garden Simulator** — a web simulation for practicing how to keep a space crop healthy.

NASA Space Apps Challenge 2026 · Challenge: *Create Health Monitoring Software for Astronauts on Space Missions* · Team Hothis

You grow 'Outredgeous' red romaine lettuce in a simulated ISS Veggie unit for one mission (seven game days that cover cultivation days 1 to 33). You track the plant and chamber state, respond to crises that were actually recorded in NASA plant growth tests, harvest on day 33, and read a ground analysis report that compares the harvest with values measured on real ISS-grown lettuce.

The simulator does not record or assess any health data about people. It trains the step that comes before crew health: keeping the crop from failing and from being contaminated.

## What works now

| Part | State |
|---|---|
| Plant state tracking (plant health, root moisture, chamber humidity, fan, lighting) with a history chart | Built |
| Daily care (watering, fan, lighting) and overnight changes | Built |
| Two crises: water shortage, and excess water with stagnant air leading to mold | Built |
| Verdict, state change and source for every choice, taken from the evidence list | Built |
| Harvest and sanitize, freeze samples for return, ground analysis report | Built |
| Mission record saved in the browser | Built |
| Crisis text written by a language model | Built, **off by default**. With `LLM_MODEL` set, a local model (Gemma 4 E4B through Ollama in development) writes the scene, the plant's lines, the clues and the option text. Without it, or when generated text fails its checks twice, the pre-made crises are used. See [Language model](#language-model-optional). |
| Third crisis (ethylene build-up) | Not built |

## Run it

Requirements: Node.js 20.9 or later, npm.

```bash
npm install        # installs the workspace from the repo root
npm run dev        # http://localhost:3000 (runs apps/web)
```

Other commands:

```bash
npm run test       # unit tests and the full mission run-through
npm run typecheck
npm run lint
npm run build
npm run check      # all of the above
```

No environment variables, database or account are needed. The language model is optional; see below.

## Language model (optional)

The game runs without it. To let a model write the crisis text:

1. Run a model server. Development used [Ollama](https://ollama.com) with `gemma4:e4b`:
   ```bash
   ollama pull gemma4:e4b
   ```
2. Optional: run the evidence search server from the RAG branch (`services/rag/rag_server.py`), which adds short excerpts from NASA plant research papers to the prompt:
   ```bash
   cd services/rag && python -m uvicorn rag_server:app --host 127.0.0.1 --port 8000
   ```
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and check the values (`LLM_MODEL`, `LLM_BASE_URL`, `RAG_URL`).
4. `npm run dev`. The server starts loading the model in the background (`apps/web/src/instrumentation.ts`); the terminal shows `[llm] gemma4:e4b is loaded` when it is ready. For a demo, set `LLM_KEEP_ALIVE=-1` so the model stays loaded until the demo starts.

What the model does and does not do:

- It writes text only. The code picks the crisis and its symptom stage, the JSON schema sent with the request lists only that crisis's symptom and action ids, and verdicts, state changes and sources are attached from the evidence list after the text is checked.
- Each reply is checked twice: `validateAiOutput` (ids, counts, one appropriate option, no duplicates) and `checkStructure`/`checkWording` in `apps/web/src/server/ai/crisis/llm/guard.ts` (no symptom that is not allowed at the current stage, no setting or reading in the scene, no label that hints at the answer or no longer names its action, no plant line that names the cause, result lines spoken by the lettuce, no scene copied from the style example, no safety or edibility claim, no soil, no water that drips or pools in microgravity, length limits). On a problem the model gets the list of broken rules and rewrites once; if the rewrite fails too, the attempt is retried once, and then the pre-made crisis is shown.
- Option order is shuffled after generation.
- `LLM_PROVIDER=openai` switches to any OpenAI-compatible server (for example vLLM on RunPod) with the same checks.
- `LLM_LOG_DIR` writes every generation (output, problems found, time taken) to `generations.jsonl` for quality checks.

The public demo link has no model server behind it, so it shows the pre-made crises.

## How to read the numbers

Every number on screen carries one of two labels.

- **Recorded**: taken from a cited source, with the source sentence shown next to it.
- **Game value**: set by the team so that the game is balanced. NASA sources say which action is right, but not how much the plant state changes per day, so all state changes are game values.

The ground analysis report never says that the harvest is safe or can be eaten. The recorded range it shows is a range that was observed, not a safety limit.

## Structure

```
apps/web/               Next.js app (npm workspace "web")
  src/
    app/                Routes: / (start), /mission, /harvest, /report, /sources, /api/crisis, /api/event
    features/           Screen code by feature: mission (store), grow-room, report
    components/         Shared UI pieces
    server/ai/          Server-only code ("server-only"): crisis and event-card pipelines, LLM client
    lib/
      contract/         Shared type file and runtime schemas (the agreement between modules)
      game/             Game rules and logic as pure TypeScript, with tests
      evidence/         Evidence list loading, checks and selection
      events/           Timeline event list, schema and judging
      i18n/             All screen text
services/rag/           Python evidence search server (FastAPI, Chroma, BM25), indexing and evaluation scripts
data/
  content/              JSON the app reads: evidence, events, event-cards, fallback-crises, ...
  sources/              Source chunks for the search index (total_RAG.json, public_sources_RAG.json)
  eval/                 Search evaluation sets
  vector_db/            Chroma index
docs/
  IMPLEMENTATION-NOTES.en.md  Where the build differs from the planning document, and why
  IMPLEMENTATION-NOTES.md     The same notes in Korean (original)
  SOURCES.md                  Data, documents, open-source software and references, with licenses
  DEMO-SCRIPT.md              Care steps that show both crises in demo mode
  DESIGN.md                   Pixel UI design system (Korean)
  TIMELINE-EVENTS-PLAN.md     Plan for the cultivation timeline and events (Korean)
  TIMELINE-ENGINE-NOTES.md    Decisions made for the timeline types and event judgement (Korean)
  ROLE-TASKS.md               Open tasks per role and the event card API contract (Korean)
```

### Where the language model plugs in

The planning document gives the model one job: write the crisis scene, the plant's lines and the option text. Verdicts, state changes and sources always come from the evidence list.

- `apps/web/src/server/ai/crisis/generator.ts`: the generator interface. Input: current state, candidate crises with their evidence, history. Output: the "AI output format" of the planning document.
- `apps/web/src/server/ai/crisis/validate.ts`: checks the output (shape, ids exist in the evidence list, at least one appropriate option, no duplicate action).
- `apps/web/src/server/ai/crisis/pipeline.ts`: generate, validate, retry once, then fall back to a pre-made crisis.
- `apps/web/src/app/api/crisis/route.ts`: the one place where a generator is passed in. It connects `apps/web/src/server/ai/crisis/llm/` when `LLM_MODEL` is set.
- `apps/web/src/server/ai/crisis/llm/`: settings, prompt, model client (Ollama or OpenAI-compatible), evidence search client and wording checks.
- `apps/web/src/server/ai/event-cards/`: event cards for timeline events behind `POST /api/event`. Their text is pre-made by default. With a model configured and `LLM_EVENT_CARDS=on`, the model writes the scene, the plant's line and the option text; the explanations, verdicts and effects still come from the data files.

## Use of AI tools

- **In the product:** when `LLM_MODEL` is set, a language model (Gemma 4 E4B by Google, run locally through Ollama during development) writes the crisis scene, the plant's lines, the clues and the option text. The crisis screen states this whenever the text is generated. Verdicts, state changes and sources never come from the model. Without `LLM_MODEL` no model is called and crisis text comes from `data/content/fallback-crises.json`. The optional evidence search uses keyword search over excerpts from published papers; no AI model is involved in that search by default.
- **In development:** the team used an AI coding assistant (Claude Code by Anthropic) to write and test the code in this branch, to search the downloaded NASA source documents and draft the evidence list, to draft the English text of the pre-made crises, to draft the documents in `docs/`, and to write the language model connection in `apps/web/src/server/ai/crisis/llm/`. The team defined the idea, the rules and the scope in its planning document.
- **Data files:** the files in `data/content/` carry an `ai_disclosure` field that says how AI tools were used for that file, except `events.json`, which has none yet. `data/eval/evaluation.events.json` and `data/sources/public_sources_RAG.json` are plain lists and cannot carry the field: the questions in the first were drafted with an AI coding assistant, and the excerpts in the second were cut from the source documents by a script written with one. Every quote in the evidence list was compared by a script with the text of the downloaded source document and is a verbatim part of it. The script and the downloaded documents are not part of this repository.
- The plant and chamber images in `apps/web/public/sprites` and `apps/web/public/bg` are AI-generated, and the screens label them "AI-generated art". No AI-generated video or audio is used.

## Sources and licenses

See [`docs/SOURCES.md`](docs/SOURCES.md).
