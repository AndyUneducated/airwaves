// The three map views, online and off.
import { chromium, serve } from './harness.mjs';

const URL = await serve();
const b = await chromium.launch();

async function shot(offline) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ['geolocation'], geolocation: { latitude: 37.7749, longitude: -122.4194 }
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 100)); });
  pg.on('requestfailed', r => { if (!offline) errs.push('reqfail: ' + r.url().slice(-40)); });

  await pg.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await pg.waitForSelector('.row');
  await pg.click('#btn-geo');
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => document.querySelector('.nw-x-c[aria-controls="map"]').click());
  await pg.waitForSelector('.mp-me');
  if (offline) await ctx.setOffline(true);

  for (const [i, v] of ['plain', 'far', 'land'].entries()) {
    await pg.evaluate(n => document.querySelectorAll('.mp-seg .seg-o')[n].click(), i);
    await pg.waitForTimeout(v === 'land' ? 2500 : 500);
    const st = await pg.evaluate(() => ({
      checked: [...document.querySelectorAll('.mp-seg .seg-o')].map(o => o.getAttribute('aria-checked')).join(','),
      links: document.querySelectorAll('.mp-link line').length,
      kms: document.querySelectorAll('.mp-km').length,
      coast: document.querySelectorAll('.mp-cst').length,
      adm: document.querySelectorAll('.mp-adm').length,
      how: document.querySelector('.mp-how').textContent.slice(0, 46),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    console.log(`  ${v.padEnd(6)} ${JSON.stringify(st)}`);
    if (!offline) {
      await pg.evaluate(() => document.querySelector('#map').scrollIntoView({ block: 'center' }));
      await pg.waitForTimeout(200);
      await pg.screenshot({ path: `.probe/map-${v}.png`, clip: await pg.evaluate(() => {
        const r = document.querySelector('#map').getBoundingClientRect();
        return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6), width: r.width + 12, height: Math.min(r.height + 12, 880) };
      }) });
    }
  }
  console.log(`  errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  await ctx.close();
  return errs;
}

console.log('online:');
await shot(false);
console.log('offline (outline never fetched):');
const e = await shot(true);
await b.close();
