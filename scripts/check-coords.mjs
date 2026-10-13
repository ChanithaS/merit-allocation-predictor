// Cross-check scripts/hospital-coords.mjs against OpenStreetMap (Nominatim). Slow on purpose (1 request/second,
// per their usage policy). Usage: node scripts/check-coords.mjs
import { COORDS } from './hospital-coords.mjs';

const km = (a, b) => {
  const R = 6371, r = x => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
for (const [id, [lat, lng, q]] of Object.entries(COORDS)) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=lk`;
  const res = await (await fetch(url, { headers: { 'User-Agent': 'merit-allocation-predictor coordinate check' } })).json();
  const r = res[0];
  const d = r ? km([lat, lng], [Number(r.lat), Number(r.lon)]) : null;
  console.log(`${id.padEnd(16)} ${d === null ? 'NOT FOUND'.padEnd(10) : (d.toFixed(1) + ' km').padEnd(10)} ${d !== null && d > 5 ? '<-- CHECK ' : ''}${r ? `${r.lat},${r.lon} ${(r.display_name || '').split(',').slice(0, 2).join(',')}` : ''}`);
  await new Promise(r => setTimeout(r, 1100));
}
