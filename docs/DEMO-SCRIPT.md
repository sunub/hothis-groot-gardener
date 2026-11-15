# Demo script

Demo mode uses a fixed random seed. If you do the care steps below in this order, the same crises occur on the same days every time. A test (`apps/web/src/lib/game/mission-run.test.ts`) runs these exact steps from day 1 to the report.

All numbers below are game values.

## Before you start

1. Run `npm run dev` and open http://localhost:3000.
2. Select **Start demo mission**.

## Steps

Wait a moment after each screen change before you select the next button. The app ignores a click in the first 0.6 seconds after the screen changes, so that a double click does not press a button on the next screen.

| Game day | Cultivation day | What you see in the morning | What you do | What it shows |
|---|---|---|---|---|
| 1 | 1 | Health 70, root moisture 55, humidity 55, fan low | Do no care. End the day. | Sowing day. Overnight change: root moisture −10, humidity +5. |
| 2 | 6 | Health 73, root moisture 45, humidity 60 | Do no care. End the day. | Root moisture drops into the low caution zone overnight (35). Health −3. |
| 3 | 12 | **Crisis: water shortage.** Root moisture 35 | Choose **Add water directly to the plant pillows**. | Appropriate. Root moisture returns to 55, health +5. The source sentence from the VEG-01 record is shown. |
| 4 | 17 | Health 78, root moisture 45, humidity 70 | Water **Heavy** two times. End the day. | Over-watering: root moisture 85, then 75 after the night. Humidity 75. Two caution zones, health −6. |
| 5 | 22 | **Crisis: excess water and stagnant air.** Root moisture 75, humidity 75, fan low | First choose **Give the plant pillows more water** (wrong on purpose). Then choose **Switch the fan setting up to high**. | Inappropriate: health −10, symptoms get worse and the crisis is shown again without the wrong option. Then appropriate: both values return to 55, health +5, the fan stays on high. The screen says that this record is from zinnia in the same hardware. |
| 6 | 28 | Health 70, root moisture 40, humidity 45, fan high | Set the fan to **Low**. Water **Normal**. End the day. | The fan stays where the crisis left it until you change it. |
| 7 | 33 | Health 73 | Choose **Harvest with sanitized scissors**. Then send the samples. | Harvest grade: Success. |

## What the report shows at the end

- Microbial value of the harvest: **3.3 log10 CFU/g** (game value) = 3.0 baseline + 0.1 (one night with humidity in the high caution zone) + 0.5 (one inappropriate choice in the mold crisis) − 0.3 (sanitized scissors at harvest).
- It is within the recorded range of 2.14 to 4.86. The report states that being within the range does not mean the harvest is safe.
- Verdicts: 2 appropriate, 1 inappropriate. Attempts: 1 for the water shortage, 2 for the excess water crisis. Nights in a danger zone: 0.

## If you leave the script

The seed fixes the random numbers, not the crises. A crisis occurs only when the plant state calls for one:

- On days 2 to 6, a value in a **danger** zone in the morning always causes a crisis when a crisis watches that value: low root moisture (water shortage), or high root moisture or high humidity with the fan on Low (excess water). Low humidity causes no crisis, and high values with the fan on High cause none.
- Standard missions (not the demo) also get overnight changes, which move one watched value into its caution zone, until two crises have occurred.
- A value in a **caution** zone causes a crisis with a 30% chance. With the demo seed, that roll succeeds on days 3 and 5 and fails on days 2, 4 and 6.
