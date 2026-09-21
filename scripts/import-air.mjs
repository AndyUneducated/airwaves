/* Add airport frequencies to every region from the ourairports database.
 *
 *   node scripts/import-air.mjs --dry     report what it would add, write nothing
 *   node scripts/import-air.mjs           write into data/r/*.json
 *
 * WHY AN IMPORT AND NOT MORE HAND-WRITING
 *
 * The hand-written entries cover the airports worth writing prose about. They miss the
 * twelve other towered fields within an hour's drive, which are often the better listening:
 * a training field with six aircraft in the pattern is busier than an international airport,
 * and much easier to follow. That is a coverage problem, not an editorial one, and the FAA
 * and ICAO data already answer it. Inventing those frequencies would be unforgivable;
 * importing them from the public-domain database is free and verifiable.
 *
 * WHAT KEEPS IT CURATED
 *
 * A dump of 30,000 frequencies would destroy the site. So:
 *   - only real airports, ranked by significance and distance, at most TOP_N per region
 *   - only the positions a listener actually wants, at most a handful per airport
 *   - nothing that duplicates a frequency the region already lists, so every hand-written
 *     entry and its prose survives untouched
 *
 * Source: ourairports.com, public domain.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const AIRPORTS = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const FREQS = 'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv';
const DIR = new URL('../data/r/', import.meta.url);
const META = new URL('../data/regions.json', import.meta.url);

const dry = process.argv.includes('--dry');

/* Deliberately tight. Left looser this adds 756 entries, which would make aviation 56% of
 * the whole site and turn a curated guide into an airport directory. What a listener wants
 * from a field they have not heard of is the weather loop, the tower, and at a busy one the
 * ground — not all eleven positions. Six fields per region covers the ones you could
 * actually hear without burying the other nine categories. */
const TOP_N = Number(process.env.AW_TOP || 6);      // airports per region
const MAX_KM = 150;        // beyond this an airport belongs to nobody
const PER_AIRPORT = { large_airport: 4, medium_airport: 3, small_airport: 2 };

// The positions worth listening to, in the order a listener would want them. Anything not
// here — apron, PMSV, post, flight service, plain "MISC" — is left out on purpose.
const ROLES = {
  ATIS: { n: 'ATIS', z: '自动通播', rank: 1 },
  AWOS: { n: 'AWOS', z: '自动气象观测', rank: 1 },
  ASOS: { n: 'ASOS', z: '自动气象观测', rank: 1 },
  TWR: { n: 'Tower', z: '塔台', rank: 2 },
  GND: { n: 'Ground', z: '地面管制', rank: 3 },
  CLD: { n: 'Clearance Delivery', z: '放行许可', rank: 4 },
  APP: { n: 'Approach', z: '进场管制', rank: 5 },
  DEP: { n: 'Departure', z: '离场管制', rank: 5 },
  'A/D': { n: 'Approach / Departure', z: '进离场管制', rank: 5 },
  CNTR: { n: 'Center', z: '区域管制', rank: 6 },
  CTAF: { n: 'CTAF', z: '无塔机场公共频率', rank: 7 },
  UNIC: { n: 'UNICOM', z: '通用航空服务', rank: 8 }
};

// Chinese airports label their positions TWR01, GND02, ATIS-I, AP01. Same thing, numbered
// per runway or per sector.
function role(raw) {
  let k = String(raw).toUpperCase().trim();
  k = k.replace(/[-_ ]?\d+$/, '').replace(/-[IO]$/, '');
  if (k === 'AP') k = 'APP';
  if (k === 'ARR') k = 'APP';
  return ROLES[k] ? k : null;
}

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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const rows = (await res.text()).split('\n').filter(Boolean);
  const head = cells(rows[0]);
  return rows.slice(1).map(r => {
    const c = cells(r), o = {};
    head.forEach((h, i) => { o[h] = c[i]; });
    return o;
  });
}

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

const [airports, freqRows] = await Promise.all([table(AIRPORTS), table(FREQS)]);

const byIdent = new Map();
for (const f of freqRows) {
  const k = role(f.type);
  const mhz = Number(f.frequency_mhz);
  if (!k || !(mhz > 0)) continue;
  // The radio tunes 0.5-999 MHz; airband is well inside that, but guard against bad rows.
  if (mhz < 108 || mhz > 400) continue;
  if (!byIdent.has(f.airport_ident)) byIdent.set(f.airport_ident, []);
  byIdent.get(f.airport_ident).push({ k, mhz: Math.round(mhz * 1000) / 1000 });
}

/* One frequency per position per airport. Beijing Capital publishes three tower frequencies
 * split by runway and two ATIS feeds; listing them all produced three identical rows called
 * "Beijing Tower". To hear the tower you need one of them, and which one is a detail for
 * somebody standing at the fence, not for a list you are scrolling in a car park. */
for (const [ident, list] of byIdent) {
  const best = new Map();
  for (const f of list.sort((a, b) => a.mhz - b.mhz)) if (!best.has(f.k)) best.set(f.k, f);
  byIdent.set(ident, [...best.values()]);
}

// Real, open, uniquely identified airports only.
const usable = airports.filter(a =>
  /^[A-Z]{4}$/.test(a.ident) &&
  PER_AIRPORT[a.type] !== undefined &&
  !/\[Duplicate\]/i.test(a.name) &&
  a.latitude_deg && a.longitude_deg &&
  byIdent.has(a.ident));

console.log(`${airports.length} airports and ${freqRows.length} frequencies upstream; ${usable.length} airports usable\n`);

const weight = { large_airport: 3, medium_airport: 2, small_airport: 1 };
const regions = JSON.parse(readFileSync(META, 'utf8')).regions;
const placed = regions.filter(r => r.lat != null && r.lon != null);

/* Give every airport to its NEAREST region, then let each region choose from what it owns.
 *
 * Ranking by significance inside a radius instead put San Jose and San Francisco into the
 * Central Coast list — 129 and 170 km away, and already covered by the regions they belong
 * to — while Monterey and San Luis Obispo lost their slots. A region is a place you are
 * standing, so the only airports that belong to it are the ones it is closest to. */
const owned = new Map(placed.map(r => [r.id, []]));
for (const a of usable) {
  let best = null, bd = Infinity;
  for (const r of placed) {
    const d = km(r.lat, r.lon, +a.latitude_deg, +a.longitude_deg);
    if (d < bd) { bd = d; best = r; }
  }
  if (best && bd <= MAX_KM) owned.get(best.id).push({ a, d: bd });
}

let added = 0;
const report = [];

for (const region of placed) {

  const file = new URL(`${region.id}.json`, DIR);
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch (e) { continue; }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  // Drop what a previous run of this script added, so running it twice is a no-op and
  // changing the rules above does not pile a second copy on top of the first.
  const lines = raw.split(/\r?\n/).filter(l => !/"src":\s*"oa"/.test(l));

  // What does this region already list? A hand-written entry, with its prose and its local
  // knowledge, always wins. Match on frequency, and also on the airport-and-position pair:
  // the hand-written "Oakland ATIS" and a generated "OAK ATIS" are the same thing on
  // different numbers, and listing both would just look like a mistake.
  const existing = new Set();
  const covered = new Set();
  // The list groups by the area line, so an airport the region already writes about must
  // keep the exact wording it already uses. "Monterey Regional (KMRY)" and "Monterey
  // Regional Airport (KMRY)" are the same field, and letting both through split one
  // airport into two headers at opposite ends of the page.
  const areaOf = new Map();
  const keep = JSON.parse(lines.join(eol)).stations || [];
  const base = keep.length;
  for (const s of keep) {
    if (s.f > 0) existing.add(s.f.toFixed(3));
    if (s.c !== 'air') continue;
    const icao = s.ref || ((s.a || '').match(/\(([A-Z]{4})/) || [])[1];
    if (icao && s.a && !areaOf.has(icao)) areaOf.set(icao, s.a);
    for (const [k, r] of Object.entries(ROLES)) {
      const word = r.n.split(' ')[0];
      if (new RegExp(`\\b${word}\\b`, 'i').test(s.n)) {
        if (s.ref) covered.add(`${s.ref}|${k}`);
        // An entry without a ref still names its airport in the area line.
        const m = (s.a || '').match(/\(([A-Z]{4})\)/);
        if (m) covered.add(`${m[1]}|${k}`);
      }
    }
  }

  // Within what the region owns, a busier airport earns its place over a closer quiet one.
  const near = owned.get(region.id)
    .sort((x, y) => (weight[y.a.type] - weight[x.a.type]) || (x.d - y.d))
    .slice(0, TOP_N);

  const fresh = [];
  for (const { a, d } of near) {
    const usedHere = new Set();
    const picks = (byIdent.get(a.ident) || [])
      .sort((x, y) => ROLES[x.k].rank - ROLES[y.k].rank)
      .filter(f => {
        if (existing.has(f.mhz.toFixed(3))) return false;
        if (covered.has(`${a.ident}|${f.k}`)) return false;
        // Tianjin publishes one number as both Tower and Approach. Keep the higher-ranked
        // reading of it rather than the same frequency twice under two names.
        if (usedHere.has(f.mhz)) return false;
        usedHere.add(f.mhz);
        return true;
      });

    // A towered field's CTAF and UNICOM are secondary; at an untowered one they are the
    // whole story. Only keep them when there is no tower to listen to instead.
    const towered = picks.some(f => f.k === 'TWR') ||
      (byIdent.get(a.ident) || []).some(f => f.k === 'TWR');
    const kept = picks
      .filter(f => !(towered && (f.k === 'CTAF' || f.k === 'UNIC')))
      .slice(0, PER_AIRPORT[a.type]);

    // Named by airport code, the way the hand-written entries already do it ("SFO Tower").
    // Municipality will not do: Capital and Daxing are both "Beijing", and two rows called
    // "Beijing Tower" in one region tell you nothing.
    const code = /^[A-Z]{3}$/.test(a.iata_code || '') ? a.iata_code : a.ident;
    for (const f of kept) {
      // Standard positions share standard numbers: 121.900 is ground control at half the
      // fields in a metro area. Listing it once per field puts identical rows down the page
      // and stacks ticks on the same spot of the spectrum rail. Tuning it near any of them
      // gets you that field's ground, so the most significant one carries the entry.
      existing.add(f.mhz.toFixed(3));
      fresh.push({
        f: f.mhz,
        n: `${code} ${ROLES[f.k].n}`,
        z: `${code} ${ROLES[f.k].z}`,
        c: 'air',
        m: 'AM',
        conf: 'high',
        a: areaOf.get(a.ident) || `${a.name} (${a.ident})`,
        ref: a.ident,
        // Provenance, and the handle this script uses to find its own work again. Without it
        // a re-run would either duplicate everything or have to guess which entries were
        // generated, and guessing wrong means deleting somebody's hand-written prose.
        src: 'oa'
      });
    }
    if (kept.length) report.push(`    ${a.ident} ${String(Math.round(d)).padStart(4)} km  ${kept.length} added  ${a.name.slice(0, 40)}`);
  }

  if (!fresh.length) continue;

  // Put them after the last aviation entry so the file keeps its grouping. Frequencies are
  // written with three decimals to match the hand-written style.
  const fmt = s => '    ' + JSON.stringify(s)
    .replace(/^\{"f":[\d.]+/, `{ "f": ${s.f.toFixed(3)}`)
    .replace(/","/g, '", "')
    .replace(/":"/g, '": "')
    .replace(/,"/g, ', "')
    .replace(/\}$/, ' }');

  const last = anchor(lines, 'air');
  if (last < 0) continue;

  // The last entry in the array carries no comma, so inserting after it needs one added,
  // which in turn leaves the new last entry with one it should not have.
  if (!/,\s*$/.test(lines[last])) lines[last] += ',';
  lines.splice(last + 1, 0, ...fresh.map(s => fmt(s) + ','));
  const next = lines.join(eol).replace(/,(\s*\]\s*\}\s*)$/, '$1');

  // Never hand back a file that does not parse. Splicing text into hand-formatted JSON is
  // the kind of thing that works until it silently does not.
  try {
    const n = JSON.parse(next).stations.length;
    const want = base + fresh.length;
    if (n !== want) throw new Error(`expected ${want} stations, got ${n}`);
  } catch (e) {
    console.error(`\nREFUSING TO WRITE ${region.id}.json: ${e.message}`);
    process.exit(1);
  }

  if (!dry) writeFileSync(file, next);
  added += fresh.length;
  report.unshift(`  ${region.id}: +${fresh.length}`);
  console.log(report.splice(0).join('\n'));
}

console.log(`\n${added} aviation entries added${dry ? ' (dry run, nothing written)' : ''}`);
console.log('Run scripts/make-odds.mjs afterwards to score them.');
