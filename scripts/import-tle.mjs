// Refresh the orbital elements in data/sat.json from Celestrak.
//
// Elements are the one part of the satellite data that genuinely goes stale: a TLE is a fit
// to a short arc, and by a week out the along-track error is tens of kilometres, which moves
// a predicted pass by minutes. Everything else in that file - which satellites are worth
// tuning, what they transmit, whether the transmitter is even switched on - is judgement and
// stays hand-written. So this script only ever rewrites the `tle` field.
//
//   node scripts/import-tle.mjs          refresh in place
//   node scripts/import-tle.mjs --check  report staleness, change nothing
//
// Run daily by .github/workflows/tle.yml.
import { readFileSync, writeFileSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const FILE = 'data/sat.json';
const raw = readFileSync(FILE, 'utf8');
const doc = JSON.parse(raw);

const RE = 6378.135, MU = 398600.8;
const jdNow = Date.now() / 86400000 + 2440587.5;

// Celestrak asks that callers fetch by group where possible and not hammer per-object
// queries. These are all amateur or weather satellites, so two group files cover almost
// everything and any leftovers are fetched individually.
const GROUPS = ['amateur', 'weather', 'stations', 'cubesat'];

const fleet = new Map();   // norad -> [name, l1, l2]

const parseTle = txt => {
  const out = [];
  const lines = txt.split(/\r?\n/);
  for (let i = 0; i + 2 < lines.length + 1; i++) {
    if (/^1 /.test(lines[i + 1] || '') && /^2 /.test(lines[i + 2] || '')) {
      out.push([lines[i].trim(), lines[i + 1], lines[i + 2]]);
      i += 2;
    }
  }
  return out;
};

const wanted = new Set();
for (const b of doc.birds) for (const id of b.norad) wanted.add(id);

for (const g of GROUPS) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`;
  const txt = await (await fetch(url)).text();
  let hit = 0;
  for (const [name, l1, l2] of parseTle(txt)) {
    const id = parseInt(l1.substring(2, 7), 10);
    if (!wanted.has(id) || fleet.has(id)) continue;
    fleet.set(id, [name, l1, l2]);
    hit++;
  }
  console.log(`  ${g.padEnd(9)} ${hit} of ours`);
}

for (const id of wanted) {
  if (fleet.has(id)) continue;
  const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=tle`;
  const txt = await (await fetch(url)).text();
  const one = parseTle(txt)[0];
  if (one) { fleet.set(id, one); console.log(`  by catalogue number: ${id}`); }
  else console.log(`  NO ELEMENTS: ${id}`);
}

/* ---------- sanity, before anything is written ---------- */

// A TLE that parses is not a TLE that is usable. Three things make one useless here, and all
// three are silent failures if unchecked: a stale epoch quietly degrades every prediction, a
// deep-space orbit cannot be propagated by assets/sgp4.js at all, and a decayed object still
// has published elements right up until re-entry.
const problems = [];
const ageOf = l1 => {
  const yr = parseInt(l1.substring(18, 20), 10);
  const year = yr < 57 ? yr + 2000 : yr + 1900;
  const days = parseFloat(l1.substring(20, 32));
  const jan1 = 367 * year - Math.floor(7 * (year + Math.floor(10 / 12)) * 0.25)
    + Math.floor(275 / 9) + 1 + 1721013.5;
  return jdNow - (jan1 + days - 1);
};

for (const [id, [name, l1, l2]] of fleet) {
  const age = ageOf(l1);
  const rev = parseFloat(l2.substring(52, 63));
  const ecc = parseFloat('0.' + l2.substring(26, 33).trim());
  const period = 1440 / rev;
  const a = Math.pow(MU / Math.pow(rev * 2 * Math.PI / 86400, 2), 1 / 3);
  const perigee = a * (1 - ecc) - RE;

  if (age > 14) problems.push(`${id} ${name}: elements are ${age.toFixed(1)} days old`);
  if (period >= 225) problems.push(`${id} ${name}: period ${period.toFixed(0)} min is deep space, sgp4.js cannot propagate it`);
  if (perigee < 120) problems.push(`${id} ${name}: perigee ${perigee.toFixed(0)} km, decaying or decayed`);
}

for (const p of problems) console.log('  ! ' + p);

/* ---------- write, preserving the hand-written formatting ---------- */

// Line-level surgery rather than JSON.stringify, for the same reason as scripts/make-odds.mjs:
// the file is hand-maintained and reformatting it would bury the real change in noise.
let out = raw;
let touched = 0;

for (const b of doc.birds) {
  const tle = {};
  for (const id of b.norad) {
    const f = fleet.get(id);
    if (f) tle[String(id)] = [f[1], f[2]];
  }
  if (!Object.keys(tle).length) { console.log(`  keeping old elements for ${b.id}`); continue; }

  const body = JSON.stringify(tle);
  // Match this bird's object and replace only its "tle" value.
  const re = new RegExp(`("id":\\s*"${b.id}"[\\s\\S]*?"tle":\\s*)(\\{[\\s\\S]*?\\})(\\s*\\})`);
  const m = out.match(re);
  if (!m) { console.log(`  ! could not locate ${b.id} in the file`); continue; }
  if (m[2] === body) continue;
  out = out.replace(re, (_, a, __, c) => a + body + c);
  touched++;
}

if (CHECK) {
  console.log(`\n--check: ${touched} bird(s) would change, ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}

if (touched) {
  writeFileSync(FILE, out);
  console.log(`\nupdated elements for ${touched} bird(s) in ${FILE}`);
} else {
  console.log('\nelements already current, nothing written');
}

// A stale or unusable element set is worth failing the job over: a tracker that is quietly
// wrong is worse than one that is visibly broken.
if (problems.length) process.exit(1);
