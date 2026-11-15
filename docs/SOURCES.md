# Sources, software and references

Everything this project uses that the team did not make: NASA data and documents, open-source software, and the public guides the code structure follows. Each item lists where it is used and its license or usage statement.

## 1. NASA data and documents

Sentences quoted from these documents are in `data/content/evidence.json`, each next to the claim it supports. Every quote was compared by a script with the text of the downloaded source document and is a verbatim part of it. The script and the downloaded documents are not part of this repository.

| Source | Used for | License or usage statement |
|---|---|---|
| Massa, Dufour and Smith (2014). *Veggie Hardware Validation Test Preliminary Results and Lessons Learned* (abstract). NASA Technical Reports Server 20150001374. https://ntrs.nasa.gov/citations/20150001374 | Water shortage crisis: record, symptoms, the corrective action | NTRS record: public use permitted |
| NASA (2017). *On-Orbit Gardening Guides*. NASA Technical Reports Server 20170007815. https://ntrs.nasa.gov/citations/20170007815 | Fan settings (low, high) and what the high setting does; watering by observation | NTRS record: public use permitted |
| Massa (2016). *Veggie: Space Vegetables for the International Space Station and Beyond*. NASA Technical Reports Server 20160004060. https://ntrs.nasa.gov/citations/20160004060 | Harvest frozen and returned to Earth for analysis; the crop of the VEG-01 test | NTRS record: public use permitted |
| NASA. *Growing Plants in Space*. https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/ | Excess water and mold crisis: record, the cleaning action | NASA web page |
| NASA Open Science Data Repository, OSD-358 (study description). https://osdr.nasa.gov/bio/repo/data/studies/OSD-358 | Fungal growth observed on zinnia leaves and stems | NASA open data |
| NASA Open Science Data Repository, OSD-177 (study description). https://osdr.nasa.gov/bio/repo/data/studies/OSD-177 | Rot disease on the zinnia plants | NASA open data |
| NASA (2021). *Researchers Put Space Garden Microbes Under the Microscope*. https://www.nasa.gov/missions/station/researchers-put-space-garden-microbes-under-the-microscope/ | Background: contaminated plant systems can make crops fail | NASA web page |
| NASA Human Research Program (2025). *Evidence Report: Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders Leading to In-Mission Health and Performance and Long-Term Health Effects*. https://humanresearchroadmap.nasa.gov/evidence/reports/HRP-ER-BMED-HFBP-20250210.pdf | Background: failing crops and crew well-being | Public release by NASA, February 10, 2025 |
| Landon et al. (2025). *Behavioral Health Benefits of the ISS Pick-and-Eat Crop Growth System* (poster abstract). NASA Technical Reports Server 20250000411. https://ntrs.nasa.gov/citations/20250000411 | Background: working with plants as a behavioral health countermeasure | NTRS record: public use permitted |

One more NASA document is quoted in the search excerpts (`data/sources/public_sources_RAG.json`) and cited in `docs/IMPLEMENTATION-NOTES.en.md` (entry 29), but is not in the evidence list: Massa, Hummerick, Spencer and Smith (2015). *Veggie ISS Validation Test Results and Produce Consumption*. NASA Technical Reports Server 20150021302. https://ntrs.nasa.gov/citations/20150021302 (NTRS record: public use permitted).

The challenge's Resources tab links to the NASA Human Research Program pages. The evidence report above is reached from those pages (hazards and risks pages, then the evidence report list).

## 2. Other documents

| Source | Used for | License |
|---|---|---|
| Khodadad, Hummerick, Spencer, Dixit, Richards, Romeyn, Smith, Wheeler and Massa (2020). *Microbiological and Nutritional Analysis of Lettuce Crops Grown on the International Space Station*. Frontiers in Plant Science 11:199. https://doi.org/10.3389/fpls.2020.00199 | Recorded range of bacterial counts on ISS-grown lettuce leaves (2.14 to 4.86 log10 CFU/g), pathogen screening results, absence of standards, harvest and freezing steps, the fan anomaly, excess moisture, manual watering, the name of the zinnia test (VEG-01C) | CC BY |

The evidence list and the screens contain only short quoted sentences from the sources above and the numbers named above.

### Search excerpts (optional evidence search)

The evidence search (`services/rag/retriver.py`, `services/rag/rag_server.py`) reads excerpts cut from seven papers. The excerpts are in `data/sources/total_RAG.json` (76 excerpts) and in the search database `data/vector_db/`, which holds the same text with its embeddings. The license of each source is recorded in `data/content/source-licenses.json`, from the publisher record of each DOI.

| Source | Excerpts | License in the publisher record |
|---|---|---|
| Khodadad et al. (2020), listed above | 14 | CC BY 4.0 |
| Massa et al. (2017). *VEG-01: Veggie Hardware Validation Testing on the International Space Station*. Open Agriculture 2(1). https://doi.org/10.1515/opag-2017-0003 | 18 | CC BY-NC-ND 4.0 |
| Curry et al. (2026). *Sowing in space: Seed film enables crew-planted crops on the International Space Station*. Acta Astronautica. https://doi.org/10.1016/j.actaastro.2026.05.031 | 12 | CC BY-NC-ND 4.0 |
| Stutte et al. (2022). *Effect of reduced atmospheric pressure on growth and quality of two lettuce cultivars*. Life Sciences in Space Research. https://doi.org/10.1016/j.lssr.2022.06.001 | 11 | CC BY-NC-ND 4.0 |
| Mickens et al. (2018). *A strategic approach for investigating light recipes for 'Outredgeous' red romaine lettuce using white and monochromatic LEDs*. Life Sciences in Space Research. https://doi.org/10.1016/j.lssr.2018.09.003 | 8 | No open license in the publisher record |
| Morsi et al. (2022). *Comparison of two controlled-release fertilizer formulations for cut-and-come-again harvest yield and mineral content of Lactuca sativa L. cv. Outredgeous grown under International Space Station environmental conditions*. Life Sciences in Space Research. https://doi.org/10.1016/j.lssr.2021.12.001 | 7 | No open license for the published version |
| Haveman et al. (2023). *Advancing the automation of plant nucleic acid extraction for rapid diagnosis of plant diseases in space*. Frontiers in Plant Science 14:1194753. https://doi.org/10.3389/fpls.2023.1194753 | 6 | CC BY 4.0 |

Five of the seven sources do not allow free reuse of their text. Whether these excerpts stay in the public repository is an open team decision (`docs/ROLE-TASKS.md`, D3). The evidence list and the screen text do not quote these five sources. When the search server is on, retrieved excerpts are put into the prompt of the language model that writes crisis text.

`data/sources/public_sources_RAG.json` holds 26 excerpts copied word for word from the NASA documents in section 1. They are prepared for the search database and are not in it yet.

`data/eval/evaluation.example.json` and `data/eval/evaluation.events.json` are search evaluation questions written by the team.

## 3. What is not from a source

All state values and their changes (zones, overnight change, watering amounts, crisis probability, verdict effects, plant health, the microbial value of the harvest) are **game values** set by the team. They are listed in `apps/web/src/lib/game/rules.ts` and `data/content/state-criteria.json` and shown on the "Evidence and sources" screen.

## 4. Open-source software

| Package | Version | Used for | License |
|---|---|---|---|
| Next.js | 16.4.6 | App framework, routing, API route | MIT |
| React, React DOM | 19.3.0 | UI | MIT |
| TypeScript | 5.9.3 | Language | Apache-2.0 |
| Tailwind CSS (`tailwindcss`, `@tailwindcss/turbopack`) | 4.3.3 | Styling | MIT |
| Recharts | 3.10.1 | Plant state history chart | MIT |
| Zod | 4.6.7 | Runtime validation of API requests, AI output format and the evidence list | MIT |
| Vitest | 5.1.0 | Tests | MIT |
| ESLint, eslint-config-next | 9.39.5, 16.4.6 | Linting | MIT |
| @types/node, @types/react, @types/react-dom | 22.x, 19.x | Type definitions | MIT |
| class-variance-authority | 0.7.1 | Component variants of the design system | Apache-2.0 |
| clsx, tailwind-merge | 2.1.1, 3.7.0 | Joining class names | MIT |
| Pixelify Sans, DotGothic16, VT323 (fonts, loaded with `next/font/google`) | | Screen typefaces | SIL Open Font License 1.1 |
| chromadb (Python, optional search) | 1.x | Search database | Apache-2.0 |
| openai (Python, optional search) | 2.x | Client for the embedding service, used to build the database and for hybrid search | Apache-2.0 |
| python-dotenv, uvicorn (Python, optional search) | 1.x, 0.x | Settings file, search server | BSD-3-Clause |
| PyYAML, FastAPI (Python, optional search) | 6.x, 0.x | Retriever settings, search server | MIT |
| sentence-transformers (Python, optional reranker) | 5.x | Reranking model runner | License not checked here: the package was not installed when this table was written |

The images in `apps/web/public/sprites`, `apps/web/public/bg` and `apps/web/public/icons` came with the design work. The screens label the plant and chamber images "AI-generated art". Which tool made the images, and its terms, are not recorded in this repository yet.

The project was started from the `create-next-app` template (MIT). The random number generator in `apps/web/src/lib/game/rng.ts` is written for this project. It follows the published mulberry32 algorithm.

## 5. References for structure and style

No code was copied from any of these.

**Documents opened during the build**

| Reference | What was taken from it |
|---|---|
| Next.js documentation shipped with the package (`node_modules/next/dist/docs/`): project structure, route handlers, server and client components, "Building interactive apps" | Folder layout: routes in `app/` compose feature components from `features/`, shared primitives in `components/ui/`; the API as a route handler; client components only where interaction is needed |
| Recharts README and type definitions shipped with the package | Line chart composition |

**Conventions followed (the documents themselves were not opened during the build)**

| Convention | Where it shows in the code |
|---|---|
| React: one external store read with `useSyncExternalStore`; state logic as pure functions | `apps/web/src/features/mission/`, `apps/web/src/lib/game/engine.ts` |
| Redux style: state as plain serializable data, pure state transitions, one source of truth | `MissionState` in `apps/web/src/lib/contract/types.ts`, `apps/web/src/lib/game/engine.ts` |
| Google TypeScript style: naming, named exports, no `any`, comments that explain why | All TypeScript files |
| Zod: parse at trust boundaries (API request and response, AI output, data file) | `apps/web/src/lib/contract/schemas.ts` |
| WCAG: a text label next to every color signal, visible focus, target size | Screens |
| Simplified Technical English (ASD-STE100) principles: short sentences, one term per thing | `docs/IMPLEMENTATION-NOTES.md` and its English version |

## 6. AI tools

See the "Use of AI tools" section of the README. The models used by the optional evidence search (embedding model, reranker) are described in `services/rag/MODEL_SELECT.md`.
