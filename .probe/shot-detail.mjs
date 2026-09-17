// Screenshot an open detail panel, on a phone and on a desktop.
import { chromium, serve } from './harness.mjs';

const URL = await serve();
const browser = await chromium.launch();

for (const [name, w, mobile, match] of [
  ['dx-phone', 390, true, 'Mount Diablo'],
  ['dx-tiny', 320, true, 'Mount Diablo'],
  ['dx-desk', 1100, false, 'Mount Diablo'],
  ['dx-bcast', 390, true, 'KCBS']
]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 940 }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile
  });
  const page = await ctx.newPage();
  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForSelector('.row');
  await page.evaluate(m => {
    const t = [...document.querySelectorAll('.row')].find(x => x.textContent.includes(m));
    if (t) { t.click(); t.scrollIntoView({ block: 'center' }); }
  }, match);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `.probe/${name}.png` });
  await ctx.close();
}

await browser.close();
console.log('detail shots written');
