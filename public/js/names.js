// Name cleaning shared by the data build script and the browser's paste-import.
// Source CSVs contain typos, Greek/Cyrillic look-alike letters and renamed categories.

const LOOKALIKES = {
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O',
  'Ρ': 'P', 'Τ': 'T', 'Χ': 'X', 'Υ': 'Y', 'Ζ': 'Z', 'Н': 'H', 'А': 'A', 'С': 'C', 'Е': 'E',
  'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T',
};

export function normalize(s) {
  return String(s)
    .toUpperCase()
    .replace(/[^\x00-\x7F]/g, ch => LOOKALIKES[ch] ?? ch)
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIX = /^(CNTH|CSTH|BHA|BHB|BH|DGH|PGH|GH|NH|TH)\s+(.*)$/;
// Newer files write the type last: "KURUNEGALA TEACHING HOSPITAL", "HOMAGAMA BH", "MATARA DGH".
const SUFFIX = /^(.+?)\s+(TEACHING HOSPITAL|NATIONAL HOSPITAL|BASE HOSPITAL|DGH|BHA|BHB|BH|TH|NH)$/;

/** "BHA KALMUNAI (NORTH)" / "KALMUNAI NORTH BH" -> "KALMUNAI (NORTH)" / "KALMUNAI NORTH" */
export function placeOf(raw) {
  const n = normalize(raw);
  if (PREFIX.test(n)) return PREFIX.exec(n)[2];
  const t = SUFFIX.exec(n);
  return t ? t[1] : n;
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Resolve a free-text hospital name to a hospital id using the alias table; null if unknown. */
export function resolve(raw, aliases, { fuzzy = false } = {}) {
  const n = normalize(raw);
  if (aliases[n]) return aliases[n];
  const p = placeOf(raw);
  if (aliases[p]) return aliases[p];
  if (!fuzzy) return null;
  let best = null, bestD = 3;
  for (const [alias, id] of Object.entries(aliases)) {
    const d = lev(p, alias);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}
