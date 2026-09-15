/* What is actually in the ourairports frequency data, and how much of it is near a region? */

const A = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const F = 'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv';

function cells(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out;
}
async function table(url) {
  const rows = (await (await fetch(url)).text()).split('\n').filter(Boolean);
  const head = cells(rows[0]);
  return rows.slice(1).map(r => {
    const c = cells(r), o = {};
    head.forEach((h, i) => { o[h] = c[i]; });
    return o;
  });
}

const [airports, freqs] = await Promise.all([table(A), table(F)]);
console.log(`${airports.length} airports, ${freqs.length} frequencies\n`);

const byType = {};
for (const f of freqs) byType[f.type] = (byType[f.type] || 0) + 1;
console.log('frequency "type" values, most common first:');
Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 28)
  .forEach(([k, v]) => console.log(`  ${String(k).padEnd(14)}${v}`));

const aTypes = {};
for (const a of airports) aTypes[a.type] = (aTypes[a.type] || 0) + 1;
console.log('\nairport "type" values:');
Object.entries(aTypes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(18)}${v}`));

// How much is within reach of a few region centres?
const R = 6371, rad = Math.PI / 180;
const km = (a1, o1, a2, o2) => {
  const dA = (a2 - a1) * rad, dO = (o2 - o1) * rad;
  const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const fByAirport = new Map();
for (const f of freqs) {
  if (!fByAirport.has(f.airport_ident)) fByAirport.set(f.airport_ident, []);
  fByAirport.get(f.airport_ident).push(f);
}

for (const [name, lat, lon, radius] of [
  ['SF Bay Area', 37.77, -122.42, 60],
  ['Los Angeles & OC', 34.05, -118.25, 70],
  ['Beijing', 39.90, 116.41, 120],
  ['Yellowstone', 44.6, -110.5, 150]
]) {
  const near = airports
    .filter(a => a.latitude_deg && km(lat, lon, +a.latitude_deg, +a.longitude_deg) <= radius)
    .map(a => ({ ...a, d: km(lat, lon, +a.latitude_deg, +a.longitude_deg), fs: fByAirport.get(a.ident) || [] }));
  const towered = near.filter(a => a.fs.some(f => f.type === 'TWR'));
  const big = near.filter(a => /large_airport|medium_airport/.test(a.type));
  console.log(`\n${name} within ${radius} km: ${near.length} airports, ${big.length} large/medium, ${towered.length} with a tower`);
  const pick = [...new Set([...big, ...towered])].sort((x, y) => x.d - y.d).slice(0, 12);
  for (const a of pick) {
    const types = [...new Set(a.fs.map(f => f.type))].join(',');
    console.log(`   ${a.ident.padEnd(6)}${String(Math.round(a.d)).padStart(4)} km  ${a.type.replace('_airport', '').padEnd(7)} ${a.fs.length} freqs [${types}]  ${a.name.slice(0, 42)}`);
  }
}
