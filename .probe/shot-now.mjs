import { chromium, serve } from './harness.mjs';
const URL = await serve();
const browser = await chromium.launch();

for (const [name, w, hash, geo] of [
  ['now-phone', 430, '#/us/bay-area', { latitude: 37.563, longitude: -122.3255 }],
  ['now-narrow', 320, '#/us/bay-area', null],
  ['now-cn', 430, '#/cn/beijing', null],
  ['now-desk', 1100, '#/us/bay-area', null]
]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w > 700 ? 900 : 940 },
    isMobile: w < 700, hasTouch: w < 700, deviceScaleFactor: 2,
    ...(geo ? { permissions: ['geolocation'], geolocation: geo } : {})
  });
  const page = await ctx.newPage();
  await page.goto(URL + '?pro=1' + hash, { waitUntil: 'networkidle' });
  if (geo) { await page.click('#btn-geo'); await page.waitForTimeout(1500); }
  await page.waitForFunction(() => {
    const c = document.querySelectorAll('#now .nw-c');
    return c.length >= 2 && ![...c].some(n => n.querySelector('.nw-v').textContent.includes('·  ·'));
  }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `.probe/${name}.png` });
  await ctx.close();
  console.log(name);
}
await browser.close();
