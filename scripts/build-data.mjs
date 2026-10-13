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

  // Merit numbers may have gaps (a number missing from the published list); only their order matters.
  rows.sort((x, y) => x.pos - y.pos).forEach((r, i) => {
    if (!Number.isInteger(r.pos) || (i && r.pos === rows[i - 1].pos)) problems.push(`${file}: bad or duplicate merit number ${r.pos}`);
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

// Published vacancy lists (vacancy-lists/*.csv: Type,Hospital,Posts) -> ready-made templates for the app.
const vacancyLists = [];
const vdir = join(root, 'vacancy-lists');
for (const file of readdirSync(vdir).filter(f => f.endsWith('.csv')).sort()) {
  const vac = {};
  for (const line of readFileSync(join(vdir, file), 'utf8').split(/\r?\n/).slice(1).filter(Boolean)) {
    const [, name, posts] = line.split(',');
    const id = aliases[placeOf(name)] ?? aliases[normalize(name)];
    if (!id) { problems.push(`${file}: unknown hospital "${name}"`); continue; }
    if (id in vac) problems.push(`${file}: hospital listed twice: ${name}`);
    vac[id] = Number(posts);
  }
  const name = file.replace(/\.csv$/, '');
  const label = name.replace(/(\d{4})-(\d{4})/, '$1/$2'); // file names can't contain '/'
  vacancyLists.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label: `${label} vacancy list (official)`,
    type: /repeat/i.test(name) ? 'repeat' : 'main', vacancies: vac });
  console.log(`${label}: ${Object.keys(vac).length} hospitals, ${Object.values(vac).reduce((a, c) => a + c, 0)} posts`);
}
if (problems.length) {
  console.error('Data problems:\n  ' + [...new Set(problems)].join('\n  '));
  process.exit(1);
}
const out = {
  hospitals: HOSPITALS.map(([id, name, cat, district, conv]) => ({ id, name, cat, district, conv })),
  aliases,
  batches,
  vacancyLists,
};
writeFileSync(join(root, 'public/data/batches.json'), JSON.stringify(out));
for (const b of batches)
  console.log(`${b.label.padEnd(42)} ${b.type.padEnd(6)} n=${String(b.n).padStart(4)} notApplied=${b.notApplied} dropped=${b.dropped}`);
console.log(`\n${HOSPITALS.length} hospitals -> public/data/batches.json`);
