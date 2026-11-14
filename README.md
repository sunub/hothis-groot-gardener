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
| Crisis text written by a language model | **Not built.** Every crisis currently comes from a set of pre-made crises. The input and output format, the validation and the retry and fallback steps are in place (see below). |
| Third crisis (ethylene build-up) | Not built |

## Run it

Requirements: Node.js 20.9 or later, npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm run test       # unit tests and the full mission run-through
npm run typecheck
npm run lint
npm run build
npm run check      # all of the above
```

No environment variables, database or account are needed.

## How to read the numbers

Every number on screen carries one of two labels.

- **Recorded**: taken from a cited source, with the source sentence shown next to it.
- **Game value**: set by the team so that the game is balanced. NASA sources say which action is right, but not how much the plant state changes per day, so all state changes are game values.

The ground analysis report never says that the harvest is safe or can be eaten. The recorded range it shows is a range that was observed, not a safety limit.

## Structure

```
src/
  app/                  Routes: / (start), /mission, /harvest, /report, /sources, /api/crisis
  features/             Screen code by feature: mission (store), grow-room, report
  components/           Shared UI pieces
  lib/
    contract/           Shared type file and runtime schemas (the agreement between modules)
    game/               Game rules and logic as pure TypeScript, with tests
    evidence/           Evidence list loading, checks and selection
    crisis/             Crisis pipeline behind the API: candidates, validation, fallback
    i18n/               All screen text
  data/                 evidence.json, state-criteria.json, fallback-crises.json
docs/
  IMPLEMENTATION-NOTES.en.md  Where the build differs from the planning document, and why
  IMPLEMENTATION-NOTES.md     The same notes in Korean (original)
  SOURCES.md                  Data, documents, open-source software and references, with licenses
  DEMO-SCRIPT.md              Care steps that show both crises in demo mode
```

### Where the language model plugs in

The planning document gives the model one job: write the crisis scene, the plant's lines and the option text. Verdicts, state changes and sources always come from the evidence list.

- `src/lib/crisis/generator.ts`: the generator interface. Input: current state, candidate crises with their evidence, history. Output: the "AI output format" of the planning document.
- `src/lib/crisis/validate.ts`: checks the output (shape, ids exist in the evidence list, at least one appropriate option, no duplicate action).
- `src/lib/crisis/pipeline.ts`: generate, validate, retry once, then fall back to a pre-made crisis.
- `src/app/api/crisis/route.ts`: the one place where a generator is passed in.

## Use of AI tools

- **In the product:** no language model is called. Crisis text comes from `src/data/fallback-crises.json`.
- **In development:** the team used an AI coding assistant (Claude Code by Anthropic) to write and test the code in this branch, to search the downloaded NASA source documents and draft the evidence list, to draft the English text of the pre-made crises, and to draft the documents in `docs/`. The team defined the idea, the rules and the scope in its planning document.
- **Data files:** `src/data/*.json` each carry an `ai_disclosure` field that says how AI tools were used for that file. Every quote in the evidence list was compared by a script with the text of the downloaded source document and is a verbatim part of it. The script and the downloaded documents are not part of this repository.
- No AI-generated images, video or audio are used. The plant drawing is an inline SVG written as code.

## Sources and licenses

See [`docs/SOURCES.md`](docs/SOURCES.md).
