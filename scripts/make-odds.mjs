/* Stamp every station with `odds`: how likely you are to actually hear something if you
 * tune there. Run after editing station data, or after an import:
 *
 *   node scripts/make-odds.mjs           rewrite data/r/*.json
 *   node scripts/make-odds.mjs --dry     print what would change, touch nothing
 *
 * WHY THIS EXISTS
 *
 * A frequency list answers "what is on this channel". It does not answer the question people
 * actually have standing outside with a handheld: "if I dial this in, will I hear anything?"
 * Those are different. A NOAA weather transmitter is a continuous carrier covering a whole
 * region, so the answer is yes, always. A 2 m simplex calling frequency is dead silent unless
 * somebody happens to be calling. Both are correct entries; they are not remotely equivalent
 * to a listener.
 *
 * `odds` folds the three things that decide it into one value:
 *
 *   coverage    how far the signal reaches
 *   duty cycle  how much of the time it is transmitting at all
 *   confidence  whether we are even sure the frequency is right
 *
 * Confidence belongs in here rather than beside it, because a frequency we are unsure about
 * cannot honestly be called a sure thing however powerful the transmitter would be.
 *
 *   3  always on    a carrier is there essentially all the time
 *   2  usually      intermittent but reliably active; minutes, not hours
 *   1  long shot    quiet, narrow, occasional, or unconfirmed
 *
 * Entries marked `dig` get no value at all. The radio cannot decode them, so the odds of
 * hearing something intelligible are zero and a bar implying otherwise would be a lie.
 *
 * An explicit `oddsFix` on a station always wins, for the cases where local knowledge beats
 * the rules below. Keeping the rules in one file rather than hand-stamping 900 entries is
 * what stops this drifting into a field nobody can explain.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIR = new URL('../data/r/', import.meta.url);
const dry = process.argv.includes('--dry');

const has = (s, re) => re.test(s.n) || re.test(s.z || '');

// Ranges and sweeps are not channels. "Scan 118–137" cannot promise anything specific.
const VAGUE = /scan|sweep|typical|convention|paired range|range$|all \d+ channels|band —|tower band/i;

function derive(s) {
  if (s.dig) return null;                       // cannot be decoded at all
  if (!(s.f > 0)) return null;                  // placeholder rows carry no frequency

  const c = s.c;
  const vague = has(s, VAGUE);

  // --- always on: a carrier that does not stop -------------------------------------------
  // NOAA weather radio is the benchmark. Seven channels, continuous broadcast, regional
  // coverage from high sites, and the frequency is a national allocation.
  if (c === 'wx' && s.f >= 162.35 && s.f <= 162.6) return 3;
  // A recorded field report on a loop, repeating until the weather changes.
  if (has(s, /\bATIS\b|\bAWOS\b|\bASOS\b|\bVOLMET\b|\bHIWAS\b|\bTWEB\b/i)) return 3;
  // A licensed broadcaster with a named callsign, playing to a whole market. Where the
  // licensed power is known, it decides: a sub-kilowatt campus station never stops
  // transmitting but only covers a few kilometres, and calling that a sure thing would
  // mislead anyone more than a suburb away.
  if (c === 'broadcast' && !vague) return s.kw === undefined ? 3 : (s.kw >= 1 ? 3 : 2);
  // Standard time and frequency stations: the whole point is that they never stop. On the
  // long and medium waves they are ground wave and dependable.
  if (has(s, /\bWWVB\b|\bBPC\b/i)) return 3;
  // Travellers' information stations: a loop, though a deliberately tiny one.
  if (has(s, /travel+ers|travel information/i)) return 2;

  // --- usually something: busy, but with gaps --------------------------------------------
  // Shortwave time signals never stop either, but whether they reach you depends on the
  // ionosphere, and that is exactly what the odds are meant to capture.
  if (has(s, /\bWWV\b|\bWWVH\b|\bBPM\b/i)) return 2;
  // Aeronautical HF, for the same reason: oceanic position reports are near-constant, but
  // whether the path is open to you is not. This behaves like a time station, not a tower,
  // and needs saying explicitly — "air-ground" would otherwise fall into the rule below by
  // accident, which is the kind of coincidence that rots a rule set.
  if (c === 'air' && s.f < 30) return 2;
  // Working air traffic positions at a staffed field or sector.
  if (c === 'air' && !vague &&
    has(s, /tower|ground|clearance|delivery|approach|departure|cent[er]{2}|ramp|apron|radar|terminal/i)) return 2;
  // Vessel traffic services and the calling and distress channels are worked constantly in
  // any real port.
  if (c === 'marine' && !vague &&
    has(s, /\bVTS\b|Ch 16|Ch 13|Ch 22A|distress|calling|hailing|bridge-to-bridge|port operations|USCG|Coast Guard/i)) return 2;
  // A repeater with a published offset is a real installed machine, not a bare band plan
  // entry, and a repeater with a tone is one somebody is maintaining.
  if (c === 'ham' && (s.o || s.t) && !vague) return 2;
  // Railway dispatch on a working corridor: quiet between movements, never quiet for long.
  if (c === 'rail' && !vague && !has(s, /telemetry|end-of-train/i)) return 2;
  // Highway patrol and rural fire still running analogue carry for miles and are busy.
  if (c === 'safety' && !vague && has(s, /CHP|highway patrol|CAL ?FIRE|CDF|state police|sheriff/i)) return 2;

  // --- long shot: everything that needs luck or patience ---------------------------------
  // Deliberately left as the default. Simplex calling channels, CTAF at a strip with four
  // movements a day, park and forest operations, satellites, FRS and MURS, private link
  // channels, and anything given as a range to sweep rather than a channel to sit on.
  return 1;
}

/* The data files are written by hand: one station per line, frequencies carrying their
 * trailing zeros as 122.900, and blank lines grouping the categories. Re-serialising them
 * through JSON.stringify would throw all of that away and turn a one-field change into a
 * ten-thousand-line diff. So this edits the text of each station line and leaves every
 * other byte of the file exactly as it was. */

const OPEN = /^(\s*)(\{\s*"f":[\s\S]*\})(,?)$/;

let changed = 0, total = 0, skipped = [];
const dist = { 3: 0, 2: 0, 1: 0, none: 0 };
const samples = { 3: [], 2: [], 1: [], none: [] };

for (const file of readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  const url = new URL(file, DIR);
  const raw = readFileSync(url, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const region = file.replace('.json', '');
  let touched = false;

  const out = lines.map((line, i) => {
    const m = line.match(OPEN);
    if (!m) return line;
    const [, indent, body, comma] = m;

    let s;
    try { s = JSON.parse(body); } catch (e) {
      skipped.push(`${file}:${i + 1} is not parseable on its own line`);
      return line;
    }
    total++;

    const want = s.oddsFix !== undefined ? s.oddsFix : derive(s);
    const key = want === null ? 'none' : want;
    dist[key]++;
    if (samples[key].length < 6) samples[key].push(`${region} ${s.f} ${s.n}`);

    // Drop any previous value first, so running this twice is a no-op.
    const bare = body.replace(/,\s*"odds":\s*\d+(?=\s*\})/, '');
    const next = want === null
      ? bare
      : bare.replace(/\s*\}$/, `, "odds": ${want} }`);
    if (next === body) return line;
    changed++;
    touched = true;
    return indent + next + comma;
  });

  if (touched && !dry) writeFileSync(url, out.join(eol));
}

if (skipped.length) {
  console.log('COULD NOT READ:');
  skipped.forEach(x => console.log('  ' + x));
  console.log('');
}

console.log(`${total} entries, ${changed} updated${dry ? ' (dry run, nothing written)' : ''}\n`);
const pc = n => `${String(n).padStart(4)}  ${String(Math.round(n / total * 100)).padStart(2)}%`;
console.log(`  3  always on   ${pc(dist[3])}`);
console.log(`  2  usually     ${pc(dist[2])}`);
console.log(`  1  long shot   ${pc(dist[1])}`);
console.log(`     no value    ${pc(dist.none)}   (digital, encrypted, or no frequency)`);
for (const k of ['3', '2', '1', 'none']) {
  console.log(`\n  ${k}:`);
  samples[k].forEach(x => console.log(`    ${x}`));
}
