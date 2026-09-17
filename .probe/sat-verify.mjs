// Do the candidate satellites still have current elements, and are they near-Earth?
import { chromium, serve } from './harness.mjs';

const CAND = [
  [25544, 'ISS'], [48274, 'CSS Tianhe'], [27607, 'SO-50'], [43017, 'AO-91'],
  [22825, 'AO-27'], [43678, 'PO-101'], [40931, 'LAPAN-A2'], [44530, 'Taurus-1'],
  [67291, 'QMR-KWT 2'], [61781, 'ASRTU-1'], [57166, 'Meteor M2-3'], [59051, 'Meteor M2-4'],
  [63217, 'TEVEL2-1'], [63219, 'TEVEL2-2'], [63218, 'TEVEL2-3'], [63213, 'TEVEL2-4'],
  [63214, 'TEVEL2-5'], [63215, 'TEVEL2-6'], [63238, 'TEVEL2-7'], [63239, 'TEVEL2-8'],
  [63237, 'TEVEL2-9'], [43792, 'ESEO'], [39432, 'ICUBE-1'], [36799, 'TISAT 1'],
  [36122, 'XIWANG-1'], [25338, 'NOAA 15'], [28654, 'NOAA 18'], [33591, 'NOAA 19'],
  [40908, 'LilacSat-2'], [40069, 'METEOR M-2']
];

const url = id => `https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=tle`;
const got = [];
for (const [id, name] of CAND) {
  let txt = '';
  try {
    const r = await fetch(url(id));
    txt = (await r.text()).trim();
  } catch (e) { txt = 'ERR ' + e.message; }
  const lines = txt.split(/\r?\n/);
  if (lines.length < 3 || !/^1 /.test(lines[1])) {
    console.log('  NO ELEMENTS  ' + String(id).padStart(6) + '  ' + name + '   ' + txt.slice(0, 40));
    continue;
  }
  got.push([id, name, lines[0].trim(), lines[1], lines[2]]);
}

const URL = await serve();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.SGP4);

console.log('\n  id      name            epoch age  period  perigee  apogee  incl');
for (const [id, name, , l1, l2] of got) {
  const r = await page.evaluate(([a, b]) => {
    const el = SGP4.parse(a, b);
    const s = SGP4.init(el);
    if (s.deepspace) return { deepspace: true };
    // Mean elements give perigee and apogee directly.
    const n = s.no;                              // rad/min
    const aKm = Math.pow(398600.8 / Math.pow(n / 60, 2), 1 / 3);
    return {
      age: (Date.now() / 86400000 + 2440587.5) - el.jdsatepoch,
      period: 2 * Math.PI / n,
      perigee: aKm * (1 - el.ecco) - 6378.135,
      apogee: aKm * (1 + el.ecco) - 6378.135,
      incl: el.inclo * 180 / Math.PI,
      ok: !!SGP4.propagate(s, 0)
    };
  }, [l1, l2]);
  if (r.deepspace) { console.log('  ' + String(id).padStart(6) + '  ' + name.padEnd(14) + '  DEEP SPACE, unusable'); continue; }
  console.log('  ' + String(id).padStart(6) + '  ' + name.padEnd(14) + '  ' +
    r.age.toFixed(1).padStart(5) + 'd  ' + r.period.toFixed(1).padStart(6) + 'm  ' +
    r.perigee.toFixed(0).padStart(6) + 'km ' + r.apogee.toFixed(0).padStart(6) + 'km ' +
    r.incl.toFixed(1).padStart(6) + (r.ok ? '' : '   PROPAGATE FAILED'));
}
await browser.close();
