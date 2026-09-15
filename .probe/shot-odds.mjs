import { chromium, serve } from './harness.mjs';
const URL = await serve();
const browser = await chromium.launch();

for (const [name, w, q] of [['odds-simple', 430, '?pro=0'], ['odds-pro', 430, '?pro=1'], ['odds-desk', 1100, '?pro=1']]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 1000 }, isMobile: w < 700, hasTouch: w < 700, deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  await page.goto(URL + q + '#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // Scroll to the list so the indicator is what we are looking at.
  await page.evaluate(() => {
    const g = document.querySelector('.grp');
    if (g) g.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `.probe/${name}.png` });
  await ctx.close();
  console.log(name);
}
await browser.close();
