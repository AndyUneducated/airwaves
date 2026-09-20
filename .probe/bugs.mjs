// Offline: every network-backed feature has to settle into a stated fallback, with no
// console error, no unhandled rejection, and no placeholder left spinning.
import { chromium, serve } from './harness.mjs';

const URL = await serve();
const b = await chromium.launch();

async function run(label, { warm, hang }) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ['geolocation'], geolocation: { latitude: 37.7749, longitude: -122.4194 }
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 90)); });

  if (warm) {
    // Let the service worker take the shell and the data first.
    await pg.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await pg.waitForSelector('.row');
    await pg.waitForTimeout(2500);
  }
  if (hang) {
    // A connection that accepts the request and then goes nowhere: the case a plain
    // fetch() cannot recover from.
    await pg.route('**/data/sat.json', () => {});
    await pg.route('**/*.noaa.gov/**', () => {});
    await pg.route('**/api.weather.gov/**', () => {});
  } else {
    await ctx.setOffline(true);
  }

  await pg.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pg.waitForSelector('.row', { timeout: 20000 }).catch(() => {});
  await pg.click('#btn-geo').catch(() => {});
  await pg.waitForTimeout(11000);

  const st = await pg.evaluate(() => ({
    rows: document.querySelectorAll('.row').length,
    cards: [...document.querySelectorAll('#now .nw-c')].map(c =>
      `${c.querySelector('.nw-k').textContent}: ${c.querySelector('.nw-v').textContent}`),
    spinning: [...document.querySelectorAll('#now .nw-v, #sky .sky-m')]
      .filter(n => /·\s+·|…/.test(n.textContent)).map(n => n.textContent.trim()),
    skyHid: document.getElementById('sky').hidden,
    net: (document.getElementById('net-t') || {}).textContent
  }));
  console.log(`\n=== ${label} ===`);
  console.log('rows', st.rows, '| net badge:', JSON.stringify(st.net));
  st.cards.forEach(c => console.log('  ', c));
  console.log('still loading:', st.spinning.length ? JSON.stringify(st.spinning) : 'none');
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await ctx.close();
  return { spinning: st.spinning, errs, rows: st.rows };
}

// Cold, with only the orbit file hanging: the one path that had no deadline at all, so
// the service worker must not be allowed to answer it from cache.
async function cold() {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ['geolocation'], geolocation: { latitude: 37.7749, longitude: -122.4194 },
    serviceWorkers: 'block'
  });
  let held = 0;
  await ctx.route('**/data/sat.json', () => { held++; });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 90)); });
  await pg.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.row', { timeout: 20000 });
  await pg.click('#btn-geo');
  const t0 = Date.now();
  await pg.waitForFunction(() => {
    const c = [...document.querySelectorAll('#now .nw-c')].find(x => /OVERHEAD/i.test(x.querySelector('.nw-k').textContent));
    return c && !/·\s+·/.test(c.querySelector('.nw-v').textContent);
  }, null, { timeout: 20000 }).catch(() => {});
  const st = await pg.evaluate(() => {
    const c = [...document.querySelectorAll('#now .nw-c')].find(x => /OVERHEAD/i.test(x.querySelector('.nw-k').textContent));
    return {
      v: c ? c.querySelector('.nw-v').textContent : '(no card)',
      offers: c ? c.classList.contains('nw-hit') : null,
      skyHid: document.getElementById('sky').hidden,
      rows: document.querySelectorAll('.row').length
    };
  });
  console.log('\n=== cold, orbit file hangs (no service worker) ===');
  console.log(`held ${held} request(s); settled after ${Math.round((Date.now() - t0) / 100) / 10}s: ${JSON.stringify(st)}`);
  console.log('errors:', errs.length ? errs.join(' | ') : 'none');
  await ctx.close();
  return { spinning: /·\s+·/.test(st.v) ? [st.v] : [], errs, rows: st.rows, offers: st.offers };
}

const a = await run('offline, warm cache', { warm: true });
const c = await run('online but requests hang', { warm: true, hang: true });
const d = await cold();
if (d.offers) { console.log('\nFAIL cold: card still offers to open an empty panel'); }

let bad = d.offers ? 1 : 0;
for (const [n, r] of [['warm offline', a], ['hanging', c], ['cold hang', d]]) {
  if (r.spinning.length) { console.log(`\nFAIL ${n}: left a placeholder`); bad++; }
  if (r.errs.length) { console.log(`\nFAIL ${n}: ${r.errs.join(' | ')}`); bad++; }
  if (!r.rows) { console.log(`\nFAIL ${n}: no rows`); bad++; }
}
console.log(bad ? `\n${bad} problems` : '\nall offline paths settle');
await b.close();
process.exit(bad ? 1 : 0);
