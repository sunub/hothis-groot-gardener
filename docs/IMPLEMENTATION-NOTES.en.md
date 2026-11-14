# Implementation notes: where the build differs from the planning document, and decisions made during the build

The Korean original of this file is `IMPLEMENTATION-NOTES.md`.

This document records, one entry at a time, the points where **the planning document alone did not give a decision**. These points came up when the planning document "Space Garden Simulator planning document v1.7" was converted into code.

The reader must do two tasks.

1. Read "What the team must decide" in each entry and make the team's decision.
2. If the decision is different from the current build, change the files given in "How to revert".

## How to read this document

- **Type** has three values.
  - **Uncertain**: the planning document marks the point as "needs confirmation" or "not decided".
  - **Ambiguous**: a sentence in the planning document has two or more possible meanings.
  - **Wrong**: sentences in the planning document do not agree with each other, or do not agree with the source material.
- A **game value** is a number that the team set for game balance. It is not a value from NASA material.
- A **recorded value** is a value copied without change from a source document.
- The **evidence list** is the file `data/content/evidence.json`.
- A **game day** is 1 to 7. A **cultivation day** is 1, 6, 12, 17, 22, 28 or 33.
- The **night check** is the check of the status zones at the end of a day (entry 2).

## Entry list

| No. | Title | Type |
|---|---|---|
| 1 | Order of events in one day | Ambiguous |
| 2 | Time of the night check | Ambiguous |
| 3 | Daily care on a day with a crisis | Ambiguous |
| 4 | Meaning of "up to two times a day" | Ambiguous |
| 5 | Effect of the light control | Ambiguous |
| 6 | Calculation of the crisis probability | Ambiguous |
| 7 | When more than one crisis is a candidate | Ambiguous |
| 8 | The "+30%p" after a partial verdict | Ambiguous |
| 9 | The "related metric" of an appropriate verdict | Ambiguous |
| 10 | The "one step worse" of an inappropriate verdict | Ambiguous |
| 11 | The −15 of ground control support | Ambiguous |
| 12 | Difference between plant health 0 and the harvest grade "Failure" | Ambiguous |
| 13 | Chamber humidity does not reach the danger zone with the fan on low alone | Wrong |
| 14 | Stage 3 is almost never reached by the number of days alone | Wrong |
| 15 | The format of the evidence list was extended | Wrong |
| 16 | Verdicts and value types are written as English codes | Ambiguous |
| 17 | Two to three clues and the number of symptoms | Wrong |
| 18 | Fields added to the crisis request | Ambiguous |
| 19 | The "set days" of demo mode | Ambiguous |
| 20 | Details of the microbial value calculation for the harvest | Ambiguous |
| 21 | Language of the screens | Uncertain |
| 22 | Scope without the AI connection, and where to connect it | Uncertain |
| 23 | Location of the status criteria table | Ambiguous |
| 24 | The water shortage symptom "wilting" is not in the source text | Wrong |
| 25 | The water shortage action is "add directly", not "inject", and it is a record of the first grow-out | Wrong |
| 26 | The overwatering and mold symptoms and their order are not in usable source text | Wrong |
| 27 | The overwatering and mold actions "remove dead tissue" and "sanitize surfaces" are not in the source text | Wrong |
| 28 | No record was found that "a fan on high causes water shortage" | Uncertain |
| 29 | The sanitizing wipes (Pro-San) at harvest are a procedure for produce that is eaten | Ambiguous |
| 30 | What the recorded range 2.14 to 4.86 refers to | Wrong |
| 31 | The document used as evidence for the purpose | Uncertain |
| 32 | The value type that the planning document calls "measured" is shown on screen as "Recorded" | Ambiguous |
| 33 | When "sanitize surfaces" is selected, the microbial value goes up | Wrong |
| 34 | A format check of the crisis response was added to the shared type file | Ambiguous |
| 35 | Option text and "no wording that shows the correct answer" | Ambiguous |
| 36 | The microbial value cannot be "below the range" | Wrong |
| 37 | The server checks the evidence list before it sends a crisis | Ambiguous |
| 38 | Items in the planning document that were not built | Uncertain |

---

## 1. Order of events in one day

- **Type**: Ambiguous
- **Planning document section**: The diagram in "Service flow", and "Game rules > Daily progress and daily care". Original (translated from the Korean planning document): "The day starts with a check of the plant and environment status in the grow chamber.", "When a day passes, root moisture decreases by 10, and by 15 if the fan is on high."
- **What the problem is**: The document does not give the order of the status check, the crisis check, the action, the overnight change, and the plant health calculation. If the order is different, the same input gives a different result.
- **What was done**: The day has this fixed order. (`apps/web/src/lib/game/engine.ts`)
  1. Morning: The screen shows the status for the day.
  2. Crisis check: This occurs only on days 2 to 6. It uses the morning status.
  3. If there is a crisis, the player responds to the crisis. If not, the player does daily care.
  4. End of day: The overnight change (root moisture, chamber humidity) is applied.
  5. Night check: The zones are checked with the changed status, and plant health is calculated.
  6. The game goes to the next morning.
- **Why**: The diagram in Service flow has the order "② Check plant status → Crisis? → ③ → ⑤ End of day". The build follows that order.
- **How to revert**: Change the order in `endDay` and `nextDay` in `apps/web/src/lib/game/engine.ts`. Also change the related tests in `apps/web/src/lib/game/engine.test.ts`.
- **What the team must decide**: Whether this order is correct.

## 2. Time of the night check

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Plant health and harvest". Original (translated from the Korean planning document): "Every night, apply −10 for each metric in danger and −3 for each metric in caution. If all are normal, apply +3."
- **What the problem is**: The document does not say if "every night" uses the values before the overnight change or after it.
- **What was done**: The zones are checked with the values **after** the overnight change. This check is called the "night check". The three items below all use the result of the night check.
  - The change in plant health
  - The number of days in the danger zone (symptom stage)
  - The number of days with chamber humidity in caution or danger (high) (microbial value)
- **Why**: The status shown the next morning agrees with the health change received at night. In the care step, the screen shows the "expected values after tonight" in advance.
- **How to revert**: In `endDay` in `apps/web/src/lib/game/engine.ts`, move the zone check before the change is applied.
- **What the team must decide**: Whether the night check occurs before or after the change is applied.

## 3. Daily care on a day with a crisis

- **Type**: Ambiguous
- **Planning document section**: The diagram in "Service flow". Original (translated from the Korean planning document): "Crisis? No → ③ Daily care … Yes → ③ Show crisis → ④ Select action → Verdict … Appropriate → ⑤ End of day"
- **What the problem is**: The text does not say if daily care is also possible on a day when a crisis ended.
- **What was done**: On a day with a crisis, there is no daily care. When the crisis ends, the day ends immediately. Day 7 (harvest day) also has no daily care.
- **Why**: In the diagram, daily care and crisis display are two separate paths.
- **Caution**: If the player selects "set the fan to high" in the overwatering crisis, the fan stays on high through the night. The player can set the fan lower again in the care step of the next day.
- **How to revert**: Change `continueAfterResult` in `apps/web/src/lib/game/engine.ts` so that it goes to the `care` step instead of `night` when a crisis ends.
- **What the team must decide**: Whether care is permitted on a day when a crisis ended.

## 4. Meaning of "up to two times a day"

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Daily progress and daily care". Original (translated from the Korean planning document): "Daily care actions are limited to two a day (choose from watering amount, fan, and light). The watering amount is None 0, Normal +10, Much +20."
- **What the problem is**: The document does not say if the same action can be done two times, or if "no watering" counts as one action.
- **What was done**: The player can do up to two actions a day, of any type. The player can do the same action two times (for example, "Heavy" watering two times = +40). "No watering" is not an action, so it does not count. The screen shows only the "Normal" and "Heavy" buttons.
- **Why**: "Up to two times" was read literally. Two waterings are necessary for the player to cause an overwatering crisis on purpose.
- **How to revert**: Add a check "one action of the same type per day" in `applyCare` in `apps/web/src/lib/game/engine.ts`.
- **What the team must decide**: Whether the same action is permitted two times a day.

## 5. Effect of the light control

- **Type**: Ambiguous
- **Planning document section**: "Crop and crisis selection > Plant status metrics". Original (translated from the Korean planning document): "Light is not a cause of or an action for a crisis, so it is adjusted only in daily care."
- **What the problem is**: There is no rule for what changes when the light changes.
- **What was done**: The light (red and blue, each low, medium or high) only records the setting. It does not change any value. A light action counts toward the two actions a day. The screen shows the text "Light does not change the values in this simulation".
- **Why**: The build does not add an effect that has no evidence.
- **How to revert**: To add an effect, add a constant to `apps/web/src/lib/game/rules.ts` and apply it in `endDay`.
- **What the team must decide**: Whether to keep the light control, and whether to give it an effect.

## 6. Calculation of the crisis probability

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Crisis occurrence". Original (translated from the Korean planning document): "If a related metric is in the danger zone, a crisis always occurs. If it is in the caution zone, a crisis occurs with 30% probability. The maximum is one per day."
- **What the problem is**: The document does not say if, with two candidate crises, there is one random roll for each or one roll in total.
- **What was done**: The game uses one random number per day. The probability for the day is the highest probability of the candidate crises. If there is no candidate, there is no crisis. On days 2 to 6, the game uses one random number even if there is no candidate (so that the same seed gives the same random number on each day).
- **Files changed**: `crisisProbability` in `apps/web/src/lib/evidence/select.ts`, and `nextDay` in `apps/web/src/lib/game/engine.ts`.
- **Why**: This is the simplest match with "the maximum is one per day".
- **How to revert**: Change `crisisProbability` to give a probability for each candidate, and roll for each candidate in `nextDay`.
- **What the team must decide**: None (adjust after balance tests).

## 7. When more than one crisis is a candidate

- **Type**: Ambiguous
- **Planning document section**: The crisis_id field in "AI output format". Original (translated from the Korean planning document): "One of the candidates given by the code". "What the backend does > Task list". Original: "Receives the current plant and environment status, and selects only the crises whose conditions are met"
- **What the problem is**: There is no rule that selects which crisis to send when there are two candidates. Before AI is connected, nothing makes this selection.
- **What was done**: The game logic in the browser decides **whether** a crisis occurs. The server decides **which** crisis. When the server uses a pre-made crisis, it sends the first candidate. The candidate order is "danger zone first, then the order in the evidence list". The browser checks that the crisis in the response is in the candidates that it calculated.
- **Files changed**: `selectCandidates` in `apps/web/src/lib/evidence/select.ts`, and `apps/web/src/server/ai/crisis/`.
- **Why**: The build keeps the division of work in the planning document ("status management decides when, the code decides which crises are possible, and the AI selects") and also gives the same result every time without AI.
- **How to revert**: Change the line that selects the candidate in `apps/web/src/server/ai/crisis/fallback.ts`.
- **What the team must decide**: After AI is connected, whether to send all candidates to the AI or only one.

## 8. The "+30%p" after a partial verdict

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Effects by verdict". Original (translated from the Korean planning document): "Partial | Ends | Moves only half way toward normal, +30%p probability of the same crisis on the next day"
- **What the problem is**: The document does not say if the crisis occurs with 30% on the next day when the condition for that crisis is not met (when the status is normal).
- **What was done**: The game adds 30%p to the probability **only when** that crisis is a candidate on the next day (60% in the caution zone). If the status is normal, no crisis occurs. The added value applies only to the next day.
- **Caution**: If two crises are candidates on the next day, only the crisis that ended as partial on the previous day stays as a candidate. The exception is when the crisis of the previous day is in the caution zone and the other crisis is in the danger zone. Then the probability is already 100%. Without this rule, the added 30%p can cause a **different** crisis (a problem found in an independent review). The server reads the partial verdict of the previous day from the crisis history in the request and selects the same candidate. (`selectCandidates` and `recurrenceCrisisIdOf` in `apps/web/src/lib/evidence/select.ts`)
- **Why**: If a crisis occurs when the status is normal, the symptoms do not agree with the status values. The planning document requires that a crisis scene "does not contradict the current status values".
- **How to revert**: In `crisisProbability` and `selectCandidates` in `apps/web/src/lib/evidence/select.ts`, add the crisis that ended as partial on the previous day to the candidates, independent of the condition.
- **What the team must decide**: Whether the crisis occurs again even when the status is normal.

## 9. The "related metric" of an appropriate verdict

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Effects by verdict". Original (translated from the Korean planning document): "Appropriate | Ends | The related metric goes to the middle of the normal zone (55) | +5". The list example in "Data processing": `"delta": { "humidity": -10, "plant_health": 5 }`
- **What the problem is**: The overwatering and mold crisis has two causes: root moisture and chamber humidity. The document does not say which metric is the "related metric". Also, the table says "go to 55" and the example says "−10".
- **What was done**: For each action, the `delta` in the evidence list gives which metric changes and how. Three types of value are possible.
  - A number: add that amount.
  - `"to_mid"`: if the metric is outside the normal zone, move it to 55. If it is in the normal zone, do not change it.
  - `"half_to_mid"`: if the metric is outside the normal zone, move it half the distance to 55. If it is in the normal zone, do not change it.
  For the appropriate action for overwatering and mold (set the fan to high), both root moisture and chamber humidity are set to `"to_mid"`.
- **Why**: The table was used as the reference (the planning document calls the numbers in the example "example values to show the format"). If a normal metric also moves to 55, a metric not related to the action changes. So the metric moves only when it is outside the normal zone.
- **How to revert**: Change the `delta` of the related action in `data/content/evidence.json` to a number. No code change is necessary.
- **What the team must decide**: The final values of the change for each action (the `delta` in the evidence list).

## 10. The "one step worse" of an inappropriate verdict

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Effects by verdict". Original (translated from the Korean planning document): "Inappropriate | Continues | One step worse, shown again with new symptoms | −10"
- **What the problem is**: The document does not say if "one step" is one status zone or one symptom stage.
- **What was done**: When the player selects an inappropriate action, two things occur.
  1. The symptom stage increases by 1 (up to the last stage of that crisis).
  2. The `delta` of that action is applied (for example, "give more water" is root moisture +20, plant health −10).
  Then the crisis is shown again with the symptoms of the new stage.
- **Why**: "Shown again with new symptoms" connects to the symptom stage. How much worse the status becomes is different for each action, so it is in the evidence list.
- **How to revert**: `chooseOption` in `apps/web/src/lib/game/engine.ts`, and `computeStage` in `apps/web/src/lib/evidence/select.ts`.
- **What the team must decide**: The change for each inappropriate action.

## 11. The −15 of ground control support

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Effects by verdict". Original (translated from the Korean planning document): "If the player selects inappropriate two times in a row, "ground control support" ends the crisis and plant health changes by −15."
- **What the problem is**: The document does not say if the −15 is added to the −10 of the second inappropriate selection, or if it replaces it. It also does not give the status values after the crisis ends.
- **What was done**: The −15 is **added** to the two −10 values (total −35 in one crisis). Ground control support moves the metrics in the condition of that crisis to 55, in the same way as `"to_mid"`. It does not change the fan setting. "Two times in a row" is counted in one crisis.
- **Why**: The −10 in the table and the −15 in this sentence are given separately. If the status does not go back to normal, the same crisis always occurs again on the next day, and the mission effectively ends.
- **How to revert**: `GROUND_SUPPORT_HEALTH` in `apps/web/src/lib/game/rules.ts`, and `chooseOption` in `apps/web/src/lib/game/engine.ts`.
- **What the team must decide**: Whether the total is −35 or −25.

## 12. Difference between plant health 0 and the harvest grade "Failure"

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Plant health and harvest". Original (translated from the Korean planning document): "When it reaches 0, the mission fails at that moment. The harvest and freezing steps are skipped, and the game ends with a cultivation log summary instead of the ground analysis report.", "On day 7, plant health of 80 or more is Excellent, 50 to 79 is Success, and less than 50 is Failure."
- **What the problem is**: "Failure" has two meanings.
- **What was done**: The two have different names.
  - **Mission failure**: The game ends immediately when plant health reaches 0 (during a crisis or at night). There is no harvest, freezing or report. The screen shows the cultivation log summary.
  - **Harvest grade "Failure"**: Plant health on day 7 is 1 to 49. Harvest, freezing and the ground analysis report continue as usual.
- **Why**: The original text, followed literally, gives this division.
- **How to revert**: `harvestCrop` in `apps/web/src/lib/game/engine.ts`.
- **What the team must decide**: Whether to show the report for the harvest grade "Failure".

## 13. Chamber humidity does not reach the danger zone with the fan on low alone

- **Type**: Wrong
- **Planning document section**: "Game rules > Daily progress and daily care". Original (translated from the Korean planning document): "Chamber humidity increases by 5 if the fan is on low", "Game rules > Microbial value of the harvest". Original: "Day with chamber humidity in danger (high) | +0.2 per day"
- **What the problem is**: From the start value 55, six days with the fan on low give chamber humidity of 60, 65, 70, 75, 80 and 85. A value above 80 (danger) first occurs on the night of day 6. Crises occur only until the morning of day 6. So the overnight change with the fan on low alone does not make chamber humidity cause a crisis that "always" occurs. After the player selects an action in a crisis that increases chamber humidity ("Keep the settings and check again later", +5), chamber humidity can be above 80 on the morning of day 6. The caution zone (30%) occurs only on the mornings of day 5 and day 6.
- **What was done**: The values were not changed. The overwatering and mold crisis is caused mainly by too much watering (root moisture).
- **Why**: Balance values are for the team to set during tests.
- **How to revert**: Not applicable. To change it, increase `NIGHT_DRIFT` (humidity +5 when the fan is on low) in `apps/web/src/lib/game/rules.ts`.
- **What the team must decide**: Whether to increase the humidity increase when the fan is on low.

## 14. Stage 3 is almost never reached by the number of days alone

- **Type**: Wrong
- **Planning document section**: "Game rules > Symptom progression". Original (translated from the Korean planning document): "For overwatering and mold, stage 1 on the first day (droplets at leaf tips, leaf curl), stage 2 on the second day (tissue necrosis), stage 3 from the third day (mold)"
- **Note**: The symptom names of each stage were changed in entry 26. This entry is only about "the path to stage 3".
- **What the problem is**: In the danger zone, a crisis always occurs. Any verdict that ends a crisis moves the status out of the danger zone. So, with the fan on low, the status does not stay in the danger zone for three days.
- **Exception**: Stage 3 is reached if the player keeps the fan on high and continues heavy watering. With the fan on high, the trigger of the overwatering and mold crisis does not hold, so no crisis occurs and root moisture stays in the danger zone (high) for three days. If the player then sets the fan to low, the crisis occurs on the next day at stage 3 from the start (found in the independent review: 12 times in 300,000 random missions).
- **What was done**: The day-count rule is implemented without change. The rule from entry 10 (symptom stage +1 for each inappropriate selection) is added to it. So, if the player selects inappropriate two times in one crisis, stage 3 is reached. This is the usual path to stage 3. Immediately after that, ground control support ends the crisis.
- **Why**: Stage 3 and the "+0.5" of the microbial value can actually occur without a change to the numbers in the planning document.
- **How to revert**: `computeStage` in `apps/web/src/lib/evidence/select.ts`.
- **What the team must decide**: Whether to keep this path to stage 3.

## 15. The format of the evidence list was extended

- **Type**: Wrong
- **Planning document section**: The JSON example in "Data processing > Contents of one list item". Original: `"trigger": { "root_moisture": "high", "airflow": "low" }`, `"symptoms": ["guttation", "epinasty", "necrosis", "mold"]`, `"delta": { "humidity": -10, "plant_health": 5 }`
- **What the problem is**: The example format cannot express four rules in the planning document.
  1. The condition "root moisture **or** chamber humidity is high" (one of the two).
  2. At which stage each symptom occurs.
  3. "Go to 55" and "move only half way".
  4. An action that changes the fan setting ("If the fan is set to high and left there, water shortage comes some days later").
- **What was done**: The format was extended as follows. (`apps/web/src/lib/contract/types.ts`, `apps/web/src/lib/contract/schemas.ts`)
  - `trigger`: `{ "any_of": [{ "metric": …, "side": "low" | "high" }], "fan": "low" }`. If one item of `any_of` is met and the fan matches, the crisis is a candidate.
  - `symptoms`: not only IDs, but `{ symptom_id, name, stage, value_type, source }`.
  - `delta`: the three value types of entry 9, and `"fan": "high" | "low"`.
  - For each crisis: `summary` (the recorded fact), `record` (crop, experiment, text to disclose on screen), and `source`.
  - At the top of the file, `meta` (description and AI use label). At the bottom, `harvest` (evidence for the post-harvest evaluation) and `background` (evidence for the purpose).
- **Why**: The planning document calls the numbers and conditions in the example "example values to show the format". The field names stay the same as in the example, and only necessary fields were added.
- **How to revert**: Not applicable (if the format is reduced, the rules above cannot be expressed).
- **What the team must decide**: Whether the evidence material owner will manage the list in this format.

## 16. Verdicts and value types are written as English codes

- **Type**: Ambiguous
- **Planning document section**: The same JSON example. Original: `"verdict": "적절"`, `"value_type": "게임 값"`
- **What the problem is**: If the values in the data file are in Korean, the data must also change when the screen language changes.
- **What was done**: The data contains codes. The text shown on screen comes from the text files.
  - Verdict: `appropriate` (appropriate), `partial` (partial), `inappropriate` (inappropriate)
  - Value type: `measured` (recorded value), `game_value` (game value)
- **Why**: With the data file separate from the screen language, only the text files change when a language is added.
- **How to revert**: `Verdict` and `ValueType` in `apps/web/src/lib/contract/types.ts`, and `data/content/evidence.json`.
- **What the team must decide**: None.

## 17. Two to three clues and the number of symptoms

- **Type**: Wrong
- **Planning document section**: "AI output format". Original (translated from the Korean planning document): "clues | 2 to 3 observation clues, each with a symptom_id | Only symptoms in the list". "Game rules > Symptom progression". Original: "The code gives the AI only the symptoms up to the current stage as candidates."
- **What the problem is**: If only one symptom is available at a stage, two clues with different symptoms are not possible. For water shortage, the planning document gives only one symptom, "wilting". (In the current evidence list, entry 24 gives two symptoms for water shortage stage 1. But a crisis with only one symptom can be added later, so the rule stays.)
- **What was done**: The check for the number of clues is "1 or more and 3 or less, and 2 or more if 2 or more symptoms are available up to that stage". The same symptom is not used two times in one crisis. (`apps/web/src/server/ai/crisis/validate.ts`)
- **Why**: To not invent symptoms that have no evidence.
- **How to revert**: The clue count check in `apps/web/src/server/ai/crisis/validate.ts`.
- **What the team must decide**: Whether to find more symptoms for water shortage, or to permit one clue.

## 18. Fields added to the crisis request

- **Type**: Ambiguous
- **Planning document section**: "What the backend does > Request and response". Original (translated from the Korean planning document): "Request (screen → backend) | Current plant and environment status, which cultivation day, past crisis history"
- **What the problem is**: With only these three items, the server cannot calculate the symptom stage. It also cannot identify a request to show the same crisis again after an inappropriate selection.
- **What was done**: Three fields were added to the request. (`CrisisRequest` in `apps/web/src/lib/contract/types.ts`)
  - `danger_days`: for each metric, the number of consecutive days in the danger zone.
  - `active`: the crisis in progress (ID, which display it is, the inappropriate actions already selected). `null` at the first display.
  - `locale`: the language of the text.
  The response has these added fields: `stage`, `attempt`, `record_note` (text to disclose on screen when the crop is different), and `origin` (whether it is a pre-made crisis or an AI-generated crisis).
- **Why**: The planning document says that the server does not store progress. So the request must carry the necessary facts.
- **How to revert**: Not applicable.
- **What the team must decide**: None.

## 19. The "set days" of demo mode

- **Type**: Ambiguous
- **Planning document section**: "Game rules > Crisis occurrence". Original (translated from the Korean planning document): "In demo mode, the random seed is fixed so that the two crises occur at least once on set days."
- **What the problem is**: Crises occur from the status, and the status changes with the user's actions. A fixed seed alone does not set the days.
- **What was done**: Demo mode is defined as "fixed seed + set sequence of actions". The sequence of actions is in `docs/DEMO-SCRIPT.md`. If the user follows that sequence, water shortage occurs on day 3 and overwatering and mold on day 5. An automated test runs this sequence from day 1 to the report and checks it. (`DEMO_SEED` in `apps/web/src/lib/game/rules.ts`, `apps/web/src/lib/game/mission-run.test.ts`)
- **Why**: If a crisis is forced onto a day, the rule "crises are set by the status" is broken.
- **How to revert**: Not applicable.
- **What the team must decide**: The sequence of actions to show in the demo.

## 20. Details of the microbial value calculation for the harvest

- **Type**: Ambiguous
- **Planning document section**: The table in "Game rules > Microbial value of the harvest".
- **What the problem is**: There are four details that the table does not give.
- **What was done**:
  1. "Days with chamber humidity in caution or danger (high)" are counted from the result of the night check (entry 2). These are the nights of days 1 to 6, a maximum of 6.
  2. "Progressed to the mold stage (stage 3) +0.5" is added only once in the full mission (unlike the other rows in the table, it does not say "each time").
  3. The "mold crisis" is `overwater_mold` in the evidence list. "Sanitize surfaces" is the action `clean_plant_surfaces` (wipe the plant surfaces) of that crisis (entry 27). "Sanitize at harvest" is to harvest with sanitized scissors (entry 29).
  4. The calculated value is rounded to two decimal places, then limited to 1.5 to 6.0. The two ends of the recorded range (2.14, 4.86) are "in the range".
- **Files changed**: `MICROBIAL` in `apps/web/src/lib/game/rules.ts`, and `computeMicrobial` in `apps/web/src/lib/game/engine.ts`.
- **Why**: The numbers in the table stay as they are. Only the details that the table does not give were decided, in the simplest way. The night check counts days by the same rule as plant health and the symptom stage.
- **How to revert**: The two files above.
- **What the team must decide**: None (adjust after tests).

## 21. Language of the screens

- **Type**: Uncertain
- **Planning document section**: "Items to agree first and order of work > Schedule and owners". Original (translated from the Korean planning document): "Language of screens and submission | Not decided"
- **What the problem is**: The screen language is not decided. The competition rules require that the material linked from the submission page is in English.
- **What was done**: The text of the screens and the data is in English. All screen text is in `apps/web/src/lib/i18n/en/`. The text of the pre-made crises is in `data/content/fallback-crises.json`.
- **Why**: The repository and the demo screens are linked from the submission page.
- **How to revert**: To add Korean, make text files with the same structure in `apps/web/src/lib/i18n/ko/` and register them in `apps/web/src/lib/i18n/index.tsx`.
- **What the team must decide**: Whether to also have Korean screens.

## 22. Scope without the AI connection, and where to connect it

- **Type**: Uncertain
- **Planning document section**: "AI use > AI processing steps", "Technology stack". Original (translated from the Korean planning document): "Model call | LLM API that supports structured output (JSON)"
- **What the problem is**: The language model and the instructions are not decided.
- **What was done**: The code that calls a language model and the instructions were not made. Now all crises come from the pre-made crises (`data/content/fallback-crises.json`). The connection points are as follows.
  - `apps/web/src/server/ai/crisis/generator.ts`: the format of the generator. The input is `GenerationInput` (current status, evidence for the candidate crises, past history). The output is the AI output format of the planning document (`AiCrisisOutput`). Make a function in this format and pass it in `apps/web/src/app/api/crisis/route.ts`.
  - `validateAiOutput` in `apps/web/src/server/ai/crisis/validate.ts`: does the four checks of the planning document (format, IDs are in the list, at least one appropriate option, no duplicate actions). The pre-made crises must also pass the same checks.
  - `apps/web/src/server/ai/crisis/pipeline.ts`: generate → validate → if it fails, try one more time → if it fails again, use a pre-made crisis. If there is no generator, it sends a pre-made crisis immediately.
  - `apps/web/src/server/ai/crisis/attach.ts`: uses the action ID to find the verdict, the change and the source in the evidence list, and attaches them.
- **Why**: The planning document already defines the AI output format, the validation and the failure handling. With those parts built first, the AI is connected by adding one generator function.
- **How to revert**: Not applicable.
- **What the team must decide**: The language model, the instructions, and the time limit for the response.

## 23. Location of the status criteria table

- **Type**: Ambiguous
- **Planning document section**: "Modules and division of work > ① Evidence material". Original (translated from the Korean planning document): "Makes the normal, caution and danger criteria for the plant and environment status."
- **What the problem is**: The document does not say in which file the status criteria are kept.
- **What was done**: The zone limits are in `data/content/state-criteria.json` (marked as game values). The other rule values (overnight change, watering amounts, probabilities, health changes, microbial values) are constants in `apps/web/src/lib/game/rules.ts`.
- **Why**: The zone boundaries are the data that the planning document calls "status criteria", so they are in a data file. Only the game logic uses the other numbers, so they are constants in the code.
- **How to revert**: Not applicable.
- **What the team must decide**: None.

## 24. The water shortage symptom "wilting" is not in the source text

- **Type**: Wrong
- **Planning document section**: The table in "Crop and crisis selection > Crisis candidates". Original (translated from the Korean planning document): "① Water shortage | … | Wilting | Inject water directly into the pillows"
- **What the problem is**: The downloaded material and the VEG-01 records on the NASA Technical Reports Server (NTRS) do not say anywhere that the lettuce "wilted" (searched for wilt, wilting, droop).
- **What was done**: The symptoms were changed to words that are in the source text. (`data/content/evidence.json`)
  - Stage 1: "plants not growing well" (`poor_growth`), "pillow wicks are dry" (`dry_wicks`). Original: "After about a week and a half it was observed that plants were not growing well and that pillow wicks were dry."
  - Stage 2: "stressed plants" (`stressed_plants`). The source does not give the order of the symptoms. The team set the order of stage 1 and stage 2. Original: "Direct watering of the pillows led to a recovery in several of the stressed plants; a couple of which did not recover."
  - Source: the abstract of Massa, Dufour, Smith (2014), NTRS 20150001374.
- **Why**: To not show a symptom without a confirmed source as if it were a NASA record.
- **How to revert**: If a source text with "wilting" is found (for example, Massa et al. 2017, the VEG-01 validation paper), add it with the quoted sentence to `water_shortage.symptoms` in `data/content/evidence.json`.
- **What the team must decide**: Whether to check the body text of the VEG-01 validation paper.

## 25. The water shortage action is "add directly", not "inject", and it is a record of the first grow-out

- **Type**: Wrong
- **Planning document section**: The same table. Original (translated from the Korean planning document): "In the VEG-01 lettuce grow-out, the reservoir did not send enough water up to the pillows | … | Inject water directly into the pillows"
- **What the problem is**: The source text is "added water directly to the plant pillows". The word "inject" is not in it. Also, the abstract of this record calls the experiment only "VEG-01" (May to June 2014) and does not name the crop. That the crop was 'Outredgeous' red romaine lettuce is in a different NASA document (NTRS 20160004060). For the second grow-out (VEG-01B), there is only this sentence: "the plants had some periods of low water early on" (Khodadad et al., 2020, about VEG-01A and VEG-01B).
- **What was done**: The action is named "add water directly to the pillows" (`add_water_direct`). The record field of the crisis says VEG-01, and the source sentence for the crop name is attached in `note`. The three wrong actions (refill the reservoir, wait for the next watering schedule, set the fan to high) have source sentences attached, and `note` says that their verdicts were given by the team.
- **Why**: The words in the evidence list must not say more than the source text. Judges must be able to follow the source and check it.
- **How to revert**: `water_shortage` in `data/content/evidence.json`.
- **What the team must decide**: Whether the verdicts of the three wrong actions (1 partial, 2 inappropriate) are correct.

## 26. The overwatering and mold symptoms and their order are not in usable source text

- **Type**: Wrong
- **Planning document section**: The table in "Crop and crisis selection > Crisis candidates". Original (translated from the Korean planning document): "In VEG-01C zinnia, droplets formed at the leaf tips and leaves curled downward, then mold occurred | droplets at leaf tips, leaf curl, tissue necrosis, mold". "Game rules > Symptom progression". Original: "Follows the order recorded in VEG-01C."
- **What the problem is**: "Droplets at leaf tips (guttation)" and "leaves curl downward (epinasty)" for zinnia are not in any of the checked material. "Leaf curl" and "necrosis" are only in the abstract of Schuerger et al. 2021. That abstract has a non-commercial license (CC BY-NC), so it was not used as data. No material gives the order of the symptoms by date.
- **What was done**: The symptoms were changed to words that are in usable source text. (`data/content/evidence.json`)
  - Stage 1: "excess moisture around the plants" (`excess_moisture`), "water droplets left on the leaves" (`leaf_droplets`). The second is a general statement about poor air circulation, not an observation record of zinnia. The "About this record" field on the crisis screen and the evidence and sources screen disclose this.
  - Stage 2: "mold on leaves and stems" (`fungal_growth`). Original: "aerial mycelium was observed on the leaves and stems of zinnia plants"
  - Stage 3: "rot of leaves and stems" (`rot`). Original: "became afflicted with a foliar, stem, and root rot disease"
  - `note` says that the order of stage 2 and stage 3 was set by the team.
- **Caution**: The "mold stage (stage 3)" of the planning document is now the "rot" stage. The "+0.5" of the microbial value stays on stage 3. The related row in the report says "rot stage (stage 3)".
- **Why**: A symptom that was not found in a source text cannot be shown as a record. The abstract with the non-commercial condition was not used as data in a public repository.
- **How to revert**: `overwater_mold.symptoms` in `data/content/evidence.json`, and the related text in `data/content/fallback-crises.json`.
- **What the team must decide**: Whether to accept these three stages. Whether to check the body text of Schuerger et al. 2021 and restore the symptoms of the planning document.

## 27. The overwatering and mold actions "remove dead tissue" and "sanitize surfaces" are not in the source text

- **Type**: Wrong
- **Planning document section**: The same table. Original (translated from the Korean planning document): "Remove dead tissue, sanitize surfaces, set the fan to high". The example in "AI output format": `"action_id": "remove_dead_tissue"`
- **What the problem is**:
  - "Remove dead tissue" is not in the checked material.
  - "Sanitize surfaces" is not there. What is there is a sentence that the astronaut "delicately cleaned off the fungus".
  - There is no record that the fan was actually set to high during the zinnia grow-out. What is there is a sentence in the growing procedure: "nominal setting is low, high setting will dry excess moisture".
- **What was done**: The actions are these four. (`data/content/evidence.json`)
  - Appropriate: "set the fan to high" (`fan_high`). The source is the growing procedure. `note` says that no record of the actual change was found.
  - Partial: "wipe the plant surfaces" (`clean_plant_surfaces`). The source is a NASA article.
  - Inappropriate: "give more water" (`add_water`), "keep the settings and check again later" (`wait_and_observe`).
  - `remove_dead_tissue` and `sanitize_surfaces` were removed. The microbial value rule "sanitize surfaces during a crisis" is attached to `clean_plant_surfaces` (`SANITIZE_ACTION_ID` in `apps/web/src/lib/game/rules.ts`).
- **Why**: An action that is not in a source text cannot be shown as a recorded action. Four options are necessary so that three stay after one inappropriate option is removed.
- **How to revert**: If source text is found, add the action to `data/content/evidence.json` and add the option text to `data/content/fallback-crises.json`.
- **What the team must decide**: Whether the four actions and their verdicts are correct.

## 28. No record was found that "a fan on high causes water shortage"

- **Type**: Uncertain
- **Planning document section**: The table in "Crisis candidates". Original (translated from the Korean planning document): "If the fan stays on high, the plants become too dry and water shortage occurs". The paragraph below it. Original: "Real cases where a fix for one side causes the other side are used as wrong options."
- **What the problem is**: The checked material has no record that water shortage came after the zinnia was dried (medium confidence. The body text of Schuerger et al. 2021 and Massa et al. 2017 were not opened).
- **What was done**: The game rule stays (when the fan is on high, root moisture −15 each night; `NIGHT_DRIFT` in `apps/web/src/lib/game/rules.ts`). The screens and the evidence list do not call this a "real case".
- **Why**: The rule itself is a game value, so it can stay. Only the words "real case" have no source.
- **How to revert**: Not applicable.
- **What the team must decide**: To not call this connection a "real case" in the presentation.

## 29. The sanitizing wipes (Pro-San) at harvest are a procedure for produce that is eaten

- **Type**: Ambiguous
- **Correction (Nov 15)**: This entry first said that the wipes are "not in the source text" (type: Wrong). A source was then found on the NASA Technical Reports Server (NTRS), and the entry was corrected. The first search (wipe, sanitiz, Pro-San, citric) did not find this document.
- **Planning document section**: "Post-harvest microbial evaluation > Steps". Original (translated from the Korean planning document): "⑥ Harvest and sanitizing | On day 33, harvest the leaves and wipe them with sanitizing wipes (Pro-San)"
- **What the problem is**: The wiping procedure is recorded. The source is the NASA presentation "Veggie ISS Validation Test Results and Produce Consumption" (Massa et al. 2015, NTRS 20150021302). Source text: "Produce shall be wiped at harvest according to produce-specific procedure.", "Crew was approved to consume produce with precautionary wiping." But the same document says that the harvest of the second crop was divided: "½ the produce harvested for consumption, ½ for science". The wiping procedure is for the produce that is eaten. The ground analysis report of the game is about the sample that is frozen and returned. No record was found that this sample was wiped. The procedure that was confirmed for the frozen sample is "harvested after 33 days of growth using sanitized scissors to remove the leaves" (Khodadad et al. 2020).
- **What was done**: The harvest choice stays "harvest with sanitized scissors / harvest without sanitizing the scissors". The microbial value rule "sanitized at harvest −0.3" applies when the player selects sanitized scissors (game value). The record of the wipes is not in the evidence list.
- **Why**: The report compares the value of the frozen sample. The procedure that was confirmed for that sample is sanitized scissors. If the wipes become the harvest choice, the screen says that wiped leaves were analyzed, and there is no record of that.
- **How to revert**: To add the wipes, add the quoted sentences and the source to `harvest.steps` in `data/content/evidence.json` and change the harvest step text in `apps/web/src/lib/i18n/en/report.ts`. Say on screen that the procedure is for produce that is eaten.
- **What the team must decide**: Whether to add the choice "wipe the produce that will be eaten" to the harvest step. Whether the "NASA NTRS presentation" that the planning document links is NTRS 20150021302.

## 30. What the recorded range 2.14 to 4.86 refers to

- **Type**: Wrong
- **Planning document section**: "Post-harvest microbial evaluation > What the report shows". Original (translated from the Korean planning document): "Recorded range of bacteria and fungi in ISS and ground red romaine lettuce: 2.14 to 4.86 log10 CFU/g"
- **What the problem is**: The abstract of the paper (Khodadad et al. 2020) calls this range "total counts for bacteria and yeast/molds". But in the body text, 2.14 and 4.86 are the lowest and highest of **four mean bacterial counts on leaves of lettuce grown on the ISS** (3.53, 4.86, 2.89, 2.14). The fungal counts are given separately as 2.3 to 4.3. The leaf values of the ground control are not given as numbers in the body text.
- **What was done**: The description on the report screen says "the lowest and highest of four mean bacterial counts on leaves of lettuce grown on the ISS". The quoted sentence is from the body text. (`harvest.microbial_range` in `data/content/evidence.json`)
- **Why**: A value shown as recorded must also agree with the source text about what it is a count of.
- **How to revert**: `description` in the same file.
- **What the team must decide**: To not use the wording "ISS and ground" and "bacteria and fungi" in the presentation material either.

## 31. The document used as evidence for the purpose

- **Type**: Uncertain
- **Planning document section**: Evidence item 2 in "Purpose". Original (translated from the Korean planning document): "A NASA science white paper says that diseased or stressed plants can cause stress and anxiety in the crew ([link: NASA white paper])"
- **What the problem is**: The terms of use of that white paper were not confirmed, and the file contains the authors' contact details. Also, no material was found that **measured** the effect of diseased plants on crew mood.
- **What was done**: The white paper is not used as evidence on screen. A sentence with the same meaning is quoted from the NASA Human Research Program evidence report (2025), and `note` says "a recommendation to consider, not a measured effect". (`background` in `data/content/evidence.json`)
- **Why**: A document with unconfirmed usage terms was not quoted in a public repository. A sentence with the same meaning is in a NASA report that is released to the public.
- **How to revert**: `background` in the same file.
- **What the team must decide**: To state this claim in the presentation only at the strength of a "recommendation".

## 32. The value type that the planning document calls "measured" is shown on screen as "Recorded"

- **Type**: Ambiguous
- **Planning document section**: "Data processing > Contents of one list item". Original (translated from the Korean planning document): "Value type | Whether it is a recorded value or a game value"
- **What the problem is**: The evidence list also has records that are not numbers (symptoms, procedures). The label "Measured" does not fit these.
- **What was done**: The data code stays `measured`. Only the text on screen is "Recorded" (taken from a source document). (`apps/web/src/lib/i18n/en/common.ts`)
- **Why**: The label must be correct for all the things it is attached to (numbers, symptoms, procedures).
- **How to revert**: `value_type.measured` in the same file.
- **What the team must decide**: None.

## 33. When "sanitize surfaces" is selected, the microbial value goes up

- **Type**: Wrong
- **Planning document section**: The table in "Game rules > Microbial value of the harvest". Original (translated from the Korean planning document): "Mold crisis ended as partial | +0.3", "Selected sanitize surfaces during a crisis | −0.2 each time (maximum −0.6)"
- **What the problem is**: The verdict of the action that wipes the surfaces is "partial". So one selection of this action gives both +0.3 and −0.2, and the value goes up by 0.1. Also, a partial verdict ends the crisis. So to reach "maximum −0.6", three separate mold crises must occur.
- **What was done**: The two rules are implemented as written in the table. The values were not changed. The "choices that changed the value" table in the report shows the two rows separately.
- **Why**: Which one to change is for the team that sets the balance.
- **How to revert**: Select one of the two. (a) Make `MICROBIAL.crisis_sanitize` in `apps/web/src/lib/game/rules.ts` larger than +0.3, for example −0.4. (b) In `computeMicrobial` in `apps/web/src/lib/game/engine.ts`, do not add +0.3 to a crisis that ended as partial by wiping the surfaces.
- **What the team must decide**: Whether the choice to wipe the surfaces decreases the value.

## 34. A format check of the crisis response was added to the shared type file

- **Type**: Ambiguous
- **Planning document section**: "Technology stack". Original (translated from the Korean planning document): "Output validation | Zod | Checks the format and that the linked IDs (crisis, symptom, action) are in the list, and retries on failure"
- **What the problem is**: The planning document only says that the server checks the AI output. It does not say if the screen can trust the server response.
- **What was done**: The screen also checks the format when it receives a response (`crisisResponseSchema` in `apps/web/src/lib/contract/schemas.ts`). Then the game logic compares the crisis and action IDs with the evidence list. For the verdict and the change, the game applies the values from the evidence list, not the values in the response.
- **Why**: So that a broken response does not damage the saved mission.
- **How to revert**: Not applicable.
- **What the team must decide**: None.

## 35. Option text and "no wording that shows the correct answer"

- **Type**: Ambiguous
- **Planning document section**: "AI output format". Original (translated from the Korean planning document): "options.label | Option text shown on screen | No wording that shows the correct answer", "scene | 2 to 3 sentences about what is seen in the grow chamber | Must not contradict the current status values"
- **What the problem is**: A person must read the text to judge these two constraints. Code cannot check them. Also, if the crisis name ("Excess water and stagnant air leading to mold") is shown before the selection, it shows the answer.
- **What was done**:
  - The scene text of the pre-made crises gives only the symptoms seen on the plants. It does not give measured values or causes. So it does not contradict any status value.
  - The screen hides the crisis name before the selection and shows it on the result screen.
  - The option order is different in each pre-made crisis.
- **Why**: Constraints that code cannot check are kept by the rules for writing the text and by the order of the screen.
- **How to revert**: `data/content/fallback-crises.json`, and the crisis panel in `apps/web/src/features/grow-room/`.
- **What the team must decide**: After AI is connected, who checks these two constraints and how.

## 36. The microbial value cannot be "below the range"

- **Type**: Wrong
- **Planning document section**: "Game rules > Microbial value of the harvest". Original (translated from the Korean planning document): "Base value | 3.0 log10 CFU/g", "Sanitized at harvest | −0.3", "The report shows only "below the range / in the range / above the range" against the recorded range (2.14 to 4.86)"
- **What the problem is**: The only rules that decrease the value are "sanitize at harvest −0.3" and "sanitize surfaces during a crisis −0.2 (maximum −0.6)". Sanitize surfaces is a partial verdict, so the same selection also adds +0.3 (entry 33). So the lowest value is 3.0 − 0.3 = 2.70, and it cannot be lower than the lower end of the range, 2.14. "Below the range" never shows on screen.
- **What was done**: All three displays are implemented. The values were not changed.
- **Why**: Balance values are for the team to set during tests. The screen must be able to show all three cases.
- **How to revert**: `MICROBIAL` in `apps/web/src/lib/game/rules.ts`.
- **What the team must decide**: Whether to adjust the values so that "below the range" can occur.

## 37. The server checks the evidence list before it sends a crisis

- **Type**: Ambiguous
- **Planning document section**: "What the backend does > Task list". Original (translated from the Korean planning document): "Load and check the evidence list | Reads the list JSON and checks for duplicate IDs, at least one appropriate action per crisis, and no missing sources | Required"
- **What the problem is**: The document does not say when the check occurs, or what happens when the check fails.
- **What was done**: The check occurs in two places.
  1. Test (`apps/web/src/lib/evidence/check.test.ts`): passes only if the evidence list in the repository has no errors.
  2. Server (`apps/web/src/server/ai/crisis/pipeline.ts`): checks the list before it sends a crisis (once after the server starts). If there is an error, it does not send a crisis and sends a 500 response. The screen shows a "Retry" button.
- **Why**: So that no crisis is sent from evidence that did not pass the check.
- **Caution**: The "Evidence and sources" screen shows the list as it is. It does not run the check, so the tests prevent errors in the list.
- **How to revert**: `assertEvidenceChecked` in `apps/web/src/server/ai/crisis/pipeline.ts`.
- **What the team must decide**: None.

## 38. Items in the planning document that were not built

- **Type**: Uncertain
- **Planning document section**: The figure in "Service flow". Original (translated from the Korean planning document): "① Start cultivation (red romaine lettuce · set the mission length)". "Items to review before confirmation". Original: "Decide whether the player writes one line of reason after the selection (used in the record and the report)". "What the backend does > Task list". Original: "Keep a generation log | … | Optional", "Quote check script | … | Optional". "Crisis candidates". Original: "③ Ethylene build-up (optional)". "Technology stack". Original: "Quality test | Repeated generation script"
- **What the problem is**: Some items are in the planning document but are not in this build. The reasons are different for each item.
- **What was done**: These six items were not built.
  1. **Setting the mission length.** The game rules fix the mission at seven days ("The mission is seven days"), so there is no setting screen. On the start screen the player selects only a standard mission or a demo mission. (`GAME_DAYS` in `apps/web/src/lib/game/rules.ts`)
  2. **One line of reason after the selection.** The planning document did not decide this item, so it was not added.
  3. **Generation log.** This is a log of the input given to the AI and the output received. The AI connection is not built, so there is nothing to log.
  4. **Quote check script.** A script outside the repository checked that each quoted sentence is in the source text. The downloaded source texts are not in the repository, so the script is not in it.
  5. **Ethylene build-up crisis.** This is the third crisis, which the planning document marks as optional. The planning document says that its source is a record of wheat and needs confirmation.
  6. **Prompt and repeated generation script.** These are AI planning tasks and belong to the AI connection.
- **Why**: Only two kinds of items were left out: items that the planning document itself marks as optional or not decided, and items that have meaning only with the AI connection.
- **How to revert**: Not applicable. To add them: item 1 goes in `apps/web/src/lib/game/rules.ts` and the start screen, item 2 in `CrisisAttemptRecord` in `apps/web/src/lib/contract/types.ts` and the result screen, item 5 in `data/content/evidence.json` and `data/content/fallback-crises.json`.
- **What the team must decide**: Whether to add any of these before submission.
