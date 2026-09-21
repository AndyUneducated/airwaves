/* Add NOAA Weather Radio transmitters to every US region from the NWS county coverage list.
 *
 *   node scripts/import-wx.mjs --dry     report what it would add, write nothing
 *   node scripts/import-wx.mjs           write into data/r/*.json
 *
 * WHY THIS ONE MATTERS MORE THAN THE OTHER IMPORTS
 *
 * Weather radio is the single most useful thing on this site. It is the only category where
 * the answer to "will I hear anything" is yes, always: a continuous carrier, from a high
 * site, on a frequency that cannot drift. It is also the first thing anyone tunes when the
 * sky changes.
 *
 * Which made the hand-written entries embarrassing. There are only seven NWR channels, so
 * guessing that Denver is on 162.550 is a coin flip with decent odds, and every one of those
 * entries was marked "verify" because that is exactly what it was — a guess. Meanwhile
 * `make-odds` scores any 162 MHz weather entry as "always on", which is a promise the data
 * could not keep.
 *
 * The NWS publishes the real thing: every transmitter, its callsign, its frequency, its
 * power, its coordinates and whether it is currently on the air. So none of it needs
 * guessing, and a region added tomorrow gets correct weather frequencies for free.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not give these entries a `ref`, so they do not appear on the horizon map. The
 * feed has the transmitter's ground position but not its antenna height, and NWR sites are
 * deliberately on ridges and towers. Plotting them at ground level would put real,
 * audible transmitters below the horizon line, which is a worse lie than leaving them off.
 *
 * Source: NOAA / National Weather Service county coverage list, public domain.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const CCL = 'https://www.weather.gov/source/nwr/JS/CCL.js';
const DIR = new URL('../data/r/', import.meta.url);
const META = new URL('../data/regions.json', import.meta.url);
const dry = process.argv.includes('--dry');

/* The NWS puts nominal reception at about 40 miles over level ground. Past roughly double
 * that you are relying on terrain and luck, and this site would rather list four things you
 * can hear than eight you cannot. */
const MAX_KM = 110;
const TOP_N = 4;

const R = 6371, rad = Math.PI / 180;
const km = (a1, o1, a2, o2) => {
  const dA = (a2 - a1) * rad, dO = (o2 - o1) * rad;
  const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* Where in the file a new entry belongs. The data files group by category and the categories
 * run in a fixed order, so an import lands after the last entry of its own category — or,
 * for a region that has none yet, after the last entry of the nearest category above it. */
const ORDER = ['link', 'air', 'wx', 'ham', 'parks', 'marine', 'rail', 'broadcast', 'safety', 'misc'];
function anchor(lines, cat) {
  const want = ORDER.indexOf(cat);
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/"c":\s*"(\w+)"/);
    if (m && ORDER.indexOf(m[1]) >= 0 && ORDER.indexOf(m[1]) <= want) last = i;
  }
  return last;
}

/* The feed is a JavaScript file of parallel arrays — one row per county per transmitter,
 * so a single transmitter appears once for every county it covers. Read the assignments
 * rather than executing it. */
async function rows() {
  const res = await fetch(CCL);
  if (!res.ok) throw new Error(`CCL.js: HTTP ${res.status}`);
  const text = await res.text();
  const cols = {};
  for (const m of text.matchAll(/^(\w+)\[(\d+)\] = "(.*)";$/gm)) {
    (cols[m[1]] ||= [])[+m[2]] = m[3];
  }
  const n = (cols.CALLSIGN || []).length;
  if (!n) throw new Error('CCL.js parsed to nothing — the feed format has changed');
  const out = [];
  for (let i = 0; i < n; i++) out.push(Object.fromEntries(Object.keys(cols).map(k => [k, cols[k][i]])));
  return out;
}

const all = await rows();

// One row per transmitter, not per county it covers.
const sites = new Map();
for (const r of all) {
  if (r.STATUS !== 'NORMAL') continue;              // off the air, or never built
  const f = Number(r.FREQ), lat = Number(r.LAT), lon = Number(r.LON);
  if (!(f >= 162.35 && f <= 162.6)) continue;
  if (!isFinite(lat) || !isFinite(lon) || (!lat && !lon)) continue;
  if (sites.has(r.CALLSIGN)) continue;
  sites.set(r.CALLSIGN, {
    call: r.CALLSIGN, f: Math.round(f * 1000) / 1000, lat, lon,
    site: r.SITENAME, state: r.SITESTATE,
    w: Number(r.PWR) || 0,
    wfo: (r.WFO || '').split('|')[0]
  });
}
console.log(`${all.length} county rows upstream, ${sites.size} transmitters on the air\n`);

const regions = JSON.parse(readFileSync(META, 'utf8')).regions.filter(r => r.lat != null);

/* Unlike the aviation and broadcast imports, a transmitter is not given to one region and
 * withheld from its neighbours. Those imports are exclusive because an airport belongs
 * somewhere and listing SFO under four Bay Area regions would be four copies of one entry.
 * Weather is the opposite case: one 1000 W site on a ridge genuinely is the weather radio
 * for everyone within 40 miles of it, and a region that omitted it because a neighbouring
 * region was marginally closer would be hiding the most useful frequency it has. */
const owned = new Map(regions.map(r => [r.id, []]));
for (const s of sites.values()) {
  for (const r of regions) {
    const d = km(r.lat, r.lon, s.lat, s.lon);
    if (d <= MAX_KM) owned.get(r.id).push({ ...s, d });
  }
}

let added = 0, dropped = 0;

for (const region of regions) {
  const file = new URL(`${region.id}.json`, DIR);
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch (e) { continue; }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';

  /* Drop what a previous run added, and also the bare hand-written guesses this replaces:
   * a 162 MHz row with a name and nothing else was always a placeholder for this data. An
   * entry someone wrote prose for is a different matter — that is local knowledge about
   * where the signal actually reaches, which no database has — so it stays, and the
   * frequency it occupies suppresses the generated row below. */
  const lines = raw.split(/\r?\n/).filter(l => {
    if (/"src":\s*"nwr"/.test(l)) return false;
    if (!/"c":\s*"wx"/.test(l)) return true;
    let s;
    try { s = JSON.parse(l.trim().replace(/,$/, '')); } catch { return true; }
    if (!(s.f >= 162.35 && s.f <= 162.6) || s.d) return true;
    dropped++;
    return false;
  });

  const keep = JSON.parse(lines.join(eol)).stations || [];
  const base = keep.length;
  const existing = new Set(keep.filter(s => s.f > 0).map(s => s.f.toFixed(3)));

  /* Strongest first. A 1000 W site on a ridge is the one you will actually hear; the 5 W
   * fill-in transmitter in the next valley is only interesting if you are in that valley. */
  const fresh = [];
  for (const s of (owned.get(region.id) || []).sort((a, b) => (b.w - a.w) || (a.d - b.d))) {
    if (fresh.length >= TOP_N) break;
    if (existing.has(s.f.toFixed(3))) continue;
    existing.add(s.f.toFixed(3));
    fresh.push(s);
  }
  if (!fresh.length) continue;

  const out = fresh.sort((a, b) => a.f - b.f).map(s => ({
    f: s.f,
    n: `${s.call} — ${s.site}, ${s.state}`,
    z: `${s.call} · ${s.site}`,
    c: 'wx',
    m: 'NFM',
    conf: 'high',
    kw: s.w / 1000,
    a: 'NOAA Weather Radio',
    src: 'nwr'
  }));

  const fmt = o => '    ' + JSON.stringify(o)
    .replace(/^\{"f":[\d.]+/, `{ "f": ${o.f.toFixed(3)}`)
    .replace(/","/g, '", "').replace(/":"/g, '": "').replace(/,"/g, ', "')
    .replace(/\}$/, ' }');

  const last = anchor(lines, 'wx');
  if (last < 0) continue;

  // The final entry in the array carries no comma, so inserting after it needs one added.
  if (!/,\s*$/.test(lines[last])) lines[last] += ',';
  lines.splice(last + 1, 0, ...out.map(o => fmt(o) + ','));
  // ...which in turn leaves the new final entry with one it should not have.
  let next = lines.join(eol).replace(/,(\s*\]\s*\}\s*)$/, '$1');

  try {
    const n = JSON.parse(next).stations.length;
    if (n !== base + out.length) throw new Error(`expected ${base + out.length}, got ${n}`);
  } catch (e) {
    console.error(`REFUSING TO WRITE ${region.id}.json: ${e.message}`);
    process.exit(1);
  }

  if (!dry) writeFileSync(file, next);
  added += out.length;
  console.log(`  ${region.id.padEnd(18)}+${out.length}  ${out.map(o => `${o.f} ${o.n.split(' — ')[0]}`).join(', ')}`);
}

console.log(`\n${added} weather entries added, ${dropped} unverified guesses replaced${dry ? ' (dry run, nothing written)' : ''}`);
console.log('Run scripts/make-odds.mjs afterwards to score them.');
