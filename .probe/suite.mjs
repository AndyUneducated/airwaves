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
  await page.click('#q');
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
  await page.waitForTimeout(200);
  const opts = await page.evaluate(() => document.querySelectorAll('#cty-menu .cty-o').length);
  await page.click('#cty-menu .cty-o:nth-child(2)');
  await page.waitForTimeout(600);
  const cn = await page.evaluate(() => ({
    country: document.querySelector('#cty-k').textContent, hash: location.hash
  }));
  pass('country switch', opts === 2 && cn.country === 'CN' && cn.hash === '#/cn/china-nationwide', JSON.stringify(cn));

  await page.goto(URL + '#/link/link-us', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const legacy = await page.evaluate(() => document.querySelector('.intro h1').textContent);
  pass('legacy #/link/ URLs resolve', legacy === 'Private Link', legacy);

  await page.click('.row');
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'n/a'));
  pass('tap to copy', /MHz|kHz/.test(copied), copied);

  await page.fill('#q', 'zzzz');
  await page.waitForTimeout(250);
  const none = await page.evaluate(() => ({
    rows: document.querySelectorAll('.row').length,
    empty: !document.getElementById('empty').hidden,
    ruler: document.getElementById('ruler').hidden
  }));
  pass('search empty state', none.rows === 0 && none.empty && none.ruler, JSON.stringify(none));
  await page.fill('#q', '');
  await page.waitForTimeout(200);

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
