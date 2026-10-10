// Cleans prev-data/*.csv into public/data/batches.json (the only data the app loads).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, placeOf, looksLikeInstitution } from '../public/js/names.js';
import { HOSPITALS, OVERRIDES, IGNORED, ORDER_UNRELIABLE } from './hospitals.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'prev-data');

const aliases = {};
HOSPITALS.forEach(([id, , , , , names]) => names.forEach(n => (aliases[n] = id)));
const index = Object.fromEntries(HOSPITALS.map((h, i) => [h[0], i]));

const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const problems = [];
const batches = [];

for (const file of readdirSync(dir).filter(f => f.endsWith('.csv')).sort()) {
  const lines = readFileSync(join(dir, file), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  lines.shift(); // header
  const rows = lines.map(l => {
    const [a, b, ...rest] = l.split(',');
    return { label: a.trim(), pos: Number(b), inst: rest.join(',').trim() };
  });

  const label = rows[0].label;
  const m = /^(\w+)\s+(\d{4})/.exec(normalize(label));
  const type = /MAIN/.test(normalize(label)) ? 'main' : 'repeat';
  const month = MONTHS.indexOf(m[1]);
  const seq = [];
  let notApplied = 0, dropped = 0;

  // Older files use positions 1..N (best first). Newer ones use a score where HIGHER is better and
  // some numbers are missing, so there the order of the scores (not their value) is the merit rank.
  const asRanks = rows.every(r => Number.isInteger(r.pos)) && new Set(rows.map(r => r.pos)).size === rows.length
    && Math.min(...rows.map(r => r.pos)) === 1 && Math.max(...rows.map(r => r.pos)) === rows.length;
  rows.sort((x, y) => (asRanks ? x.pos - y.pos : y.pos - x.pos));
  rows.forEach(r => {
    const full = normalize(r.inst);
    if (full === 'NOT APPLIED') { seq.push(-1); notApplied++; return; }
    if (IGNORED.has(full)) { seq.push(-1); dropped++; return; }
    const id = OVERRIDES[full] ?? aliases[placeOf(r.inst)] ?? aliases[full];
    if (id) { seq.push(index[id]); return; }
    // Not an institution at all (e.g. a candidate's name typed into the wrong column): keep the slot, drop the value.
    if (!looksLikeInstitution(r.inst)) { seq.push(-1); dropped++; return; }
    problems.push(`${file}: unknown institution "${r.inst}"`); seq.push(-1);
  });

  const vacancies = {};
  seq.forEach(h => { if (h >= 0) vacancies[HOSPITALS[h][0]] = (vacancies[HOSPITALS[h][0]] ?? 0) + 1; });
  const bid = file.replace(/\.csv$/, '').trim().replace(/\s+/g, '-').toLowerCase();
  batches.push({
    id: bid,
    orderReliable: !(bid in ORDER_UNRELIABLE),
    label: label.replace(/\s+/g, ' '),
    type, date: Number(m[2]) * 12 + month, n: rows.length, rankedByScore: !asRanks, notApplied, dropped, vacancies, seq,
  });
}

if (problems.length) {
  console.error('Data problems (add aliases in scripts/hospitals.mjs):\n  ' + [...new Set(problems)].join('\n  '));
  process.exit(1);
}

batches.sort((a, b) => a.date - b.date);
const out = {
  hospitals: HOSPITALS.map(([id, name, cat, district, conv, , like]) => ({ id, name, cat, district, conv, ...(like ? { like } : {}) })),
  aliases,
  batches,
};
writeFileSync(join(root, 'public/data/batches.json'), JSON.stringify(out));
for (const b of batches)
  console.log(`${b.label.padEnd(42)} ${b.type.padEnd(6)} n=${String(b.n).padStart(4)} notApplied=${b.notApplied} dropped=${b.dropped}${b.rankedByScore ? ' (ranked by score order)' : ''}${b.orderReliable ? '' : '  ** vacancies only: merit order unreliable **'}`);
console.log(`\n${HOSPITALS.length} hospitals -> public/data/batches.json`);
