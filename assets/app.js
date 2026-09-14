/* Airwaves — station browser for analog handhelds (built around the Yaesu VX-6R) */
(() => {
  'use strict';

  const T = {
    en: {
      tagline: 'frequencies worth listening to',
      search: 'Search frequency, station, place…',
      noresults: 'Nothing matches that.',
      all: 'All',
      near: 'Near me',
      locating: 'Locating…',
      csv: 'Export for CHIRP',
      copied: 'Copied',
      entries: n => `${n} ${n === 1 ? 'entry' : 'entries'}`,
      nogeo: 'Location unavailable',
      geoOk: r => `Closest region: ${r}`,
      online: 'online',
      offline: 'offline · cached',
      langBtn: '中文',
      country: 'Country',
      spectrum: 'Spectrum',
      rulerHint: 'Tap the spectrum to jump to the nearest entry',
      digNote: 'Struck-through rows are things a VX-6 cannot give you: digital and encrypted systems it has no way to decode, signals outside its tuning range, and a few services that simply do not exist here. They are listed so you know not to spend an evening hunting for them.',
      copyHint: 'Tap any row to copy its frequency',
      verify: 'Verify locally',
      avoid: 'Avoid',
      avoidNote: 'Rows marked Avoid are calling channels, data segments or bands reserved for other uses. Keep them in your radio to monitor, but do not use them as your own working channel. They are left out of the CHIRP export.',
      'ft.radio': 'Your radio',
      'ft.trust': 'How much to trust this',
      'ft.legal': 'Listening and transmitting',
      'ft.offline': 'Cached for offline use'
    },
    zh: {
      tagline: '值得收听的频率',
      search: '搜索频率、台站、地点…',
      noresults: '没有匹配的结果。',
      all: '全部',
      near: '我的位置',
      locating: '定位中…',
      csv: '导出 CHIRP 文件',
      copied: '已复制',
      entries: n => `${n} 条`,
      nogeo: '无法获取位置',
      geoOk: r => `最近地区：${r}`,
      online: '在线',
      offline: '离线 · 已缓存',
      langBtn: 'EN',
      country: '国家',
      spectrum: '频谱',
      rulerHint: '点击频谱可跳到最接近的条目',
      digNote: '带删除线的条目是 VX-6 无法提供的内容：它无法解码的数字与加密系统、超出其调谐范围的信号，以及在当地根本不存在的业务。列出来是为了让你知道不必白费一晚上去找。',
      copyHint: '点击任意一行即可复制频率',
      verify: '请在当地核实',
      avoid: '避免',
      avoidNote: '标注“避免”的条目是呼叫频率、数据频段或保留给其他用途的频段。可以存进电台守听，但不要当作自己的工作频率使用。导出 CHIRP 时会自动排除它们。',
      'ft.radio': '你的电台',
      'ft.trust': '可信度说明',
      'ft.legal': '收听与发射',
      'ft.offline': '已缓存，可离线使用'
    }
  };

  const FT = {
    'ft.radio.b': {
      en: 'Built around the Yaesu VX-6R: continuous receive from 0.5 to 999 MHz in AM, NFM and WFM. It is an analog receiver — it cannot decode P25, DMR or NXDN, so digital systems are marked as unreceivable rather than omitted.',
      zh: '以八重洲 VX-6R 为基准：0.5 至 999 MHz 连续接收，支持 AM、窄带 FM 和宽带 FM。它是模拟接收机——无法解码 P25、DMR 或 NXDN，因此数字系统被标注为“收不到”，而不是直接删掉。'
    },
    'ft.trust.b': {
      en: 'Every entry carries a confidence tag. Standard means a national FCC or ITU allocation that will not change. Stable means long-established. Verify means it is believed correct but is local and worth confirming before you rely on it.',
      zh: '每一条都带有可信度标签。“法定分配”指 FCC 或 ITU 的全国统一分配，不会变动。“稳定”指长期使用。“请核实”指大致正确但地方性较强，依赖之前值得先确认。'
    },
    'ft.legal.b': {
      en: 'Receiving is legal in most of the United States, though a few states restrict scanner use in a vehicle, and it is not generally restricted in China either. Transmitting is a separate question in each country: in the US you need an FCC licence and must stay inside its privileges, and in China you need a Chinese licence and type-approved equipment. Never transmit on public safety, aviation or marine channels except in a genuine emergency.',
      zh: '在美国大部分地区收听是合法的（少数州限制在车内使用扫描机），在中国收听通常也不受限制。发射在两国则是各自独立的问题：在美国需要 FCC 执照并只能在权限内操作；在中国需要中国执照和经过型号核准的设备。除真正紧急情况外，绝不要在公共安全、航空或海事频道上发射。'
    }
  };

  const $ = s => document.querySelector(s);
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

  let META = null, REGION = null, LANG = localStorage.getItem('aw.lang') === 'zh' ? 'zh' : 'en';
  let SCOPE = null, CAT = 'all', Q = '';
  const CACHE = new Map();

  const t = k => { const v = T[LANG][k]; return v === undefined ? T.en[k] : v; };
  const L = (o, key) => (LANG === 'zh' && o[key.z]) ? o[key.z] : o[key.n];

  /* ---------- formatting ---------- */

  function fmtFreq(f) {
    if (f >= 100) return f.toFixed(3);
    if (f >= 1) return f.toFixed(f % 1 === 0 ? 3 : 3);
    return (f * 1000).toFixed(0);
  }
  const unit = f => (f < 1 ? 'kHz' : 'MHz');

  /* ---------- boot ---------- */

  async function boot() {
    document.documentElement.dataset.lang = LANG;
    try {
      META = await (await fetch('data/regions.json', { cache: 'no-cache' })).json();
    } catch (e) {
      $('#list').append(el('p', 'empty', 'Could not load frequency data.'));
      return;
    }
    $('#ver').textContent = 'v' + META.version;
    applyStatic();
    wire();
    netState();

    const hashed = fromHash();
    SCOPE = (hashed && hashed.scope) || localStorage.getItem('aw.scope') || META.scopes[0].id;
    if (!META.scopes.some(s => s.id === SCOPE)) SCOPE = META.scopes[0].id;
    buildCountry();
    buildRegionTabs();
    await select((hashed || firstIn(SCOPE)).id, false);
  }

  // Regions live under a country: #/us/bay-area. A bare #/bay-area still resolves.
  function fromHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const id = parts.length > 1 ? parts[1] : parts[0];
    return id ? META.regions.find(r => r.id === id) : null;
  }

  function inScope(scope) {
    return META.regions.filter(r => r.scope === scope);
  }

  function firstIn(scope) {
    const pool = inScope(scope);
    const last = localStorage.getItem('aw.region.' + scope);
    return pool.find(r => r.id === last) || pool.find(r => r.pin) || pool[0];
  }

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(n => {
      const k = n.dataset.i18n;
      if (FT[k]) n.textContent = FT[k][LANG];
      else if (T[LANG][k] !== undefined && typeof T[LANG][k] === 'string') n.textContent = t(k);
    });
    $('#q').placeholder = t('search');
    $('#btn-lang').textContent = t('langBtn');
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  }

  /* ---------- country ---------- */

  // The country is picked once and rarely touched, so it belongs in the header as a setting.
  // That leaves the pill strip below as the only place picker, instead of two strips that
  // look alike and appear to do the same job.
  function buildCountry() {
    const c = META.scopes.find(s => s.id === SCOPE) || META.scopes[0];
    const name = L(c, { n: 'n', z: 'z' });
    $('#cty-k').textContent = c.k;
    $('#cty-n').textContent = name;
    $('#btn-cty').setAttribute('aria-label', t('country') + ': ' + name);

    const menu = $('#cty-menu');
    menu.textContent = '';
    META.scopes.forEach(s => {
      const o = el('button', 'cty-o');
      o.type = 'button';
      o.setAttribute('role', 'option');
      o.setAttribute('aria-selected', String(s.id === SCOPE));
      o.append(el('span', 'cty-ok', s.k));
      o.append(el('span', 'cty-on', L(s, { n: 'n', z: 'z' })));
      o.append(el('span', 'cty-oc', String(inScope(s.id).length)));
      o.addEventListener('click', () => {
        countryMenu(false);
        if (s.id !== SCOPE) select(firstIn(s.id).id, true);
      });
      menu.append(o);
    });
  }

  function countryMenu(open) {
    $('#cty').classList.toggle('open', open);
    $('#cty-menu').hidden = !open;
    $('#btn-cty').setAttribute('aria-expanded', String(open));
  }

  /* ---------- tabs ---------- */

  function buildRegionTabs() {
    const nav = $('#regions');
    nav.textContent = '';
    const pool = inScope(SCOPE);
    const places = pool.filter(r => r.kind !== 'link');
    const links = pool.filter(r => r.kind === 'link');

    if (places.some(r => r.lat != null)) {
      const geo = el('button', 'chip chip-geo');
      geo.type = 'button';
      geo.id = 'btn-geo';
      geo.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6"/></svg>';
      geo.append(el('span', null, t('near')));
      geo.addEventListener('click', locate);
      nav.append(geo);
    }

    places.forEach(r => nav.append(regionChip(r)));

    // Private Link is a set of channels rather than a place, so it sits past a divider at
    // the end of the strip instead of masquerading as a third country.
    if (links.length) {
      nav.append(el('span', 'r-sep'));
      links.forEach(r => {
        const b = regionChip(r);
        b.classList.add('chip-link');
        b.insertAdjacentHTML('afterbegin',
          '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3"/></svg>');
        nav.append(b);
      });
    }
    edgeFades(nav);
  }

  function regionChip(r) {
    const b = el('button', 'chip', L(r, { n: 'n', z: 'z' }));
    b.type = 'button';
    b.dataset.id = r.id;
    b.setAttribute('aria-pressed', String(REGION ? r.id === REGION.meta.id : false));
    b.addEventListener('click', () => select(r.id, true));
    return b;
  }

  // Only offer categories this region actually has, so no filter can lead to an empty list.
  function buildCatTabs() {
    const box = $('#cats');
    box.textContent = '';
    const mk = (id, label) => {
      const b = el('button', 'chip', label);
      b.type = 'button';
      b.dataset.cat = id;
      b.setAttribute('aria-pressed', String(CAT === id));
      b.addEventListener('click', () => { CAT = id; syncCats(); render(); });
      return b;
    };
    const present = new Set((REGION ? REGION.data.stations : []).map(s => s.c));
    box.append(mk('all', t('all')));
    META.categories.filter(c => present.has(c.id)).forEach(c => box.append(mk(c.id, L(c, { n: 'n', z: 'z' }))));
    edgeFades(box);
  }

  function syncCats() {
    document.querySelectorAll('#cats .chip').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.cat === CAT)));
  }

  // Fade the edge of a horizontal strip only while there is more to scroll to.
  function edgeFades(node) {
    const upd = () => {
      const max = node.scrollWidth - node.clientWidth;
      node.classList.toggle('fade-l', max > 2 && node.scrollLeft > 4);
      node.classList.toggle('fade-r', max > 2 && node.scrollLeft < max - 4);
    };
    node.addEventListener('scroll', upd, { passive: true });
    addEventListener('resize', upd);
    requestAnimationFrame(upd);
  }

  /* ---------- region selection ---------- */

  async function select(id, push) {
    const meta = META.regions.find(r => r.id === id);
    if (!meta) return;

    if (meta.scope !== SCOPE) {
      SCOPE = meta.scope;
      localStorage.setItem('aw.scope', SCOPE);
      buildCountry();
      buildRegionTabs();
    }
    document.querySelectorAll('#regions .chip[data-id]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    localStorage.setItem('aw.region.' + SCOPE, id);
    if (push) history.replaceState(null, '', '#/' + SCOPE + '/' + id);

    if (!CACHE.has(id)) {
      skeleton();
      try {
        CACHE.set(id, await (await fetch(`data/r/${id}.json`, { cache: 'no-cache' })).json());
      } catch (e) {
        CACHE.set(id, { id, stations: [] });
      }
      // A stable key per station lets the spectrum ruler find the row it belongs to.
      CACHE.get(id).stations.forEach((s, i) => { s.k = i; });
    }
    REGION = { meta, data: CACHE.get(id) };
    CAT = 'all';
    paint(() => { renderIntro(); buildCatTabs(); render(); });
    const tab = document.querySelector(`#regions .chip[data-id="${id}"]`);
    if (tab && push) tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // Cross-fade the region swap where the browser has view transitions; repaint plainly otherwise.
  // Switching regions quickly skips the transition in flight, which rejects — that is expected.
  function paint(fn) {
    if (!document.startViewTransition || reduced()) { fn(); return; }
    const vt = document.startViewTransition(fn);
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
  }

  function skeleton() {
    const box = $('#list');
    box.textContent = '';
    $('#empty').hidden = true;

    // On the very first load nothing above the list exists yet, so hold that space too.
    // Otherwise the intro and the ruler arrive together and shove the whole page down.
    const first = !REGION;
    if (first) {
      const intro = $('#intro');
      intro.textContent = '';
      ['sk-sub', 'sk-h1', 'sk-b', 'sk-b2', 'sk-btn'].forEach(c => intro.append(el('div', 'sk-x ' + c)));
      const ru = $('#ruler');
      ru.textContent = '';
      ru.append(el('div', 'sk-x sk-ru-c'), el('div', 'sk-x sk-ru-r'));
      ru.hidden = false;
    } else {
      $('#ruler').hidden = true;
    }

    for (let i = 0; i < (first ? 9 : 7); i++) {
      const r = el('div', 'sk');
      r.append(el('span', 'sk-f'), el('span', 'sk-n'));
      box.append(r);
    }
  }

  /* ---------- render ---------- */

  function renderIntro() {
    const { meta, data } = REGION;
    const box = $('#intro');
    box.textContent = '';

    box.append(el('p', 'sub', L(meta, { n: 'sub', z: 'subz' })));
    box.append(el('h1', null, L(meta, { n: 'n', z: 'z' })));

    const intro = LANG === 'zh' ? (data.introz || data.intro) : data.intro;
    if (intro) box.append(el('p', 'body', intro));

    const acts = el('div', 'acts');

    const csv = el('button', 'btn btn-a');
    csv.type = 'button';
    csv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3.5v11M8 11l4 4 4-4M4.5 19.5h15"/></svg>';
    csv.append(el('span', null, t('csv')));
    csv.addEventListener('click', exportCsv);
    acts.append(csv);

    const usable = data.stations.filter(s => s.f > 0).length;
    acts.append(el('span', 'btn btn-lk', t('entries')(usable)));

    (meta.links || []).forEach(k => {
      const a = el('a', 'btn btn-lk', k.l);
      a.href = k.u;
      a.target = '_blank';
      a.rel = 'noopener';
      acts.append(a);
    });
    box.append(acts);

    const warn = LANG === 'zh' ? (data.warnz || data.warn) : data.warn;
    if (warn) {
      const n = el('div', 'notice notice-hi');
      n.append(el('span', null, warn));
      box.append(n);
    }
    if (data.stations.some(s => s.avoid)) {
      const n = el('div', 'notice');
      n.append(el('span', null, t('avoidNote')));
      box.append(n);
    }
    if (data.stations.some(s => s.dig)) {
      const n = el('div', 'notice');
      n.append(el('span', null, t('digNote')));
      box.append(n);
    }
  }

  function matches(s) {
    if (CAT !== 'all' && s.c !== CAT) return false;
    if (!Q) return true;
    const hay = [
      s.n, s.z, s.a, s.d, s.dz, s.m, s.t,
      s.f > 0 ? fmtFreq(s.f) : '', s.f > 0 ? String(s.f) : ''
    ].filter(Boolean).join(' ').toLowerCase();
    return Q.split(/\s+/).every(w => hay.includes(w));
  }

  function render() {
    const box = $('#list');
    box.textContent = '';
    const rows = REGION.data.stations.filter(matches);
    $('#empty').hidden = rows.length > 0;
    renderRuler(rows);
    if (!rows.length) return;

    const order = META.categories.map(c => c.id);
    const byCat = new Map();
    rows.forEach(s => {
      if (!byCat.has(s.c)) byCat.set(s.c, []);
      byCat.get(s.c).push(s);
    });

    order.filter(id => byCat.has(id)).forEach(id => {
      const cat = META.categories.find(c => c.id === id);
      const items = byCat.get(id);
      const g = el('section', 'grp');

      const hd = el('div', 'grp-hd');
      hd.append(el('h2', null, L(cat, { n: 'n', z: 'z' })));
      hd.append(el('span', 'n', String(items.length)));
      hd.append(el('span', 'hint', L(cat, { n: 'hint', z: 'hintz' }) || ''));
      g.append(hd);

      let area = null;
      items.forEach(s => {
        if (s.a && s.a !== area) {
          area = s.a;
          g.append(el('div', 'area', area));
        }
        g.append(row(s));
      });
      box.append(g);
    });
  }

  /* ---------- spectrum ruler ---------- */

  // Where the listed frequencies actually sit across the radio's tuning range. Log scale,
  // because 0.5–999 MHz is three decades and a linear rail would bunch everything at the end.
  const LO = 0.5, HI = 999;
  const SPAN = Math.log10(HI / LO);
  const pos = f => (Math.log10(f) - Math.log10(LO)) / SPAN;
  const BANDS = [{ n: 'HF', a: LO, b: 30 }, { n: 'VHF', a: 30, b: 300 }, { n: 'UHF', a: 300, b: HI }];

  function renderRuler(rows) {
    const box = $('#ruler');
    box.textContent = '';
    const pts = rows.filter(s => s.f >= LO && s.f <= HI);
    box.hidden = pts.length < 2;
    if (box.hidden) return;

    const cap = el('div', 'ru-cap');
    cap.append(el('span', 'ru-t', t('spectrum')));
    cap.append(el('span', 'ru-h', t('rulerHint')));
    box.append(cap);

    const rail = el('button', 'ru-rail');
    rail.type = 'button';
    rail.setAttribute('aria-label', t('rulerHint'));

    BANDS.forEach(b => {
      const seg = el('span', 'ru-band');
      seg.style.left = pct(pos(b.a));
      seg.style.width = pct(pos(b.b) - pos(b.a));
      seg.append(el('em', null, b.n));
      rail.append(seg);
    });

    pts.forEach(s => {
      const k = el('span', 'ru-k' + (s.dig ? ' k-dig' : s.avoid ? ' k-avd' : ''));
      k.style.left = pct(pos(s.f));
      rail.append(k);
    });

    const cur = el('span', 'ru-cur'), out = el('span', 'ru-out');
    rail.append(cur, out);

    // Snap to the nearest listed entry rather than a raw frequency, so a rough tap with a
    // thumb still lands on something real.
    const nearest = e => {
      const r = rail.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const f = LO * Math.pow(HI / LO, x);
      return pts.reduce((best, s) =>
        Math.abs(Math.log10(s.f / f)) < Math.abs(Math.log10(best.f / f)) ? s : best, pts[0]);
    };

    rail.addEventListener('pointermove', e => {
      const s = nearest(e);
      cur.style.left = pct(pos(s.f));
      // Keep the readout clear of the rounded ends so it is never half clipped.
      out.style.left = pct(Math.min(.92, Math.max(.08, pos(s.f))));
      out.textContent = fmtFreq(s.f) + ' ' + unit(s.f);
      rail.classList.add('live');
    });
    rail.addEventListener('pointerleave', () => rail.classList.remove('live'));
    // A finger never leaves the rail the way a cursor does, so clear the readout on lift.
    rail.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse') setTimeout(() => rail.classList.remove('live'), 700);
    });
    rail.addEventListener('pointercancel', () => rail.classList.remove('live'));
    rail.addEventListener('click', e => jumpTo(nearest(e)));
    box.append(rail);

    const ax = el('div', 'ru-ax');
    [1, 10, 100, 999].forEach((f, i) => {
      const l = el('span', null, i === 3 ? f + ' MHz' : String(f));
      l.style.left = pct(pos(f));
      ax.append(l);
    });
    box.append(ax);
  }

  const pct = v => (v * 100).toFixed(3) + '%';

  function jumpTo(s) {
    const node = document.querySelector(`.row[data-k="${s.k}"]`);
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    flash(node);
    buzz(8);
  }

  function flash(node) {
    node.classList.remove('hit');
    requestAnimationFrame(() => node.classList.add('hit'));
    setTimeout(() => node.classList.remove('hit'), 1100);
  }

  function row(s) {
    const b = el('button', 'row' + (s.dig ? ' dig' : '') + (s.avoid ? ' avd' : ''));
    b.type = 'button';
    b.dataset.k = s.k;

    const f = el('div', 'f');
    if (s.f > 0) {
      f.append(document.createTextNode(fmtFreq(s.f)));
      f.append(el('span', 'u', unit(s.f)));
    } else {
      f.append(document.createTextNode('—'));
    }
    b.append(f);

    const nm = el('div', 'nm');
    nm.append(el('div', 't', LANG === 'zh' ? (s.z || s.n) : s.n));
    const alt = LANG === 'zh' ? s.n : s.z;
    if (alt && alt !== (LANG === 'zh' ? s.z : s.n)) nm.append(el('div', 'alt', alt));
    const d = LANG === 'zh' ? (s.dz || s.d) : s.d;
    if (d) nm.append(el('div', 'd', d));
    b.append(nm);

    const m = el('div', 'meta');
    if (s.avoid) m.append(el('span', 'tag tag-avd', t('avoid')));
    if (s.m) m.append(el('span', 'tag ' + (s.dig ? 'tag-dig' : 'tag-m'), s.m));
    if (s.o) m.append(el('span', 'tag tag-o', s.o));
    if (s.t) m.append(el('span', 'tag tag-t',
      isDcs(s.t) ? 'DCS ' + (s.t.match(/\d+/) || [''])[0] : 'PL ' + s.t));
    if (s.conf && META.confidence[s.conf]) {
      const c = META.confidence[s.conf];
      const tag = el('span', 'tag tag-' + s.conf, LANG === 'zh' ? c.z : c.n);
      tag.title = LANG === 'zh' ? c.dz : c.d;
      m.append(tag);
    }
    b.append(m);

    b.addEventListener('click', () => {
      if (s.f <= 0) { toast(t('verify')); return; }
      const txt = fmtFreq(s.f) + ' ' + unit(s.f);
      copy(txt);
      flash(b);
      buzz(14);
      toast(t('copied') + ' · ' + txt);
    });
    return b;
  }

  /* ---------- clipboard / toast ---------- */

  function copy(txt) {
    if (navigator.clipboard) { navigator.clipboard.writeText(txt).catch(() => {}); return; }
    const ta = el('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  let toastTimer;
  function toast(msg) {
    const n = $('#toast');
    n.textContent = msg;
    n.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => n.classList.remove('show'), 1900);
  }

  /* ---------- CHIRP export ---------- */

  // The VX-6 shows six characters. Derived tags are fine for names like "NOAA Weather — WX1"
  // but useless for prose, so an entry can supply its own.
  function shortTag(s) {
    if (s.tag) return s.tag.slice(0, 6);
    const clean = s.n.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').trim();
    const words = clean.split(/\s+/);
    const tag = words.length > 1 ? words.map(w => w.slice(0, 3)).join('') : words[0];
    return tag.slice(0, 6) || 'MEM';
  }

  const isDcs = t => !!t && /d(?:t)?cs/i.test(t);

  function exportCsv() {
    const head = ['Location', 'Name', 'Frequency', 'Duplex', 'Offset', 'Tone', 'rToneFreq',
      'cToneFreq', 'DtcsCode', 'DtcsPolarity', 'Mode', 'TStep', 'Skip', 'Comment',
      'URCALL', 'RPT1CALL', 'RPT2CALL', 'DVCODE'];

    const rows = REGION.data.stations
      .filter(s => s.f > 0 && !s.dig && !s.avoid && s.f >= 0.5 && s.f <= 999)
      .map((s, i) => {
        const dup = s.o ? (/^[-−]/.test(s.o) ? '-' : '+') : '';
        const off = s.o ? Math.abs(parseFloat(s.o.replace(/[−–]/g, '-'))).toFixed(6) : '0.000000';
        // DCS is a digital squelch code, not a CTCSS frequency — it belongs in DtcsCode.
        const dcs = isDcs(s.t);
        const tone = s.t ? (dcs ? 'DTCS' : 'Tone') : '';
        const pl = (s.t && !dcs) ? s.t : '88.5';
        const code = dcs ? (s.t.match(/\d+/) || ['23'])[0].padStart(3, '0') : '023';
        const mode = s.m === 'NFM' ? 'NFM' : s.m === 'WFM' ? 'WFM' : s.m === 'AM' ? 'AM' : 'FM';
        // Channels such as FRS and the weather satellites sit on a 12.5 kHz grid, not 5 kHz.
        const step = Math.round(s.f * 1e6) % 5000 === 0 ? '5.00' : '12.50';
        const comment = [s.n, s.a].filter(Boolean).join(' — ').replace(/[",\r\n]/g, ' ');
        return [i, shortTag(s), s.f.toFixed(6), dup, off, tone, pl, pl, code, 'NN',
          mode, step, '', comment, '', '', '', ''].join(',');
      });

    const blob = new Blob([head.join(',') + '\n' + rows.join('\n') + '\n'],
      { type: 'text/csv;charset=utf-8' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `airwaves-${REGION.meta.id}-vx6.csv`;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(`${rows.length} → CHIRP CSV`);
  }

  /* ---------- geolocation ---------- */

  function locate() {
    const btn = $('#btn-geo');
    const label = btn.querySelector('span');
    if (!navigator.geolocation) { toast(t('nogeo')); return; }
    label.textContent = t('locating');
    navigator.geolocation.getCurrentPosition(pos => {
      label.textContent = t('near');
      const { latitude: la, longitude: lo } = pos.coords;
      let best = null, bd = Infinity;
      META.regions.filter(r => r.lat != null).forEach(r => {
        const d = haversine(la, lo, r.lat, r.lon);
        if (d < bd) { bd = d; best = r; }
      });
      if (!best) { toast(t('nogeo')); return; }
      select(best.id, true);
      toast(t('geoOk')(L(best, { n: 'n', z: 'z' })) + ` · ${Math.round(bd)} km`);
    }, () => {
      label.textContent = t('near');
      toast(t('nogeo'));
    }, { timeout: 9000, maximumAge: 300000 });
  }

  function haversine(a1, o1, a2, o2) {
    const R = 6371, r = Math.PI / 180;
    const dA = (a2 - a1) * r, dO = (o2 - o1) * r;
    const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /* ---------- wiring ---------- */

  function wire() {
    const q = $('#q'), clear = $('#q-clear');
    let deb;
    q.addEventListener('input', () => {
      clear.hidden = !q.value;
      clearTimeout(deb);
      deb = setTimeout(() => { Q = q.value.trim().toLowerCase(); render(); }, 90);
    });
    clear.addEventListener('click', () => { q.value = ''; Q = ''; clear.hidden = true; render(); q.focus(); });

    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
      else if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; Q = ''; clear.hidden = true; render(); q.blur(); }
    });

    $('#btn-lang').addEventListener('click', () => {
      LANG = LANG === 'zh' ? 'en' : 'zh';
      localStorage.setItem('aw.lang', LANG);
      document.documentElement.dataset.lang = LANG;
      paint(() => {
        applyStatic();
        buildCountry();
        buildRegionTabs();
        buildCatTabs();
        renderIntro();
        render();
      });
    });

    const cty = $('#cty'), ctyBtn = $('#btn-cty');
    ctyBtn.addEventListener('click', () => countryMenu(!cty.classList.contains('open')));
    document.addEventListener('pointerdown', e => {
      if (cty.classList.contains('open') && !cty.contains(e.target)) countryMenu(false);
    });
    cty.addEventListener('keydown', e => {
      if (e.key === 'Escape') { countryMenu(false); ctyBtn.focus(); }
    });

    addEventListener('online', netState);
    addEventListener('offline', netState);
    addEventListener('hashchange', () => {
      const r = fromHash();
      if (r && REGION && r.id !== REGION.meta.id) select(r.id, false);
    });
  }

  function netState() {
    const n = $('#net');
    const on = navigator.onLine;
    n.classList.toggle('off', !on);
    $('#net-t').textContent = on ? t('online') : t('offline');
    n.title = on ? '' : t('offline');
  }

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  boot();
})();
