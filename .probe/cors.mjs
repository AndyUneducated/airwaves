// Throwaway probe: which live-data APIs a GitHub Pages origin can actually call.
import { chromium, serve } from './harness.mjs';

const EPS = [
  ['adsb.lol point', 'https://api.adsb.lol/v2/point/37.77/-122.42/25'],
  ['adsb.fi opendata', 'https://opendata.adsb.fi/api/v2/lat/37.77/lon/-122.42/dist/25'],
  ['airplanes.live', 'https://api.airplanes.live/v2/point/37.77/-122.42/25'],
  ['weather.gov alerts', 'https://api.weather.gov/alerts/active?point=37.77,-122.42'],
  ['weather.gov points', 'https://api.weather.gov/points/37.77,-122.42'],
  ['celestrak amateur', 'https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=json'],
  ['celestrak weather', 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=json'],
  ['swpc k-index', 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'],
  ['swpc 10cm flux', 'https://services.swpc.noaa.gov/products/summary/10cm-flux.json'],
  ['swpc geospace', 'https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json']
];

const browser = await chromium.launch();
const page = await browser.newPage();
// The fetches have to run from a real page origin, not about:blank, or the browser will
// not apply CORS the way the published site sees it.
await page.goto(await serve());

for (const [name, url] of EPS) {
  const r = await page.evaluate(async u => {
    const started = Date.now();
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 15000);
      const res = await fetch(u, { signal: c.signal });
      clearTimeout(t);
      const txt = await res.text();
      let shape = '';
      try {
        const j = JSON.parse(txt);
        shape = Array.isArray(j) ? `array[${j.length}]`
          : Object.keys(j).slice(0, 6).join(',');
      } catch { shape = 'non-json'; }
      return { ok: res.ok, status: res.status, bytes: txt.length, shape, ms: Date.now() - started };
    } catch (e) {
      return { ok: false, err: e.message, ms: Date.now() - started };
    }
  }, url);
  console.log(
    (r.ok ? 'CORS OK  ' : 'BLOCKED  ') + name.padEnd(22),
    r.ok ? `${r.status} ${r.bytes}B ${r.ms}ms  {${r.shape}}` : r.err || r.status
  );
}

await browser.close();
