// Screenshot each skin, and the settings popover that switches them.
import { chromium, serve } from './harness.mjs';

const URL = await serve();
const browser = await chromium.launch();

for (const [name, skin, openMenu, w, dx] of [
  ['skin-auto', 'auto', false, 390, false],
  ['skin-glare', 'glare', false, 390, false],
  ['skin-black', 'black', false, 390, false],
  ['skin-menu', 'auto', true, 390, false],
  ['skin-menu-glare', 'glare', true, 390, false],
  ['skin-tiny', 'glare', true, 320, false],
  // The rows carry the coloured tags and the odds bars, which is where a light skin is
  // most likely to lose a distinction that the dark one made easily.
  ['skin-rows-glare', 'glare', false, 390, true],
  ['skin-rows-black', 'black', false, 390, true]
]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('aw.skin', s), skin);
  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForSelector('.row');
  if (openMenu) {
    await page.click('#btn-view');
    await page.waitForTimeout(350);
  }
  if (dx) {
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('.row')].find(x => x.textContent.includes('Mount Diablo'));
      if (t) { t.click(); t.scrollIntoView({ block: 'center' }); }
    });
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `.probe/${name}.png` });
  await ctx.close();
}

await browser.close();
console.log('skin shots written');
