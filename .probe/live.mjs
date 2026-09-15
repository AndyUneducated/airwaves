// Smoke-test the published site, not the local copy.
import { chromium } from './harness.mjs';

const U = process.env.AW_LIVE_URL || 'https://andyuneducated.github.io/airwaves/';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) bad++; };

const b = await chromium.launch();

// A phone needs isMobile so the meta viewport applies; without it the page lays out as
// a desktop squeezed to 390px and measures shifts no real phone would see.
for (const [tag, vp, mobile] of [
  ['phone', { width: 390, height: 844 }, true],
  ['desktop', { width: 1280, height: 900 }, false]
]) {
  const ctx = await b.newContext({
    viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));

  // the pro flag lives in location.search, so it must come before the hash
  await pg.goto(U + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => document.querySelectorAll('.row').length > 20);

  // pro mode is actually on, and rows advertise that they expand
  const chev = await pg.locator('.row .dx-c').count();
  ok(chev > 20, `${tag}: ${chev} rows show the expand chevron`);

  // odds indicator rendered, and reads out for a screen reader
  const aria = await pg.locator('.row .od').first().getAttribute('aria-label');
  ok(!!aria && /chance|always|usually|shot/i.test(aria), `${tag}: odds announced as "${aria}"`);

  // the detail panel opens with real content. The panel is a sibling of the row,
  // so read .dx-k globally rather than scoping it inside .row.
  const tap = m => pg.evaluate(s => {
    const t = [...document.querySelectorAll('.row')].find(x => x.textContent.includes(s));
    if (t) { t.scrollIntoView({ block: 'center' }); t.click(); }
  }, m);

  await tap('Tower');
  await pg.waitForTimeout(400);
  const keys = await pg.locator('.dx-k').allInnerTexts();
  ok(keys.length >= 3, `${tag}: panel shows ${keys.length} fields (${keys.slice(0, 4).join(', ')})`);
  ok(await pg.locator('.dx-b').count() > 0, `${tag}: panel carries its own copy button`);

  // and closes again
  await tap('Tower');
  await pg.waitForTimeout(400);
  ok(await pg.locator('.dx-k').count() === 0, `${tag}: panel closes on second tap`);

  // spectrum rail present and stable: measure its position twice
  await pg.waitForSelector('.ru-rail', { timeout: 10000 });
  const railY = () => pg.evaluate(() => document.querySelector('.ru-rail').getBoundingClientRect().y);
  const y1 = await railY();
  await pg.waitForTimeout(1200);
  const y2 = await railY();
  ok(y1 != null && Math.abs(y1 - y2) < 1, `${tag}: spectrum rail does not drift (${y1} -> ${y2})`);

  // right-now panel appears in pro
  await pg.waitForSelector('#now .nw-c', { timeout: 8000 });
  const cards = await pg.locator('#now .nw-c').count();
  ok(cards >= 3, `${tag}: right-now panel shows ${cards} cards`);

  // Layout shift has to be measured on a clean load. Expanding a panel moves the
  // rows below it on purpose, and a synthetic click does not set hadRecentInput,
  // so interacting first would bill that deliberate motion as unexpected shift.
  const fresh = await ctx.newPage();
  await fresh.goto(U + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  const cls = await fresh.evaluate(() => new Promise(r => {
    let v = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => r(v), 900);
  }));
  // Same bar the suite holds locally: 0.1 is "good", and the residual is a per-region
  // note whose height cannot be known before the data arrives.
  ok(cls < 0.1, `${tag}: layout shift on a clean load ${cls.toFixed(4)}`);
  await fresh.close();

  // simple mode still copies instead of expanding
  await pg.goto(U + '?pro=0#/us/bay-area', { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => document.querySelectorAll('.row').length > 20);
  ok(await pg.locator('.row .dx-c').count() === 0, `${tag}: simple mode has no chevrons`);
  ok(await pg.locator('.row .od').count() > 20, `${tag}: simple mode still shows odds bars`);

  ok(errs.length === 0, `${tag}: no uncaught exceptions${errs.length ? ' -> ' + errs[0] : ''}`);
  await ctx.close();
}

await b.close();
console.log(bad ? `\n${bad} FAILED` : '\nlive site all good');
process.exit(bad ? 1 : 0);
