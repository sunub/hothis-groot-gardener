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

One more NASA document is cited in `docs/IMPLEMENTATION-NOTES.en.md` (entry 29) but is not used in the data files: Massa, Hummerick, Spencer and Smith (2015). *Veggie ISS Validation Test Results and Produce Consumption*. NASA Technical Reports Server 20150021302. https://ntrs.nasa.gov/citations/20150021302 (NTRS record: public use permitted).

The challenge's Resources tab links to the NASA Human Research Program pages. The evidence report above is reached from those pages (hazards and risks pages, then the evidence report list).

## 2. Other documents

| Source | Used for | License |
|---|---|---|
| Khodadad, Hummerick, Spencer, Dixit, Richards, Romeyn, Smith, Wheeler and Massa (2020). *Microbiological and Nutritional Analysis of Lettuce Crops Grown on the International Space Station*. Frontiers in Plant Science 11:199. https://doi.org/10.3389/fpls.2020.00199 | Recorded range of bacterial counts on ISS-grown lettuce leaves (2.14 to 4.86 log10 CFU/g), pathogen screening results, absence of standards, harvest and freezing steps, the fan anomaly, excess moisture, manual watering, the name of the zinnia test (VEG-01C) | CC BY |

No data files from these sources are included in the repository. The repository contains only short quoted sentences and the numbers named above.

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

See the "Use of AI tools" section of the README.
