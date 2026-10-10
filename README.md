# Merit Allocation Predictor

Static, client-side app (no backend): enter your merit number, total candidates and this year's
vacancies; get the chance each hospital is still open at your turn, and the chance you end up at
each hospital given your priority order.

## Run locally
```
npm run dev          # serves ./public at http://localhost:8788
```
(ES modules and workers need http, so don't open index.html as a file.)

## Update the data
Drop new CSVs (`Batch_Date,Merit_Position,Allocated_Institution`) into `prev-data/`, then:
```
npm run build:data   # cleans names -> public/data/batches.json
npm run backtest     # leave-one-batch-out accuracy check
```
The build fails and lists any institution name it can't match. Add the spelling to the alias
list in `scripts/hospitals.mjs` (also where hospital categories and location scores live).

## Deploy to Cloudflare Pages (not done yet)
`public/` is the whole site; no build step is needed because `public/data/batches.json` is committed.
```
npx wrangler login
npm run deploy       # wrangler pages deploy public
```
Or connect a Git repo in the Pages dashboard with build command empty and output directory `public`.
Note: the published site includes the cleaned allocation data (`/data/batches.json`).

## Model
Candidates pick in merit order from hospitals with posts left. Each pick is Plackett-Luce
(`P(h) = w_h / Σ w over open hospitals`); weights are fitted from past batches (MM algorithm), per
merit-position segment. A Monte Carlo run (4000 replays of the candidates ahead of you) gives
P(open at your turn); your final-allocation odds are computed from the same runs for whatever
priority order you set, so reordering is instant.

Backtest (Brier score, lower is better, on held-out batches):

| Holdout | This model | "Same relative position in other years" |
|---|---|---|
| Main batches | 0.045 | 0.060 |
| Repeat batches | 0.075 | 0.078 |

Presets: main batch → trained on main batches only; repeat batch → main + repeat (repeat weighted 0.5).

## Estimating without a vacancy list
Choose "I don't have it: estimate from past years" and enter only your merit number and total
candidates. Each hospital's share of posts in past batches of the same type is scaled to your total,
and each simulation run redraws a past year's pattern. A "typical pick at my position" column shows
where an average candidate at your rank ends up (open hospitals weighted by popularity).
Backtest Brier score: main 0.079 estimated vs 0.045 with the real list (baseline 0.106);
repeat 0.089 vs 0.075 (baseline 0.093). Hospitals that are new to the list (no earlier batch had them)
cannot be anticipated, so the estimate is least reliable for those. So it is usable, but less certain.

## Data notes
- `2026 August.csv` was extracted from the published PDF. Its columns are Merit No, registration number,
  name, institution; only merit number and institution are kept (no names). Eight merit numbers are
  genuinely absent from the PDF (59, 168, 225, 684, 774, 843, 1172, 1186), so merit numbers can have gaps;
  only their order is used. Check new extractions against the PDF: OCR drops rows and garbles names.
- Rows marked "NOT APPLIED" are kept as skips. The vacancy count per hospital is how many times it appears.
- New hospitals first seen in Aug 2026 (Mannar, Mullerriyawa, Theldeniya, Warakapola, Dambadeniya) are
  listed as plain "BH"/"DGH", so their Base A/B category is an assumption.

## Data verification
Every CSV was checked against its source PDF with an independent OCR (Apple Vision), keyed by merit number,
and uncertain rows were read from the page images. The only errors were three rows with garbled text
(Oct 2023 #814 and #1392, June 2023 #311), now fixed. Look-alike Greek/Cyrillic letters were replaced by
plain Latin ones. July 2026 #236 is printed as "DGH Gampola" in the official list itself; it is read literally
as Gampola. All rows now map to a hospital, so nothing is dropped.

## Assumptions to check
- Location scores (1-5) in `scripts/hospitals.mjs` are rough estimates; edit them in the UI too.
- BH Point Pedro only appears as plain "BH" in the data; it is assumed Base A.
- PGH hospitals are grouped with Teaching (they became TH in later years).
- Only two main batches exist, so main-batch estimates are uncertain; treat them as a guide.
