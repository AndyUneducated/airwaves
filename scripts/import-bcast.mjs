/* Add US broadcast stations -- FM and AM -- from the FCC's licensing database.
 *
 *   node scripts/import-bcast.mjs --dry     report, write nothing
 *   node scripts/import-bcast.mjs           write into data/r/*.json
 *
 * WHAT THE FCC WILL AND WILL NOT TELL US
 *
 * It gives callsign, licensed power, transmitter coordinates, city of licence, licensee, and
 * whether the licence is non-commercial. It does NOT give format. There is no field saying
 * "news" or "classical" or "country", and no honest way to derive one, so this does not
 * pretend to: guessing a station's format from its callsign would be making things up, which
 * is the one thing a frequency reference must never do.
 *
 * What it can say truthfully is who holds the licence and under what kind of it, and that
 * turns out to be most of what a listener wants. FM 88.1-91.9 is the reserved
 * non-commercial band, so everything there is public, college, community or religious radio;
 * AM carries an explicit non-commercial flag. The licensee's own name separates a university
 * from a ministry from a broadcasting corporation. So entries are grouped by what the
 * licence is, which is a fact, rather than by what the music sounds like, which is not on
 * file.
 *
 * WHAT KEEPS IT CURATED
 *
 * California alone has 706 licensed FM stations and 447 AM. Importing all of them would bury
 * everything else on the site. Each region takes a small quota, deliberately split so the
 * result is not just the twelve loudest commercial signals:
 *
 *   6 public / college / community FM   the news, classical and jazz end of the dial
 *   6 commercial FM                     the music end
 *   4 AM                                news, talk, sport, and the night-time DX
 *
 * Source: FCC Media Bureau, public domain.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIR = new URL('../data/r/', import.meta.url);
const META = new URL('../data/regions.json', import.meta.url);
const dry = process.argv.includes('--dry');

// Only the states our regions sit in or border. Transmitters are then handed to whichever
// region is nearest, so a station just over a state line still lands in the right place.
const STATES = ('CA NV UT AZ NM CO WY MT ID TX OK IL IN WI MI IA MO MA NH VT ME CT RI NY NJ ' +
  'PA MD VA DC DE WV FL GA AL WA OR AK HI').split(' ');

const QUOTA = { public: 6, commercial: 6, am: 4 };
const MAX_KM = 120;          // a transmitter further out belongs to another region
const MIN_KW = { public: 0.05, commercial: 1, am: 0.5 };

const CLASSES = {
  public: { n: 'Public radio', z: '公共广播' },
  college: { n: 'College & community radio', z: '校园与社区广播' },
  religious: { n: 'Religious broadcasters', z: '宗教广播' },
  commercial: { n: 'Commercial FM', z: '商业调频' },
  am: { n: 'AM — news, talk and sport', z: '中波 · 新闻与谈话' }
};

// Read from the licensee's own registered name. Not a guess about content: an entry saying
// "licensed to a university" is true whatever they choose to play.
function flavour(licensee, nce) {
  const s = (licensee || '').toUpperCase();
  if (/UNIVERSIT|COLLEGE|SCHOOL|EDUCAT|REGENTS|STUDENT|ACADEM/.test(s)) return 'college';
  if (/MINISTR|CHURCH|GOSPEL|CHRISTIAN|CATHOLIC|BIBLE|FAITH|EVANGEL|RELIGIO|CALVARY|BAPTIST/.test(s)) return 'religious';
  if (/PUBLIC (RADIO|BROADCAST)|COMMUNITY|FOUNDATION|FRIENDS OF|ASSOCIATION|TRUST/.test(s)) return 'public';
  return nce ? 'public' : 'commercial';
}

/* The FCC files everything in capitals. Title case reads better, but blind title case turns
 * LLC into Llc and iHeartMedia's registered "IHM" into "Ihm". A short word with no vowels is
 * an abbreviation, not a word, so it keeps its capitals. */
const title = s => String(s).toLowerCase().replace(/[\w']+/g, w =>
  (w.length <= 4 && !/[aeiou]/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));

const dms = (d, m, s, sign) => (Number(d) + Number(m) / 60 + Number(s) / 3600) * sign;
const R = 6371, rad = Math.PI / 180;
const km = (a1, o1, a2, o2) => {
  const dA = (a2 - a1) * rad, dO = (o2 - o1) * rad;
  const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* Where in the file a new entry belongs. The data files group by category and the categories
 * run in a fixed order, so an import lands after the last entry of its own category — or,
 * for a region that has none yet, after the last entry of the nearest category above it.
 * Appending to the end instead would put broadcast stations below the satellites. */
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

async function fetchState(st, service) {
  const url = service === 'AM'
    ? `https://transition.fcc.gov/fcc-bin/amq?state=${st}&list=4&size=9`
    : `https://transition.fcc.gov/fcc-bin/fmq?state=${st}&serv=FM&list=4&size=9`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${st} ${service}: HTTP ${res.status}`);
  const out = [];
  for (const line of (await res.text()).split('\n')) {
    if (!line.includes('|')) continue;
    const c = line.split('|').map(x => x.trim());
    if (c[9] !== 'LIC') continue;                       // licensed and on the air only
    const call = c[1];
    if (!/^[KW][A-Z]{2,3}$/.test(call)) continue;       // full service, not a translator
    const mhz = service === 'AM'
      ? Number(c[2].replace(/\s*kHz/, '')) / 1000
      : Number(c[2].replace(/\s*MHz/, ''));
    const kw = Number(String(c[14]).replace(/\s*kW/, ''));
    if (!(mhz > 0) || !(kw > 0)) continue;

    // AM files a separate row for day and night power. Keep the daytime figure: it is the
    // one that describes the signal for most of the time anyone is listening.
    if (service === 'AM' && c[5] !== 'DAY') continue;

    const o = service === 'AM' ? 18 : 18;               // ID column, coords follow
    const latI = service === 'AM' ? 19 : 19;
    const lat = dms(c[latI + 1], c[latI + 2], c[latI + 3], c[latI] === 'N' ? 1 : -1);
    const lon = dms(c[latI + 5], c[latI + 6], c[latI + 7], c[latI + 4] === 'W' ? -1 : 1);
    if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) continue;

    const nce = service === 'AM' ? c[4] === 'NCE' : Number(c[4]) <= 220;
    out.push({
      call, mhz: Math.round(mhz * 1000) / 1000, kw, lat, lon,
      city: title(c[10]),
      by: title(c[27] || ''),
      service, nce
    });
  }
  return out;
}

console.log(`fetching ${STATES.length} states, FM and AM...`);
const all = [];
for (let i = 0; i < STATES.length; i += 6) {
  const batch = STATES.slice(i, i + 6);
  const got = await Promise.all(batch.flatMap(st => [fetchState(st, 'FM'), fetchState(st, 'AM')]));
  got.forEach(g => all.push(...g));
  process.stdout.write(`  ${Math.min(i + 6, STATES.length)}/${STATES.length} states, ${all.length} licensed stations\r`);
}
console.log(`\n${all.length} licensed stations upstream\n`);

const regions = JSON.parse(readFileSync(META, 'utf8')).regions.filter(r => r.lat != null);

// Nearest region wins, same as the aviation import.
const owned = new Map(regions.map(r => [r.id, []]));
for (const s of all) {
  let best = null, bd = Infinity;
  for (const r of regions) {
    const d = km(r.lat, r.lon, s.lat, s.lon);
    if (d < bd) { bd = d; best = r; }
  }
  if (best && bd <= MAX_KM) owned.get(best.id).push({ ...s, d: bd });
}

let added = 0;
for (const region of regions) {
  const file = new URL(`${region.id}.json`, DIR);
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch (e) { continue; }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/).filter(l => !/"src":\s*"fcc"/.test(l));

  const keep = JSON.parse(lines.join(eol)).stations || [];
  const base = keep.length;
  const existing = new Set(keep.filter(s => s.f > 0).map(s => s.f.toFixed(3)));
  const calls = new Set();
  for (const s of keep) {
    const m = (s.n || '').match(/\b([KW][A-Z]{2,3})\b/);
    if (m) calls.add(m[1]);
  }

  const mine = owned.get(region.id) || [];
  const pick = [];
  const take = (label, list, n) => {
    const chosen = list
      .filter(s => !existing.has(s.mhz.toFixed(3)) && !calls.has(s.call))
      // Strongest first: on a list of things to listen to, the ones that reach you matter.
      .sort((a, b) => b.kw - a.kw)
      .slice(0, n);
    chosen.forEach(s => {
      existing.add(s.mhz.toFixed(3));
      calls.add(s.call);
      pick.push(s);
    });
    return chosen.length;
  };

  const fm = mine.filter(s => s.service === 'FM');
  take('public', fm.filter(s => s.nce && s.kw >= MIN_KW.public), QUOTA.public);
  take('commercial', fm.filter(s => !s.nce && s.kw >= MIN_KW.commercial), QUOTA.commercial);
  take('am', mine.filter(s => s.service === 'AM' && s.kw >= MIN_KW.am), QUOTA.am);

  if (!pick.length) continue;

  const fresh = pick.map(s => {
    const cls = s.service === 'AM' ? 'am' : flavour(s.by, s.nce);
    return {
      f: s.mhz,
      n: `${s.call} — ${s.city}`,
      z: `${s.call} · ${CLASSES[cls].z}`,
      c: 'broadcast',
      m: s.service === 'AM' ? 'AM' : 'WFM',
      conf: 'high',
      kw: s.kw,
      by: s.by,
      a: CLASSES[cls].n,
      src: 'fcc'
    };
  }).sort((a, b) => a.a.localeCompare(b.a) || a.f - b.f);

  const fmt = o => '    ' + JSON.stringify(o)
    .replace(/^\{"f":[\d.]+/, `{ "f": ${o.f < 1 ? o.f.toFixed(3) : o.f.toFixed(3)}`)
    .replace(/","/g, '", "').replace(/":"/g, '": "').replace(/,"/g, ', "')
    .replace(/\}$/, ' }');

  const last = anchor(lines, 'broadcast');
  if (last < 0) continue;

  // The last entry in the array carries no comma, so inserting after it needs one added,
  // which in turn leaves the new last entry with one it should not have.
  if (!/,\s*$/.test(lines[last])) lines[last] += ',';
  lines.splice(last + 1, 0, ...fresh.map(o => fmt(o) + ','));
  const next = lines.join(eol).replace(/,(\s*\]\s*\}\s*)$/, '$1');
  try {
    const n = JSON.parse(next).stations.length;
    if (n !== base + fresh.length) throw new Error(`expected ${base + fresh.length}, got ${n}`);
  } catch (e) {
    console.error(`REFUSING TO WRITE ${region.id}.json: ${e.message}`);
    process.exit(1);
  }
  if (!dry) writeFileSync(file, next);
  added += fresh.length;

  const by = {};
  fresh.forEach(o => { by[o.a] = (by[o.a] || 0) + 1; });
  console.log(`  ${region.id.padEnd(18)}+${String(fresh.length).padStart(3)}  ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

console.log(`\n${added} broadcast entries added${dry ? ' (dry run, nothing written)' : ''}`);
console.log('Run scripts/make-odds.mjs afterwards to score them.');
