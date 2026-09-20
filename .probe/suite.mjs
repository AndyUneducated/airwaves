// Regression suite for the site. Serves the project itself, so there is nothing to start
// first and no fixed port to collide with.
//   npm test                         all groups
//   node .probe/suite.mjs mode ruler only the named groups
import { chromium, serve } from './harness.mjs';

const URL = await serve();
const only = process.argv.slice(2);
const want = g => !only.length || only.includes(g);

const browser = await chromium.launch();
let failures = 0;
const pass = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

async function session(opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: !opts.viewport, hasTouch: !opts.viewport
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('requestfailed', r => errs.push('request failed: ' + r.url()));
  return { ctx, page, errs };
}

// Search shares the chip row and is closed until asked for, so the field has to be opened
// before it can be typed into.
async function openSearch(page) {
  if (await page.evaluate(() => document.getElementById('hd-search').hidden)) {
    await page.click('#btn-find');
    await page.waitForSelector('#q', { state: 'visible' });
  }
}

// Overhead and the horizon map open from a card in the right-now panel rather than sitting
// on the page, so a test that wants to look inside one has to open it first.
async function openPanel(page, key) {
  await page.waitForSelector(`.nw-x-c[aria-controls="${key}"]`, { timeout: 15000 });
  if (await page.evaluate(k => document.getElementById(k).hidden, key)) {
    await page.evaluate(k => document.querySelector(`.nw-x-c[aria-controls="${k}"]`).click(), key);
  }
  await page.waitForFunction(k => !document.getElementById(k).hidden, key, { timeout: 15000 });
}

// Switch region and wait for the state, not for a guessed number of milliseconds: the
// skeleton has to be gone and the chip for this region has to be the selected one.
async function go(page, id) {
  await page.evaluate(i => { location.hash = '#/x/' + i; }, id);
  await page.waitForFunction(i =>
    !document.querySelector('.sk') &&
    !!document.querySelector(`#regions .chip[data-id="${i}"][aria-pressed="true"]`),
    id, { timeout: 10000 });
}

/* ================= every region renders, in both modes ================= */
if (want('regions')) {
  for (const mode of ['simple', 'pro']) {
    const { ctx, page, errs } = await session();
    await page.goto(URL + (mode === 'pro' ? '?pro=1' : '?pro=0'), { waitUntil: 'networkidle' });
    const ids = await page.evaluate(async () =>
      (await (await fetch('data/regions.json')).json()).regions.map(r => r.id));

    const bad = [];
    let rows = 0, pro = 0;
    for (const id of ids) {
      await go(page, id);
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({
        title: document.querySelector('.intro h1').textContent.trim(),
        rows: document.querySelectorAll('.row').length,
        blankFreq: [...document.querySelectorAll('.row .f')].filter(n => !n.textContent.trim()).length,
        px: document.querySelectorAll('.px').length,
        chev: document.querySelectorAll('.dx-c').length,
        withFreq: [...document.querySelectorAll('.row')].filter(n => !/^—/.test(n.querySelector('.f').textContent)).length,
        ticks: document.querySelectorAll('.ru-k').length,
        cats: document.querySelectorAll('#cats .chip').length,
        emptyArea: [...document.querySelectorAll('.area')].filter(n => !n.textContent.trim()).length,
        exportBtn: !!document.querySelector('.btn-a')
      }));
      rows += r.rows; pro += r.chev;
      // Every pro row that has a frequency must offer its detail panel. The pro line itself
      // is conditional now -- it only appears when there is a distance or a band to name --
      // so the chevron is what has to be universal.
      const pxOk = mode === 'pro'
        ? r.chev === r.withFreq
        : r.px === 0 && r.chev === 0;
      if (!r.title || !r.rows || !r.cats || !r.exportBtn || r.blankFreq || r.emptyArea || r.ticks > r.rows || !pxOk) {
        bad.push(id + ' ' + JSON.stringify(r));
      }
    }
    pass(`all regions render (${mode})`, bad.length === 0,
      bad.length ? bad.slice(0, 3).join('; ') : `${ids.length} regions, ${rows} rows, ${pro} expandable`);
    pass(`no console errors browsing every region (${mode})`, errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

/* ================= mode switch ================= */
if (want('mode')) {
  const { ctx, page, errs } = await session();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const off = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    pressed: document.getElementById('btn-mode').getAttribute('aria-pressed'),
    px: document.querySelectorAll('.px').length,
    band: document.querySelector('.ru-band em').textContent
  }));
  pass('defaults to simple mode', off.mode === 'simple' && off.pressed === 'false' && off.px === 0 && off.band === 'HF',
    JSON.stringify(off));

  await page.click('#btn-mode');
  await page.waitForTimeout(450);
  const on = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    pressed: document.getElementById('btn-mode').getAttribute('aria-pressed'),
    px: document.querySelectorAll('.px').length,
    bands: [...document.querySelectorAll('.ru-band em')].map(n => n.textContent),
    toast: document.getElementById('toast').textContent
  }));
  pass('toggle turns pro on', on.mode === 'pro' && on.pressed === 'true' && on.px > 0 &&
    on.bands.every(b => /^(HF|VHF|UHF) \d+$/.test(b)) && /Pro mode/.test(on.toast),
    `${on.px} pro lines, bands ${on.bands.join('/')}`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  pass('pro mode persists across reload',
    (await page.evaluate(() => document.documentElement.dataset.mode)) === 'pro');

  await page.keyboard.press('p');
  await page.waitForTimeout(400);
  const afterKey = await page.evaluate(() => document.documentElement.dataset.mode);
  await openSearch(page);
  await page.type('#q', 'p');
  await page.waitForTimeout(300);
  const afterType = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    value: document.getElementById('q').value
  }));
  pass('P toggles, but not while typing', afterKey === 'simple' && afterType.mode === 'simple' && afterType.value === 'p',
    `key→${afterKey}, typed "${afterType.value}" and stayed ${afterType.mode}`);
  await page.fill('#q', '');

  await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  const forcedOn = await page.evaluate(() => document.documentElement.dataset.mode);
  await page.goto(URL + '?pro=0', { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  const forcedOff = await page.evaluate(() => document.documentElement.dataset.mode);
  pass('?pro= overrides and sticks', forcedOn === 'pro' && forcedOff === 'simple');

  pass('no console errors around the mode switch', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ================= pro detail is correct, not just present ================= */
if (want('pro')) {
  const { ctx, page } = await session();
  await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
  await go(page, 'bay-area');
  await page.waitForTimeout(500);

  // The always-visible pro line carries only what helps while scanning: which band, and
  // where it is. The reference figures -- repeater input, antenna lengths, mode, power --
  // moved into the detail panel, which the "detail" group covers. Printing them on every
  // row said the same thing twice once the panel existed.
  const line = f => page.evaluate(freq => {
    const row = [...document.querySelectorAll('.row')]
      .find(n => n.querySelector('.f').textContent.startsWith(freq));
    return row ? [...row.querySelectorAll('.px-i')].map(n => n.textContent) : null;
  }, f);
  const panel = f => page.evaluate(freq => {
    document.querySelectorAll('.dx').forEach(n => n.remove());
    const row = [...document.querySelectorAll('.row')]
      .find(n => n.querySelector('.f').textContent.startsWith(freq));
    if (!row) return null;
    row.click();
    const o = {};
    (row.nextElementSibling || document.createElement('div'))
      .querySelectorAll('.dx-r').forEach(n => {
        o[n.querySelector('.dx-k').textContent] = n.querySelector('.dx-v').textContent;
      });
    row.click();
    return o;
  }, f);

  // W6CX Mount Diablo: 147.060 with a +0.600 offset, so you transmit on 147.660.
  pass('the pro line names the band and nothing redundant',
    String(await line('147.060')) === '2 m', JSON.stringify(await line('147.060')));
  // NOAA weather is not an amateur band, so the line has nothing to say and is absent.
  pass('no pro line where there is nothing to put in it',
    String(await line('162.400')) === '', JSON.stringify(await line('162.400')));

  // N6NFI: 145.230 with a −0.600 offset, so you transmit on 144.630.
  const neg = await panel('145.230');
  pass('a negative offset subtracts', /144\.630/.test(neg['You transmit on'] || ''),
    JSON.stringify(neg['You transmit on']));
  // KQED on 88.5 MHz: broadcast FM, an 85 cm quarter wave.
  const fm = await panel('88.500');
  pass('broadcast FM antenna length', /85 cm/.test(fm['Antenna'] || ''), JSON.stringify(fm['Antenna']));

  await page.click('#btn-lang');
  await page.waitForTimeout(500);
  pass('the pro line is translated', String(await line('147.060')) === '2 m', JSON.stringify(await line('147.060')));
  const zh = await panel('147.060');
  pass('the detail panel is translated',
    /147\.660/.test(zh['你发射的频率'] || '') && !!zh['收到概率'], JSON.stringify(zh));
  await ctx.close();
}

/* ================= distance and bearing to transmitter sites ================= */
if (want('geo')) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true,
    permissions: ['geolocation'],
    // San Mateo: one airport inside 10 km and several beyond it, so both distance formats
    // and several compass points get exercised from one position.
    geolocation: { latitude: 37.5630, longitude: -122.3255 }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const before = await page.evaluate(() => ({
    label: document.querySelector('#btn-geo span').textContent,
    lit: document.querySelector('#btn-geo').classList.contains('on-geo'),
    anyDistance: [...document.querySelectorAll('.px-i')].some(n => /km/.test(n.textContent))
  }));
  pass('no distances before you share a location', !before.lit && !before.anyDistance,
    JSON.stringify(before));

  await page.click('#btn-geo');
  await page.waitForFunction(() => !document.querySelector('.sk'), null, { timeout: 10000 });
  await page.waitForTimeout(700);

  const located = await page.evaluate(() => ({
    region: document.querySelector('.intro h1').textContent,
    label: document.querySelector('#btn-geo span').textContent,
    lit: document.querySelector('#btn-geo').classList.contains('on-geo'),
    stored: JSON.parse(localStorage.getItem('aw.pos') || 'null')
  }));
  pass('locating picks the region and remembers the position',
    located.region === 'SF Bay Area' && located.label === 'Here' && located.lit &&
    Math.abs(located.stored.lat - 37.5630) < 0.01,
    `${located.region}, chip says "${located.label}"`);

  const read = f => page.evaluate(freq => {
    const row = [...document.querySelectorAll('.row')]
      .find(n => n.querySelector('.f').textContent.startsWith(freq));
    return row ? [...row.querySelectorAll('.px-i')].map(n => n.textContent) : null;
  }, f);

  // Worked out independently from places.json with a separate great-circle implementation:
  // SFO is 7.665 km at 325.5°, San Carlos 8.612 km at 130.1°, Palo Alto 21.751 km at 121.3°.
  const sfo = await read('120.500');
  const sql = await read('119.000');
  const pao = await read('118.600');
  const rpt = await read('147.060');   // a repeater has no single site, so it claims no distance
  pass('a tower inside 10 km reads in tenths', String(sfo[0]) === '7.7 km NW', JSON.stringify(sfo));
  pass('bearing points the other way for a southern field', String(sql[0]) === '8.6 km SE', JSON.stringify(sql));
  pass('beyond 10 km it rounds to whole km', String(pao[0]) === '22 km SE', JSON.stringify(pao));
  pass('entries without a known site claim no distance', !/km/.test(String(rpt)), JSON.stringify(rpt));

  await page.click('#btn-lang');
  await page.waitForTimeout(600);
  const zh = await read('120.500');
  pass('distance is localised', String(zh[0]) === '7.7 公里 西北', JSON.stringify(zh));
  await page.click('#btn-lang');
  await page.waitForTimeout(500);

  // The position survives a reload, so distances are there without asking again.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    lit: document.querySelector('#btn-geo').classList.contains('on-geo'),
    sfo: (() => {
      const row = [...document.querySelectorAll('.row')]
        .find(n => n.querySelector('.f').textContent.startsWith('120.500'));
      return row ? row.querySelector('.px-i').textContent : null;
    })()
  }));
  pass('a remembered position needs no second prompt', after.lit && after.sfo === '7.7 km NW',
    JSON.stringify(after));

  // ?pro=0 rather than clearing localStorage, because the query deliberately wins on load.
  await page.goto(URL + '?pro=0', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const inSimple = await page.evaluate(() => ({
    px: document.querySelectorAll('.px').length,
    lit: document.querySelector('#btn-geo').classList.contains('on-geo')
  }));
  pass('simple mode keeps the position but shows no distances',
    inSimple.px === 0 && inSimple.lit, JSON.stringify(inSimple));

  pass('no console errors while locating', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ================= pro: the per-entry detail panel ================= */
if (want('detail')) {
  const { ctx, page, errs } = await session();
  const open = async match => {
    await page.evaluate(m => {
      document.querySelectorAll('.dx').forEach(n => n.remove());
      document.querySelectorAll('.row.open').forEach(n => n.classList.remove('open'));
      const t = [...document.querySelectorAll('.row')].find(x => x.textContent.includes(m));
      if (t) { t.scrollIntoView({ block: 'center' }); t.click(); }
    }, match);
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const o = {};
      document.querySelectorAll('.dx-r').forEach(n => {
        o[n.querySelector('.dx-k').textContent] = n.querySelector('.dx-v').textContent;
      });
      return o;
    });
  };

  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // A repeater is the case that earns the feature: the listed frequency is the output, and
  // nothing in the radio or the list tells you what to transmit on.
  const rpt = await open('Mount Diablo');
  pass('a repeater gives you its input and tone',
    /147\.660/.test(rpt['You transmit on'] || '') && /PL 100/.test(rpt['Tone'] || ''),
    JSON.stringify(rpt));

  // Channel spacing is a property of the service, not the mode. Claiming 8.33 kHz about a
  // medium-wave broadcaster was wrong, and this is the guard for it.
  const am = await open('KCBS');
  pass('a medium-wave station is not described in airband steps',
    am['Set the radio to'] === 'AM · medium wave', JSON.stringify(am['Set the radio to']));
  pass('licensed power and licensee come through',
    /50 kW/.test(am['Licensed power'] || '') && /Audacy/.test(am['Licensed to'] || ''),
    `${am['Licensed power']} / ${am['Licensed to']}`);
  pass('imported entries admit where they came from',
    /FCC/.test(am['Source'] || ''), am['Source']);
  pass('a hundred metres of wire is not offered as antenna advice',
    am['Antenna'] === undefined, String(am['Antenna']));

  const air = await open('SFO Tower');
  pass('an airport says airband, and where the transmitter is',
    /airband/.test(air['Set the radio to'] || '') && !!air['Transmitter'],
    `${air['Set the radio to']} / ${air['Transmitter']}`);
  pass('the odds are spelled out, not just drawn', !!air['Odds'], air['Odds']);

  // Toggle, and the affordance that says it can be toggled.
  const toggle = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.row')].find(x => x.textContent.includes('SFO Tower'));
    const before = row.getAttribute('aria-expanded');
    const chev = !!row.querySelector('.dx-c');
    row.click();
    const after = row.getAttribute('aria-expanded');
    const gone = !(row.nextElementSibling && row.nextElementSibling.classList.contains('dx'));
    return { before, after, gone, chev };
  });
  pass('tapping again closes it',
    toggle.before === 'true' && toggle.after === 'false' && toggle.gone, JSON.stringify(toggle));
  pass('the row shows it can be opened', toggle.chev, 'chevron present');

  // Copying moved into the panel, so it must still work from there.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.row')].find(x => x.textContent.includes('SFO Tower'));
    row.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.dx-b').click());
  await page.waitForTimeout(300);
  const copied = await page.evaluate(async () => {
    const toast = document.querySelector('.toast');
    let clip = '';
    try { clip = await navigator.clipboard.readText(); } catch (e) {}
    return { toast: toast ? toast.textContent : '', clip };
  });
  pass('the copy button in the panel still copies',
    /120\.500/.test(copied.toast) || /120\.500/.test(copied.clip), JSON.stringify(copied));

  // Simple mode must be untouched: a tap copies and nothing expands.
  await page.goto(URL + '?pro=0#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const plain = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.row')].find(x => x.textContent.includes('SFO Tower'));
    row.click();
    return {
      expanded: row.getAttribute('aria-expanded'),
      panel: !!document.querySelector('.dx'),
      chev: !!row.querySelector('.dx-c')
    };
  });
  await page.waitForTimeout(250);
  const plainToast = await page.evaluate(() => {
    const t = document.querySelector('.toast');
    return t ? t.textContent : '';
  });
  pass('simple mode still copies on tap and never expands',
    !plain.panel && !plain.chev && plain.expanded === null && /120\.500/.test(plainToast),
    `${JSON.stringify(plain)} toast="${plainToast}"`);

  pass('no console errors from the detail panel', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ================= odds: will I hear anything if I tune here ================= */
if (want('odds')) {
  const { ctx, page, errs } = await session();
  const read = f => page.evaluate(freq => {
    const row = [...document.querySelectorAll('.row')]
      .find(n => n.querySelector('.f').textContent.startsWith(freq));
    if (!row) return null;
    const od = row.querySelector('.od');
    return {
      has: !!od,
      level: od ? Number(od.className.match(/od-(\d)/)[1]) : null,
      lit: od ? od.querySelectorAll('.od-b i.on').length : null,
      word: od && od.querySelector('.od-w') ? od.querySelector('.od-w').textContent : null,
      label: od ? od.getAttribute('aria-label') : null,
      struck: row.classList.contains('dig')
    };
  }, f);

  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // A looped ATIS recording is the clearest "always on" there is; a tower is busy but has
  // gaps; a simplex calling channel is silent unless somebody calls.
  const atis = await read('135.450');
  const tower = await read('120.500');
  const simplex = await read('146.520');
  pass('a continuous ATIS loop reads three bars',
    atis.level === 3 && atis.lit === 3 && atis.word === 'Always on', JSON.stringify(atis));
  pass('a working tower reads two',
    tower.level === 2 && tower.lit === 2 && tower.word === 'Usually something', JSON.stringify(tower));
  pass('a simplex calling channel reads one',
    simplex.level === 1 && simplex.lit === 1 && simplex.word === 'Long shot', JSON.stringify(simplex));
  pass('the bars carry a text label for screen readers',
    /Odds of hearing something — Always on/.test(atis.label), atis.label);

  // NOAA weather radio is the benchmark the whole scale was set against.
  const noaa = await read('162.400');
  pass('NOAA weather radio is the top of the scale', noaa.level === 3, JSON.stringify(noaa));

  // Something the radio cannot decode has no odds at all, rather than a low score.
  const digital = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.row.dig')][0];
    return row ? { name: row.querySelector('.t').textContent, od: !!row.querySelector('.od') } : null;
  });
  pass('digital entries claim no odds', digital && digital.od === false, JSON.stringify(digital));

  // The old confidence tag is gone from the list: one indicator, as designed.
  const oldTags = await page.evaluate(() =>
    document.querySelectorAll('.tag-std, .tag-high, .tag-check').length);
  pass('the separate confidence tag is gone from rows', oldTags === 0, `${oldTags} left`);

  // An unconfirmed frequency cannot be a sure thing however strong the transmitter.
  const capped = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.row')];
    return rows.filter(r => {
      const od = r.querySelector('.od-3');
      return od && /Verify/i.test(r.textContent);
    }).length;
  });
  pass('nothing marked three bars contradicts itself', capped === 0, `${capped} conflicts`);

  await page.click('#btn-lang');
  await page.waitForTimeout(700);
  const zh = await read('135.450');
  pass('odds are translated', zh.word === '常开' && /收到东西的概率/.test(zh.label), JSON.stringify(zh));
  await page.click('#btn-lang');
  await page.waitForTimeout(600);

  // Simple mode keeps the bars but drops the words: same information, less furniture.
  await page.goto(URL + '?pro=0#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const plain = await read('135.450');
  pass('simple mode shows bars without words',
    plain.level === 3 && plain.lit === 3 && plain.word === null, JSON.stringify(plain));

  // Every entry with a frequency should say something, or the indicator is not trustworthy.
  const coverage = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.row')];
    const real = rows.filter(r => !r.classList.contains('dig') && !/^—/.test(r.querySelector('.f').textContent));
    return { real: real.length, withOdds: real.filter(r => r.querySelector('.od')).length };
  });
  pass('every receivable entry carries odds',
    coverage.real > 20 && coverage.real === coverage.withOdds, JSON.stringify(coverage));

  pass('no console errors with odds rendered', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ================= the tuning hiss is actually audible ================= */
if (want('hiss')) {
  // Regression guard for a measured bug: the hiss peaked about 26 dB down, and because a
  // detent silenced it and detents were a fixed 15px wide, the crowded part of the band was
  // 89% "locked" — so it went mute exactly where you spend the most time tuning.
  for (const [label, hash] of [['bay-area', '#/us/bay-area'], ['nationwide', '#/us/nationwide']]) {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__gains = [];
      const set = AudioParam.prototype.setTargetAtTime;
      AudioParam.prototype.setTargetAtTime = function (v, ...rest) {
        window.__gains.push(v);
        return set.call(this, v, ...rest);
      };
    });
    await page.goto(URL + '?pro=1' + hash, { waitUntil: 'commit' });
    await page.waitForFunction(() => !!document.querySelector('.ru-rail'), null, { timeout: 10000 });

    const y0 = await page.evaluate(() => document.querySelector('.ru-rail').getBoundingClientRect().y);
    await page.waitForTimeout(2200);
    const y1 = await page.evaluate(() => document.querySelector('.ru-rail').getBoundingClientRect().y);
    pass(`rail does not move under your finger (${label})`, Math.abs(y1 - y0) < 1, `drifted ${Math.round(y1 - y0)}px`);

    await page.evaluate(() => document.querySelector('.ru-rail').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.ru-rail').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    await page.mouse.move(box.x + 2, box.y + box.h / 2);
    await page.mouse.down();
    const locks = [];
    for (let px = 2; px < box.w - 2; px += 2) {
      await page.mouse.move(box.x + px, box.y + box.h / 2);
      locks.push(await page.evaluate(() => document.querySelector('.ru-rail').classList.contains('lock')));
    }
    const gains = await page.evaluate(() => window.__gains.slice());
    await page.mouse.up();

    const quiet = gains.filter(g => g > 0 && g <= 0.005).length;
    pass(`hiss never drops out mid-sweep (${label})`,
      gains.length > 20 && quiet === 0 && Math.max(...gains) >= 0.12,
      `${gains.length} gain changes, peak ${Math.max(...gains).toFixed(3)}, ${quiet} near-silent`);

    // No tenth of the rail may be swallowed by detents, however crowded the band is there.
    let worst = 0, worstAt = 0;
    for (let i = 0; i < 10; i++) {
      const part = locks.slice(Math.floor(i * locks.length / 10), Math.floor((i + 1) * locks.length / 10));
      const share = part.filter(Boolean).length / part.length;
      if (share > worst) { worst = share; worstAt = i + 1; }
    }
    // Not a bug when it is high in a crowded band -- with twenty broadcast stations packed
    // into one stretch of the rail you genuinely are near one almost everywhere. What the
    // original bug was is the hiss going mute there, and the check above covers that.
    pass(`detents leave air between them (${label})`, worst <= 0.8,
      `busiest tenth is #${worstAt} at ${Math.round(worst * 100)}% locked`);

    await ctx.close();
  }
}

/* ================= the "right now" panel ================= */
if (want('now')) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  const read = () => page.evaluate(() => {
    const box = document.querySelector('#now');
    if (!box || box.hidden) return { hidden: true };
    return {
      hidden: false,
      where: box.querySelector('.nw-w').textContent,
      cards: [...box.querySelectorAll('.nw-c')].map(c => ({
        k: c.querySelector('.nw-k').textContent,
        v: c.querySelector('.nw-v').textContent,
        d: c.querySelector('.nw-d').textContent,
        warn: c.classList.contains('nw-warn'),
        hit: c.classList.contains('nw-hit')
      }))
    };
  });

  await page.goto(URL + '?pro=0#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  pass('simple mode has no panel', (await read()).hidden === true);

  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const c = document.querySelectorAll('#now .nw-c');
    return c.length >= 3 && ![...c].some(n => n.querySelector('.nw-v').textContent.includes('·  ·'));
  }, null, { timeout: 15000 });
  const us = await read();
  pass('three cards, keyed to the region you are reading',
    us.cards.length === 3 && us.where === 'SF Bay Area' &&
    us.cards.map(c => c.k).join('|') === 'Sun|HF conditions|Weather alerts',
    `${us.where}: ` + us.cards.map(c => c.k).join(' / '));

  const sun = us.cards[0];
  pass('sun card states day or night and the next turn',
    /^(Dark|Daylight|Dark — the AM band is open|The sun does not)/.test(sun.v) &&
    /^(Sunrise|Sunset) in \d+( h \d+)? m$/.test(sun.d),
    `"${sun.v}" / "${sun.d}"`);

  const hf = us.cards[1];
  pass('HF card reads a real Kp and flux',
    /^Kp [0-7] · (quiet|unsettled|active|storm|severe storm)$/.test(hf.v) &&
    /^Solar flux \d+ · high bands/.test(hf.d),
    `"${hf.v}" / "${hf.d}"`);

  const wx = us.cards[2];
  pass('alert card names the weather frequency and can be tapped',
    /NOAA on 162\.\d+ MHz/.test(wx.d) && wx.hit,
    `"${wx.v}" / "${wx.d}"`);

  // Tapping it should land you on the frequency it just named.
  await page.click('#now .nw-c.nw-hit');
  await page.waitForTimeout(900);
  const landed = await page.evaluate(() => {
    const hit = document.querySelector('.row.hit');
    return hit ? hit.querySelector('.f').textContent : null;
  });
  pass('tapping the alert card jumps to NOAA weather radio', /^162\./.test(String(landed)), String(landed));

  // The alert service is US-only and rejects a Chinese point outright, so that card must
  // not be there at all rather than sitting broken.
  await page.goto(URL + '?pro=1#/cn/beijing', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#now .nw-c').length >= 2, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const cn = await read();
  pass('no US alert card outside the US',
    cn.cards.length === 2 && !cn.cards.some(c => /alert/i.test(c.k)) &&
    cn.where === 'Beijing & Capital Region',
    `${cn.where}: ` + cn.cards.map(c => c.k).join(' / '));

  await page.click('#btn-lang');
  await page.waitForTimeout(900);
  const zh = await read();
  pass('panel is translated',
    zh.cards[0].k === '日照' && zh.cards[1].k === '短波条件' &&
    /(还有|不落|不升)/.test(zh.cards[0].d + zh.cards[0].v),
    zh.cards.map(c => `${c.k}: ${c.v}`).join(' | '));
  await page.click('#btn-lang');
  await page.waitForTimeout(700);

  // A region with no centre point has nothing to say about "here".
  await page.goto(URL + '?pro=1#/us/nationwide', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  pass('nationwide sets get no panel', (await read()).hidden === true);

  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  pass('no console errors while the panel is online', errs.length === 0, errs.slice(0, 3).join(' | '));

  // Everything past here runs with the network pulled, which the browser reports as failed
  // resource loads by design. Only uncaught exceptions still count against us.
  const thrown = () => errs.filter(e => e.startsWith('pageerror: '));

  // Offline: the sun still works because it is local, and the live cards fall back to the
  // last reading rather than going blank.
  await ctx.setOffline(true);
  await page.evaluate(() => {
    // Expire the TTLs so the cards have to try the network and fail.
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('aw.live.')) continue;
      const v = JSON.parse(localStorage.getItem(k));
      v.at = 0;
      localStorage.setItem(k, JSON.stringify(v));
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const c = document.querySelectorAll('#now .nw-c');
    return c.length >= 3 && ![...c].some(n => n.querySelector('.nw-v').textContent.includes('·  ·'));
  }, null, { timeout: 20000 });
  const off = await read();
  pass('offline: the sun is unaffected', /^(Dark|Daylight)/.test(off.cards[0].v), off.cards[0].v);
  pass('offline: live cards show the last reading, marked as such',
    /^Kp [0-7] ·/.test(off.cards[1].v) && /last known/.test(off.cards[1].d),
    `"${off.cards[1].v}" / "${off.cards[1].d}"`);

  // With nothing cached and no network it must say so plainly rather than spin forever.
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('aw.live.')) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!document.querySelector('#now .nw-c:nth-child(2) .nw-v') &&
      !document.querySelector('#now .nw-c:nth-child(2) .nw-v').textContent.includes('·  ·'),
    null, { timeout: 25000 });
  const cold = await read();
  pass('offline with nothing cached: the card admits it',
    cold.cards[1].v === 'Needs a connection' && /^(Dark|Daylight)/.test(cold.cards[0].v),
    cold.cards.map(c => `${c.k}: ${c.v}`).join(' | '));
  await ctx.setOffline(false);

  pass('nothing thrown, online or off', thrown().length === 0, thrown().slice(0, 3).join(' | '));
  await ctx.close();
}

/* ================= header fits on a small phone ================= */
if (want('layout')) {
  for (const [w, lang] of [[280, 'en'], [320, 'en'], [320, 'zh'], [360, 'zh'], [390, 'zh'], [768, 'en']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 720 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
    await page.evaluate(l => localStorage.setItem('aw.lang', l), lang);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.hd-bar');
      const btn = document.getElementById('btn-mode');
      const r = btn.getBoundingClientRect();
      // The visible pill is small on purpose; what must reach 44px is the hit area.
      const after = getComputedStyle(btn, '::after');
      const grow = Math.abs(parseFloat(after.top) || 0) + Math.abs(parseFloat(after.bottom) || 0);
      const brand = document.querySelector('.brand-name');
      const clipped = brand.offsetParent !== null && brand.scrollWidth > brand.clientWidth + 1;
      return {
        overflow: bar.scrollWidth - bar.clientWidth,
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tap: Math.round(r.height + grow), right: Math.round(r.right), vw: innerWidth, clipped,
        label: document.getElementById('mode-t').textContent
      };
    });
    pass(`header fits at ${w}px (${lang})`,
      m.overflow <= 1 && m.docOverflow <= 1 && m.right <= m.vw && !m.clipped && m.tap >= 44 && !!m.label,
      `overflow ${m.overflow}/${m.docOverflow}, hit area ${m.tap}px, label "${m.label}", brand clipped: ${m.clipped}`);
    await ctx.close();
  }
}

/* ================= line of sight ================= */
if (want('map')) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    geolocation: { latitude: 37.7749, longitude: -122.4194 }, permissions: ['geolocation']
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForSelector('.row');
  // Nothing about reach can be drawn until the reader asks to be located, and a panel this
  // tall arriving unbidden would shove the tuning rail and the list down the page.
  pass('map: hidden until you share your location',
    await page.evaluate(() => document.getElementById('map').hidden) === true);
  await page.click('#btn-geo');
  await openPanel(page, 'map');
  await page.waitForSelector('.mp-me', { timeout: 20000 });

  // The horizon is the one number here that is physics rather than presentation, so it is
  // checked against the closed form it approximates: a tangent from height h to a sphere of
  // radius 4/3 R, which is d = sqrt(2kRh + h^2). If the coefficient is ever "tidied" the
  // rings silently resize and nothing else would notice.
  const phys = await page.evaluate(() => {
    const K = 4 / 3, R = 6371.0088;
    const exact = h => Math.sqrt(2 * K * R * (h / 1000) + (h / 1000) ** 2);
    const app = h => 4.12 * Math.sqrt(h);
    let worst = 0;
    for (const h of [2, 10, 30, 100, 165, 500, 1173, 2000, 4000]) {
      worst = Math.max(worst, Math.abs(app(h) - exact(h)) / exact(h) * 100);
    }
    return { worst, mast: app(2) + app(10), diablo: app(2) + app(1173), jet: app(2) + app(10000) };
  });
  pass('map: the horizon matches spherical geometry with 4/3 refraction',
    phys.worst < 0.2, `worst ${phys.worst.toFixed(3)}% up to 4000 m`);
  // Three figures any radio handbook quotes, which catch a coefficient wrong by a factor.
  pass('map: and reproduces the textbook distances',
    Math.abs(phys.mast - 18.9) < 0.5 && Math.abs(phys.diablo - 147) < 1.5 &&
    Math.abs(phys.jet - 418) < 2,
    `2+10 m ${phys.mast.toFixed(1)} km, Diablo ${phys.diablo.toFixed(1)} km, jet ${phys.jet.toFixed(0)} km`);

  const m = await page.evaluate(() => {
    const svg = document.querySelector('.mp');
    const rings = [...svg.querySelectorAll('.mp-ring')];
    const box = svg.viewBox.baseVal;
    return {
      sites: svg.querySelectorAll('.mp-s').length,
      rings: rings.length,
      los: svg.querySelectorAll('.mp-s.los').length,
      me: svg.querySelectorAll('.mp-me').length,
      grid: svg.querySelectorAll('.mp-grid line').length,
      scale: (svg.querySelector('.mp-sc text') || {}).textContent || '',
      titles: [...svg.querySelectorAll('.mp-s title')].map(t => t.textContent),
      links: svg.querySelectorAll('.mp-link line').length,
      w: box.width, h: box.height,
      // Everything needed to check the projection from what is actually drawn: the scale bar
      // fixes pixels per km, and each site's title states its true distance from you.
      bar: (() => {
        const ls = [...svg.querySelectorAll('.mp-sc line')];
        const horiz = ls.filter(l => Math.abs(l.y1.baseVal.value - l.y2.baseVal.value) < 0.5)[0];
        const lbl = (svg.querySelector('.mp-sc text') || {}).textContent || '';
        return horiz ? { px: Math.abs(horiz.x2.baseVal.value - horiz.x1.baseVal.value), km: parseFloat(lbl) } : null;
      })(),
      me: (() => {
        const c = svg.querySelector('.mp-me circle');
        return c ? [c.cx.baseVal.value, c.cy.baseVal.value] : null;
      })(),
      plots: [...svg.querySelectorAll('.mp-s')].map(g => {
        const c = g.querySelector('circle'), tl = g.querySelector('title').textContent;
        const x = c.cx.baseVal.value, y = c.cy.baseVal.value;
        // The ring is a sibling of the marker, not a child, so pair them by centre rather
        // than by document order - matching on order would pass even if they came apart.
        const ring = rings.find(r => Math.abs(r.cx.baseVal.value - x) < 0.2 &&
          Math.abs(r.cy.baseVal.value - y) < 0.2);
        return {
          x, y, ring: ring ? ring.r.baseVal.value : null, dot: c.r.baseVal.value,
          km: (tl.match(/([\d.]+)\s*km/) || [])[1], elev: (tl.match(/([\d.]+)\s*m\b/) || [])[1]
        };
      })
    };
  });

  pass('map: sites are plotted with a ring each', m.sites >= 3 && m.rings === m.sites,
    `${m.sites} sites, ${m.rings} rings`);
  pass('map: you are on it', m.me !== null);
  pass('map: a graticule and a scale bar orient the reader',
    m.grid >= 4 && /\d+\s*(km|公里)/.test(m.scale), `${m.grid} grid lines, scale "${m.scale}"`);

  // The projection is checked against the drawing itself: pixels per km from the scale bar
  // must also hold for the straight-line pixel distance to each site, whose true distance the
  // site states. Sites lie in every direction from San Francisco, so an axis scaled wrongly
  // - which is what clamping the panel height used to do - shows up here as a spread.
  const barPx = m.bar ? m.bar.px / m.bar.km : 0;
  const spread = m.plots.filter(p => p.km && +p.km > 10).map(p =>
    Math.hypot(p.x - m.me[0], p.y - m.me[1]) / +p.km / barPx);
  const lo = Math.min(...spread), hi = Math.max(...spread);
  pass('map: one scale holds in every direction',
    spread.length >= 4 && lo > 0.96 && hi < 1.04,
    `${spread.length} sites, px/km vs scale bar ranges ${lo.toFixed(3)}-${hi.toFixed(3)}`);

  // And the rings are that same scale applied to the horizon of each site's own elevation.
  const ringErr = m.plots.filter(p => p.elev && p.ring).map(p =>
    p.ring / ((4.12 * Math.sqrt(+p.elev + 10) + 4.12 * Math.sqrt(2)) * barPx));
  pass('map: rings are drawn to the horizon they claim',
    ringErr.length >= 4 && Math.min(...ringErr) > 0.98 && Math.max(...ringErr) < 1.02,
    `ratio ${Math.min(...ringErr).toFixed(3)}-${Math.max(...ringErr).toFixed(3)}`);

  // Typography: the viewBox used to be a fixed 1000 units wide, so an 19px label came out
  // near 7px on a phone. One unit per pixel is what keeps these honest.
  const type = await page.evaluate(() => {
    const svg = document.querySelector('.mp');
    const r = svg.getBoundingClientRect();
    const px = t => parseFloat(getComputedStyle(t).fontSize) * (r.width / svg.viewBox.baseVal.width);
    // Overlap is checked over every label including "You"; the count is site codes only.
    const labels = [...svg.querySelectorAll('.mp-marks text')];
    const boxes = labels.map(t => t.getBBox());
    const codes = svg.querySelectorAll('.mp-s text').length;
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x < b.x + b.width && a.x + a.width > b.x &&
          a.y < b.y + b.height && a.y + a.height > b.y) overlaps++;
      }
    }
    return {
      unit: r.width / svg.viewBox.baseVal.width,
      site: labels.length ? px(labels[0]) : 0,
      scale: px(svg.querySelector('.mp-sc text')),
      labels: codes, overlaps,
      sites: svg.querySelectorAll('.mp-s').length
    };
  });
  pass('map: one svg unit is one screen pixel', Math.abs(type.unit - 1) < 0.02,
    `${type.unit.toFixed(3)} px per unit`);
  pass('map: labels are big enough to read', type.site >= 10 && type.scale >= 9.5,
    `codes ${type.site.toFixed(1)}px, scale bar ${type.scale.toFixed(1)}px`);
  pass('map: no two labels overlap', type.overlaps === 0, `${type.overlaps} collisions`);
  // Dropping a colliding label is the fix, but dropping most of them would mean the map
  // names almost nothing.
  pass('map: most sites still get named', type.labels >= Math.ceil(type.sites * 0.8),
    `${type.labels} of ${type.sites} labelled`);

  // The sites in reach are the answer to the question the panel asks, so if any label has to
  // go it must not be one of theirs.
  const named = await page.evaluate(() => {
    const has = sel => [...document.querySelectorAll(sel)].map(g => !!g.querySelector('text'));
    return { los: has('.mp-s.los'), all: has('.mp-s') };
  });
  pass('map: sites in reach keep their code', named.los.length > 0 && named.los.every(Boolean),
    `${named.los.filter(Boolean).length} of ${named.los.length} in-reach labelled`);

  // A code clipped by the panel edge reads as a different airport.
  const clipped = await page.evaluate(() => {
    const svg = document.querySelector('.mp'), vb = svg.viewBox.baseVal;
    return [...svg.querySelectorAll('.mp-marks text')].filter(t => {
      const b = t.getBBox();
      return b.x < 0 || b.y < 0 || b.x + b.width > vb.width || b.y + b.height > vb.height;
    }).map(t => t.textContent);
  });
  pass('map: no label runs off the edge', clipped.length === 0, clipped.join(', '));

  pass('map: each site says how far and how high', m.titles.length === m.sites &&
    m.titles.every(x => /\d+\s*m\b/.test(x) && /[\d.]+\s*km/.test(x)), m.titles[0]);
  pass('map: only sites in reach are joined to you', m.links === m.los,
    `${m.links} lines, ${m.los} in reach`);

  // A handheld in San Francisco cannot see every airport in the region; if everything or
  // nothing is in reach the calculation has collapsed into a constant.
  pass('map: the reach calculation discriminates', m.los > 0 && m.los < m.sites,
    `${m.los} of ${m.sites} within line of sight`);

  // The explanation has to state that this is horizon only, or the map overclaims: it knows
  // nothing about the hill in front of you.
  const how = await page.evaluate(() => (document.querySelector('.mp-how') || {}).textContent || '');
  pass('map: the panel says what it does not know',
    /terrain|地形/i.test(how) && /horizon|视距/i.test(how), how.slice(0, 60));

  // Pixel geometry has to be rebuilt when the width changes, or a rotated phone shows a map
  // drawn for the old width, stretched by the browser, with the scale bar now lying.
  const before = await page.evaluate(() => document.querySelector('.mp').viewBox.baseVal.width);
  await page.setViewportSize({ width: 800, height: 844 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const svg = document.querySelector('.mp');
    return { vb: svg.viewBox.baseVal.width, unit: svg.getBoundingClientRect().width / svg.viewBox.baseVal.width };
  });
  pass('map: it redraws when the width changes',
    after.vb > before + 50 && Math.abs(after.unit - 1) < 0.02,
    `${before} -> ${after.vb} units, ${after.unit.toFixed(3)} px per unit`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

  // Three views of the same map. Reach is the horizon reading it has always drawn; distance
  // joins every site and says how far; land puts a surveyed coast and border under it.
  const view = async i => {
    await page.evaluate(n => document.querySelectorAll('.mp-seg .seg-o')[n].click(), i);
    await page.waitForTimeout(i === 2 ? 2500 : 400);
    return page.evaluate(() => ({
      checked: [...document.querySelectorAll('.mp-seg .seg-o')].findIndex(o => o.getAttribute('aria-checked') === 'true'),
      hl: getComputedStyle(document.querySelector('.mp-seg')).getPropertyValue('--i').trim(),
      links: document.querySelectorAll('.mp-link line').length,
      lit: document.querySelectorAll('.mp-link line.los').length,
      land: document.querySelectorAll('.mp-cst, .mp-adm').length,
      labels: [...document.querySelectorAll('.mp-s text')].map(n => n.textContent),
      how: document.querySelector('.mp-how').textContent
    }));
  };
  const vPlain = await view(0), vFar = await view(1), vLand = await view(2);

  pass('map: the strip picks a view and the highlight follows',
    vPlain.checked === 0 && vFar.checked === 1 && vLand.checked === 2 &&
    vPlain.hl === '0' && vFar.hl === '1' && vLand.hl === '2',
    `checked ${vPlain.checked}/${vFar.checked}/${vLand.checked}, highlight ${vPlain.hl}/${vFar.hl}/${vLand.hl}`);

  // Reach joins only what you can hear; distance joins everything, and marks which of those
  // is nonetheless over the horizon, so a short grey line is not mistaken for a usable one.
  pass('map: distance joins every site and keeps the reach reading',
    vFar.links > vPlain.links && vFar.lit === vPlain.links && vFar.links === 8,
    `reach ${vPlain.links} lines, distance ${vFar.links} of which ${vFar.lit} in reach`);

  // The figure hangs off the site's own code, which already has collision avoidance. Written
  // along the line instead, labels for sites a few km apart land on top of each other.
  const withKm = vFar.labels.filter(x => /\d+\s?km/.test(x)).length;
  pass('map: distance view labels each site with how far it is',
    withKm >= vFar.labels.length - 1 && withKm > 4 && vPlain.labels.every(x => !/km/.test(x)),
    `${withKm} of ${vFar.labels.length} labelled, e.g. "${vFar.labels[0]}"`);

  pass('map: land draws a surveyed outline and says where it came from',
    vLand.land > 0 && /Natural Earth/.test(vLand.how) && vPlain.land === 0,
    `${vLand.land} outline paths`);

  pass('map: each view explains itself',
    vPlain.how !== vFar.how && vFar.how !== vLand.how && vPlain.how.length > 40,
    `"${vPlain.how.slice(0, 22)}…" / "${vFar.how.slice(0, 22)}…" / "${vLand.how.slice(0, 22)}…"`);

  // The choice is worth keeping: it is a preference about the picture, not about this visit.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.row');
  await page.click('#btn-geo');
  await openPanel(page, 'map');
  await page.waitForSelector('.mp-me', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const kept = await page.evaluate(() =>
    [...document.querySelectorAll('.mp-seg .seg-o')].findIndex(o => o.getAttribute('aria-checked') === 'true'));
  pass('map: the view you picked is remembered', kept === 2, `came back on segment ${kept}`);
  await page.evaluate(() => document.querySelectorAll('.mp-seg .seg-o')[0].click());
  await page.waitForTimeout(400);

  pass('map: no console errors', errs.length === 0, errs.join(' | '));

  await page.evaluate(() => document.querySelector('#map').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.probe/map.png' });

  // The narrowest phone still in use. The panel is wide - a whole SVG - so it is the most
  // likely thing on the page to burst the viewport.
  const ctx2 = await browser.newContext({
    viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true,
    geolocation: { latitude: 37.7749, longitude: -122.4194 }, permissions: ['geolocation']
  });
  const p2 = await ctx2.newPage();
  await p2.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await p2.waitForSelector('.row');
  await p2.click('#btn-geo');
  await openPanel(p2, 'map');
  await p2.waitForSelector('.mp-me', { timeout: 20000 });
  const tiny = await p2.evaluate(() => ({
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    labels: document.querySelectorAll('.mp-s text').length,
    sites: document.querySelectorAll('.mp-s').length
  }));
  pass('map: fits a 320px screen', tiny.over <= 1, `overflow ${tiny.over}px`);
  // Labels are dropped when they collide, and a 320px panel is where that bites hardest.
  pass('map: still names sites on the narrowest phone', tiny.labels >= tiny.sites / 2,
    `${tiny.labels} of ${tiny.sites}`);
  await p2.screenshot({ path: '.probe/map-tiny.png' });
  await ctx2.close();

  // Sunlight mode inverts the panel, and the label haloes are drawn in the panel background,
  // so they have to follow the skin or the codes turn into dark text ringed in dark.
  await page.evaluate(() => document.documentElement.setAttribute('data-skin', 'glare'));
  await page.waitForTimeout(200);
  const gl = await page.evaluate(() => {
    const p = getComputedStyle(document.querySelector('.mp')).backgroundColor;
    const t = document.querySelector('.mp-s text');
    const cs = getComputedStyle(t);
    const lum = c => {
      const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = lum(cs.fill), b = lum(p);
    return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), halo: cs.stroke, panel: p };
  });
  pass('map: labels stay readable in sunlight mode', gl.ratio >= 3,
    `contrast ${gl.ratio.toFixed(2)}:1 against ${gl.panel}, halo ${gl.halo}`);

  // Rings carry the reading, and a thin translucent stroke that works indoors disappears on
  // a white screen in the sun, so sunlight mode must not be weaker than the dark one.
  const alpha = await page.evaluate(() => {
    const a = () => {
      const g = getComputedStyle(document.querySelector('.mp-ring:not(.los)')).stroke;
      const l = getComputedStyle(document.querySelector('.mp-ring.los')).stroke;
      const grab = c => parseFloat((c.match(/[\d.]+\)/) || ['1)'])[0]) || 1;
      return [grab(g), grab(l)];
    };
    const glare = a();
    document.documentElement.setAttribute('data-skin', 'auto');
    const dark = a();
    document.documentElement.setAttribute('data-skin', 'glare');
    return { glare, dark };
  });
  pass('map: rings are stronger in sunlight, not weaker',
    alpha.glare[0] > alpha.dark[0] && alpha.glare[1] > alpha.dark[1],
    `over-horizon ${alpha.dark[0]} -> ${alpha.glare[0]}, in-reach ${alpha.dark[1]} -> ${alpha.glare[1]}`);
  await page.evaluate(() => document.querySelector('#map').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: '.probe/map-glare.png' });

  // Simple mode is the design centre and stays uncluttered.
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p3 = await ctx3.newPage();
  await p3.goto(URL + '?pro=0#/us/bay-area', { waitUntil: 'networkidle' });
  await p3.waitForSelector('.row');
  pass('map: simple mode does not show it',
    await p3.evaluate(() => document.getElementById('map').hidden) === true);
  await ctx3.close();
  await ctx.close();
}

/* ================= SGP4, against the official verification vectors ================= */
if (want('sgp4')) {
  // The propagator is the one part of this site whose errors are invisible: a wrong orbit
  // still produces a confident time and bearing, and the only way to know it is wrong is to
  // be standing outside pointing at nothing. So it is checked against Vallado's published
  // vectors - the same fixtures every other SGP4 implementation is validated with.
  const { readFileSync } = await import('node:fs');
  let tleTxt, outTxt;
  try {
    tleTxt = readFileSync('.probe/sgp4-ver/SGP4-VER.TLE', 'utf8');
    outTxt = readFileSync('.probe/sgp4-ver/tcppver.out', 'utf8');
  } catch (e) {
    pass('sgp4: verification fixtures present', false,
      'missing .probe/sgp4-ver - run: node .probe/sgp4-fetch.mjs');
  }

  if (tleTxt && outTxt) {
    const tle = tleTxt.split(/\r?\n/);
    const cases = [];
    for (let i = 0; i < tle.length; i++) {
      if (!/^1 /.test(tle[i]) || !/^2 /.test(tle[i + 1] || '')) continue;
      cases.push({ satnum: tle[i].substring(2, 7).trim(), l1: tle[i], l2: tle[i + 1].substring(0, 69) });
      i++;
    }
    const expect = new Map();
    let cur = null;
    for (const line of outTxt.split(/\r?\n/)) {
      const h = line.match(/^(\d+)\s+xx\s*$/);
      if (h) { cur = []; expect.set(h[1], cur); continue; }
      // Rows carry a wall-clock timestamp after the state vector, so only the first seven
      // fields are numbers.
      const n = line.trim().split(/\s+/).slice(0, 7).map(Number);
      if (cur && n.length === 7 && n.every(v => Number.isFinite(v))) cur.push(n);
    }

    const { ctx, page } = await session();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.SGP4);

    let vectors = 0, deep = 0, worst = 0, worstV = 0, where = '', failed = 0;
    for (const c of cases) {
      const rows = expect.get(String(Number(c.satnum)));
      if (!rows || !rows.length) continue;
      const got = await page.evaluate(([l1, l2, ts]) => {
        const s = SGP4.init(SGP4.parse(l1, l2));
        if (s.deepspace) return { deepspace: true };
        return { rows: ts.map(t => { const p = SGP4.propagate(s, t); return p ? p.r.concat(p.v) : null; }) };
      }, [c.l1, c.l2, rows.map(r => r[0])]);

      if (got.deepspace) { deep++; continue; }
      for (let i = 0; i < rows.length; i++) {
        const e = rows[i], g = got.rows[i];
        if (!g) { failed++; continue; }
        const dr = Math.hypot(g[0] - e[1], g[1] - e[2], g[2] - e[3]);
        const dv = Math.hypot(g[3] - e[4], g[4] - e[5], g[5] - e[6]);
        if (dr > worst) { worst = dr; where = c.satnum + ' @ t=' + e[0]; }
        if (dv > worstV) worstV = dv;
        vectors++;
      }
    }

    pass('sgp4: enough of the vector set is exercised', vectors >= 150 && deep >= 20,
      `${vectors} near-earth state vectors, ${deep} deep-space cases identified`);
    pass('sgp4: every near-earth vector propagates', failed === 0, `${failed} failed`);
    // A metre would already be far better than the elements themselves; this is held at a
    // millimetre because agreement with the reference should be at arithmetic precision, and
    // anything worse means a term has been mistyped rather than merely approximated.
    pass('sgp4: position matches the reference to 1 mm', worst < 1e-6,
      `worst ${worst.toExponential(2)} km on ${where}`);
    pass('sgp4: velocity matches the reference', worstV < 1e-8,
      `worst ${worstV.toExponential(2)} km/s`);

    // Deep space is out of scope, and must be refused rather than approximated.
    const ds = await page.evaluate(() => {
      // A geostationary element set: period about 1436 minutes.
      const s = SGP4.init(SGP4.parse(
        '1 25954U 99060A   26260.50000000  .00000100  00000+0  00000+0 0  9990',
        '2 25954   0.0200  95.0000 0002000 250.0000 110.0000  1.00270000 90000'));
      return { deepspace: s.deepspace, propagated: !!SGP4.propagate(s, 0) };
    });
    pass('sgp4: deep space is refused, not approximated',
      ds.deepspace === true && ds.propagated === false, JSON.stringify(ds));
    await ctx.close();
  }
}

/* ================= overhead passes ================= */
if (want('sky')) {
  /* the curated data has to stay honest */
  {
    const { readFileSync } = await import('node:fs');
    const doc = JSON.parse(readFileSync('data/sat.json', 'utf8'));

    const orphans = doc.freqs.filter(f => !doc.birds.some(b => b.id === f.bird));
    pass('sky data: every frequency belongs to a satellite', orphans.length === 0,
      orphans.map(o => o.n).join(', '));

    const noEl = doc.birds.filter(b => !Object.keys(b.tle || {}).length);
    pass('sky data: every satellite has elements', noEl.length === 0,
      noEl.map(b => b.id).join(', '));

    // Elements are refreshed by a daily Action. If that has been broken for a fortnight the
    // predictions are quietly wrong, so the suite notices before a user does.
    const jdNow = Date.now() / 86400000 + 2440587.5;
    let oldest = 0, oldestId = '';
    for (const b of doc.birds) {
      for (const [id, t] of Object.entries(b.tle)) {
        const yr = parseInt(t[0].substring(18, 20), 10);
        const year = yr < 57 ? yr + 2000 : yr + 1900;
        const jan1 = 367 * year - Math.floor(7 * year * 0.25) + 30 + 1 + 1721013.5;
        const age = jdNow - (jan1 + parseFloat(t[0].substring(20, 32)) - 1);
        if (age > oldest) { oldest = age; oldestId = b.id + '/' + id; }
      }
    }
    pass('sky data: elements are fresh', oldest < 21,
      `oldest ${oldest.toFixed(1)} days (${oldestId})`);

    // The NOAA APT satellites are the trap here. Their transmitters were switched off in
    // 2025 but Celestrak still publishes elements, so anything built on orbits alone will
    // happily predict passes for three silent satellites. They must stay out.
    const dead = [25338, 28654, 33591];
    const present = doc.birds.filter(b => b.norad.some(n => dead.includes(n)));
    pass('sky data: the decommissioned NOAA APT birds stay out', present.length === 0,
      present.map(b => b.n).join(', '));
    pass('sky data: and the exclusion is written down',
      /decommissioned/i.test(JSON.stringify(doc.excluded || [])));
  }

  /* the panel */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      geolocation: { latitude: 37.7749, longitude: -122.4194 }, permissions: ['geolocation']
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await page.waitForSelector('.row');

    // Without a position the panel must not appear at all: a region centre would produce
    // times that look authoritative and are wrong by however far away you are.
    pass('sky: no panel until you share a position',
      await page.evaluate(() => document.getElementById('sky').hidden) === true);

    await page.click('#btn-geo');
    await openPanel(page, 'sky');
    await page.waitForSelector('.sky-r', { timeout: 40000 });

    const m = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.sky-r')];
      return {
        n: rows.length,
        freqs: rows.map(r => (r.querySelector('.sky-f') || {}).textContent || ''),
        names: rows.map(r => (r.querySelector('.sky-n') || {}).textContent || ''),
        when: rows.map(r => (r.querySelector('.sky-w') || {}).textContent || ''),
        live: rows.map(r => r.classList.contains('live')),
        hasMore: !!document.querySelector('.sky-b')
      };
    });

    pass('sky: passes are listed', m.n >= 1 && m.n <= 3, `${m.n} rows shown`);
    pass('sky: each row names a frequency and a satellite',
      m.freqs.every(f => /\d/.test(f)) && m.names.every(n => n.trim().length > 3),
      m.freqs.join(' | '));
    pass('sky: each row says when and how high',
      m.when.every(w => /\d+°|now/i.test(w)), m.when[0]);

    // A pass in progress is the only time-critical thing here, so it must sort first.
    const firstLive = m.live.indexOf(true);
    pass('sky: a pass in progress sorts to the top',
      firstLive === -1 || firstLive === 0, `live flags ${m.live.join(',')}`);

    // Nothing below the workable threshold should ever be offered.
    const peaks = m.when.map(w => { const n = w.match(/(\d+)°/); return n ? Number(n[1]) : 99; });
    pass('sky: nothing below 10 degrees is offered', peaks.every(p => p >= 10),
      'peaks ' + peaks.join(', '));

    if (m.hasMore) {
      await page.click('.sky-b');
      await page.waitForTimeout(600);
      const all = await page.evaluate(() => ({
        n: document.querySelectorAll('.sky-r').length,
        // Chronological, so the list reads as a timetable.
        order: [...document.querySelectorAll('.sky-r')].map(r =>
          r.classList.contains('live') ? -1 : 0)
      }));
      pass('sky: the full list expands', all.n > m.n, `${m.n} -> ${all.n}`);
    }

    pass('sky: no console errors', errs.length === 0, errs.join(' | '));

    /* screenshots, so the panel can be looked at and not only asserted */
    await page.evaluate(() => document.querySelector('#sky').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.probe/sky.png' });
    await ctx.close();
  }

  /* and in sunlight mode, where the live-pass highlight has to survive a light background */
  {
    const ctx = await browser.newContext({
      viewport: { width: 320, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      geolocation: { latitude: 37.7749, longitude: -122.4194 }, permissions: ['geolocation']
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('aw.skin', 'glare'));
    await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await page.waitForSelector('.row');
    await page.click('#btn-geo');
    await openPanel(page, 'sky');
    await page.waitForSelector('.sky-r', { timeout: 40000 });
    const over = await page.evaluate(() => {
      document.querySelector('#sky').scrollIntoView({ block: 'center' });
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    pass('sky: the panel fits a 320px screen', over <= 1, `overflow ${over}px`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.probe/sky-glare.png' });
    await ctx.close();
  }
}

/* ================= skins: the outdoor display modes ================= */
if (want('skin')) {
  // Composite a node's effective background down through any translucent layers, then
  // report WCAG contrast for every node that draws its own text. Measuring rather than
  // trusting the tokens is the point: a single hardcoded colour left behind in a rule is
  // exactly how the header stayed dark while the page around it went white.
  const PROBE = () => {
    const lum = (r, g, b) => {
      const f = c => (c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const bgOf = node => {
      // Composite down the real paint stack under the text, not just the ancestor chain.
      // An ancestor walk misses anything that paints between a node and its parent, such
      // as the sliding highlight behind the selected segment of the display picker: that
      // reads as dark-on-dark and is in fact light-on-accent.
      const box = node.getBoundingClientRect();
      const x = Math.round(box.left + box.width / 2);
      const y = Math.round(box.top + box.height / 2);
      let chain = null;
      if (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight) {
        const hit = document.elementsFromPoint(x, y);
        const i = hit.indexOf(node);
        if (i >= 0) chain = hit.slice(i);
      }
      const stack = [];
      // No hit test available (off-screen, or covered by something opaque, in which case
      // the text is not visible anyway) falls back to the ancestor chain.
      const walk = chain || (() => { const a = []; for (let e = node; e; e = e.parentElement) a.push(e); return a; })();
      for (const el of walk) {
        const c = parse(getComputedStyle(el).backgroundColor || '');
        const a = c.length >= 3 ? (c[3] === undefined ? 1 : c[3]) : 0;
        if (a > 0) { stack.push([c[0], c[1], c[2], a]); if (a >= 1) break; }
      }
      let r = 255, g = 255, b = 255;
      for (let i = stack.length - 1; i >= 0; i--) {
        const [sr, sg, sb, a] = stack[i];
        r = sr * a + r * (1 - a); g = sg * a + g * (1 - a); b = sb * a + b * (1 - a);
      }
      return [r, g, b];
    };

    let worst = { ratio: 99, sel: '', text: '' };
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!el.offsetParent && cs.position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // Skip anything parked off-screen, such as the skip link: it is never seen, so its
      // contrast is not a claim about the skin.
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const fg = parse(cs.color);
      if (fg.length < 3 || (fg[3] !== undefined && fg[3] < 0.5)) continue;
      const [br, bg, bb] = bgOf(el);
      const l1 = lum(fg[0], fg[1], fg[2]), l2 = lum(br, bg, bb);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < worst.ratio) {
        worst = {
          ratio: Math.round(ratio * 100) / 100,
          sel: el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0],
          text: el.textContent.trim().slice(0, 30)
        };
      }
    }

    // Every surface that paints a panel must sit on the same side of the light/dark line
    // as the skin claims. This is the assertion the header bug would have failed. Chips are
    // deliberately left out: a selected one is accent-filled and so inverts against the
    // page in both skins, which is the design rather than a defect.
    const surfaces = {};
    for (const sel of ['.hd', '.nw-c', '.dx', '.view-menu', '.row', 'body']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const [r, g, b] = bgOf(el);
      surfaces[sel] = Math.round(lum(r, g, b) * 1000) / 1000;
    }
    return {
      worst, surfaces,
      skin: document.documentElement.dataset.skin,
      bar: (document.querySelector('meta[name="theme-color"]') || {}).content,
      bg: getComputedStyle(document.body).backgroundColor
    };
  };

  for (const skin of ['auto', 'glare', 'black']) {
    const { ctx, page, errs } = await session();
    await page.addInitScript(s => localStorage.setItem('aw.skin', s), skin);
    await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await page.waitForSelector('.row');
    // Open a detail panel and the settings menu so those surfaces are measured too.
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('.row')].find(x => x.textContent.includes('Mount Diablo'));
      if (t) t.click();
    });
    await page.click('#btn-view');
    await page.waitForTimeout(300);
    const m = await page.evaluate(PROBE);

    pass(`${skin}: skin survives the reload`, m.skin === skin, `data-skin=${m.skin}`);

    const light = skin === 'glare';
    const surfaces = Object.entries(m.surfaces);
    const wrong = surfaces.filter(([, l]) => light ? l < 0.5 : l > 0.2);
    pass(`${skin}: every surface is ${light ? 'light' : 'dark'}`,
      wrong.length === 0 && surfaces.length >= 6,
      wrong.length ? 'wrong side: ' + wrong.map(([s, l]) => `${s} ${l}`).join(', ')
        : surfaces.length + ' surfaces checked');

    // Sunlight mode exists to be read in sunlight, so it is held to WCAG AA on every
    // visible word. The other two keep the panel look and are only held to a floor that
    // stops a skin change from quietly making them worse.
    const floor = light ? 4.5 : 2.9;
    pass(`${skin}: worst text contrast >= ${floor}`,
      m.worst.ratio >= floor,
      `${m.worst.ratio}:1 on ${m.worst.sel} ${JSON.stringify(m.worst.text)}`);

    pass(`${skin}: browser chrome colour matches`,
      m.bar === { auto: '#0a0b0d', glare: '#ffffff', black: '#000000' }[skin], `theme-color ${m.bar}`);

    if (skin === 'black') {
      pass('black: background is true black', m.bg === 'rgb(0, 0, 0)', m.bg);
    }
    pass(`${skin}: no console errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* the settings popover itself */
  {
    const { ctx, page, errs } = await session();
    await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await page.waitForSelector('.row');

    const shut = () => page.evaluate(() => document.getElementById('view-menu').hidden);
    pass('settings start closed', await shut() === true);

    await page.click('#btn-view');
    // The popover animates in from scale(.985), so measuring immediately reads every row
    // about 1.5% short and the thumb-size checks below fail on nothing.
    await page.waitForTimeout(250);
    const opened = await page.evaluate(() => ({
      open: !document.getElementById('view-menu').hidden,
      expanded: document.getElementById('btn-view').getAttribute('aria-expanded'),
      radios: [...document.querySelectorAll('[role="menuitemradio"]')].map(o => o.getAttribute('aria-checked')),
      // The gloved-thumb requirement from the brief: these are hit outdoors. The skin
      // segments are a third of the menu wide, so they earn their height back in width.
      short: [...document.querySelectorAll('.view-o')].filter(o => o.getBoundingClientRect().height < 44).length,
      smallSeg: [...document.querySelectorAll('.seg-o')].filter(o => {
        const r = o.getBoundingClientRect();
        return r.height < 40 || r.width < 44;
      }).length,
      labels: [...document.querySelectorAll('.view-o .view-n')].every(n => n.textContent.trim().length > 2),
      segLabels: [...document.querySelectorAll('.seg-o')].every(o => o.textContent.trim().length > 1),
      // The description under the strip has to say something about the live choice.
      note: (document.querySelector('.view-sd') || {}).textContent || ''
    }));
    pass('settings open with one skin selected',
      opened.open && opened.expanded === 'true' &&
      opened.radios.filter(c => c === 'true').length === 1 && opened.labels && opened.segLabels,
      `checked: ${opened.radios.join(',')}`);
    pass('settings rows are thumb-sized', opened.short === 0, `${opened.short} rows under 44px`);
    pass('skin segments are thumb-sized', opened.smallSeg === 0, `${opened.smallSeg} segments too small`);
    pass('the selected skin is described', opened.note.trim().length > 10, `note: "${opened.note}"`);

    // Switching skin must repaint immediately, not only after a reload.
    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const seg = n => `.seg-o:nth-of-type(${n + 1})`;
    await page.click(seg(1));
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const box = document.querySelector('.seg').getBoundingClientRect();
      const hl = document.querySelector('.seg-hl').getBoundingClientRect();
      return {
        bg: getComputedStyle(document.body).backgroundColor,
        skin: document.documentElement.dataset.skin,
        saved: localStorage.getItem('aw.skin'),
        open: !document.getElementById('view-menu').hidden,
        ticked: [...document.querySelectorAll('.seg-o')].findIndex(o => o.getAttribute('aria-checked') === 'true'),
        // Which third of the strip the highlight has slid to.
        third: Math.round(((hl.left + hl.width / 2) - box.left) / box.width * 3 - 0.5),
        note: document.querySelector('.view-sd').textContent
      };
    });
    pass('picking a skin repaints at once',
      after.bg !== before && after.skin === 'glare' && after.saved === 'glare',
      `${before} -> ${after.bg}, saved ${after.saved}`);
    // A strip you can see slide is worth keeping open: comparing skins is the whole task.
    pass('the strip follows the choice and stays open',
      after.open && after.ticked === 1 && after.third === 1 && after.note.trim().length > 10,
      `open=${after.open} ticked=${after.ticked} highlight-third=${after.third}`);

    // The bug this replaced: the skin applied but the menu kept marking the old one, because
    // nothing rebuilt the popover. Reopening must never disagree with the page.
    await page.click('#btn-view');
    await page.click('#btn-view');
    await page.waitForTimeout(250);
    const again = await page.evaluate(() => ({
      skin: document.documentElement.dataset.skin,
      i: document.querySelector('.seg').dataset.i,
      ticked: [...document.querySelectorAll('.seg-o')].findIndex(o => o.getAttribute('aria-checked') === 'true'),
      checked: [...document.querySelectorAll('.seg-o')].filter(o => o.getAttribute('aria-checked') === 'true').length
    }));
    pass('reopening shows the skin that is actually applied',
      again.skin === 'glare' && again.ticked === 1 && again.checked === 1 && again.i === '1',
      `skin=${again.skin} ticked=${again.ticked} of ${again.checked}`);
    await page.keyboard.press('Escape');

    // Escape and an outside tap both have to dismiss it, or it traps a one-handed user.
    await page.click('#btn-view');
    await page.keyboard.press('Escape');
    pass('escape closes settings', await shut() === true);
    await page.click('#btn-view');
    await page.mouse.click(10, 400);
    pass('tapping outside closes settings', await shut() === true);

    // Escape inside the menu must not also wipe the search box.
    await page.evaluate(() => { const q = document.getElementById('q'); q.value = '146'; });
    await page.click('#btn-view');
    await page.keyboard.press('Escape');
    pass('escape in settings leaves the search alone',
      await page.evaluate(() => document.getElementById('q').value) === '146');

    pass('settings: no console errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  /* keep-screen-on, against a stubbed lock so both outcomes are reachable */
  {
    // Headless Chromium has navigator.wakeLock but rejects the request, since there is no
    // screen to hold. Stubbing it is what makes the working path testable at all, and the
    // rejecting path below is then the real browser behaviour rather than a contrivance.
    const { ctx, page } = await session();
    await page.addInitScript(() => {
      let held = 0;
      window.__held = () => held;
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: async () => {
            held++;
            return { type: 'screen', released: false, release: async () => { held--; }, addEventListener() {} };
          }
        }
      });
    });
    await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await page.waitForSelector('.row');
    await page.click('#btn-view');
    await page.click('#btn-awake');
    await page.waitForTimeout(200);
    const on = await page.evaluate(() => ({
      checked: document.getElementById('btn-awake').getAttribute('aria-checked'),
      saved: localStorage.getItem('aw.awake'),
      held: window.__held()
    }));
    pass('keep-screen-on takes a real lock and is remembered',
      on.checked === 'true' && on.saved === '1' && on.held === 1,
      `checked ${on.checked}, saved ${on.saved}, locks held ${on.held}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.row');
    await page.click('#btn-view');
    const back = await page.evaluate(() => ({
      checked: document.getElementById('btn-awake').getAttribute('aria-checked'),
      held: window.__held()
    }));
    pass('keep-screen-on retakes the lock on load',
      back.checked === 'true' && back.held === 1, `checked ${back.checked}, locks held ${back.held}`);

    await page.click('#btn-awake');
    await page.waitForTimeout(200);
    const off = await page.evaluate(() => ({
      saved: localStorage.getItem('aw.awake'), held: window.__held()
    }));
    pass('keep-screen-on releases the lock when turned off',
      off.saved === '0' && off.held === 0, `saved ${off.saved}, locks held ${off.held}`);
    await ctx.close();
  }

  /* and when the browser refuses, which is what headless actually does */
  {
    const { ctx, page, errs } = await session();
    await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await page.waitForSelector('.row');
    await page.click('#btn-view');
    await page.click('#btn-awake');
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({
      checked: document.getElementById('btn-awake').getAttribute('aria-checked'),
      saved: localStorage.getItem('aw.awake')
    }));
    // A refused lock must leave the switch off: showing it on would promise a screen that
    // then sleeps anyway, which is worse than not offering it.
    pass('a refused lock leaves the switch off and unsaved',
      r.checked === 'false' && r.saved !== '1', `checked ${r.checked}, saved ${r.saved}`);
    pass('a refused lock throws nothing at the console', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}

/* ================= CHIRP export ================= */
if (want('export')) {
  const { ctx, page } = await session();
  await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
  const out = [];
  let ok = true;
  for (const id of ['nationwide', 'bay-area', 'link-us', 'china-nationwide', 'link-cn']) {
    await go(page, id);
    await page.waitForTimeout(280);
    const dl = await Promise.all([page.waitForEvent('download'), page.click('.btn-a')]).then(r => r[0]);
    let csv = '';
    for await (const c of await dl.createReadStream()) csv += c;
    const lines = csv.trim().split('\n');
    const cols = lines[0].split(',').length;
    const ragged = lines.filter(l => l.split(',').length !== cols).length;
    const freqs = lines.slice(1).map(l => parseFloat(l.split(',')[2]));
    if (cols !== 18 || ragged || !freqs.length || freqs.some(f => !(f >= 0.5 && f <= 999))) ok = false;
    out.push(`${id}:${freqs.length}`);
  }
  pass('CHIRP export unaffected by mode', ok, out.join(' '));
  await ctx.close();
}

/* ================= navigation and core interactions ================= */
if (want('nav')) {
  const { ctx, page, errs } = await session();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const start = await page.evaluate(() => ({
    country: document.querySelector('#cty-k').textContent,
    title: document.querySelector('.intro h1').textContent
  }));
  pass('default view is US Nationwide', start.country === 'US' && /Nationwide/.test(start.title), JSON.stringify(start));

  await page.click('#btn-cty');
  await page.waitForTimeout(250);
  const opts = await page.evaluate(() => document.querySelectorAll('#cty-menu .cty-o').length);

  // A popover anchored to the wrong edge of its chip is invisible rather than merely ugly.
  // This one hung 86px off the left of a 320px screen, taking the country codes with it,
  // because it was right-anchored to a chip that sits at the left of the header.
  const place = await page.evaluate(() => {
    const m = document.querySelector('#cty-menu').getBoundingClientRect();
    return { left: Math.round(m.left), right: Math.round(m.right), w: innerWidth };
  });
  pass('country menu opens fully on screen',
    place.left >= 0 && place.right <= place.w,
    `${place.left}..${place.right} in ${place.w}px`);

  // The current country is accent-filled like every other selected thing in the app, so
  // each of its three pieces has to be legible on the fill rather than on the panel.
  const mark = await page.evaluate(() => {
    const sel = document.querySelector('.cty-o[aria-selected="true"]');
    if (!sel) return null;
    const lum = c => {
      const [r, g, b] = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const fill = getComputedStyle(sel).backgroundColor;
    const ratio = n => {
      const a = lum(getComputedStyle(n).color), b = lum(fill);
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
    };
    return {
      filled: (fill.match(/[\d.]+/g) || []).slice(3)[0] !== '0' && fill !== 'rgba(0, 0, 0, 0)',
      count: [...document.querySelectorAll('.cty-o[aria-selected="true"]')].length,
      worst: Math.min(...['.cty-on', '.cty-ok', '.cty-oc'].map(s => ratio(sel.querySelector(s))))
    };
  });
  pass('the current country is filled and readable on the fill',
    mark && mark.filled && mark.count === 1 && mark.worst >= 4.5,
    mark ? `worst ${mark.worst}:1 across ${mark.count} marked row(s)` : 'nothing marked');

  await page.click('#cty-menu .cty-o:nth-child(2)');
  await page.waitForTimeout(600);
  const cn = await page.evaluate(() => ({
    country: document.querySelector('#cty-k').textContent, hash: location.hash
  }));
  pass('country switch', opts === 2 && cn.country === 'CN' && cn.hash === '#/cn/china-nationwide', JSON.stringify(cn));

  // Both popovers, at the narrowest phone the site claims to support. This is where an
  // edge-anchoring mistake shows up first, and it is the width least likely to be opened
  // by hand during development.
  {
    const nar = await session({ viewport: { width: 320, height: 640 } });
    await nar.page.goto(URL + '#/us/bay-area', { waitUntil: 'networkidle' });
    await nar.page.waitForSelector('.row');
    for (const [name, btn, menu] of [['country', '#btn-cty', '#cty-menu'], ['display', '#btn-view', '#view-menu']]) {
      await nar.page.click(btn);
      await nar.page.waitForTimeout(250);
      const m = await nar.page.evaluate(sel => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), w: innerWidth };
      }, menu);
      pass(`${name} menu fits a 320px screen`,
        m.left >= 0 && m.right <= m.w, `${m.left}..${m.right} in ${m.w}px`);
      await nar.page.keyboard.press('Escape');
    }
    pass('320px menus: no console errors', nar.errs.length === 0, nar.errs.join(' | '));
    await nar.ctx.close();
  }

  await page.goto(URL + '#/link/link-us', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const legacy = await page.evaluate(() => document.querySelector('.intro h1').textContent);
  pass('legacy #/link/ URLs resolve', legacy === 'Private Link', legacy);

  await page.click('.row');
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'n/a'));
  pass('tap to copy', /MHz|kHz/.test(copied), copied);

  // Opening search hides the chip strip and swaps in the field, in a row that must not
  // change height: the list below it is what you are reading while you type.
  const shut = await page.evaluate(() => document.querySelector('.hd-row').getBoundingClientRect().height);
  await openSearch(page);
  const open = await page.evaluate(() => ({
    h: document.querySelector('.hd-row').getBoundingClientRect().height,
    chips: document.getElementById('regions').hidden,
    focus: document.activeElement.id
  }));
  pass('search opens in the chip row without moving it',
    Math.abs(open.h - shut) < 1.5 && open.chips && open.focus === 'q',
    `${shut}px -> ${open.h}px, chips hidden ${open.chips}, focus ${open.focus}`);

  await page.fill('#q', 'zzzz');
  await page.waitForTimeout(250);
  const none = await page.evaluate(() => ({
    rows: document.querySelectorAll('.row').length,
    empty: !document.getElementById('empty').hidden,
    ruler: document.getElementById('ruler').hidden
  }));
  pass('search empty state', none.rows === 0 && none.empty && none.ruler, JSON.stringify(none));

  // Closing has to put the chips back and drop the query with them, or the list stays
  // filtered by a word that is no longer anywhere on screen.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const back = await page.evaluate(() => ({
    hidden: document.getElementById('hd-search').hidden,
    chips: !document.getElementById('regions').hidden,
    q: document.getElementById('q').value,
    rows: document.querySelectorAll('.row').length,
    h: document.querySelector('.hd-row').getBoundingClientRect().height
  }));
  pass('closing search restores the chips and the full list',
    back.hidden && back.chips && back.q === '' && back.rows > 0 && Math.abs(back.h - shut) < 1.5,
    JSON.stringify(back));

  await page.click('#btn-lang');
  await page.waitForTimeout(500);
  const zh = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    cat: document.querySelector('#cats .chip').textContent,
    mode: document.getElementById('mode-t').textContent
  }));
  pass('language toggle', zh.lang === 'zh-CN' && zh.cat === '全部' && zh.mode === '专业', JSON.stringify(zh));

  pass('no console errors during interaction', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ================= spectrum ruler ================= */
if (want('ruler')) {
  const { ctx, page } = await session({ viewport: { width: 1280, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const box = await (await page.$('.ru-rail')).boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.waitForTimeout(250);
  const live = await page.evaluate(() => ({
    text: document.querySelector('.ru-out').textContent,
    on: document.querySelector('.ru-rail').classList.contains('live')
  }));
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => {
    const n = document.querySelector('.row.hit');
    return n ? n.querySelector('.f').textContent.trim() : null;
  });
  pass('ruler readout and jump', live.on && /MHz|kHz/.test(live.text) && !!hit, `${live.text} → ${hit}`);
  await ctx.close();
}

/* ================= pro: the rail becomes a tuning knob ================= */
if (want('wheel')) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  // Count how many AudioContexts get built, to prove none is built when sound is off.
  await page.addInitScript(() => {
    window.__ac = 0;
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      constructor(...a) { super(...a); window.__ac++; }
    };
  });

  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const shape = await page.evaluate(() => {
    const r = document.querySelector('.ru-rail');
    return {
      h: Math.round(r.getBoundingClientRect().height),
      touch: getComputedStyle(r).touchAction,
      mute: !!document.querySelector('.ru-mute'),
      hint: document.querySelector('.ru-h').textContent
    };
  });
  pass('pro rail is a knob', shape.h === 46 && shape.touch === 'pan-y' && shape.mute && /Drag to tune/.test(shape.hint),
    JSON.stringify(shape));

  // Sweep across the rail and collect what the readout says along the way.
  const box = await (await page.$('.ru-rail')).boundingBox();
  const y = box.y + box.height / 2;
  const scroll0 = await page.evaluate(() => window.scrollY);
  await page.mouse.move(box.x + box.width * 0.30, y);
  await page.mouse.down();
  const seen = [];
  for (let i = 30; i <= 78; i += 2) {
    await page.mouse.move(box.x + box.width * (i / 100), y);
    seen.push(await page.evaluate(() => ({
      out: document.querySelector('.ru-out').textContent,
      hint: document.querySelector('.ru-h').textContent,
      lock: document.querySelector('.ru-rail').classList.contains('lock'),
      on: document.querySelectorAll('.ru-k.k-on').length,
      scroll: window.scrollY,
      sel: String(getSelection()).length,
      outline: getComputedStyle(document.querySelector('.ru-rail')).outlineStyle
    })));
  }
  await page.mouse.up();
  await page.waitForTimeout(400);

  const distinct = new Set(seen.map(s => s.out)).size;
  const locked = seen.filter(s => s.lock);
  const named = seen.filter(s => / · /.test(s.hint) && !/^(HF|VHF|UHF) · /.test(s.hint));
  pass('sweeping tunes continuously', distinct > 12, `${distinct} distinct readouts over 25 samples`);
  pass('entries act as detents', locked.length > 0 && locked.every(s => s.on === 1) && named.length > 0,
    `${locked.length} samples locked, e.g. "${(named[0] || {}).hint}"`);
  // Locked, the bubble must name the entry the rail claims, not the raw pointer frequency.
  pass('a detent snaps the readout to the entry',
    locked.every(s => s.hint.startsWith(s.out.replace(/ (MHz|kHz)$/, ''))),
    locked.length ? `"${locked[0].out}" vs "${locked[0].hint}"` : 'no locked samples');
  pass('no focus ring from a pointer sweep', seen.every(s => s.outline === 'none'),
    seen.find(s => s.outline !== 'none') ? 'outline appeared' : 'none throughout');
  // A sweep used to select the whole page, which then auto-scrolled it away under your finger.
  pass('sweeping selects nothing and does not scroll the page',
    seen.every(s => s.sel === 0 && s.scroll === scroll0),
    `max selection ${Math.max(...seen.map(s => s.sel))} chars, scroll ${scroll0} → ${Math.max(...seen.map(s => s.scroll))}`);

  const afterDrop = await page.evaluate(() => {
    const n = document.querySelector('.row.hit');
    const rail = document.querySelector('.ru-rail');
    return {
      jumped: n ? n.querySelector('.f').textContent.trim() : null,
      ac: window.__ac,
      idle: document.querySelector('.ru-h').textContent,
      // :focus-visible is the real question. Computed outline-width reports the UA's "auto"
      // ring even on an unfocused button, so it answers nothing.
      ring: rail.matches(':focus-visible'),
      focused: document.activeElement === rail
    };
  });
  pass('release jumps to the nearest entry', !!afterDrop.jumped, afterDrop.jumped);
  pass('no focus ring left behind by a drag', !afterDrop.ring && !afterDrop.focused,
    `focus-visible: ${afterDrop.ring}, focused: ${afterDrop.focused}`);
  pass('readout returns to its hint', /Drag to tune/.test(afterDrop.idle), afterDrop.idle);
  pass('sound engine starts on the gesture', afterDrop.ac === 1, `${afterDrop.ac} AudioContext(s)`);

  // Keyboard: arrows should walk the entries. Read the knob's own readout — rows keep their
  // flash for a second, so several can carry .hit at once and DOM order is by category.
  await page.evaluate(() => document.querySelector('.ru-rail').focus());
  await page.waitForTimeout(1300);
  await page.keyboard.press('Home');
  await page.waitForTimeout(170);
  const first = await page.evaluate(() => document.querySelector('.ru-out').textContent);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(240);
  const third = await page.evaluate(() => document.querySelector('.ru-out').textContent);
  await page.keyboard.press('End');
  await page.waitForTimeout(240);
  const last = await page.evaluate(() => ({
    out: document.querySelector('.ru-out').textContent,
    hits: document.querySelectorAll('.row.hit').length,
    lock: document.querySelector('.ru-rail').classList.contains('lock')
  }));
  // Compare in MHz. The readout switches to kHz below 1 MHz, and the lowest entry in a
  // region with broadcast AM in it is now something like "740 kHz" -- which is less than
  // "453.000 MHz" as a frequency but greater as a bare number.
  const mhz = s => parseFloat(s) / (/kHz/.test(s) ? 1000 : 1);
  pass('arrow keys step through entries',
    mhz(first) < mhz(third) && mhz(third) < mhz(last.out) && last.hits >= 1 && last.lock,
    `${first} → ${third} → ${last.out}, and the row follows`);

  // A finger never leaves the rail the way a cursor does, so the touch path holds the
  // readout for a moment after lift and then clears itself rather than sticking.
  const touch = await page.evaluate(async () => {
    const rail = document.querySelector('.ru-rail');
    const r = rail.getBoundingClientRect();
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const ev = (type, frac) => rail.dispatchEvent(new PointerEvent(type, {
      pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
      clientX: r.left + r.width * frac, clientY: r.top + r.height / 2
    }));
    ev('pointerdown', 0.2);
    const seen = new Set();
    for (let i = 20; i <= 70; i += 5) {
      ev('pointermove', i / 100);
      await wait(16);
      seen.add(document.querySelector('.ru-out').textContent);
    }
    const dragging = rail.classList.contains('live');
    ev('pointerup', 0.7);
    await wait(350);
    const held = rail.classList.contains('live');
    await wait(900);
    return { dragging, held, cleared: !rail.classList.contains('live'), steps: seen.size };
  });
  pass('touch drag tunes, lingers, then clears',
    touch.dragging && touch.held && touch.cleared && touch.steps > 8,
    `${touch.steps} readouts while dragging, held after lift: ${touch.held}`);

  // Mute, reload, and prove no audio engine is built at all.
  await page.click('.ru-mute');
  await page.waitForTimeout(150);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const box2 = await (await page.$('.ru-rail')).boundingBox();
  await page.mouse.move(box2.x + box2.width * 0.4, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width * 0.6, box2.y + box2.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const muted = await page.evaluate(() => ({
    ac: window.__ac,
    pressed: document.querySelector('.ru-mute').getAttribute('aria-pressed'),
    stillWorks: !!document.querySelector('.row.hit')
  }));
  pass('sound off is remembered and builds nothing',
    muted.ac === 0 && muted.pressed === 'false' && muted.stillWorks, JSON.stringify(muted));
  await page.evaluate(() => localStorage.setItem('aw.audio', '1'));

  pass('no console errors from the knob', errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ================= simple mode rail is untouched ================= */
if (want('wheel')) {
  const { ctx, page } = await session({ viewport: { width: 1180, height: 900 } });
  await page.goto(URL + '?pro=0#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => {
    const r = document.querySelector('.ru-rail');
    return {
      h: Math.round(r.getBoundingClientRect().height),
      mute: !!document.querySelector('.ru-mute'),
      hint: document.querySelector('.ru-h').textContent
    };
  });
  const box = await (await page.$('.ru-rail')).boundingBox();
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const jumped = await page.evaluate(() => !!document.querySelector('.row.hit'));
  pass('simple rail unchanged', s.h === 34 && !s.mute && /Tap the spectrum/.test(s.hint) && jumped,
    JSON.stringify(s));
  await ctx.close();
}

/* ================= offline ================= */
if (want('offline')) {
  const { ctx, page } = await session();
  await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const a = await page.evaluate(() => ({
    rows: document.querySelectorAll('.row').length,
    mode: document.documentElement.dataset.mode,
    px: document.querySelectorAll('.px').length
  }));
  await go(page, 'beijing');
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => document.querySelectorAll('.row').length);
  pass('works offline, pro included', a.rows > 0 && a.mode === 'pro' && a.px > 0 && b > 0,
    `reload ${a.rows} rows / ${a.px} pro lines, Beijing ${b} rows`);
  await ctx.setOffline(false);
  await ctx.close();

  // Offline is not the hard case: a dead connection rejects at once and the service worker
  // answers from cache. The hard case is a connection that accepts a request and then goes
  // nowhere, which is a captive portal or one bar of signal, and which an untimed fetch
  // cannot recover from. Every network-backed reading has to reach a stated answer.
  for (const [label, hang] of [['offline', null], ['requests that hang', ['**/*.noaa.gov/**', '**/api.weather.gov/**', '**/data/sat.json']]]) {
    const s = await session();
    await s.page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
    await s.page.waitForSelector('.row');
    await s.page.waitForTimeout(2500);
    if (hang) for (const p of hang) await s.page.route(p, () => {});
    else await s.ctx.setOffline(true);

    await s.page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await s.page.waitForSelector('.row', { timeout: 20000 });
    await s.page.click('#btn-geo');
    await s.page.waitForTimeout(10500);
    const st = await s.page.evaluate(() => ({
      rows: document.querySelectorAll('.row').length,
      stuck: [...document.querySelectorAll('#now .nw-v, #sky .sky-m')]
        .map(n => n.textContent.trim()).filter(x => /·\s+·|…/.test(x)),
      cards: [...document.querySelectorAll('#now .nw-c')].map(c => c.querySelector('.nw-v').textContent).join(' | ')
    }));
    pass(`nothing is left loading (${label})`,
      st.rows > 0 && st.stuck.length === 0 && s.errs.length === 0,
      st.stuck.length ? st.stuck.join(', ') : `${st.rows} rows · ${st.cards}` + (s.errs.length ? ' · ' + s.errs.join(' | ') : ''));
    await s.ctx.close();
  }

  // The orbit file is the one fetch the service worker would normally hide, so it is tested
  // with the worker blocked and the request held open.
  const cold = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    permissions: ['geolocation'], geolocation: { latitude: 37.7749, longitude: -122.4194 },
    serviceWorkers: 'block'
  });
  const cerr = [];
  await cold.route('**/data/sat.json', () => {});
  const cp = await cold.newPage();
  cp.on('pageerror', e => cerr.push('pageerror: ' + e.message));
  cp.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  await cp.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'domcontentloaded' });
  await cp.waitForSelector('.row', { timeout: 20000 });
  await cp.click('#btn-geo');
  const t0 = Date.now();
  await cp.waitForFunction(() => {
    const c = document.querySelector('[aria-controls="sky"]');
    return c && !/·\s+·/.test(c.querySelector('.nw-v').textContent);
  }, null, { timeout: 20000 }).catch(() => {});
  const took = Date.now() - t0;
  const co = await cp.evaluate(() => {
    const c = document.querySelector('[aria-controls="sky"]');
    return { v: c.querySelector('.nw-v').textContent, offers: c.classList.contains('nw-hit') };
  });
  pass('a held orbit request gives up and the card stops offering',
    took < 12000 && !/·\s+·/.test(co.v) && !co.offers && cerr.length === 0,
    `"${co.v}" after ${(took / 1000).toFixed(1)}s, still offers: ${co.offers}` + (cerr.length ? ' · ' + cerr.join(' | ') : ''));
  await cold.close();
}

/* ================= no compliance wording ================= */
if (want('compliance')) {
  const { ctx, page } = await session();
  const WORDS = /\blegal\b|illegal|licen[cs]|unlicensed|\bFCC\b|SRRC|type-approv|offence|合法|违法|合规|执照|核准|法定|持证|军事管理|通行证/i;
  await page.goto(URL + '?pro=1', { waitUntil: 'networkidle' });
  const ids = await page.evaluate(async () =>
    (await (await fetch('data/regions.json')).json()).regions.map(r => r.id));
  const hits = [];
  for (const lang of ['en', 'zh']) {
    await page.evaluate(l => localStorage.setItem('aw.lang', l), lang);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    for (const id of ids) {
      await go(page, id);
      await page.waitForTimeout(190);
      const m = (await page.evaluate(() => document.body.innerText)).match(WORDS);
      if (m) hits.push(`${lang}/${id}: ${m[0]}`);
    }
  }
  pass('no compliance wording rendered', hits.length === 0, hits.slice(0, 6).join('; '));
  await page.evaluate(() => localStorage.setItem('aw.lang', 'en'));
  await ctx.close();
}

/* ================= load performance ================= */
if (want('perf')) {
  // Desktop and a deep link both have to be measured, not just the phone landing page.
  // A phone renders the skeleton fast enough that late layout work lands before first
  // paint and goes unbilled, which hid a 34px header jump and a 349px one on desktop.
  const loads = [
    ['phone, landing', '?pro=0', undefined],
    ['phone, landing, pro', '?pro=1', undefined],
    ['phone, deep link, pro', '?pro=1#/us/bay-area', undefined],
    ['desktop, landing, pro', '?pro=1', { width: 1280, height: 900 }],
    ['desktop, deep link, pro', '?pro=1#/us/bay-area', { width: 1280, height: 900 }],
    ['desktop, deep link', '?pro=0#/us/bay-area', { width: 1280, height: 900 }]
  ];
  for (const [label, path, viewport] of loads) {
    const { ctx, page } = await session(viewport ? { viewport } : {});
    await page.addInitScript(() => {
      window.__cls = 0;
      window.__worst = null;
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__cls += e.value;
          // Name the biggest mover, so a failure says what to go and look at.
          if (!window.__worst || e.value > window.__worst.v) {
            const s = (e.sources || [])[0], n = s && s.node;
            window.__worst = {
              v: +e.value.toFixed(4),
              el: n ? (n.nodeName || '?').toLowerCase() + (n.id ? '#' + n.id : '') : '?'
            };
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(URL + path, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.row');
    await page.waitForTimeout(2200);
    const m = await page.evaluate(() => ({
      cls: +window.__cls.toFixed(4),
      worst: window.__worst,
      fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0].startTime)
    }));
    const blame = m.worst ? `, worst ${m.worst.v} on ${m.worst.el}` : '';
    pass(`layout stable on load (${label})`, m.cls < 0.1, `CLS ${m.cls}, FCP ${m.fcp} ms${blame}`);
    await ctx.close();
  }

  // Everything above measures over localhost, where the data arrives so fast that shifts
  // land before the first paint and go unbilled. That is not where people are: the same
  // pages measured 0.15 over the real network while reading 0 here. Hold the data back so
  // the placeholders are on screen well past first paint, which is when their size has to
  // be right.
  for (const [label, path, viewport] of [
    ['phone, slow network', '?pro=1#/us/bay-area', undefined],
    ['phone, slow network, zh', '?pro=1#/cn/beijing', undefined],
    // The landing page, which every one of these had skipped: it is the only path where the
    // region is not known at first paint, and a loaded machine caught it shifting 0.29.
    ['phone, slow network, landing', '?pro=1', undefined],
    ['desktop, slow network, landing', '?pro=1', { width: 1280, height: 900 }],
    ['desktop, slow network', '?pro=1#/us/bay-area', { width: 1280, height: 900 }]
  ]) {
    const { ctx, page } = await session(viewport ? { viewport } : {});
    await page.route('**/data/**', async route => {
      await new Promise(r => setTimeout(r, 700));
      route.continue();
    });
    await page.addInitScript(() => {
      window.__cls = 0;
      window.__worst = null;
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__cls += e.value;
          if (!window.__worst || e.value > window.__worst.v) {
            const s = (e.sources || [])[0], n = s && s.node;
            window.__worst = {
              v: +e.value.toFixed(4),
              el: n ? (n.nodeName || '?').toLowerCase() + (n.id ? '#' + n.id : '') : '?'
            };
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(URL + path, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.row');
    await page.waitForTimeout(2600);
    const m = await page.evaluate(() => ({ cls: +window.__cls.toFixed(4), worst: window.__worst }));
    const blame = m.worst ? `, worst ${m.worst.v} on ${m.worst.el}` : '';
    pass(`layout stable on load (${label})`, m.cls < 0.1, `CLS ${m.cls}${blame}`);
    await ctx.close();
  }

  // Coming back. A bare URL restores the last region, so the shape to reserve is whatever
  // that region drew last time - which nothing above covers, because every case here is
  // either a first visit or a deep link. Both directions have to hold: a region with a
  // right-now panel must have its 370px reserved, and one without must not.
  for (const [label, first, panel] of [
    ['region with a panel', '#/us/bay-area', true],
    ['nationwide, no panel', '#/us/nationwide', false]
  ]) {
    const { ctx, page } = await session({ viewport: { width: 390, height: 844 } });
    // Visit once so the shape is recorded, exactly as a real reader would.
    await page.goto(URL + '?pro=1' + first, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.row');
    await page.waitForTimeout(900);
    const seen = await page.evaluate(() => ({
      now: !document.getElementById('now').hidden,
      shape: JSON.parse(localStorage.getItem('aw.shape') || 'null'),
      intro: Math.round(document.getElementById('intro').getBoundingClientRect().height)
    }));
    pass(`shape recorded (${label})`,
      !!seen.shape && seen.shape.n === (panel ? 1 : 0) && Math.abs(seen.shape.i - seen.intro) <= 1,
      seen.shape ? `panel ${seen.shape.n}, intro ${seen.shape.i}px vs drawn ${seen.intro}px` : 'nothing stored');

    // Now come back to the bare URL, slowly, and see whether the reserved shape matches.
    await page.route('**/data/**', async route => {
      await new Promise(r => setTimeout(r, 700));
      route.continue();
    });
    await page.addInitScript(() => {
      window.__cls = 0;
      window.__worst = null;
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__cls += e.value;
          if (!window.__worst || e.value > window.__worst.v) {
            const s = (e.sources || [])[0], n = s && s.node;
            window.__worst = {
              v: +e.value.toFixed(4),
              el: n ? (n.nodeName || '?').toLowerCase() + (n.id ? '#' + n.id : '') : '?'
            };
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    const reserved = await page.evaluate(() => {
      const n = document.getElementById('now');
      return {
        now: getComputedStyle(n).display !== 'none' ? Math.round(n.getBoundingClientRect().height) : 0,
        intro: Math.round(document.getElementById('intro').getBoundingClientRect().height)
      };
    });
    await page.waitForSelector('.row');
    await page.waitForTimeout(2600);
    const back = await page.evaluate(() => ({
      cls: +window.__cls.toFixed(4), worst: window.__worst,
      region: location.hash, now: !document.getElementById('now').hidden
    }));
    pass(`returning reserves the right shape (${label})`,
      back.now === panel && (panel ? reserved.now > 300 : reserved.now === 0),
      `reserved ${reserved.now}px for the panel, drew ${back.now ? 'one' : 'none'} (${back.region})`);
    pass(`layout stable on load (phone, returning, ${label})`,
      back.cls < 0.02, `CLS ${back.cls}` + (back.worst ? `, worst ${back.worst.v} on ${back.worst.el}` : ''));
    await ctx.close();
  }

  // index.html resolves the mode inline so the placeholders are sized before the first
  // paint. That repeats logic app.js owns, so check the two agree for the case the query
  // string does not settle: a remembered preference. If they drift, pro mode loads with
  // the panel's space unreserved and the page jumps exactly as it used to.
  for (const remembered of ['pro', 'simple']) {
    const { ctx, page } = await session({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(m => localStorage.setItem('aw.mode', m), remembered);
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    // No ?pro=, so the inline script has to fall back to what was remembered.
    await page.goto(URL + '#/us/bay-area', { waitUntil: 'domcontentloaded' });
    const atPaint = await page.evaluate(() => document.documentElement.dataset.mode);
    await page.waitForSelector('.row');
    await page.waitForTimeout(2200);
    const settled = await page.evaluate(() => ({
      mode: document.documentElement.dataset.mode,
      cls: +window.__cls.toFixed(4)
    }));
    pass(`inline mode matches app.js (remembered ${remembered})`,
      atPaint === remembered && settled.mode === remembered,
      `at paint ${atPaint}, settled ${settled.mode}`);
    pass(`layout stable on load (desktop, remembered ${remembered})`,
      settled.cls < 0.1, `CLS ${settled.cls}`);
    await ctx.close();
  }
}

/* ================= screenshots, so I can look at it and not only assert ================= */
if (want('shots')) {
  const shots = [
    ['simple', '?pro=0#/us/bay-area', { width: 390, height: 1000 }],
    ['pro', '?pro=1#/us/bay-area', { width: 390, height: 1000 }],
    ['pro-wide', '?pro=1#/us/bay-area', { width: 1180, height: 900 }],
    ['pro-tiny', '?pro=1#/us/bay-area', { width: 320, height: 720 }]
  ];
  for (const [name, path, viewport] of shots) {
    const ctx = await browser.newContext({
      viewport, deviceScaleFactor: 2, isMobile: viewport.width < 800, hasTouch: true
    });
    const page = await ctx.newPage();
    await page.goto(URL + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1100);
    // Park on the amateur group, where the pro line has the most to say.
    await page.evaluate(() => {
      const r = [...document.querySelectorAll('.row')]
        .find(n => n.querySelector('.f').textContent.startsWith('147.060'));
      if (r) r.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(650);
    await page.screenshot({ path: `.probe/${name}.png` });
    await ctx.close();
  }

  // And one of the knob mid-sweep, locked onto an entry.
  const ctx = await browser.newContext({ viewport: { width: 430, height: 620 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(URL + '?pro=1#/us/bay-area', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.evaluate(() => scrollTo(0, 260));
  await page.waitForTimeout(250);
  const r = await (await page.$('.ru-rail')).boundingBox();
  const y = r.y + r.height / 2;
  await page.mouse.move(r.x + r.width * 0.3, y);
  await page.mouse.down();
  // Creep along until the rail reports a lock, so the shot shows the detent state.
  for (let i = 30; i <= 85; i++) {
    await page.mouse.move(r.x + r.width * (i / 100), y);
    if (await page.evaluate(() => document.querySelector('.ru-rail').classList.contains('lock'))) break;
  }
  await page.waitForTimeout(250);
  await page.screenshot({ path: '.probe/wheel.png' });
  await page.mouse.up();
  await ctx.close();

  console.log('shots  ' + shots.map(s => s[0]).join(', ') + ', wheel');
}

await browser.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
