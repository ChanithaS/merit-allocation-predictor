import { resolve } from './js/names.js';
import { finalProbs, vacancyEstimator } from './js/model.js';

const $ = id => document.getElementById(id);
const CAT = { T: 'Teaching', D: 'DGH', A: 'Base A', B: 'Base B' };
const store = {
  get() { try { return JSON.parse(localStorage.getItem('merit-state') || '{}'); } catch { return {}; } },
  set(v) { try { localStorage.setItem('merit-state', JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const data = await (await fetch('data/batches.json')).json();
const H = data.hospitals.length;
const idx = Object.fromEntries(data.hospitals.map((h, i) => [h.id, i]));
const saved = store.get();

const state = {
  vac: saved.vac ?? {},
  order: saved.order?.filter(id => id in idx) ?? data.hospitals.map(h => h.id),
  conv: saved.conv ?? {},
  catPrio: saved.catPrio ?? { T: 1, D: 2, A: 3, B: 4 },
  alpha: saved.alpha ?? 30,
  result: null,
  mode: saved.mode ?? 'estimate',
};
for (const h of data.hospitals) if (!state.order.includes(h.id)) state.order.push(h.id);
const ids = data.hospitals.map(h => h.id);
// Posts per hospital as shown/used: the typed list, or the average estimate from past batches of the chosen type.
function postsFor() {
  if (state.mode === 'known') return Object.fromEntries(ids.map(id => [id, state.vac[id] || 0]));
  const n = Number($('n').value), type = $('batchType').value;
  if (!n) return {};
  const est = vacancyEstimator(data.batches.filter(b => b.type === type), ids, n);
  return Object.fromEntries(ids.map((id, i) => [id, Math.round(est.mean[i])]));
}
const conv = id => state.conv[id] ?? data.hospitals[idx[id]].conv;
const persist = () => store.set({ vac: state.vac, order: state.order, conv: state.conv, catPrio: state.catPrio, alpha: state.alpha,
  mode: state.mode, rank: $('rank').value, n: $('n').value, batchType: $('batchType').value, naRate: $('naRate').value });

// ---- inputs ----
const batchesDesc = [...data.batches].sort((a, b) => b.date - a.date);
$('template').innerHTML = '<option value="">Fill vacancies from…</option>' +
  batchesDesc.map(b => `<option value="${b.id}">${b.label} (${b.n})</option>`).join('');
$('template').onchange = e => {
  const b = data.batches.find(x => x.id === e.target.value);
  if (!b) return;
  state.vac = { ...b.vacancies };
  $('n').value = Object.values(b.vacancies).reduce((a, c) => a + c, 0);
  $('batchType').value = b.type;
  e.target.value = '';
  render(); persist();
};
$('rank').value = saved.rank ?? ''; $('n').value = saved.n ?? '';
$('batchType').value = saved.batchType ?? 'main'; $('naRate').value = saved.naRate ?? 1.5;
if (!Object.keys(state.vac).length) {
  const latestMain = batchesDesc.find(b => b.type === 'main');
  state.vac = { ...latestMain.vacancies };
  if (!$('n').value) $('n').value = Object.values(state.vac).reduce((a, c) => a + c, 0);
}

$('cats').innerHTML = Object.entries(CAT).map(([k, v]) =>
  `<label><span class="badge ${k}">${v}</span><input type="number" min="1" max="4" data-cat="${k}" value="${state.catPrio[k]}"></label>`).join('');
$('cats').oninput = e => { state.catPrio[e.target.dataset.cat] = Number(e.target.value) || 1; persist(); };
$('alpha').value = state.alpha; $('alphaVal').textContent = state.alpha + '%';
$('alpha').oninput = e => { state.alpha = Number(e.target.value); $('alphaVal').textContent = state.alpha + '%'; persist(); };
$('hideZero').onchange = render;

$('auto').onclick = () => {
  const a = state.alpha / 100;
  const score = id => {
    const h = data.hospitals[idx[id]];
    return (1 - a) * (1 - (state.catPrio[h.cat] - 1) / 3) + a * (conv(id) - 1) / 4 + 0.001 * conv(id);
  };
  state.order.sort((x, y) => score(y) - score(x) || data.hospitals[idx[x]].name.localeCompare(data.hospitals[idx[y]].name));
  render(); persist();
};

$('clear').onclick = () => { state.vac = {}; state.result = null; render(); persist(); };

// ---- paste import ----
$('paste').onclick = () => { $('pasteMsg').textContent = ''; $('pasteDlg').showModal(); };
$('pasteDlg').addEventListener('close', () => {
  if ($('pasteDlg').returnValue !== 'ok') return;
  const found = {}, missed = [];
  for (const line of $('pasteText').value.split(/\r?\n/)) {
    const m = /^(.*?)[\s,;:\t]+(\d+)\s*$/.exec(line.trim());
    if (!line.trim()) continue;
    const id = m && resolve(m[1], data.aliases, { fuzzy: true });
    if (id) found[id] = (found[id] ?? 0) + Number(m[2]); else missed.push(line.trim());
  }
  state.vac = found;
  $('n').value = Object.values(found).reduce((a, c) => a + c, 0) || $('n').value;
  render(); persist();
  if (missed.length) alert('Could not match these lines:\n\n' + missed.join('\n'));
});

// ---- table ----
function bar(p, cls = '') {
  const pct = Math.round(p * 1000) / 10;
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i><b>${pct.toFixed(pct < 10 && pct > 0 ? 1 : 0)}%</b></div>`;
}

function render() {
  const known = state.mode === 'known';
  const posts = postsFor();
  $('mode').value = state.mode;
  $('listTools').hidden = !known;
  $('postsHead').textContent = known ? 'Posts' : 'Posts (est.)';
  refreshSum();

  const priority = state.order.map(id => idx[id]).filter(h => (posts[data.hospitals[h].id] || 0) > 0);
  const res = state.result;
  const fin = res ? finalProbs(res.matrix, res.sims, H, priority) : null;
  let cum = 0;
  const cumOf = {};
  if (fin) for (const h of priority) { cum += fin.final[h]; cumOf[h] = cum; }

  const hide = $('hideZero').checked;
  const rows = [];
  state.order.forEach((id, pos) => {
    const h = data.hospitals[idx[id]], v = posts[id] || 0;
    if (hide && !v) return;
    const i = idx[id];
    rows.push(`<tr draggable="true" data-id="${id}" class="${v ? '' : 'zero'}">
      <td class="grip">☰ ${pos + 1}<br><button data-up="${id}" title="Move up">▲</button><button data-down="${id}" title="Move down">▼</button></td>
      <td><span class="name">${h.name}</span><span class="badge ${h.cat}">${CAT[h.cat]}</span><div class="sub2">${h.district}</div></td>
      <td><select data-conv="${id}">${[1, 2, 3, 4, 5].map(k => `<option${k === conv(id) ? ' selected' : ''}>${k}</option>`).join('')}</select></td>
      <td>${known ? `<input type="number" min="0" data-vac="${id}" value="${v || ''}" placeholder="0">` : `<span title="Average over past ${$('batchType').value} batches">${v ? '~' + v : '0'}</span>`}</td>
      <td>${fin && v ? bar(res.open[i]) : '<span class="sub2">—</span>'}</td>
      <td>${fin && v ? bar(fin.final[i], 'g') : '<span class="sub2">—</span>'}</td>
      <td>${fin && v ? bar(cumOf[i] ?? 0, 'g') : '<span class="sub2">—</span>'}</td>
      <td>${fin && v ? bar(res.typical[i], 'g') : '<span class="sub2">—</span>'}</td>
    </tr>`);
  });
  document.querySelector('#tbl tbody').innerHTML = rows.join('');
  renderSummary(fin, priority);
}

function renderSummary(fin, priority) {
  const el = $('summary');
  if (!fin) { el.hidden = true; return; }
  el.hidden = false;
  const top = priority.map(h => [h, fin.final[h]]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(x => x[1] > 0.005);
  const first3 = priority.slice(0, 3).reduce((a, h) => a + fin.final[h], 0);
  const typ = data.hospitals.map((h, i) => [h, res_().typical[i]]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(x => x[1] > 0.02);
  const note = state.mode === 'estimate'
    ? `<p class="hint">Vacancies were estimated from past ${$('batchType').value} batches, so these figures are less certain than with the real list.</p>` : '';
  el.innerHTML = `<h2>Your outlook at merit #${$('rank').value} of ${$('n').value}</h2>
    <ul>
      <li>Where a typical candidate at your position ends up: ${typ.map(([h, p]) => `<b>${h.name}</b> (${(p * 100).toFixed(0)}%)`).join(', ') || '—'}</li>
      <li>With your priority order (set it in the table below), most likely: ${top.map(([h, p]) => `<b>${data.hospitals[h].name}</b> (${(p * 100).toFixed(0)}%)`).join(', ') || '—'}</li>
      <li>Chance of getting one of your top 3 in that order: <b>${(first3 * 100).toFixed(0)}%</b></li>
      ${fin.none > 0.005 ? `<li class="warn">Chance every listed hospital is full by your turn: ${(fin.none * 100).toFixed(1)}%</li>` : ''}
    </ul>${note}`;
}
const res_ = () => state.result;

// table interactions
const tbody = document.querySelector('#tbl tbody');
tbody.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.vac) { state.vac[t.dataset.vac] = Number(t.value) || 0; state.result = null; $('summary').hidden = true; refreshSum(); }
  persist();
});
tbody.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.conv) { state.conv[t.dataset.conv] = Number(t.value); persist(); }
  if (t.dataset.vac) render();
});
function refreshSum() {
  if (state.mode !== 'known') { $('sumHint').textContent = ''; return; }
  const total = Object.values(state.vac).reduce((a, c) => a + (Number(c) || 0), 0), n = Number($('n').value);
  $('sumHint').innerHTML = `(vacancies sum to ${total}${n && n !== total ? ' <span class="warn">≠ total</span>' : ''})`;
}
$('n').oninput = () => { state.result = null; render(); persist(); };
$('batchType').onchange = () => { state.result = null; render(); persist(); };
$('mode').onchange = e => { state.mode = e.target.value; state.result = null; render(); persist(); };
for (const id of ['rank', 'naRate']) $(id).oninput = persist;

tbody.addEventListener('click', e => {
  const up = e.target.dataset.up, down = e.target.dataset.down, id = up ?? down;
  if (!id) return;
  const i = state.order.indexOf(id), j = up ? i - 1 : i + 1;
  if (j < 0 || j >= state.order.length) return;
  [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  render(); persist();
});
let dragId = null;
tbody.addEventListener('dragstart', e => { const tr = e.target.closest('tr'); if (!tr) return; dragId = tr.dataset.id; tr.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
tbody.addEventListener('dragend', () => { dragId = null; tbody.querySelectorAll('tr').forEach(r => r.classList.remove('dragging', 'over')); });
tbody.addEventListener('dragover', e => { e.preventDefault(); tbody.querySelectorAll('tr.over').forEach(r => r.classList.remove('over')); e.target.closest('tr')?.classList.add('over'); });
tbody.addEventListener('drop', e => {
  e.preventDefault();
  const target = e.target.closest('tr')?.dataset.id;
  if (!dragId || !target || target === dragId) return;
  state.order.splice(state.order.indexOf(dragId), 1);
  state.order.splice(state.order.indexOf(target), 0, dragId);
  render(); persist();
});

// ---- run ----
const worker = new Worker('js/worker.js', { type: 'module' });
worker.postMessage({ type: 'init', data });
worker.onmessage = ({ data: m }) => {
  if (m.type === 'progress') { $('run').textContent = `Simulating… ${Math.round(m.f * 100)}%`; return; }
  state.result = m;
  $('run').disabled = false; $('run').textContent = 'Calculate';
  $('trained').textContent = 'Learned from: ' + m.trained.join('; ');
  render();
};
worker.onerror = e => { $('run').disabled = false; $('run').textContent = 'Calculate'; alert('Simulation failed: ' + e.message); };

$('run').onclick = () => {
  const rank = Number($('rank').value), n = Number($('n').value);
  if (!rank || rank < 1) return alert('Enter your merit number.');
  if (!n || rank > n) return alert('Total candidates must be at least your merit number.');
  if (state.mode === 'known' && !Object.values(state.vac).some(v => v > 0)) return alert('Enter at least one hospital vacancy.');
  $('run').disabled = true; $('run').textContent = 'Simulating… 0%';
  persist();
  worker.postMessage({ type: 'run', mode: state.mode, rank, n, vac: state.vac, batchType: $('batchType').value,
    naRate: (Number($('naRate').value) || 0) / 100, sims: 4000, seed: 1 });
};

render();
