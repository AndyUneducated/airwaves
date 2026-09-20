// Smoke: header row, search toggle, folded panels.
import { chromium, serve } from './harness.mjs';

const URL = await serve();
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  permissions: ['geolocation'], geolocation: { latitude: 37.7749, longitude: -122.4194 }
});
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('  PAGEERROR', e.message));
pg.on('console', m => { if (m.type() === 'error') console.log('  CONSOLE', m.text().slice(0, 140)); });
await pg.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
await pg.waitForFunction(() => document.querySelectorAll('.row').length > 0);

const row = () => pg.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height * 10) / 10, hid: e.hidden }; };
  return { find: r('#btn-find'), regions: r('#regions'), search: r('#hd-search'), q: r('#q'), hdRow: r('.hd-row'), header: r('header'), rows: document.querySelectorAll('.row').length };
});

console.log('closed:', JSON.stringify(await row()));
await pg.click('#btn-find');
await pg.waitForTimeout(300);
console.log('open:  ', JSON.stringify(await row()));
console.log('focused:', await pg.evaluate(() => document.activeElement.id));

await pg.keyboard.type('146');
await pg.waitForTimeout(350);
console.log('after typing 146:', (await row()).rows, 'rows');

await pg.keyboard.press('Escape');
await pg.waitForTimeout(350);
const back = await row();
console.log('after escape:', JSON.stringify(back));

// header control heights
console.log('header heights:', await pg.evaluate(() => [...document.querySelectorAll('.hd-tools .chip, .hd-tools .cty-b, #btn-find')]
  .map(c => `${c.id}=${Math.round(c.getBoundingClientRect().height * 10) / 10}`).join(' ')));

await pg.screenshot({ path: '.probe/hdr.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
await pg.click('#btn-find');
await pg.waitForTimeout(300);
await pg.screenshot({ path: '.probe/hdr-open.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
await b.close();
