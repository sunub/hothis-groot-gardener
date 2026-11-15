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
| Two crises: water shortage, and excess water with stagnant air leading to mold; a standard mission has at least two, raised by an overnight change when the state calls for none | Built |
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

No environment variables, database or account are needed. The language model is optional; to run with it in one step, use the setup script in [Language model](#language-model-optional).

## Language model (optional)

The game runs without it. With no model configured, or when the model server does not answer, every crisis uses the reviewed pre-made text in `data/content/fallback-crises.json` (English and Korean) at once, and the Korean screen keeps the diary lines in English. Verdicts, state changes and sources are the same either way. The public demo link has no model server behind it, so it shows the pre-made crises.

### Run with the model: one script

The script checks Node.js, installs [Ollama](https://ollama.com) if it is missing (it asks first), downloads the model `gemma4:e4b` once (about 10 GB), installs the npm packages, writes `apps/web/.env.local`, then builds and starts the app at http://localhost:3000.

Windows (PowerShell, in the repository folder):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-with-ai.ps1
```

macOS or Linux:

```bash
bash scripts/start-with-ai.sh
```

- Wait for `[llm] gemma4:e4b is loaded` in the terminal, then open http://localhost:3000. Crisis text written by the model is labelled on the crisis screen.
- Options: `-Yes` / `--yes` installs and downloads without asking, `-Dev` / `--dev` runs the development server, `-Port 3001` / `--port 3001` uses another port.
- A GPU is recommended. On a computer without one a reply can take longer than the 30-second limit, and the game then shows the pre-made text.
- Stop with Ctrl+C. To run without the model again, delete `apps/web/.env.local`.
- The script does not start the evidence search server; it is optional (step 2 below).

### Manual setup

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

### What the model does and does not do

- It writes text only. The code picks the crisis and its symptom stage, the JSON schema sent with the request lists only that crisis's symptom and action ids, and verdicts, state changes and sources are attached from the evidence list after the text is checked.
- Each reply is checked twice: `validateAiOutput` (ids, counts, one appropriate option, no duplicates) and `checkStructure`/`checkWording` in `apps/web/src/server/ai/crisis/llm/guard.ts` (no symptom that is not allowed at the current stage, no setting or reading in the scene, no label that hints at the answer, no longer names its action or adds another action's key word, a clue for the symptom that is new at this stage, no plant line that names the cause, result lines spoken by the lettuce, no scene copied from the style example, no safety or edibility claim, no soil, no water that drips or pools in microgravity, length limits). On a problem the model gets the list of broken rules and rewrites once; if the rewrite fails too, the attempt is retried once, and then the pre-made crisis is shown. Style problems (a narrator instead of the lettuce, a scene copied from the style example) also ask for the rewrite, but do not reject the text.
- Option order is shuffled after generation.
- `LLM_PROVIDER=openai` switches to any OpenAI-compatible server (for example vLLM on RunPod) with the same checks.
- `LLM_LOG_DIR` writes every generation (output, problems found, time taken) to `generations.jsonl` for quality checks.

### Evidence search and how well it works

When `RAG_URL` points at the search server (`services/rag/rag_server.py`), each crisis request first searches 76 excerpts from published sources and puts the top 4 into the prompt as background for the scene and the "why" lines. The default setting (`retriver.local.yaml`) is keyword search (BM25) only and needs no API key. The search never decides verdicts, state changes or the sources shown on screen; those come from the evidence list. Without `RAG_URL`, or when the server does not answer within 3 seconds, the model writes without excerpts. The one-step scripts do not start the search server.

We measured the search with the five queries the game actually sends (`data/eval/evaluation.app.json`): water shortage at stages 1 and 2, overwatering and mold at stages 1 to 3. Before scoring, every candidate excerpt was graded as key evidence, supporting, unrelated, or off-stage (about a symptom the plant does not have yet at that stage, which could lead the model to write it).

| Query | Precision@4 | Recall@4 | MRR@4 | nDCG@4 | Off-stage |
|---|---|---|---|---|---|
| Water shortage, stage 1 | 0.75 | 0.67 | 1.00 | 0.79 | 0 |
| Water shortage, stage 2 | 0.75 | 0.67 | 1.00 | 0.79 | 0 |
| Overwatering, stage 1 | 0.75 | 1.00 | 1.00 | 0.86 | 0 |
| Overwatering, stage 2 | 0.50 | 1.00 | 1.00 | 0.80 | 0 |
| Overwatering, stage 3 | 0.50 | 1.00 | 1.00 | 0.80 | 0 |
| **Average, top 4 (what the game uses)** | **0.65** | **0.87** | **1.00** | **0.81** | **0 of 20** |
| Average if the top 5 were used | 0.60 | 0.87 | 1.00 | 0.78 | 2 of 25 |

- Precision is the share of the excerpts in the prompt that are key or supporting. Recall and MRR count key evidence only: Recall is the share of key excerpts that reach the prompt, MRR is 1 divided by the rank of the first one. nDCG weighs key and supporting excerpts by rank.
- The first excerpt is key evidence for every query, and no off-stage excerpt reaches the prompt. A fifth excerpt would add a tip burn record to both water shortage prompts, which is why the game keeps 4.
- Weak points: for water shortage, the excerpt on watering the pillows directly ranks 6th. At overwatering stages 2 and 3, a lighting excerpt and a harvest schedule excerpt take places 3 and 4, and at stage 3 the root rot record is not in the top 10. A stage's new symptom changes little: water shortage stages 1 and 2, and overwatering stages 2 and 3, return the same excerpts.
- Five queries over two crises is a small set, and the grades are a judgement made by reading each excerpt (see Use of AI tools). Measured on 2026-11-15 with 76 excerpts.

To repeat it (setup and the other evaluation sets: `services/rag/RETRIEVAL_USAGE.md`, in Korean):

```bash
cd services/rag
uv run python evaluation.py --dataset ../../data/eval/evaluation.app.json --config retriver.local.yaml --top-n 4
```

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
scripts/                start-with-ai.ps1 (Windows) and start-with-ai.sh (macOS, Linux): run the app with the language model in one step
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
- **Data files:** the files in `data/content/` carry an `ai_disclosure` field that says how AI tools were used for that file, except `events.json`, which has none yet. `data/eval/evaluation.events.json` and `data/sources/public_sources_RAG.json` are plain lists and cannot carry the field: the questions in the first were drafted with an AI coding assistant, and the excerpts in the second were cut from the source documents by a script written with one. In `data/eval/evaluation.app.json` the queries are the ones the game builds, and the relevance grades were drafted with an AI coding assistant after reading each excerpt. Every quote in the evidence list was compared by a script with the text of the downloaded source document and is a verbatim part of it. The script and the downloaded documents are not part of this repository.
- The plant and chamber images in `apps/web/public/sprites` and `apps/web/public/bg` are AI-generated, and the screens label them "AI-generated art". No AI-generated video or audio is used.

## Sources and licenses

See [`docs/SOURCES.md`](docs/SOURCES.md).
