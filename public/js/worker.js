import { fitWeights, fillMissing, simulate, vacancyEstimator } from './model.js';

// Presets chosen by backtesting on held-out batches (see README).
const PRESETS = {
  main: { types: ['main'], fit: { decay: 1, segments: 3 }, sigma: 0.1 },
  repeat: { types: ['main', 'repeat'], fit: { decay: 1, repeatWeight: 0.5 }, sigma: 0.1 },
};

let data;
onmessage = ({ data: m }) => {
  if (m.type === 'init') { data = m.data; return; }
  const H = data.hospitals.length;
  const p = PRESETS[m.batchType];
  const train = data.batches.filter(b => p.types.includes(b.type) && b.orderReliable !== false);
  const { w, seen } = fitWeights(train, H, p.fit);
  const likes = data.hospitals.map(h => (h.like ? data.hospitals.findIndex(x => x.id === h.like) : -1));
  const wf = fillMissing(w, seen, data.hospitals.map(h => h.cat), likes);
  const ids = data.hospitals.map(h => h.id);
  // Estimate mode: vacancies are redrawn each run from past batches of the same type, scaled to n.
  const est = m.mode === 'estimate'
    ? vacancyEstimator(data.batches.filter(b => b.type === m.batchType), ids, m.n) : null;
  const vac = est ? null : Int32Array.from(ids, id => m.vac[id] || 0);
  const res = simulate({
    w: wf, vac, vacSampler: est?.sampler, rank: m.rank, n: m.n, priority: [], sims: m.sims, sigma: p.sigma, naRate: m.naRate, seed: m.seed,
    onProgress: f => postMessage({ type: 'progress', f }),
  });
  postMessage({ type: 'result', open: res.open, typical: res.typical, matrix: res.matrix, sims: res.sims, trained: train.map(b => b.label) }, [res.matrix.buffer]);
};
