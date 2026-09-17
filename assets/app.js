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
      here: 'Here',
      compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      km: 'km',
      nowT: 'Right now',
      nowYou: 'at your position',

      skyT: 'Overhead',
      skyNone: 'No workable pass in the next 12 hours',
      skyNoPos: 'Share your location to see passes',
      skyWait: 'Working out passes…',
      skyNow: 'Overhead now',
      skyUp: d => `in ${d}`,
      skyRise: (a, b) => `rises ${a}, sets ${b}`,
      skyPeak: d => `${d}° at best`,
      skyLasts: d => `${d} long`,
      skyLive: (el, az) => `${el}° up, bearing ${az}`,
      skyDop: k => `Doppler ±${k} kHz`,
      skyDig: 'Digital',
      skyDigWhy: 'Audible as a harsh buzz, but turning it into a picture needs a computer',
      skyHigh: 'High pass',
      skyMore: 'All passes',
      skyLess: 'Next few',
      skyStale: d => `Orbits are ${d} days old`,

      view: 'Display and outdoor settings',
      vDisplay: 'Display',
      vAuto: 'Panel',
      vAutoS: 'Dark, for normal light',
      vGlare: 'Sunlight',
      vGlareS: 'Ink on white, readable in direct sun',
      vBlack: 'Battery',
      vBlackS: 'True black, saves power on OLED',
      vAwake: 'Keep screen on',
      vAwakeS: 'Stops the phone sleeping while you tune',
      vAwakeNo: 'This browser will not hold the screen on',
      vSkinOn: n => `${n} display`,
      vAwakeOn: 'Screen will stay on',
      vAwakeOff: 'Screen can sleep again',

      sun: 'Sun',
      dark: 'Dark',
      darkAm: 'Dark — the AM band is open',
      daylight: 'Daylight',
      sunUp: 'The sun does not set today',
      sunDown: 'The sun does not rise today',
      sunrise: d => `Sunrise in ${d}`,
      sunset: d => `Sunset in ${d}`,
      span: (h, m) => (h ? `${h} h ${m} m` : `${m} m`),
      hf: 'HF conditions',
      kp: ['quiet', 'quiet', 'quiet', 'unsettled', 'active', 'storm', 'storm', 'severe storm'],
      hfSteady: 'Paths below 30 MHz are steady',
      hfRough: 'Paths below 30 MHz are degraded, worst at high latitudes',
      flux: f => `Solar flux ${f}`,
      fluxV: ['high bands mostly closed', 'high bands marginal', 'high bands workable', 'high bands wide open'],
      wxAlerts: 'Weather alerts',
      wxNone: 'None active',
      wxMore: n => `and ${n} more`,
      wxOn: f => `NOAA on ${f}`,
      liveOff: 'Needs a connection',
      liveOld: 'last known',
      online: 'online',
      offline: 'offline · cached',
      langBtn: '中文',
      country: 'Country',
      pro: 'Pro',
      proLabel: 'Pro mode',
      proOn: 'Pro mode — the technical detail behind every entry',
      proOff: 'Simple mode',
      rptIn: 'in',
      spectrum: 'Spectrum',
      rulerHint: 'Tap the spectrum to jump to the nearest entry',
      wheelHint: 'Drag to tune · release to jump',
      sound: 'Tuning sound',
      digNote: 'Struck-through rows are things a VX-6 cannot give you: digital and encrypted systems it has no way to decode, signals outside its tuning range, and a few services that simply do not exist here. They are listed so you know not to spend an evening hunting for them.',
      copyHint: 'Tap any row to copy its frequency',
      proHint: 'Tap any row for detail · copy is inside',
      dOdds: 'Odds',
      dMode: 'Set the radio to',
      dInput: 'You transmit on',
      dShift: 'shift',
      dTone: 'Tone',
      dPower: 'Licensed power',
      dLocal: 'A local signal — a few kilometres, not a region',
      dLicensee: 'Licensed to',
      dSite: 'Transmitter',
      dElev: 'site elevation',
      dAnt: 'Antenna',
      dBand: 'Amateur band',
      dMem: 'Memory name',
      dMemNote: 'Used by the CHIRP export',
      dSource: 'Source',
      dSrcFcc: 'FCC licensing database',
      dSrcOa: 'ourairports / ICAO data',
      dSrcHand: 'Written for this guide',
      dCopy: 'Copy',
      dAir: 'airband, 25 kHz channels',
      dMw: 'medium wave',
      dSw: 'shortwave',
      dBcast: 'broadcast FM',
      verify: 'Verify locally',
      avoid: 'Avoid',
      'ft.radio': 'Your radio',
      'ft.trust': 'How much to trust this',
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
      here: '当前位置',
      compass: ['北', '东北', '东', '东南', '南', '西南', '西', '西北'],
      km: '公里',
      nowT: '此刻',
      nowYou: '你所在的位置',

      skyT: '头顶',
      skyNone: '未来 12 小时内没有值得一试的过顶',
      skyNoPos: '共享位置后即可查看过顶时刻',
      skyWait: '正在推算过顶…',
      skyNow: '正在头顶',
      skyUp: d => `${d}后`,
      skyRise: (a, b) => `${a}升起，${b}落下`,
      skyPeak: d => `最高 ${d}°`,
      skyLasts: d => `持续 ${d}`,
      skyLive: (el, az) => `仰角 ${el}°，方位 ${az}`,
      skyDop: k => `多普勒 ±${k} kHz`,
      skyDig: '数字',
      skyDigWhy: '能听到刺耳的杂音，但要还原成图像得用电脑',
      skyHigh: '高仰角',
      skyMore: '全部过顶',
      skyLess: '只看最近',
      skyStale: d => `轨道数据已有 ${d} 天`,

      view: '显示与户外设置',
      vDisplay: '显示',
      vAuto: '仪表盘',
      vAutoS: '深色，适合常规光线',
      vGlare: '强光',
      vGlareS: '白底黑字，烈日下也看得清',
      vBlack: '省电',
      vBlackS: '纯黑，OLED 屏更省电',
      vAwake: '屏幕常亮',
      vAwakeS: '调频时不让手机息屏',
      vAwakeNo: '此浏览器不支持屏幕常亮',
      vSkinOn: n => `已切换到${n}显示`,
      vAwakeOn: '屏幕将保持常亮',
      vAwakeOff: '屏幕可以自动息屏了',

      sun: '日照',
      dark: '天已黑',
      darkAm: '天已黑 —— 中波已开',
      daylight: '白天',
      sunUp: '今天太阳不落',
      sunDown: '今天太阳不升',
      sunrise: d => `日出还有 ${d}`,
      sunset: d => `日落还有 ${d}`,
      span: (h, m) => (h ? `${h} 小时 ${m} 分` : `${m} 分`),
      hf: '短波条件',
      kp: ['平静', '平静', '平静', '略受扰', '活跃', '磁暴', '磁暴', '强磁暴'],
      hfSteady: '30 MHz 以下传播稳定',
      hfRough: '30 MHz 以下传播受扰，高纬度最明显',
      flux: f => `太阳射电通量 ${f}`,
      fluxV: ['高频段基本不开', '高频段勉强', '高频段可用', '高频段大开'],
      wxAlerts: '气象警报',
      wxNone: '当前无警报',
      wxMore: n => `另有 ${n} 条`,
      wxOn: f => `NOAA 气象广播 ${f}`,
      liveOff: '需要联网',
      liveOld: '上次获取',
      online: '在线',
      offline: '离线 · 已缓存',
      langBtn: 'EN',
      country: '国家',
      pro: '专业',
      proLabel: '专业模式',
      proOn: '专业模式 —— 每条频率背后的技术细节',
      proOff: '简洁模式',
      rptIn: '上行',
      spectrum: '频谱',
      rulerHint: '点击频谱可跳到最接近的条目',
      wheelHint: '拖动调谐 · 松手跳转',
      sound: '调谐声',
      digNote: '带删除线的条目是 VX-6 无法提供的内容：它无法解码的数字与加密系统、超出其调谐范围的信号，以及在当地根本不存在的业务。列出来是为了让你知道不必白费一晚上去找。',
      copyHint: '点击任意一行即可复制频率',
      proHint: '点击任意一行查看详情 · 复制按钮在里面',
      dOdds: '收到概率',
      dMode: '电台设置为',
      dInput: '你发射的频率',
      dShift: '偏移',
      dTone: '亚音频',
      dPower: '执照功率',
      dLocal: '本地信号——覆盖几公里，而非整个地区',
      dLicensee: '执照持有人',
      dSite: '发射台',
      dElev: '台址海拔',
      dAnt: '天线长度',
      dBand: '业余频段',
      dMem: '存储器名称',
      dMemNote: '用于 CHIRP 导出',
      dSource: '数据来源',
      dSrcFcc: 'FCC 执照数据库',
      dSrcOa: 'ourairports / ICAO 数据',
      dSrcHand: '本指南自行撰写',
      dCopy: '复制',
      dAir: '航空波段，25 kHz 间隔',
      dMw: '中波',
      dSw: '短波',
      dBcast: '调频广播',
      verify: '请在当地核实',
      avoid: '避免',
      'ft.radio': '你的电台',
      'ft.trust': '可信度说明',
      'ft.offline': '已缓存，可离线使用'
    }
  };

  const FT = {
    'ft.radio.b': {
      en: 'Built around the Yaesu VX-6R: continuous receive from 0.5 to 999 MHz in AM, NFM and WFM. It is an analog receiver — it cannot decode P25, DMR or NXDN, so digital systems are marked as unreceivable rather than omitted.',
      zh: '以八重洲 VX-6R 为基准：0.5 至 999 MHz 连续接收，支持 AM、窄带 FM 和宽带 FM。它是模拟接收机——无法解码 P25、DMR 或 NXDN，因此数字系统被标注为“收不到”，而不是直接删掉。'
    },
    'ft.trust.b': {
      en: 'The bars on each entry are the odds of hearing anything if you tune there. Three bars means a carrier is on it essentially all the time, over a wide area — NOAA weather radio, a broadcast station, an airport ATIS loop. Two means busy but intermittent: a working tower, a port, a maintained repeater. One means quiet, short-range, occasional, or a frequency worth confirming locally before you rely on it — worth programming, not worth sitting on. Entries with no bars are digital or encrypted, so the radio cannot decode them at all.',
      zh: '每条右侧的信号条表示：把电台调到这个频率，能收到东西的概率。三格代表几乎始终有信号且覆盖面大——NOAA 气象广播、广播电台、机场自动通播。两格代表繁忙但断续：运行中的塔台、港口、有人维护的中继台。一格代表安静、距离短、偶发，或这个频率本身值得先在当地核实——值得存进电台，但不值得一直守着。没有信号条的条目是数字或加密信号，电台根本无法解码。'
    }
  };

  const $ = s => document.querySelector(s);
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

  let META = null, REGION = null, LANG = localStorage.getItem('aw.lang') === 'zh' ? 'zh' : 'en';
  let SCOPE = null, CAT = 'all', Q = '';
  let PLACES = null;
  const CACHE = new Map();

  // Where you were, if you have ever said. Kept for a few hours so distances are there the
  // moment you open the site rather than after another permission prompt.
  const POS = { lat: null, lon: null };
  const POS_TTL = 6 * 3600e3;

  (function restorePos() {
    try {
      const p = JSON.parse(localStorage.getItem('aw.pos') || 'null');
      if (p && Date.now() - p.at < POS_TTL) { POS.lat = p.lat; POS.lon = p.lon; }
    } catch (e) {}
  })();

  // Two modes, one site. Simple is the whole point of the thing: a frequency, a name, go.
  // Pro layers the instruments on top for someone standing there with the radio in hand.
  let MODE = startMode();
  const isPro = () => MODE === 'pro';

  // ?pro=1 makes a pro-mode view shareable and testable without touching the hash router.
  function startMode() {
    const q = new URLSearchParams(location.search).get('pro');
    if (q === '1' || q === '0') {
      const m = q === '1' ? 'pro' : 'simple';
      localStorage.setItem('aw.mode', m);
      return m;
    }
    return localStorage.getItem('aw.mode') === 'pro' ? 'pro' : 'simple';
  }

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
    applyMode();

    try {
      META = await (await fetch('data/regions.json', { cache: 'no-cache' })).json();
    } catch (e) {
      $('#list').textContent = '';
      $('#ruler').hidden = true;
      $('#now').hidden = true;
      $('#intro').textContent = '';
      $('#list').append(el('p', 'empty', 'Could not load frequency data.'));
      return;
    }
    $('#ver').textContent = 'v' + META.version;
    // Coordinates are a nicety, not a dependency: if this fails the site is unchanged.
    fetch('data/places.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then(p => { PLACES = p; if (POS.lat != null && REGION) render(); })
      .catch(() => {});
    applyStatic();
    applySkin();
    buildView();
    wire();
    netState();
    // Restore the wake lock, but only once the page is actually visible - the request is
    // rejected outright on a background tab.
    if (wantAwake() && !document.hidden) holdScreen(true);

    const hashed = fromHash();
    SCOPE = (hashed && hashed.scope) || localStorage.getItem('aw.scope') || META.scopes[0].id;
    if (!META.scopes.some(s => s.id === SCOPE)) SCOPE = META.scopes[0].id;
    document.documentElement.dataset.scope = SCOPE;
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
    $('#mode-t').textContent = t('pro');
    $('#btn-mode').title = t('proLabel') + ' (P)';
    $('#btn-mode').setAttribute('aria-label', t('proLabel'));
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  }

  /* ---------- mode ---------- */

  function applyMode() {
    document.documentElement.dataset.mode = MODE;
    $('#btn-mode').setAttribute('aria-pressed', String(isPro()));
  }

  function toggleMode() {
    MODE = isPro() ? 'simple' : 'pro';
    localStorage.setItem('aw.mode', MODE);
    applyMode();
    buzz(isPro() ? 14 : 8);
    toast(isPro() ? t('proOn') : t('proOff'));
    if (REGION) paint(() => { renderIntro(); renderNow(); renderSky(); render(); });
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

    /* ---------- outdoor settings ---------- */

    // The skin is read before the first paint by the inline script in index.html, so this
    // reads it back rather than deciding it again.
    const SKINS = ['auto', 'glare', 'black'];
    let SKIN = SKINS.includes(document.documentElement.dataset.skin)
      ? document.documentElement.dataset.skin : 'auto';
    let AWAKE = null;

    function applySkin() {
      document.documentElement.dataset.skin = SKIN;
      // The browser chrome should match, or the notch area stays the old colour.
      const bar = { auto: '#0a0b0d', glare: '#ffffff', black: '#000000' }[SKIN];
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', bar);
    }

    // Screen Wake Lock drops the lock whenever the page is hidden, so it has to be retaken
    // on return or the screen quietly starts sleeping again after the first notification.
    async function holdScreen(on) {
      if (!('wakeLock' in navigator)) return false;
      try {
        if (on) {
          AWAKE = await navigator.wakeLock.request('screen');
          AWAKE.addEventListener('release', () => { AWAKE = null; });
        } else if (AWAKE) {
          await AWAKE.release();
          AWAKE = null;
        }
        return true;
      } catch (e) {
        AWAKE = null;
        return false;
      }
    }

    const wantAwake = () => localStorage.getItem('aw.awake') === '1';

    function buildView() {
      const menu = $('#view-menu');
      const open = !menu.hidden;
      menu.textContent = '';
      $('#btn-view').setAttribute('aria-label', t('view'));
      $('#btn-view').title = t('view');

      menu.append(el('p', 'view-h', t('vDisplay')));
      const names = { auto: 'vAuto', glare: 'vGlare', black: 'vBlack' };
      SKINS.forEach(id => {
        const o = el('button', 'view-o');
        o.type = 'button';
        o.setAttribute('role', 'menuitemradio');
        o.setAttribute('aria-checked', String(id === SKIN));
        o.append(el('span', 'view-d'));
        const n = el('span', 'view-n', t(names[id]));
        n.append(el('span', 'view-s', t(names[id] + 'S')));
        o.append(n);
        o.addEventListener('click', () => {
          if (id !== SKIN) {
            SKIN = id;
            localStorage.setItem('aw.skin', SKIN);
            applySkin();
            buzz(8);
            toast(t('vSkinOn')(t(names[id])));
          }
          viewMenu(false);
        });
        menu.append(o);
      });

      menu.append(el('div', 'view-sep'));

      const can = 'wakeLock' in navigator;
      const sw = el('button', 'view-o');
      sw.type = 'button';
      sw.id = 'btn-awake';
      sw.setAttribute('role', 'menuitemcheckbox');
      sw.setAttribute('aria-checked', String(can && wantAwake()));
      sw.disabled = !can;
      const sn = el('span', 'view-n', t('vAwake'));
      sn.append(el('span', 'view-s', can ? t('vAwakeS') : t('vAwakeNo')));
      sw.append(sn);
      const tg = el('span', 'view-t');
      tg.append(el('i'));
      sw.append(tg);
      sw.addEventListener('click', async () => {
        const on = !wantAwake();
        const ok = await holdScreen(on);
        if (!ok && on) return;
        localStorage.setItem('aw.awake', on ? '1' : '0');
        sw.setAttribute('aria-checked', String(on));
        buzz(on ? 14 : 8);
        toast(on ? t('vAwakeOn') : t('vAwakeOff'));
      });
      menu.append(sw);

      menu.hidden = !open;
    }

    function viewMenu(open) {
      $('#view').classList.toggle('open', open);
      $('#view-menu').hidden = !open;
      $('#btn-view').setAttribute('aria-expanded', String(open));
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
      geo.append(el('span', null, POS.lat == null ? t('near') : t('here')));
      geo.classList.toggle('on-geo', POS.lat != null);
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
      document.documentElement.dataset.scope = SCOPE;
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
    paint(() => { renderIntro(); renderNow(); renderSky(); buildCatTabs(); render(); });
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
    $('#empty').hidden = true;

    // The first load is already skeletoned by index.html, so that the placeholders are
    // part of the first paint instead of arriving after it. Rebuilding them here would
    // only give that shape a second definition to drift from.
    if (!REGION) return;

    const box = $('#list');
    box.textContent = '';
    $('#ruler').hidden = true;
    for (let i = 0; i < 7; i++) {
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

    // The note explains the struck-through rows, so it sits just above the list rather than
    // between you and what is happening right now.
    const slot = $('#notice');
    slot.textContent = '';
    if (data.stations.some(s => s.dig)) {
      const n = el('div', 'notice');
      n.append(el('span', null, t('digNote')));
      slot.append(n);
    }
  }

  /* ---------- right now ---------- */

  // Sunrise and sunset from the standard solar position formulas. Worth computing locally:
  // it needs no network, and below 30 MHz darkness changes what you can hear more than
  // anything else does — several entries in the data say "at night" in so many words.
  function sunTimes(date, lat, lon) {
    const rad = Math.PI / 180, day = 86400000, J1970 = 2440588, J2000 = 2451545;
    const fromJ = j => new Date((j + 0.5 - J1970) * day);

    const d = date.valueOf() / day - 0.5 + J1970 - J2000;
    const lw = rad * -lon, phi = rad * lat;
    const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
    const ds = 0.0009 + lw / (2 * Math.PI) + n;
    const M = rad * (357.5291 + 0.98560028 * ds);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + Math.PI;
    const dec = Math.asin(Math.sin(rad * 23.4397) * Math.sin(L));
    const jNoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

    // −0.833° allows for refraction and the sun's own radius: the usual definition.
    const cosW = (Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) /
      (Math.cos(phi) * Math.cos(dec));
    if (cosW >= 1) return { polar: 'night' };
    if (cosW <= -1) return { polar: 'day' };
    const w = Math.acos(cosW);
    const jSet = J2000 + (0.0009 + (w + lw) / (2 * Math.PI) + n) +
      0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    return { rise: fromJ(jNoon - (jSet - jNoon)), set: fromJ(jSet) };
  }

  function span(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    return t('span')(Math.floor(m / 60), m % 60);
  }

  // Live data on a site with no backend: fetched straight from the browser, cut down to the
  // few fields that matter, cached with a TTL. Always optional — a failure leaves the card
  // quiet instead of breaking the page, and a stale reading beats an empty one offline.
  async function live(key, url, ttl, reduce) {
    const now = Date.now();
    const read = () => {
      try { return JSON.parse(localStorage.getItem('aw.live.' + key) || 'null'); } catch (e) { return null; }
    };
    const had = read();
    if (had && now - had.at < ttl) return had.v;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const v = reduce(await r.json());
      try { localStorage.setItem('aw.live.' + key, JSON.stringify({ at: now, v })); } catch (e) {}
      return v;
    } catch (e) {
      return had ? Object.assign({}, had.v, { old: true }) : null;
    } finally {
      clearTimeout(timer);
    }
  }

  function nowCard(label, value, detail) {
    const c = el('div', 'nw-c');
    c.append(el('div', 'nw-k', label));
    c.append(el('div', 'nw-v', value));
    c.append(el('div', 'nw-d', detail));
    return c;
  }

  function fill(c, value, detail) {
    c.querySelector('.nw-v').textContent = value;
    c.querySelector('.nw-d').textContent = detail || '';
  }

  let nowGen = 0;

  function renderNow() {
    // Flipping through regions must not fire a request per region, so the live readings are
    // held back briefly and dropped if you have already moved on.
    const gen = ++nowGen;
    const soon = fn => setTimeout(() => { if (gen === nowGen) fn(); }, 350);

    const box = $('#now');
    box.textContent = '';
    if (!isPro() || !REGION) { box.hidden = true; return; }

    // Your own position if you have shared it, otherwise the middle of the region you are
    // reading. Nationwide sets and the link pages have no centre, so they get no panel.
    const own = POS.lat != null;
    const lat = own ? POS.lat : REGION.meta.lat;
    const lon = own ? POS.lon : REGION.meta.lon;
    if (lat == null || lon == null) { box.hidden = true; return; }
    box.hidden = false;

    const cap = el('div', 'nw-cap');
    cap.append(el('span', 'nw-t', t('nowT')));
    cap.append(el('span', 'nw-w', own ? t('nowYou') : L(REGION.meta, { n: 'n', z: 'z' })));
    box.append(cap);

    const grid = el('div', 'nw-g');
    grid.append(sunCard(lat, lon));

    const hf = nowCard(t('hf'), '·  ·  ·', '');
    grid.append(hf);
    soon(() => fillHf(hf));

    // The alert service is the US National Weather Service and rejects points outside it.
    if (SCOPE === 'us') {
      const wx = nowCard(t('wxAlerts'), '·  ·  ·', '');
      grid.append(wx);
      soon(() => fillWx(wx, lat, lon));
    }

    box.append(grid);
  }

  /* ---------- satellite passes ---------- */

  // A handheld needs the satellite reasonably high: below about 10 degrees the path runs
  // through too much atmosphere and too much of whatever is on your horizon.
  const SKY_MIN_EL = 10;
  const SKY_HOURS = 12;
  const C_KM_S = 299792.458;

  let SATS = null, SAT_ERR = false, SKY_ALL = false;

  async function loadSats() {
    if (SATS || SAT_ERR) return SATS;
    try {
      SATS = await (await fetch('data/sat.json')).json();
      // One SGP4 init per satellite, reused for every pass search afterwards.
      for (const b of SATS.birds) {
        b.rec = [];
        for (const id of b.norad) {
          const tle = b.tle[String(id)];
          if (!tle) continue;
          const r = window.SGP4.init(window.SGP4.parse(tle[0], tle[1]));
          if (!r.deepspace && !r.error) b.rec.push({ id, r });
        }
      }
    } catch (e) { SAT_ERR = true; SATS = null; }
    return SATS;
  }

  // Walk time forward in coarse steps looking for the satellite to clear the horizon, then
  // bisect the crossing. A coarse step has to be shorter than the shortest pass or a pass
  // can be stepped straight over; the fastest of these birds is above the horizon for about
  // eight minutes, so one minute leaves a wide margin.
  function findPasses(rec, lat, lon, from, hours) {
    const S = window.SGP4;
    const jdOf = ms => ms / 86400000 + 2440587.5;
    const minOf = ms => (jdOf(ms) - rec.jdsatepoch) * 1440;
    const elAt = ms => {
      const l = S.look(rec, minOf(ms), jdOf(ms), lat, lon, 0);
      return l ? l.el : -90;
    };

    const out = [];
    const step = 60000;
    const end = from + hours * 3600000;
    let prev = elAt(from), prevT = from;

    for (let tms = from + step; tms <= end; tms += step) {
      const now = elAt(tms);
      if (prev < 0 && now >= 0) {
        // Rising. Bisect for the horizon crossing, then sample the arc for its peak.
        let lo = prevT, hi = tms;
        for (let i = 0; i < 18; i++) {
          const mid = (lo + hi) / 2;
          if (elAt(mid) < 0) lo = mid; else hi = mid;
        }
        const aos = hi;
        let setT = null, pLo = tms, pPrev = now;
        for (let u = tms + step; u <= end + 1800000; u += step) {
          const e = elAt(u);
          if (pPrev >= 0 && e < 0) {
            let a = pLo, b = u;
            for (let i = 0; i < 18; i++) {
              const mid = (a + b) / 2;
              if (elAt(mid) >= 0) a = mid; else b = mid;
            }
            setT = a;
            break;
          }
          pLo = u; pPrev = e;
        }
        if (setT == null) break;

        // Peak by ternary search: elevation over a single pass is unimodal.
        let a = aos, b = setT;
        for (let i = 0; i < 40; i++) {
          const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
          if (elAt(m1) < elAt(m2)) a = m1; else b = m2;
        }
        const peakT = (a + b) / 2;
        const peak = S.look(rec, minOf(peakT), jdOf(peakT), lat, lon, 0);
        const rise = S.look(rec, minOf(aos), jdOf(aos), lat, lon, 0);
        const fall = S.look(rec, minOf(setT), jdOf(setT), lat, lon, 0);
        if (peak && peak.el >= SKY_MIN_EL) {
          out.push({
            aos, los: setT, peakT,
            el: peak.el, riseAz: rise ? rise.az : 0, setAz: fall ? fall.az : 0
          });
        }
        tms = setT;
        prev = -1; prevT = setT;
        continue;
      }
      prev = now; prevT = tms;
    }
    return out;
  }

  // Best pass per frequency, since a constellation shares one downlink and what matters is
  // whether anything is up there, not which of the nine it is.
  function skyPasses(lat, lon) {
    const from = Date.now();
    const rows = [];
    for (const f of SATS.freqs) {
      const bird = SATS.birds.find(b => b.id === f.bird);
      if (!bird || !bird.rec.length) continue;
      let best = null;
      for (const { id, r } of bird.rec) {
        for (const p of findPasses(r, lat, lon, from, SKY_HOURS)) {
          // Prefer one already in progress, then the soonest.
          const live = p.aos <= from && p.los >= from;
          if (!best || (live && !best.live) || (live === !!best.live && p.aos < best.aos)) {
            best = Object.assign({}, p, { live, norad: id, rec: r });
          }
          break;
        }
      }
      if (best) rows.push(Object.assign({ f }, best, { bird }));
    }
    rows.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || a.aos - b.aos);
    return rows;
  }

  function renderSky() {
    const box = $('#sky');
    if (!box) return;
    box.textContent = '';
    if (!isPro() || !REGION) { box.hidden = true; return; }

    // Passes are only meaningful for a real observer. A region centre would give times that
    // look authoritative and are wrong by however far away you are, so it is not offered.
    if (POS.lat == null) { box.hidden = true; return; }
    box.hidden = false;

    const cap = el('div', 'nw-cap');
    cap.append(el('span', 'nw-t', t('skyT')));
    box.append(cap);
    const list = el('div', 'sky-l');
    list.append(el('p', 'sky-m', t('skyWait')));
    box.append(list);

    loadSats().then(ok => {
      if (!ok || !isPro() || POS.lat == null) { box.hidden = true; return; }
      const rows = skyPasses(POS.lat, POS.lon);
      list.textContent = '';
      if (!rows.length) { list.append(el('p', 'sky-m', t('skyNone'))); return; }

      const show = SKY_ALL ? rows : rows.slice(0, 3);
      for (const p of show) list.append(skyRow(p));

      if (rows.length > 3) {
        const more = el('button', 'sky-b', SKY_ALL ? t('skyLess') : t('skyMore'));
        more.type = 'button';
        more.addEventListener('click', () => { SKY_ALL = !SKY_ALL; renderSky(); });
        list.append(more);
      }

      // Elements go stale, and a pass predicted from a fortnight-old TLE can be minutes out.
      // Say so rather than presenting it with the same confidence as a fresh one.
      const age = Math.floor(Date.now() / 86400000 + 2440587.5 - show[0].rec.jdsatepoch);
      if (age >= 7) list.append(el('p', 'sky-m', t('skyStale')(age)));
    });
  }

  function skyRow(p) {
    const row = el('div', 'sky-r');
    if (p.live) row.classList.add('live');

    const head = el('div', 'sky-h');
    const f = el('span', 'sky-f', fmtFreq(p.f.f));
    f.append(el('i', null, unit(p.f.f)));
    head.append(f);
    head.append(el('span', 'sky-n', L(p.f, { n: 'n', z: 'z' })));
    row.append(head);

    const when = el('div', 'sky-w');
    if (p.live) {
      const jd = Date.now() / 86400000 + 2440587.5;
      const l = window.SGP4.look(p.rec, (jd - p.rec.jdsatepoch) * 1440, jd, POS.lat, POS.lon, 0);
      when.append(el('span', 'sky-up', t('skyNow')));
      if (l) {
        when.append(el('span', null, t('skyLive')(Math.round(l.el), compass(l.az))));
        // Doppler shift, which on 70 cm is wide enough that you have to chase it by hand.
        const k = Math.abs(p.f.f * 1000 * (l.rangeRate / C_KM_S));
        if (k >= 0.5) when.append(el('span', null, t('skyDop')(k.toFixed(1))));
      }
    } else {
      when.append(el('span', 'sky-up', t('skyUp')(span(p.aos - Date.now()))));
      when.append(el('span', null, t('skyPeak')(Math.round(p.el))));
      when.append(el('span', null, t('skyRise')(compass(p.riseAz), compass(p.setAz))));
      when.append(el('span', null, t('skyLasts')(span(p.los - p.aos))));
    }
    row.append(when);

    const tags = el('div', 'sky-t');
    if (p.el >= 45) tags.append(el('span', 'tag tag-std', t('skyHigh')));
    if (p.f.m) tags.append(el('span', 'tag tag-m', p.f.m));
    if (p.f.t) tags.append(el('span', 'tag tag-t', 'PL ' + p.f.t));
    if (p.f.dig) tags.append(el('span', 'tag tag-dig', t('skyDig')));
    if (tags.children.length) row.append(tags);

    // The explanation is a sentence, so it goes in a paragraph that wraps rather than in a
    // tag, which does not.
    if (p.f.dig) row.append(el('p', 'sky-why', t('skyDigWhy')));

    return row;
  }

  function sunCard(lat, lon) {
    const c = nowCard(t('sun'), '', '');
    const s = sunTimes(new Date(), lat, lon);
    // Only the bands below 30 MHz care about darkness; above that it makes no difference.
    const lowBands = REGION.data.stations.some(x => x.f > 0 && x.f < 30);

    if (s.polar) {
      fill(c, s.polar === 'day' ? t('sunUp') : t('sunDown'),
        s.polar === 'night' && lowBands ? t('darkAm') : '');
      return c;
    }

    const now = Date.now();
    const dark = now < s.rise.getTime() || now > s.set.getTime();
    let next;
    if (!dark) next = s.set;
    else if (now > s.set.getTime()) next = sunTimes(new Date(now + 86400000), lat, lon).rise;
    else next = s.rise;

    // A clock time is only honest for your own position, where the device clock is the
    // right one. For a region on the other side of the world the countdown is what holds.
    const clock = POS.lat != null
      ? ' · ' + String(next.getHours()).padStart(2, '0') + ':' + String(next.getMinutes()).padStart(2, '0')
      : '';
    fill(c, dark ? (lowBands ? t('darkAm') : t('dark')) : t('daylight'),
      (dark ? t('sunrise') : t('sunset'))(span(next.getTime() - now)) + clock);
    return c;
  }

  async function fillHf(c) {
    const kp = await live('kp', 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
      30 * 60e3, j => {
        const last = j[j.length - 1];
        return { kp: Math.round(Number(last.Kp)) };
      });
    const flux = await live('flux', 'https://services.swpc.noaa.gov/products/summary/10cm-flux.json',
      6 * 3600e3, j => ({ flux: Math.round(Number((Array.isArray(j) ? j[0] : j).flux)) }));

    if (!kp) { fill(c, t('liveOff'), ''); return; }
    const k = Math.min(7, Math.max(0, kp.kp));
    const verdict = k >= 5 ? t('hfRough') : t('hfSteady');
    const detail = flux
      ? t('flux')(flux.flux) + ' · ' + t('fluxV')[flux.flux < 90 ? 0 : flux.flux < 120 ? 1 : flux.flux < 160 ? 2 : 3]
      : verdict;
    fill(c, `Kp ${k} · ${t('kp')[k]}`, detail + (kp.old ? ' · ' + t('liveOld') : ''));
    c.classList.toggle('nw-warn', k >= 5);
  }

  async function fillWx(c, lat, lon) {
    // Rounded to about a kilometre on the way out. Alerts are issued for whole counties, so
    // nothing is lost, and there is no reason to hand over a sharper position than the
    // question needs.
    const at = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const a = await live('wx' + at,
      `https://api.weather.gov/alerts/active?point=${at}`,
      10 * 60e3, j => {
        const rank = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };
        const list = (j.features || [])
          .map(f => ({ event: f.properties.event, sev: rank[f.properties.severity] || 0 }))
          .sort((x, y) => y.sev - x.sev);
        return { n: list.length, worst: list.length ? list[0].event : null, sev: list.length ? list[0].sev : 0 };
      });

    // Whatever the alerts say, the useful next move is the weather frequency for here.
    const noaa = REGION.data.stations.find(s => s.c === 'wx' && s.f > 0);
    const on = noaa ? t('wxOn')(fmtFreq(noaa.f) + ' ' + unit(noaa.f)) : '';

    if (!a) { fill(c, t('liveOff'), on); return; }
    const extra = a.n > 1 ? t('wxMore')(a.n - 1) + (on ? ' · ' : '') : '';
    fill(c, a.worst || t('wxNone'), extra + on + (a.old ? ' · ' + t('liveOld') : ''));
    c.classList.toggle('nw-warn', a.sev >= 3);

    if (noaa) {
      c.classList.add('nw-hit');
      c.setAttribute('role', 'button');
      c.tabIndex = 0;
      const go = () => jumpTo(noaa);
      c.addEventListener('click', go);
      c.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
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

  /* ---------- tuning sound ---------- */

  // Receiver hiss that quiets as you tune onto something, plus a detent click. It only ever
  // runs while a finger or cursor is on the rail, and nothing is built until the first
  // gesture, so nobody gets a noise they did not ask for.
  const AUDIO = { ctx: null, gain: null, on: localStorage.getItem('aw.audio') !== '0' };

  function audio() {
    if (!AUDIO.on) return null;
    if (AUDIO.ctx) return AUDIO.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      const ctx = new Ctx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      // Band-limited so it sounds like a squelch tail rather than a burst of static.
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(bp).connect(g).connect(ctx.destination);
      src.start();
      AUDIO.ctx = ctx;
      AUDIO.gain = g;
      return ctx;
    } catch (e) { return null; }
  }

  // Loud enough to hear on a phone speaker outdoors, which is where this gets used. The
  // earlier value was about 26 dB down and inaudible anywhere but a quiet room.
  const HISS_PEAK = 0.15;

  function hiss(level) {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    AUDIO.gain.gain.setTargetAtTime(level * HISS_PEAK, ctx.currentTime, 0.04);
  }

  // A squelch tail rather than a cut, so even a quick tap on the rail is something you hear.
  // Cutting instantly meant a click gave the hiss about 50 ms to rise and then killed it.
  function silence(tau) {
    if (AUDIO.ctx && AUDIO.gain) AUDIO.gain.gain.setTargetAtTime(0, AUDIO.ctx.currentTime, tau || 0.11);
  }

  function tick(strong) {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = strong ? 880 : 1720;
    g.gain.setValueAtTime(strong ? 0.1 : 0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (strong ? 0.05 : 0.022));
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.07);
  }

  /* ---------- spectrum ruler ---------- */

  // Where the listed frequencies actually sit across the radio's tuning range. Log scale,
  // because 0.5–999 MHz is three decades and a linear rail would bunch everything at the end.
  const LO = 0.5, HI = 999;
  const SPAN = Math.log10(HI / LO);
  const pos = f => (Math.log10(f) - Math.log10(LO)) / SPAN;
  const BANDS = [{ n: 'HF', a: LO, b: 30 }, { n: 'VHF', a: 30, b: 300 }, { n: 'UHF', a: 300, b: HI }];
  const inBand = (f, b) => f >= b.a && (b.b === HI ? f <= b.b : f < b.b);

  function renderRuler(rows) {
    const box = $('#ruler');
    box.textContent = '';
    silence();
    const pts = rows.filter(s => s.f >= LO && s.f <= HI).sort((a, b) => a.f - b.f);
    box.hidden = pts.length < 2;
    if (box.hidden) return;
    const pro = isPro();

    const cap = el('div', 'ru-cap');
    cap.append(el('span', 'ru-t', t('spectrum')));
    const hint = el('span', 'ru-h', pro ? t('wheelHint') : t('rulerHint'));
    cap.append(hint);
    if (pro) cap.append(soundBtn());
    box.append(cap);

    const rail = el('button', 'ru-rail');
    rail.type = 'button';
    rail.setAttribute('aria-label', pro ? t('wheelHint') : t('rulerHint'));

    BANDS.forEach(b => {
      const seg = el('span', 'ru-band');
      seg.style.left = pct(pos(b.a));
      seg.style.width = pct(pos(b.b) - pos(b.a));
      const n = pts.filter(s => inBand(s.f, b)).length;
      seg.append(el('em', null, pro ? `${b.n} ${n}` : b.n));
      rail.append(seg);
    });

    const ticks = new Map();
    pts.forEach(s => {
      const k = el('span', 'ru-k' + (s.dig ? ' k-dig' : s.avoid ? ' k-avd' : ''));
      k.style.left = pct(pos(s.f));
      ticks.set(s.k, k);
      rail.append(k);
    });

    const cur = el('span', 'ru-cur'), out = el('span', 'ru-out');
    rail.append(cur, out);

    const freqAt = clientX => {
      const r = rail.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      return LO * Math.pow(HI / LO, x);
    };
    // Nearest by position on the rail, not by ratio, so "nearest" means what your eye means.
    const nearest = f => pts.reduce((best, s) =>
      Math.abs(pos(s.f) - pos(f)) < Math.abs(pos(best.f) - pos(f)) ? s : best, pts[0]);

    if (pro) tuneWheel(rail, pts, cur, out, hint, ticks, freqAt, nearest);
    else tapRail(rail, cur, out, freqAt, nearest);

    box.append(rail);

    const ax = el('div', 'ru-ax');
    [1, 10, 100, 999].forEach((f, i) => {
      const l = el('span', null, i === 3 ? f + ' MHz' : String(f));
      l.style.left = pct(pos(f));
      ax.append(l);
    });
    box.append(ax);
  }

  // Simple mode: the rail reads out the nearest entry and a tap jumps to it.
  function tapRail(rail, cur, out, freqAt, nearest) {
    const show = e => {
      const s = nearest(freqAt(e.clientX));
      cur.style.left = pct(pos(s.f));
      // Keep the readout clear of the rounded ends so it is never half clipped.
      out.style.left = pct(Math.min(.92, Math.max(.08, pos(s.f))));
      out.textContent = fmtFreq(s.f) + ' ' + unit(s.f);
      rail.classList.add('live');
    };
    rail.addEventListener('pointermove', show);
    rail.addEventListener('pointerleave', () => rail.classList.remove('live'));
    // A finger never leaves the rail the way a cursor does, so clear the readout on lift.
    rail.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse') setTimeout(() => rail.classList.remove('live'), 700);
    });
    rail.addEventListener('pointercancel', () => rail.classList.remove('live'));
    rail.addEventListener('click', e => jumpTo(nearest(freqAt(e.clientX))));
  }

  // Pro mode: the same rail becomes a tuning knob. Sweeping it is continuous, entries are
  // detents you can feel and hear, and the hiss drops away as you settle onto one — which is
  // what tuning a real receiver is like, and means you can find something without looking.
  function tuneWheel(rail, pts, cur, out, hint, ticks, freqAt, nearest) {
    const idle = t('wheelHint');
    const band = f => (BANDS.find(b => inBand(f, b)) || BANDS[0]).n;
    let held = null, lockedK = null, lastBand = null, kIdx = 0, lastTick = 0;

    // How wide a detent is, per entry, in pixels. A fixed width does not work: where the
    // band is crowded the entries sit a few pixels apart, so every point on the rail was
    // inside some detent — the hiss never came back and the clicks ran together into a wall,
    // precisely in the stretch you spend the most time tuning. Half the gap to the closest
    // neighbour keeps each entry findable and leaves air between them. Measured lazily
    // because the rail's width is not known until it is laid out, and changes on resize.
    let grip = null, gripW = 0;
    function grips() {
      const w = rail.clientWidth;
      if (grip && w === gripW) return grip;
      gripW = w;
      grip = new Map();
      pts.forEach((s, i) => {
        let gap = Infinity;
        if (i > 0) gap = Math.min(gap, (pos(s.f) - pos(pts[i - 1].f)) * w);
        if (i < pts.length - 1) gap = Math.min(gap, (pos(pts[i + 1].f) - pos(s.f)) * w);
        grip.set(s.k, Math.max(2.5, Math.min(14, gap / 2)));
      });
      return grip;
    }

    function show(f, quiet) {
      const near = nearest(f);
      // A detent is a distance on screen, not a ratio, because it has to match what a thumb
      // can actually resolve.
      const away = Math.abs(pos(f) - pos(near.f)) * rail.clientWidth;
      const lock = Math.max(0, 1 - away / grips().get(near.k));
      const on = lock > .5 ? near : null;
      // Inside a detent the knob snaps, the way a real one does. The log scale is steep
      // enough that 15px can span a third of an octave, so a raw readout would disagree
      // with the entry the rail says it is locked to.
      const at = on ? on.f : f;

      cur.style.left = pct(pos(at));
      out.style.left = pct(Math.min(.92, Math.max(.08, pos(at))));
      out.textContent = fmtFreq(at) + ' ' + unit(at);
      rail.classList.add('live');
      rail.classList.toggle('lock', !!on);

      if (on && on.k !== lockedK) {
        lockedK = on.k;
        ticks.forEach((n, k) => n.classList.toggle('k-on', k === on.k));
        // Dense clusters would otherwise fire dozens of clicks a second.
        const now = performance.now();
        if (!quiet && now - lastTick > 45) { tick(false); buzz(6); lastTick = now; }
      } else if (!on && lockedK !== null) {
        lockedK = null;
        ticks.forEach(n => n.classList.remove('k-on'));
      }

      const b = band(f);
      if (lastBand && b !== lastBand && !quiet) { tick(true); buzz(17); }
      lastBand = b;

      hint.textContent = on
        ? `${fmtFreq(on.f)} ${unit(on.f)} · ${LANG === 'zh' ? (on.z || on.n) : on.n}`
        : `${b} · ${fmtFreq(f)} ${unit(f)}`;
      hint.classList.add('ru-live');

      // Never fully silent while you are actually holding the rail: a receiver sitting on a
      // quiet channel still hisses, and going mute made the knob feel dead. Landing on an
      // entry still drops it by about 10 dB, which is the part that tells you you are on it.
      if (!quiet) hiss(0.3 + 0.7 * (1 - lock));
      return near;
    }

    function rest(delay) {
      silence(0.3);
      setTimeout(() => {
        rail.classList.remove('live', 'lock');
        ticks.forEach(n => n.classList.remove('k-on'));
        hint.textContent = idle;
        hint.classList.remove('ru-live');
        lockedK = null;
        lastBand = null;
      }, delay);
    }

    rail.addEventListener('pointerdown', e => {
      // Without this a drag turns into a text selection, which also auto-scrolls the page.
      // It also suppresses the focus ring, which is right: pointer users do not need it and
      // keyboard users still reach the rail with Tab.
      e.preventDefault();
      held = e.pointerId;
      try { rail.setPointerCapture(e.pointerId); } catch (err) {}
      document.documentElement.classList.add('tuning');
      lastBand = null;
      show(freqAt(e.clientX));
    });
    rail.addEventListener('pointermove', e => {
      if (held === null) { if (e.pointerType === 'mouse') show(freqAt(e.clientX), true); return; }
      show(freqAt(e.clientX));
    });

    const lift = e => {
      if (held === null) return;
      held = null;
      try { rail.releasePointerCapture(e.pointerId); } catch (err) {}
      document.documentElement.classList.remove('tuning');
      jumpTo(nearest(freqAt(e.clientX)));
      rest(e.pointerType === 'mouse' ? 0 : 900);
    };
    rail.addEventListener('pointerup', lift);
    rail.addEventListener('pointercancel', lift);
    rail.addEventListener('pointerleave', () => { if (held === null) rest(0); });

    // The knob works from the keyboard too: step entry by entry along the band.
    rail.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      kIdx = e.key === 'Home' ? 0
        : e.key === 'End' ? pts.length - 1
        : Math.min(pts.length - 1, Math.max(0, kIdx + step));
      const s = pts[kIdx];
      show(s.f, true);
      tick(false);
      jumpTo(s);
    });
  }

  function soundBtn() {
    const b = el('button', 'ru-mute');
    b.type = 'button';
    const draw = () => {
      b.setAttribute('aria-pressed', String(AUDIO.on));
      b.setAttribute('aria-label', t('sound'));
      b.title = t('sound');
      b.innerHTML = AUDIO.on
        ? '<svg viewBox="0 0 24 24"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4z"/><path d="M15.6 9.4a4 4 0 0 1 0 5.2"/><path d="M18.4 6.9a7.6 7.6 0 0 1 0 10.2"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4z"/><path d="M16 9.8l4.6 4.4M20.6 9.8L16 14.2"/></svg>';
    };
    draw();
    b.addEventListener('click', e => {
      e.stopPropagation();
      AUDIO.on = !AUDIO.on;
      localStorage.setItem('aw.audio', AUDIO.on ? '1' : '0');
      if (!AUDIO.on) silence();
      draw();
      buzz(8);
    });
    return b;
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

  /* ---------- pro detail ---------- */

  // Amateur allocations by wavelength, the union of the US and Chinese band plans. Only the
  // name is shown, because a ham reads "2 m" faster than "144–148 MHz".
  const HAM = [
    [1.8, 2.0, '160 m'], [3.5, 4.0, '80 m'], [5.3, 5.45, '60 m'], [7.0, 7.3, '40 m'],
    [10.1, 10.15, '30 m'], [14.0, 14.35, '20 m'], [18.068, 18.168, '17 m'],
    [21.0, 21.45, '15 m'], [24.89, 24.99, '12 m'], [28.0, 29.7, '10 m'], [50, 54, '6 m'],
    [144, 148, '2 m'], [219, 225, '1.25 m'], [420, 450, '70 cm'], [902, 928, '33 cm']
  ];
  const hamBand = f => (HAM.find(b => f >= b[0] && f <= b[1]) || [])[2];

  // A quarter wave in free space. Standing on a ridge wondering whether the stock rubber
  // duck is hopeless, this is the number that answers it.
  function quarterWave(f) {
    const m = 74.9481 / f;
    return m >= 1 ? `${m < 10 ? m.toFixed(2) : Math.round(m)} m` : `${Math.round(m * 100)} cm`;
  }

  const offsetMHz = o => parseFloat(String(o).replace(/[−–]/g, '-'));

  // Only entries tied to a real transmitter site can honestly claim a distance. That is the
  // airports for now — an approach sector or an FM dial position has no single place, and a
  // made-up number would be worse than none.
  function siteOf(s) {
    return (PLACES && s.ref && PLACES.air[s.ref]) || null;
  }

  function bearing(a1, o1, a2, o2) {
    const r = Math.PI / 180;
    const dL = (o2 - o1) * r;
    const y = Math.sin(dL) * Math.cos(a2 * r);
    const x = Math.cos(a1 * r) * Math.sin(a2 * r) - Math.sin(a1 * r) * Math.cos(a2 * r) * Math.cos(dL);
    return (Math.atan2(y, x) / r + 360) % 360;
  }

  const compass = deg => t('compass')[Math.round(deg / 45) % 8];
  const fmtDist = km => (km < 10 ? km.toFixed(1) : String(Math.round(km))) + ' ' + t('km');

  function distBit(s) {
    const site = siteOf(s);
    if (!site || POS.lat == null) return null;
    const km = haversine(POS.lat, POS.lon, site[0], site[1]);
    return fmtDist(km) + ' ' + compass(bearing(POS.lat, POS.lon, site[0], site[1]));
  }

  // The line under a pro entry, always visible. Kept to what helps while you are scanning a
  // list: where the thing is, and which band it sits in. The repeater input, the antenna
  // lengths and the rest are reference figures you want when you are actually programming
  // the radio, and they now live in the detail panel a tap away — printing them on every
  // row made the list noisy and said the same thing twice once the panel existed.
  function proLine(s) {
    const bits = [];
    const near = distBit(s);
    if (near) bits.push(near);
    const band = hamBand(s.f);
    if (band) bits.push(band);
    if (!bits.length) return null;

    const box = el('div', 'px');
    bits.forEach(x => box.append(el('span', 'px-i', x)));
    return box;
  }

  /* ---------- pro: the detail panel ---------- */

  // What the radio should be set to. The VX-6R has three filters and picking the wrong one
  // is the commonest reason a frequency "does not work" — WFM on a narrow channel sounds
  // like nothing at all.
  // Channel spacing depends on the service, not only the mode: 8.33 kHz is an airband
  // convention and saying it about a medium-wave broadcaster is simply wrong.
  function modeNote(s) {
    if (s.m === 'AM') {
      if (s.f >= 108 && s.f <= 137) return 'AM · ' + t('dAir');
      if (s.f < 1.8) return 'AM · ' + t('dMw');
      return 'AM · ' + t('dSw');
    }
    if (s.m === 'NFM') return 'NFM · 12.5 kHz';
    if (s.m === 'FM') return 'FM · 25 kHz';
    if (s.m === 'WFM') return 'WFM · ' + t('dBcast');
    return s.m;
  }

  function detailRows(s) {
    const out = [];
    const add = (k, v, note) => { if (v) out.push([k, v, note]); };

    // The odds, spelled out. This is where the sentence behind the bars lives.
    if (s.odds && META.odds && META.odds[s.odds]) {
      const o = META.odds[s.odds];
      add(t('dOdds'), LANG === 'zh' ? o.z : o.n, LANG === 'zh' ? o.dz : o.d);
    }

    if (s.m) add(t('dMode'), modeNote(s), null);

    // Repeaters: the listed frequency is the output. Transmitting needs the input and the
    // tone, and no radio shows you either.
    if (s.o) {
      const input = s.f + offsetMHz(s.o);
      if (isFinite(input) && input > 0) {
        add(t('dInput'), `${fmtFreq(input)} ${unit(input)}`, `${t('dShift')} ${s.o} MHz`);
      }
    }
    if (s.t) add(t('dTone'), isDcs(s.t) ? 'DCS ' + (s.t.match(/\d+/) || [''])[0] : 'PL ' + s.t, null);

    // Broadcast: licensed power says how far it reaches, and who holds the licence says more
    // about what you will hear than any format label we could invent.
    if (s.kw) add(t('dPower'), s.kw >= 1 ? `${s.kw} kW` : `${Math.round(s.kw * 1000)} W`,
      s.kw < 1 ? t('dLocal') : null);
    if (s.by) add(t('dLicensee'), s.by, null);

    // The transmitter site, where one entry means one place on the ground.
    const site = siteOf(s);
    if (site) {
      const near = distBit(s);
      add(t('dSite'), near || `${site[0].toFixed(2)}, ${site[1].toFixed(2)}`,
        site[2] ? `${t('dElev')} ${Math.round(site[2])} m` : null);
    }

    // Only where somebody might actually cut one. A quarter wave at 740 kHz is a hundred
    // metres of wire, which is a fact but not advice.
    if (s.f >= 30) add(t('dAnt'), `λ/4 ${quarterWave(s.f)} · λ/2 ${quarterWave(s.f / 2)}`, null);

    const band = hamBand(s.f);
    if (band) add(t('dBand'), band, null);

    if (s.tag) add(t('dMem'), s.tag, t('dMemNote'));

    // Provenance. The confidence note used to be a badge on the row; it belongs here now
    // that the bars carry one merged indicator, because it explains the bars rather than
    // competing with them.
    const where = s.src === 'fcc' ? t('dSrcFcc') : s.src === 'oa' ? t('dSrcOa') : t('dSrcHand');
    const conf = s.conf && META.confidence[s.conf] ? META.confidence[s.conf] : null;
    add(t('dSource'), where, conf ? (LANG === 'zh' ? conf.dz : conf.d) : null);

    return out;
  }

  function detailPanel(s) {
    const box = el('div', 'dx');

    const grid = el('div', 'dx-g');
    for (const [k, v, note] of detailRows(s)) {
      const cell = el('div', 'dx-r');
      cell.append(el('div', 'dx-k', k));
      cell.append(el('div', 'dx-v', v));
      if (note) cell.append(el('div', 'dx-n', note));
      grid.append(cell);
    }
    box.append(grid);

    // Copying is still the thing you came for; in pro mode it moves in here so that tapping
    // a row can open the detail instead.
    const act = el('div', 'dx-a');
    const cp = el('button', 'dx-b');
    cp.type = 'button';
    cp.textContent = `${t('dCopy')} ${fmtFreq(s.f)} ${unit(s.f)}`;
    cp.addEventListener('click', e => {
      e.stopPropagation();
      const txt = fmtFreq(s.f) + ' ' + unit(s.f);
      copy(txt);
      buzz(14);
      toast(t('copied') + ' · ' + txt);
    });
    act.append(cp);
    box.append(act);
    return box;
  }

  // One indicator answering the only question that matters before you dial something in:
  // will I hear anything? It folds coverage, how much of the time the thing transmits, and
  // how sure we are of the frequency into three levels — see scripts/make-odds.mjs. Three
  // bars, because that reads at a glance in sunlight and needs no legend; the words are on
  // the bar's label for anyone who wants them, and in the detail panel in pro mode.
  function oddsTag(s) {
    const lv = s.odds;
    if (!lv || !META.odds || !META.odds[lv]) return null;
    const meta = META.odds[lv];
    const word = LANG === 'zh' ? meta.z : meta.n;

    const box = el('span', 'od od-' + lv);
    box.title = `${LANG === 'zh' ? META.odds.label.z : META.odds.label.n} — ${word}`;
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', box.title);
    const bars = el('span', 'od-b');
    for (let i = 1; i <= 3; i++) bars.append(el('i', i <= lv ? 'on' : null));
    box.append(bars);
    if (isPro()) box.append(el('span', 'od-w', word));
    return box;
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
    if (isPro() && s.f > 0) {
      const px = proLine(s);
      if (px) nm.append(px);
    }
    b.append(nm);

    const m = el('div', 'meta');
    if (s.avoid) m.append(el('span', 'tag tag-avd', t('avoid')));
    if (s.m) m.append(el('span', 'tag ' + (s.dig ? 'tag-dig' : 'tag-m'), s.m));
    if (s.o) m.append(el('span', 'tag tag-o', s.o));
    if (s.t) m.append(el('span', 'tag tag-t',
      isDcs(s.t) ? 'DCS ' + (s.t.match(/\d+/) || [''])[0] : 'PL ' + s.t));
    const od = oddsTag(s);
    if (od) m.append(od);
    // Something has to say the row opens. Without an affordance the detail panel is a
    // feature only the person who built it knows about.
    if (isPro() && s.f > 0) {
      const chev = el('span', 'dx-c');
      chev.setAttribute('aria-hidden', 'true');
      chev.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>';
      m.append(chev);
    }
    b.append(m);

    // In pro mode the row opens its detail, and copying moves into the panel. In simple mode
    // a tap copies, which is the whole interaction and should stay that way. Modes are for
    // exactly this: the same list, answering a different question.
    if (isPro() && s.f > 0) {
      b.setAttribute('aria-expanded', 'false');
      b.title = t('proHint');
      b.addEventListener('click', () => toggleDetail(b, s));
    } else {
      b.addEventListener('click', () => {
        if (s.f <= 0) { toast(t('verify')); return; }
        const txt = fmtFreq(s.f) + ' ' + unit(s.f);
        copy(txt);
        flash(b);
        buzz(14);
        toast(t('copied') + ' · ' + txt);
      });
    }
    return b;
  }

  function toggleDetail(b, s) {
    const open = b.nextElementSibling && b.nextElementSibling.classList.contains('dx');
    if (open) {
      b.nextElementSibling.remove();
      b.setAttribute('aria-expanded', 'false');
      b.classList.remove('open');
      buzz(6);
      return;
    }
    const panel = detailPanel(s);
    b.after(panel);
    b.setAttribute('aria-expanded', 'true');
    b.classList.add('open');
    buzz(10);
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
      const { latitude: la, longitude: lo } = pos.coords;
      POS.lat = la;
      POS.lon = lo;
      try {
        localStorage.setItem('aw.pos', JSON.stringify({ lat: la, lon: lo, at: Date.now() }));
      } catch (e) {}

      let best = null, bd = Infinity;
      META.regions.filter(r => r.lat != null).forEach(r => {
        const d = haversine(la, lo, r.lat, r.lon);
        if (d < bd) { bd = d; best = r; }
      });
      if (!best) { label.textContent = t('near'); toast(t('nogeo')); return; }
      // Rebuilding the strip relabels the chip, and selecting repaints the rows so the
      // distances appear without a second tap.
        buildRegionTabs();
        select(best.id, true);
        // Explicitly, rather than relying on select() to repaint: if you are already on the
        // nearest region that call changes nothing, and the passes would never appear.
        renderSky();
      toast(t('geoOk')(L(best, { n: 'n', z: 'z' })) + ` · ${fmtDist(bd)}`);
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
      const typing = document.activeElement === q;
      if (e.key === '/' && !typing) { e.preventDefault(); q.focus(); q.select(); }
      else if (e.key === 'Escape' && typing) { q.value = ''; Q = ''; clear.hidden = true; render(); q.blur(); }
      else if ((e.key === 'p' || e.key === 'P') && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleMode();
      }
    });

    $('#btn-mode').addEventListener('click', toggleMode);

    $('#btn-lang').addEventListener('click', () => {
      LANG = LANG === 'zh' ? 'en' : 'zh';
      localStorage.setItem('aw.lang', LANG);
      document.documentElement.dataset.lang = LANG;
        paint(() => {
          applyStatic();
          buildCountry();
          buildView();
          buildRegionTabs();
          buildCatTabs();
          renderIntro();
          renderNow();
          renderSky();
          render();
        });
    });

      const view = $('#view');
      $('#btn-view').addEventListener('click', () => viewMenu(!view.classList.contains('open')));
      document.addEventListener('pointerdown', e => {
        if (view.classList.contains('open') && !view.contains(e.target)) viewMenu(false);
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && view.classList.contains('open')) {
          viewMenu(false);
          $('#btn-view').focus();
        }
      });
      // A wake lock is dropped when the tab goes to the background; take it again on return.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && wantAwake() && !AWAKE) holdScreen(true);
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
