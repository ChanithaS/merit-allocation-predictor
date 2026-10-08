// Leave-one-batch-out backtest: predict which hospitals are still open at various merit
// positions of a held-out batch, using only the other batches, and score against what happened.
import { readFileSync } from 'node:fs';
import { fitWeights, fillMissing, simulate, vacancyEstimator } from '../public/js/model.js';

const data = JSON.parse(readFileSync(new URL('../public/data/batches.json', import.meta.url)));
const H = data.hospitals.length;
const cats = data.hospitals.map(h => h.cat);
const holdouts = (process.argv[2] ?? 'main').split(',');

function truth(b, R) { // posts left when it is position R's turn
  const rem = new Int32Array(H);
  b.seq.forEach(h => { if (h >= 0) rem[h]++; });
  for (let i = 0; i < R - 1; i++) if (b.seq[i] >= 0) rem[b.seq[i]]--;
  return rem;
}

// Baseline: for each hospital, how often it was still open at the same relative position in training batches.
function empirical(train, b, R) {
  const p = new Float64Array(H).fill(NaN);
  for (let h = 0; h < H; h++) {
    let hit = 0, n = 0;
    for (const t of train) {
      const vac = t.vacancies[data.hospitals[h].id];
      if (!vac) continue;
      const rem = truth(t, Math.round((R / b.n) * t.n));
      n++; if (rem[h] > 0) hit++;
    }
    if (n) p[h] = hit / n;
  }
  return p;
}

function run(label, trainFilter, opts) {
  let sumM = 0, sumE = 0, cnt = 0, hits = 0;
  const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, a: 0 }));
  for (const b of data.batches) {
    if (!(holdouts.includes(b.type) || holdouts.includes(b.id))) continue;
    const train = data.batches.filter(t => t !== b && trainFilter(t));
    if (!train.length) continue;
    const { w, seen } = fitWeights(train, H, opts);
    const wf = fillMissing(w, seen, cats);
    const vac = new Int32Array(H);
    b.seq.forEach(h => { if (h >= 0) vac[h]++; });
    const est = opts.est ? vacancyEstimator(train.filter(t => t.type === b.type), data.hospitals.map(h => h.id), b.n) : null;
    for (let q = 0.05; q < 0.96; q += 0.05) {
      const R = Math.max(2, Math.round(q * b.n));
      const res = simulate({ w: wf, vac, vacSampler: est?.sampler, rank: R, n: b.n, priority: [], sims: 600, sigma: opts.sigma ?? 0.3, naRate: b.notApplied / b.n });
      const act = truth(b, R), emp = empirical(train, b, R);
      for (let h = 0; h < H; h++) {
        if (!vac[h] && !(est && est.mean[h] > 0)) continue;
        const a = act[h] > 0 ? 1 : 0;
        sumM += (res.open[h] - a) ** 2;
        sumE += ((isNaN(emp[h]) ? 0.5 : emp[h]) - a) ** 2;
        cnt++; hits += (res.open[h] > 0.5) === !!a ? 1 : 0;
        const k = Math.min(9, Math.floor(res.open[h] * 10));
        bins[k].n++; bins[k].p += res.open[h]; bins[k].a += a;
      }
    }
  }
  console.log(`${label.padEnd(34)} Brier model=${(sumM / cnt).toFixed(4)}  empirical-baseline=${(sumE / cnt).toFixed(4)}  accuracy@0.5=${(hits / cnt * 100).toFixed(1)}%  (n=${cnt})`);
  return bins;
}

console.log(`Holdout: ${holdouts.join(',')}  (lower Brier is better)\n`);
const all = () => true, main = t => t.type === 'main';
const variants = [
  ['KNOWN vacancies (main preset)', main, { decay: 1, segments: 3, sigma: 0.1 }],
  ['ESTIMATED vacancies (main preset)', main, { decay: 1, segments: 3, sigma: 0.1, est: true }],
  ['KNOWN vacancies (repeat preset)', all, { decay: 1, repeatWeight: 0.5, sigma: 0.1 }],
  ['ESTIMATED vacancies (repeat preset)', all, { decay: 1, repeatWeight: 0.5, sigma: 0.1, est: true }],
];
const only = process.argv[3];
for (const [l, f, o] of variants) if (!only || l.includes(only)) run(l, f, o);
