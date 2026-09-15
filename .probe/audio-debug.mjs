/* Why is the tuning hiss so often inaudible? Walk the rail and record, at every step, the
 * detent lock the code computes and the gain it therefore asks for. */

import { chromium, serve } from './harness.mjs';

const URL = await serve();
const browser = await chromium.launch();

for (const [label, hash] of [['SF Bay Area', '#/us/bay-area'], ['Nationwide', '#/us/nationwide']]) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  // Capture every gain target the page asks for, with the context's own state.
  await page.addInitScript(() => {
    window.__gains = [];
    const realCtx = window.AudioContext;
    window.AudioContext = class extends realCtx {
      constructor(...a) {
        super(...a);
        window.__ctxState = () => this.state;
      }
    };
    const proto = GainNode.prototype.__proto__;   // AudioParam lives on the param object
    const set = AudioParam.prototype.setTargetAtTime;
    AudioParam.prototype.setTargetAtTime = function (v, ...rest) {
      window.__gains.push(v);
      return set.call(this, v, ...rest);
    };
  });

  await page.goto(URL + '?pro=1' + hash, { waitUntil: 'commit' });
  await page.waitForFunction(() => !!document.querySelector('.ru-rail'), null, { timeout: 10000 });

  // Does the rail stay where it first appears? If it drifts, it moves under your finger.
  const y0 = await page.evaluate(() => document.querySelector('.ru-rail').getBoundingClientRect().y);
  await page.waitForTimeout(2500);
  const y1 = await page.evaluate(() => document.querySelector('.ru-rail').getBoundingClientRect().y);
  console.log(`\n--- ${label}: rail drift after first paint: ${Math.round(y1 - y0)}px`);

  await page.evaluate(() => document.querySelector('.ru-rail').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);

  const box = await page.evaluate(() => {
    const r = document.querySelector('.ru-rail').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const under = await page.evaluate(b => {
    const n = document.elementFromPoint(b.x + b.w / 2, b.y + b.h / 2);
    return n ? n.className : 'nothing';
  }, box);
  if (!/ru-/.test(String(under))) {
    console.log(`\n=== ${label}: cursor would land on "${under}", not the rail — skipping`);
    await ctx.close();
    continue;
  }

  // Sweep left to right in 1px steps, sampling the state the UI is in at each point.
  await page.mouse.move(box.x + 2, box.y + box.h / 2);
  await page.mouse.down();
  const samples = [];
  for (let px = 2; px < box.w - 2; px += 2) {
    await page.mouse.move(box.x + px, box.y + box.h / 2);
    samples.push(await page.evaluate(() => ({
      locked: document.querySelector('.ru-rail').classList.contains('lock'),
      out: document.querySelector('.ru-out').textContent,
      gains: window.__gains.length ? window.__gains[window.__gains.length - 1] : null
    })));
  }
  await page.mouse.up();

  const locked = samples.filter(s => s.locked).length;
  const gains = samples.map(s => s.gains).filter(g => g !== null);
  const audible = gains.filter(g => g > 0.02).length;
  const silent = gains.filter(g => g <= 0.005).length;
  const distinct = new Set(samples.map(s => s.out)).size;

  console.log(`=== ${label} — rail ${Math.round(box.w)}px, ${samples.length} samples`);
  console.log(`  inside a detent : ${locked}/${samples.length}  (${Math.round(locked / samples.length * 100)}% of the sweep)`);
  console.log(`  gain asked for  : min ${Math.min(...gains).toFixed(4)}  max ${Math.max(...gains).toFixed(4)}`);
  console.log(`  effectively mute: ${silent}/${gains.length}  (${Math.round(silent / gains.length * 100)}%)`);
  console.log(`  clearly audible : ${audible}/${gains.length}  (${Math.round(audible / gains.length * 100)}%)`);
  console.log(`  distinct readout: ${distinct}/${samples.length}`);
  console.log(`  context state   : ${await page.evaluate(() => window.__ctxState ? window.__ctxState() : 'never created')}`);

  // Where on the rail is it silent? Bucket the sweep into tenths.
  const buckets = [];
  for (let i = 0; i < 10; i++) {
    const part = samples.slice(Math.floor(i * samples.length / 10), Math.floor((i + 1) * samples.length / 10));
    const lk = part.filter(s => s.locked).length;
    buckets.push(`${Math.round(lk / part.length * 100)}%`);
  }
  console.log(`  detent by tenth : ${buckets.join(' ')}`);

  await ctx.close();
}

await browser.close();
