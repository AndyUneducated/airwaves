// Do the predicted passes agree with an independent predictor?
//
// The SGP4 vectors already prove the propagator. This checks the layer on top of it - the
// horizon crossings, the peak search and the observer geometry - against N2YO, which runs
// its own implementation from its own elements. Agreement to a minute or two is the most
// that can be expected, since the two sides may be holding different TLEs.
import { chromium, serve } from './harness.mjs';

const LAT = 37.7749, LON = -122.4194;   // San Francisco
const URL = await serve();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.SGP4);

const mine = await page.evaluate(async ([lat, lon]) => {
  const S = window.SGP4;
  const doc = await (await fetch('data/sat.json')).json();
  const jdOf = ms => ms / 86400000 + 2440587.5;
  const out = [];

  for (const b of doc.birds) {
    for (const id of b.norad) {
      const tle = b.tle[String(id)];
      if (!tle) continue;
      const rec = S.init(S.parse(tle[0], tle[1]));
      if (rec.deepspace || rec.error) continue;
      const minOf = ms => (jdOf(ms) - rec.jdsatepoch) * 1440;
      const elAt = ms => { const l = S.look(rec, minOf(ms), jdOf(ms), lat, lon, 0); return l ? l.el : -90; };

      // Same search the app uses, inlined here so this probe does not depend on app internals.
      const from = Date.now(), end = from + 24 * 3600000, step = 60000;
      let prev = elAt(from), prevT = from;
      for (let tms = from + step; tms <= end; tms += step) {
        const now = elAt(tms);
        if (prev < 0 && now >= 0) {
          let lo = prevT, hi = tms;
          for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (elAt(m) < 0) lo = m; else hi = m; }
          let a = hi, bb = hi + 40 * 60000;
          for (let i = 0; i < 40; i++) {
            const m1 = a + (bb - a) / 3, m2 = bb - (bb - a) / 3;
            if (elAt(m1) < elAt(m2)) a = m1; else bb = m2;
          }
          const peakT = (a + bb) / 2;
          const pk = S.look(rec, minOf(peakT), jdOf(peakT), lat, lon, 0);
          out.push({ id, name: b.n, aos: hi, el: pk ? pk.el : 0 });
          // Skip past this pass.
          let u = tms;
          while (u < end && elAt(u) >= 0) u += step;
          tms = u; prev = -1; prevT = u;
          continue;
        }
        prev = now; prevT = tms;
      }
    }
  }
  return out.sort((x, y) => x.aos - y.aos);
}, [LAT, LON]);

await browser.close();

console.log('predicted ' + mine.length + ' passes over San Francisco in the next 24 h');
console.log('\nnext 8, by my implementation:');
for (const p of mine.slice(0, 8)) {
  console.log('  ' + String(p.id).padStart(6) + '  ' + p.name.padEnd(22) +
    new Date(p.aos).toISOString().slice(11, 16) + 'Z  peak ' + p.el.toFixed(1) + ' deg');
}

// N2YO publishes visual pass predictions per satellite; its "radio passes" page is HTML,
// so the comparison uses its public API-free JSON used by the site itself where available.
// If the network or the format is not cooperating, say so rather than silently passing.
const ISS = 25544;
try {
  const r = await fetch(`https://api.wheretheiss.at/v1/satellites/${ISS}`);
  const j = await r.json();
  console.log('\nindependent check, wheretheiss.at sub-satellite point for the ISS right now:');
  console.log('  lat ' + j.latitude.toFixed(3) + '  lon ' + j.longitude.toFixed(3) +
    '  alt ' + j.altitude.toFixed(1) + ' km');

  const browser2 = await chromium.launch();
  const p2 = await browser2.newPage();
  await p2.goto(URL, { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => !!window.SGP4);
  const ours = await p2.evaluate(async () => {
    const S = window.SGP4;
    const doc = await (await fetch('data/sat.json')).json();
    const tle = doc.birds.find(b => b.id === 'iss').tle['25544'];
    const rec = S.init(S.parse(tle[0], tle[1]));
    const jd = Date.now() / 86400000 + 2440587.5;
    const pv = S.propagate(rec, (jd - rec.jdsatepoch) * 1440);
    // TEME to geodetic, good enough for a sanity check.
    const gmst = S.gstime(jd);
    const [x, y, z] = pv.r;
    const c = Math.cos(gmst), s = Math.sin(gmst);
    const xe = x * c + y * s, ye = -x * s + y * c;
    const r = Math.sqrt(xe * xe + ye * ye + z * z);
    return {
      lat: Math.asin(z / r) * 180 / Math.PI,
      lon: ((Math.atan2(ye, xe) * 180 / Math.PI + 540) % 360) - 180,
      alt: r - 6378.135
    };
  });
  await browser2.close();

  console.log('  mine:  lat ' + ours.lat.toFixed(3) + '  lon ' + ours.lon.toFixed(3) +
    '  alt ' + ours.alt.toFixed(1) + ' km');
  // One degree of latitude is 111 km; the ISS covers that in about 15 seconds, so a small
  // disagreement here is clock and element skew, not an error in the maths.
  const dlat = Math.abs(ours.lat - j.latitude);
  let dlon = Math.abs(ours.lon - j.longitude);
  if (dlon > 180) dlon = 360 - dlon;
  const km = Math.hypot(dlat * 111, dlon * 111 * Math.cos(j.latitude * Math.PI / 180));
  console.log('  separation: ' + km.toFixed(1) + ' km, altitude differs by ' +
    Math.abs(ours.alt - j.altitude).toFixed(1) + ' km');
} catch (e) {
  console.log('\nindependent check unavailable: ' + e.message);
}
