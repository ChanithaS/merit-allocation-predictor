// Cleans prev-data/*.csv into public/data/batches.json (the only data the app loads).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, placeOf } from '../public/js/names.js';
import { HOSPITALS, OVERRIDES, IGNORED } from './hospitals.mjs';

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

  rows.sort((x, y) => x.pos - y.pos).forEach((r, i) => {
    if (r.pos !== i + 1) problems.push(`${file}: merit positions not contiguous at ${r.pos}`);
    const full = normalize(r.inst);
    if (full === 'NOT APPLIED') { seq.push(-1); notApplied++; return; }
    if (IGNORED.has(full)) { seq.push(-1); dropped++; return; }
    const id = OVERRIDES[full] ?? aliases[placeOf(r.inst)] ?? aliases[full];
    if (!id) { problems.push(`${file}: unknown institution "${r.inst}"`); seq.push(-1); return; }
    seq.push(index[id]);
  });

  const vacancies = {};
  seq.forEach(h => { if (h >= 0) vacancies[HOSPITALS[h][0]] = (vacancies[HOSPITALS[h][0]] ?? 0) + 1; });
  batches.push({
    id: file.replace(/\.csv$/, '').trim().replace(/\s+/g, '-').toLowerCase(),
    label: label.replace(/\s+/g, ' '),
    type, date: Number(m[2]) * 12 + month, n: rows.length, notApplied, dropped, vacancies, seq,
  });
}

if (problems.length) {
  console.error('Data problems (add aliases in scripts/hospitals.mjs):\n  ' + [...new Set(problems)].join('\n  '));
  process.exit(1);
}

batches.sort((a, b) => a.date - b.date);
const out = {
  hospitals: HOSPITALS.map(([id, name, cat, district, conv]) => ({ id, name, cat, district, conv })),
  aliases,
  batches,
};
writeFileSync(join(root, 'public/data/batches.json'), JSON.stringify(out));
for (const b of batches)
  console.log(`${b.label.padEnd(42)} ${b.type.padEnd(6)} n=${String(b.n).padStart(4)} notApplied=${b.notApplied} dropped=${b.dropped}`);
console.log(`\n${HOSPITALS.length} hospitals -> public/data/batches.json`);
