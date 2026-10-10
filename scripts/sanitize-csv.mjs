// The repo is public. Some source CSVs have candidate names typed into the institution column.
// Usage: node scripts/sanitize-csv.mjs "prev-data/<file>.csv"
// Moves the original to prev-data/private/ (git-ignored) and writes a copy where every value that is
// not a recognisable institution is replaced by UNKNOWN. Merit positions are kept as they are.
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { normalize, placeOf, looksLikeInstitution } from '../public/js/names.js';
import { HOSPITALS, OVERRIDES, IGNORED } from './hospitals.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/sanitize-csv.mjs <csv>'); process.exit(1); }
const aliases = {};
HOSPITALS.forEach(([id, , , , , names]) => names.forEach(n => (aliases[n] = id)));

const text = readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);
let replaced = 0;
const out = lines.map((line, i) => {
  if (i === 0 || !line.trim()) return line;
  const [a, b, ...rest] = line.split(',');
  const inst = rest.join(',');
  const full = normalize(inst);
  const known = full === 'NOT APPLIED' || IGNORED.has(full) || OVERRIDES[full] || aliases[placeOf(inst)] || aliases[full];
  if (known || looksLikeInstitution(inst)) return line;
  replaced++;
  return `${a},${b},UNKNOWN`;
});
const priv = join(dirname(file), 'private');
mkdirSync(priv, { recursive: true });
const keep = join(priv, basename(file));
if (existsSync(keep)) { console.error(`${keep} already exists; refusing to overwrite it`); process.exit(1); }
renameSync(file, keep);
writeFileSync(file, out.join('\n'));
console.log(`${replaced} non-institution value(s) replaced with UNKNOWN. Original kept at ${keep}`);
