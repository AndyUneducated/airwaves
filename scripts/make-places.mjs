/* Rebuild data/places.json — coordinates for every airport the station data refers to.
 *
 *   node scripts/make-places.mjs
 *
 * Station entries carry an ICAO code in `ref`. This turns those codes into positions so the
 * site can say how far away a tower is and in which direction, which is the difference
 * between "there is a frequency" and "you can hear it from here".
 *
 * Source: ourairports.com, public domain. Only the referenced codes are kept, so the file
 * stays a few kilobytes and ships with the site instead of being fetched at runtime —
 * GitHub Pages has no backend, and this has to work offline anyway.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const CSV = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const DIR = new URL('../data/r/', import.meta.url);
const OUT = new URL('../data/places.json', import.meta.url);

// Which codes do we actually need?
const wanted = new Set();
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  const region = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  for (const s of region.stations || []) if (s.ref) wanted.add(s.ref);
}
console.log(`${wanted.size} codes referenced by the station data`);

// A CSV row can contain quoted commas, so this needs more than split(',').
function cells(line) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const res = await fetch(CSV);
if (!res.ok) throw new Error(`airports.csv: HTTP ${res.status}`);
const rows = (await res.text()).split('\n');
const head = cells(rows[0]);
const col = name => {
  const i = head.indexOf(name);
  if (i < 0) throw new Error(`airports.csv has no "${name}" column`);
  return i;
};
const [iIdent, iName, iLat, iLon, iElev, iMuni] =
  ['ident', 'name', 'latitude_deg', 'longitude_deg', 'elevation_ft', 'municipality'].map(col);

const air = {};
for (let i = 1; i < rows.length; i++) {
  if (!rows[i]) continue;
  const r = cells(rows[i]);
  const id = r[iIdent];
  if (!wanted.has(id) || air[id]) continue;
  const lat = Number(r[iLat]), lon = Number(r[iLon]);
  if (!isFinite(lat) || !isFinite(lon)) continue;
  // Metres, because the radio horizon is worked out in metres.
  const elev = Math.round((Number(r[iElev]) || 0) * 0.3048);
  air[id] = [Number(lat.toFixed(4)), Number(lon.toFixed(4)), elev, r[iMuni] || r[iName]];
}

const missing = [...wanted].filter(c => !air[c]);
if (missing.length) console.warn(`not found, will fall back to the region: ${missing.join(' ')}`);

const out = {
  version: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
  source: 'ourairports.com (public domain)',
  air: Object.fromEntries(Object.keys(air).sort().map(k => [k, air[k]]))
};
writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/","/g, '", "') + '\n');
console.log(`wrote ${Object.keys(air).length} airports to data/places.json`);
