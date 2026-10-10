// Allocation model, shared by the browser worker and the node backtest.
//
// Candidates pick in merit order from hospitals that still have posts. Each pick is
// modelled as Plackett-Luce: P(pick h) = w_h / sum of w over hospitals still open.
// Weights are fitted from past batches (MM algorithm), then a Monte Carlo run
// replays the candidates ahead of you to see which hospitals are still open at your turn.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fit hospital popularity weights, one set per merit-position segment (K segments by
 * relative position: top-ranked candidates choose differently from the tail).
 * opts.decay: weight multiplier per batch step back in time (1 = none).
 * opts.repeatWeight: relative weight of repeat batches vs main batches.
 * opts.segments / opts.blend: K, and how strongly segment weights shrink toward the pooled fit.
 * Returns { w: Float64Array[K], seen }.
 */
export function fitWeights(batches, H, { decay = 0.8, repeatWeight = 1, segments = 1, blend = 0.3 } = {}) {
  const pooled = fitSegments(batches, H, decay, repeatWeight, 1);
  if (segments === 1) return { w: pooled.w, seen: pooled.seen };
  const seg = fitSegments(batches, H, decay, repeatWeight, segments);
  const w = seg.w.map(ws => {
    const o = new Float64Array(H);
    for (let h = 0; h < H; h++)
      if (ws[h] > 0 && pooled.w[0][h] > 0) o[h] = Math.exp((1 - blend) * Math.log(ws[h]) + blend * Math.log(pooled.w[0][h]));
    return o;
  });
  return { w, seen: pooled.seen };
}

function fitSegments(batches, H, decay, repeatWeight, K) {
  const used = [...batches].sort((a, b) => b.date - a.date); // newest first
  const data = used.map((b, k) => {
    const exh = new Int32Array(H).fill(-1); // step at which hospital runs out
    const vac = new Int32Array(H);
    b.seq.forEach(h => { if (h >= 0) vac[h]++; });
    const rem = vac.slice();
    b.seq.forEach((h, i) => { if (h >= 0 && --rem[h] === 0) exh[h] = i; });
    const segOf = b.seq.map((_, i) => Math.min(K - 1, Math.floor((i / b.seq.length) * K)));
    return { b, wt: Math.pow(decay, k) * (b.type === 'repeat' ? repeatWeight : 1), exh, vac, segOf };
  });

  const S = Array.from({ length: K }, () => new Float64Array(H));
  const seen = new Uint8Array(H);
  for (const d of data) d.b.seq.forEach((h, i) => { if (h >= 0) { S[d.segOf[i]][h] += d.wt; seen[h] = 1; } });
  if (K > 1) for (let s = 0; s < K; s++) for (let h = 0; h < H; h++) if (seen[h]) S[s][h] += 0.5;

  const w = Array.from({ length: K }, () => new Float64Array(H).fill(1));
  for (let iter = 0; iter < 400; iter++) {
    const den = Array.from({ length: K }, () => new Float64Array(H));
    for (const d of data) {
      const n = d.b.seq.length;
      const Z = new Float64Array(K);
      for (let h = 0; h < H; h++) if (d.vac[h] > 0) for (let s = 0; s < K; s++) Z[s] += w[s][h];
      const prefix = Array.from({ length: K }, () => new Float64Array(n + 1));
      for (let i = 0; i < n; i++) {
        for (let s = 0; s < K; s++) prefix[s][i + 1] = prefix[s][i];
        const h = d.b.seq[i];
        if (h < 0) continue;
        const s = d.segOf[i];
        prefix[s][i + 1] += d.wt / Z[s];
        if (d.exh[h] === i) for (let t = 0; t < K; t++) Z[t] -= w[t][h];
      }
      for (let h = 0; h < H; h++) if (d.exh[h] >= 0) for (let s = 0; s < K; s++) den[s][h] += prefix[s][d.exh[h] + 1];
    }
    let maxChange = 0;
    for (let s = 0; s < K; s++) {
      const next = new Float64Array(H);
      let logSum = 0, cnt = 0;
      for (let h = 0; h < H; h++) {
        if (!seen[h] || den[s][h] === 0) continue;
        next[h] = Math.max(S[s][h], 1e-9) / den[s][h];
        logSum += Math.log(next[h]); cnt++;
      }
      const g = Math.exp(logSum / cnt);
      for (let h = 0; h < H; h++) {
        if (!next[h]) continue;
        const v = next[h] / g;
        maxChange = Math.max(maxChange, Math.abs(Math.log(v / w[s][h])));
        w[s][h] = v;
      }
    }
    if (maxChange < 1e-7) break;
  }
  return { w, seen };
}

/** Hospitals missing from the training batches get the median weight of their category. */
export function fillMissing(ws, seen, categories) {
  return ws.map(w => {
    const out = Float64Array.from(w);
    const byCat = {};
    w.forEach((v, h) => { if (seen[h] && v > 0) (byCat[categories[h]] ??= []).push(v); });
    const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const all = Object.values(byCat).flat();
    w.forEach((v, h) => { if (!seen[h] || !(v > 0)) out[h] = byCat[categories[h]] ? median(byCat[categories[h]]) : median(all); });
    return out;
  });
}

function gauss(rng) {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

/**
 * Monte Carlo. Returns per-hospital P(still open at your turn) and P(final allocation | priority).
 *  vacSampler(rng) -> Int32Array: if given, posts are redrawn each run (used when vacancies are only estimated).
 *  w: weights per segment (Float64Array[]), n: total candidates, vac: posts per hospital, rank: your merit position (1-based),
 *  priority: hospital indices in your preferred order, sigma: weight uncertainty (log-sd),
 *  naRate: chance a candidate ahead of you skips picking (e.g. "not applied").
 */
export function simulate({ w, vac, vacSampler, rank, n, priority, sims = 4000, sigma = 0.3, naRate = 0, seed = 1, onProgress }) {
  const K = w.length, H = w[0].length;
  const total_n = n ?? rank;
  const rng = mulberry32(seed);
  const open = new Float64Array(H);
  const final = new Float64Array(H);
  const typical = new Float64Array(H); // how often a typical candidate at your position would pick h
  const matrix = new Uint8Array(sims * H); // matrix[s*H+h] = 1 if hospital h still has posts at your turn in run s
  let none = 0;
  const ww = Array.from({ length: K }, () => new Float64Array(H));
  const zs = new Float64Array(K);
  const rem = new Int32Array(H);
  const active = new Int32Array(H);

  for (let s = 0; s < sims; s++) {
    const runVac = vacSampler ? vacSampler(rng) : vac;
    let na = 0;
    zs.fill(0);
    for (let h = 0; h < H; h++) {
      rem[h] = runVac[h];
      const noise = sigma > 0 ? Math.exp(sigma * gauss(rng)) : 1;
      for (let k = 0; k < K; k++) { ww[k][h] = w[k][h] * noise; if (rem[h] > 0) zs[k] += ww[k][h]; }
      if (rem[h] > 0) active[na++] = h;
    }
    for (let i = 1; i < rank && na > 0; i++) {
      if (naRate > 0 && rng() < naRate) continue;
      const seg = Math.min(K - 1, Math.floor(((i - 1) / total_n) * K));
      const wk = ww[seg];
      let r = rng() * zs[seg], k = 0;
      for (; k < na - 1; k++) { r -= wk[active[k]]; if (r < 0) break; }
      const h = active[k];
      if (--rem[h] === 0) {
        active[k] = active[--na];
        for (let t = 0; t < K; t++) {
          let z = 0;
          for (let j = 0; j < na; j++) z += ww[t][active[j]];
          zs[t] = z;
        }
      }
    }
    for (let h = 0; h < H; h++) if (rem[h] > 0) { open[h]++; matrix[s * H + h] = 1; }
    if (na > 0) { // a typical candidate at your position picks among the open hospitals by popularity
      const wk = ww[Math.min(K - 1, Math.floor(((rank - 1) / total_n) * K))];
      let z = 0;
      for (let j = 0; j < na; j++) z += wk[active[j]];
      let r = rng() * z, k = 0;
      for (; k < na - 1; k++) { r -= wk[active[k]]; if (r < 0) break; }
      typical[active[k]]++;
    }
    let got = -1;
    for (const h of priority) if (rem[h] > 0) { got = h; break; }
    if (got >= 0) final[got]++; else none++;
    if (onProgress && s % 500 === 499) onProgress((s + 1) / sims);
  }
  return {
    open: Array.from(open, v => v / sims),
    final: Array.from(final, v => v / sims),
    typical: Array.from(typical, v => v / sims),
    none: none / sims,
    matrix,
    sims,
  };
}

/** Final-allocation probabilities for any priority order, from a finished simulation. */
export function finalProbs(matrix, sims, H, priority) {
  const final = new Float64Array(H);
  let none = 0;
  for (let s = 0; s < sims; s++) {
    let got = -1;
    for (const h of priority) if (matrix[s * H + h]) { got = h; break; }
    if (got >= 0) final[got]++; else none++;
  }
  return { final: Array.from(final, v => v / sims), none: none / sims };
}

/** Scale a hospital->count map to `total` posts with whole numbers (largest-remainder rounding). */
export function scaleVacancies(counts, total) {
  const H = counts.length;
  const sum = counts.reduce((a, c) => a + c, 0);
  const out = new Int32Array(H);
  if (!sum) return out;
  const rema = [];
  let used = 0;
  for (let h = 0; h < H; h++) {
    const exact = (counts[h] / sum) * total;
    out[h] = Math.floor(exact); used += out[h];
    rema.push([exact - out[h], h]);
  }
  rema.sort((a, b) => b[0] - a[0]);
  for (let i = 0; used < total && i < rema.length; i++, used++) out[rema[i][1]]++;
  return out;
}

/** Vacancy estimators built from past batches: average (for display) and a per-run random draw. */
export function vacancyEstimator(batches, hospitalIds, total) {
  const pats = batches.map(b => scaleVacancies(hospitalIds.map(id => b.vacancies[id] || 0), total));
  const mean = Float64Array.from(hospitalIds, (_, h) => pats.reduce((a, p) => a + p[h], 0) / pats.length);
  return { mean, sampler: rng => pats[Math.floor(rng() * pats.length)] };
}
