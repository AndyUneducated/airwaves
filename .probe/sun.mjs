/* Check the sun maths in app.js against published sunrise and sunset times before the UI
 * starts telling people the AM band is open. Run: node .probe/sun.mjs */

import { readFileSync } from 'node:fs';

const src = readFileSync('assets/app.js', 'utf8').replace(/\r\n/g, '\n');
const body = src.match(/function sunTimes\(date, lat, lon\) \{[\s\S]*?\n  \}\n/);
if (!body) { console.error('could not find sunTimes in assets/app.js'); process.exit(1); }
const sunTimes = eval(`(${body[0].trim()})`);

const hm = d => d.toISOString().slice(11, 16);
let bad = 0;

// Expected values from api.sunrise-sunset.org, an independent implementation. Five minutes
// of tolerance: neither model accounts for altitude or terrain, and nothing the panel says
// turns on that much. Each case is fed an instant near local noon so the solar day compared
// is the same one the service reported.
const cases = [
  ['San Francisco  15 Sep 2026', 37.7749, -122.4194, '2026-09-15T19:00:00Z', '13:50', '02:18'],
  ['London         21 Jun 2026', 51.5072, -0.1276, '2026-06-21T12:00:00Z', '03:40', '20:23'],
  ['Beijing        15 Sep 2026', 39.9042, 116.4074, '2026-09-15T04:00:00Z', '21:53', '10:25'],
  ['Sydney         21 Jun 2026', -33.8688, 151.2093, '2026-06-21T02:00:00Z', '20:58', '06:55']
];

for (const [name, lat, lon, iso, wantRise, wantSet] of cases) {
  const r = sunTimes(new Date(iso), lat, lon);
  if (r.polar) { console.log(`FAIL  ${name}  unexpected polar ${r.polar}`); bad++; continue; }
  const gotRise = hm(r.rise), gotSet = hm(r.set);
  const off = (a, b) => {
    const mins = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    return Math.abs(mins(a) - mins(b));
  };
  const ok = off(gotRise, wantRise) <= 5 && off(gotSet, wantSet) <= 5;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  rise ${gotRise}Z (want ${wantRise}Z)  set ${gotSet}Z (want ${wantSet}Z)`);
}

// Above the Arctic Circle the sun refuses to co-operate, and the panel says so instead of
// printing a nonsense time. Utqiagvik, Alaska — a region this site actually lists.
for (const [name, iso, want] of [
  ['Utqiagvik midsummer', '2026-06-21T12:00:00Z', 'day'],
  ['Utqiagvik midwinter', '2026-12-21T12:00:00Z', 'night']
]) {
  const r = sunTimes(new Date(iso), 71.2906, -156.7886);
  const ok = r.polar === want;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${r.polar ? 'polar ' + r.polar : 'rise ' + hm(r.rise)} (want polar ${want})`);
}

console.log(bad ? `\n${bad} FAILURE(S)` : '\nsun maths agrees with published times');
process.exit(bad ? 1 : 0);
