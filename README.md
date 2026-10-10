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
| Main batches | 0.049 | 0.067 |
| Repeat batches | 0.074 | 0.076 |

Presets: main batch → trained on main batches only; repeat batch → main + repeat (repeat weighted 0.5).

## Estimating without a vacancy list
Choose "I don't have it: estimate from past years" and enter only your merit number and total
candidates. Each hospital's share of posts in past batches of the same type is scaled to your total,
and each simulation run redraws a past year's pattern. A "typical pick at my position" column shows
where an average candidate at your rank ends up (open hospitals weighted by popularity).
Backtest Brier score: main 0.065 estimated vs 0.049 with the real list (baseline 0.089);
repeat 0.088 vs 0.074 (baseline 0.091). So it is usable, but less certain.

## Data notes
- `2026 August.csv` (2018/2019 main intake) is used **for vacancy estimates only**. Its merit
  numbers are scores (higher = better, with gaps), so rows are ranked by score order, but the
  allocation has no merit-order structure (teaching share flat across the list, Colombo peaks mid-list,
  one end ~70% northern/eastern). Training on it made backtests much worse, so it is excluded from
  popularity fitting (`ORDER_UNRELIABLE` in `scripts/hospitals.mjs`). Remove the entry to include it.
- The repo is public. That CSV had candidate names typed into the institution column, so the committed
  copy has them replaced by `UNKNOWN`; the original is kept locally in `prev-data/private/` (git-ignored).
  For future files with names, run `node scripts/sanitize-csv.mjs "prev-data/<file>.csv"` before committing.
- Rows that name no hospital (`UNKNOWN`, bare "DGH"/"BH") are dropped; their post can't be attributed.
- New hospitals with no usable history (Mannar, Mullerriyawa, Theldeniya, Warakapola, Dambadeniya) borrow a
  comparable hospital's popularity (`like` in `scripts/hospitals.mjs`); their Base A/B category is assumed.

## Assumptions to check
- Location scores (1-5) in `scripts/hospitals.mjs` are rough estimates; edit them in the UI too.
- BH Point Pedro only appears as plain "BH" in the data; it is assumed Base A.
- PGH hospitals are grouped with Teaching (they became TH in later years).
- Only two main batches exist, so main-batch estimates are uncertain; treat them as a guide.
- 3 garbled rows are dropped; `DGH GAMPOLA` (1 row) is treated as a Gampaha typo.
