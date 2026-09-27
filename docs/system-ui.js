/* RegRader 앱 동작 (system.css 와 짝)
 *
 *  - 아이콘: 한 벌의 선 아이콘(SVG)을 쓴다. 화면에 나오는 이모지는 대응하는 아이콘으로 바꾸고, 짝이 없으면 뺀다.
 *    window.rrIcon('name') 으로 다른 스크립트도 같은 아이콘을 쓸 수 있다.
 *  - 앱 틀: 앱 바 제목·경로, 좁은 화면의 서랍 메뉴, 사이드바 아래 상태
 *  - 화면 전환: 탭을 바꾸면 내용이 위/아래에서 부드럽게 들어오고, 주소(#quarterly)가 바뀌어 뒤로 가기가 된다
 *  - 시작 화면: 데이터가 준비되면 걷힌다
 *  - 차트 기본값: 글꼴·색·툴팁을 앱과 맞춘다
 * watch.html · history.html 에서도 불러 아이콘만 쓴다 (앱 틀이 없으면 그 부분은 건너뛴다).
 */
(function () {
  'use strict';

  /* ---------- 아이콘 (Lucide 계열 선 아이콘, 24x24) ---------- */
  var P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    check: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    slides: '<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    filetext: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/>',
    fileplus: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M9 15h6M12 18v-6"/>',
    fileminus: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M9 15h6"/>',
    sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M8 13h2M14 13h2M8 17h2M14 17h2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    gavel: '<path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    landmark: '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'
  };
  function rrIcon(name, cls) {
    var n = P[name] ? name : 'info';
    return '<svg class="ri' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + P[n] + '</svg>';
  }
  window.rrIcon = rrIcon;

  /* 이모지 → 아이콘 (짝이 없는 이모지는 뺀다) */
  var EMO = {
    '🏠': 'dashboard', '📅': 'calendar', '📆': 'calendar', '🗓': 'calendar', '🏢': 'briefcase', '🏭': 'briefcase', '📚': 'book', '📖': 'book',
    '✅': 'check', '☑': 'check', '⏰': 'clock', '⏳': 'clock', '⌛': 'clock', '⏱': 'clock', '🕒': 'clock', '🗂': 'history', '🔄': 'refresh',
    '📊': 'chart', '📉': 'chart', '📈': 'trend', '🎯': 'target', '🧭': 'target', '⚠': 'alert', '🚨': 'alert', '❗': 'alert', '🔥': 'alert',
    '📑': 'slides', '📄': 'file', '📃': 'file', '📜': 'file', '🧾': 'file', '📎': 'file', '📥': 'download', '📤': 'download', '⬇': 'download',
    '📧': 'mail', '✉': 'mail', '📨': 'mail', '📩': 'mail', '🔐': 'login', '🔒': 'login', '🔑': 'login', '🔓': 'login',
    '🔨': 'gavel', '💰': 'banknote', '💸': 'banknote', '💵': 'banknote', '⚖': 'scale', '⛔': 'ban', '🚫': 'ban',
    '📌': 'filetext', '📍': 'pin', '📝': 'edit', '✏': 'edit', '🆕': 'fileplus', '🗑': 'fileminus',
    '🔍': 'search', '🔎': 'search', '📋': 'clipboard', '👥': 'users', '👤': 'user', '🧑': 'user', 'ℹ': 'info', '💡': 'info', '❓': 'info',
    '🔔': 'bell', '🔗': 'link', '👀': 'eye', '👁': 'eye', '📦': 'layers', '🧩': 'layers', '🗺': 'layers', '🏷': 'tag', '⭐': 'star', '✨': 'spark',
    '🏛': 'landmark', '⚙': 'spark', '📮': 'send', '🚀': 'send', '👔': 'briefcase', '💼': 'briefcase', '🛡': 'shield', '🔰': 'shield', '⛑': 'shield', '⛏': 'briefcase',
    '🌿': 'leaf', '🌳': 'leaf', '♻': 'leaf', '🧪': 'alert', '⚡': 'spark', '🏗': 'briefcase', '🚧': 'alert',
    '🌱': 'calendar', '☀': 'calendar', '🍂': 'calendar', '❄': 'calendar'
  };
  var BMP = '⚠⏰⏳⌛⏱⛔✅☀❄⚖✉⭐❗❓⚙✏☑✨⬇ℹ♻⚡⛑⛏';
  var RE = new RegExp('(?:[\\u{1F000}-\\u{1FAFF}]|[' + BMP + '])\\uFE0F?(?:\\u200D(?:[\\u{1F000}-\\u{1FAFF}]|[' + BMP + '])\\uFE0F?)*[ \\u00a0]?', 'gu');
  var RE1 = new RegExp(RE.source, 'u');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  function base(e) { return e.replace(/[️‍\s ]/g, '').slice(0, 2); }
  function iconFor(e) {
    var b = base(e);
    return EMO[b] || EMO[Array.from(b)[0]] || '';
  }
  function fixText(t) {
    var p = t.parentNode;
    if (!p || p.nodeType !== 1 || SKIP[p.nodeName] || p.closest('svg, [contenteditable="true"], [data-keep-emoji]')) return;
    var s = t.nodeValue;
    if (!s || !RE1.test(s)) return;
    if (p.nodeName === 'OPTION' || p.nodeName === 'TITLE') { t.nodeValue = s.replace(RE, ''); return; }
    var solo = !s.replace(RE, '').trim() && p.childNodes.length === 1 && !p.classList.contains('tab-icon') && p.children.length === 0;
    var frag = document.createDocumentFragment(), last = 0, m, put = 0;
    RE.lastIndex = 0;
    while ((m = RE.exec(s))) {
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      var nm = iconFor(m[0]);
      if (nm) {
        var w = document.createElement('span');
        w.innerHTML = rrIcon(nm, solo ? '' : 'ri-in');
        var svg = w.firstChild;
        frag.appendChild(svg);
        put++;
        if (m[0].slice(-1) === ' ' || m[0].slice(-1) === ' ') frag.appendChild(document.createTextNode(' '));
      }
      last = m.index + m[0].length;
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    p.replaceChild(frag, t);
    if (solo) p.classList.add(put ? 'ri-solo' : 'ri-empty');
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return RE1.test(n.nodeValue) ? 1 : 3; } });
    var list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fixText);
    if (root.querySelectorAll) root.querySelectorAll('[title]').forEach(function (el) {
      var tt = el.getAttribute('title');
      if (tt && RE1.test(tt)) el.setAttribute('title', tt.replace(RE, '').trim());
    });
  }
  window.rrScanIcons = scan;

  /* ---------- 차트 기본값 ---------- */
  function dark() { return false; }   /* 밝은 화면 고정 */
  if (window.Chart && Chart.defaults) {
    try {
      var d = Chart.defaults;
      d.font.family = "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      d.font.size = 12;
      d.color = dark() ? '#939bab' : '#6b7280';
      d.borderColor = dark() ? '#232935' : '#eef1f5';
      d.animation.duration = 550;
      d.animation.easing = 'easeOutQuart';
      var tp = d.plugins.tooltip;
      tp.backgroundColor = dark() ? '#eef1f6' : '#111827';
      tp.titleColor = dark() ? '#111827' : '#fff';
      tp.bodyColor = dark() ? '#374151' : '#e5e7eb';
      tp.padding = 10;
      tp.cornerRadius = 8;
      tp.boxPadding = 4;
      tp.titleFont = { weight: '700' };
      tp.displayColors = true;
      tp.usePointStyle = true;
      d.plugins.legend.labels.usePointStyle = true;
      d.plugins.legend.labels.boxWidth = 8;
      d.plugins.legend.labels.boxHeight = 8;
    } catch (e) {}
  }

  /* ---------- 토스트 알림 ---------- */
  window.rrToast = function (msg, ms) {
    var wrap = document.querySelector('.rr-toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'rr-toast-wrap'; document.body.appendChild(wrap); }
    var t = document.createElement('div');
    t.className = 'rr-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = rrIcon('ok') + '<span></span>';
    t.lastChild.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 220); }, ms || 2600);
  };

  /* ---------- 앱 틀 ---------- */
  var TABS = {
    overview: ['현황', '종합 현황', 'dashboard'],
    quarterly: ['현황', '분기별 개정 현황', 'calendar'],
    business: ['현황', '직무별 개정 현황', 'briefcase'],
    lawregistry: ['현황', '적용법규', 'book'],
    tracker: ['알림 · 기록', '대응 현황', 'check'],
    watch: ['알림 · 기록', '시행 임박', 'clock'],
    history: ['알림 · 기록', '업데이트 내역', 'history']
  };
  var ORDER = Object.keys(TABS);
  var cur = 'overview';
  function setTitle(tab) {
    var t = TABS[tab];
    if (!t) return;
    var h = document.getElementById('rr-page-title'), c = document.getElementById('rr-crumb-sec');
    if (h) h.textContent = t[1];
    if (c) c.textContent = t[0];
    document.title = t[1] + ' · RegRader';
  }
  function nav(open) { document.body.classList.toggle('rr-nav-open', !!open); }
  window.rrNav = nav;

  function shell() {
    var navEl = document.querySelector('.main-tab-navigation');
    if (!navEl) return false;
    /* 메뉴 아이콘 */
    navEl.querySelectorAll('.main-tab[data-tab]').forEach(function (t) {
      var ic = t.querySelector('.tab-icon'), def = TABS[t.dataset.tab];
      if (ic && def) ic.innerHTML = rrIcon(def[2]);
    });
    /* 좁은 화면 서랍의 바깥 */
    if (!document.querySelector('.rr-scrim')) {
      var sc = document.createElement('div');
      sc.className = 'rr-scrim';
      sc.addEventListener('click', function () { nav(false); });
      document.body.appendChild(sc);
    }
    navEl.addEventListener('click', function (e) { if (e.target.closest('.main-tab')) nav(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') nav(false); });
    /* 앱 바의 짧은 업데이트 시각 */
    var ts = document.getElementById('timestamp'), sh = document.getElementById('rr-ts-short');
    if (ts && sh) {
      var put = function () {
        var s = (ts.textContent || '').trim();
        sh.textContent = /로딩/.test(s) ? '확인 중' : s.replace(/^\d{4}\.\s*/, '').replace(/:\d{2}$/, '') || '–';
      };
      put();
      new MutationObserver(put).observe(ts, { childList: true, characterData: true, subtree: true });
    }
    return true;
  }

  /* 탭 전환: 방향에 맞춘 움직임 + 주소 */
  function wrapTabs() {
    var orig = window.switchMainTab;
    if (typeof orig !== 'function' || orig.__rrSys) return;
    var wrapped = function (name, opt) {
      if (!TABS[name]) return orig.apply(this, arguments);
      var tc = document.querySelector('.tab-content');
      if (tc) tc.setAttribute('data-dir', ORDER.indexOf(name) < ORDER.indexOf(cur) ? 'up' : 'down');
      var r = orig.call(this, name);
      if (name !== cur) {
        cur = name;
        setTitle(name);
        if (!(opt && opt.fromHistory)) {
          try { history.pushState({ rrTab: name }, '', location.pathname + location.search + (name === 'overview' ? '' : '#' + name)); } catch (e) {}
        }
      }
      return r;
    };
    wrapped.__rrSys = true;
    window.switchMainTab = wrapped;
    window.addEventListener('popstate', function () {
      var t = (location.hash || '').slice(1) || 'overview';
      if (TABS[t] && t !== cur) window.switchMainTab(t, { fromHistory: true });
    });
    setTitle('overview');
  }
  /* 주소에 탭이 있으면(#quarterly) 데이터가 준비된 뒤 그 탭을 연다 */
  function openFromHash() {
    var t = (location.hash || '').slice(1);
    if (TABS[t] && t !== 'overview' && typeof window.switchMainTab === 'function') window.switchMainTab(t, { fromHistory: true });
  }

  /* 시행 임박 · 업데이트 내역 링크는 앱 안의 탭으로 */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !document.querySelector('.main-tab-navigation') || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var h = a.getAttribute('href') || '';
    var tab = /(^|\/)watch\.html(\?|#|$)/.test(h) ? 'watch' : /(^|\/)history\.html(\?|#|$)/.test(h) ? 'history' : '';
    if (!tab || typeof window.switchMainTab !== 'function') return;
    e.preventDefault();
    window.switchMainTab(tab);
  }, true);

  /* 법령 상세 패널: 닫을 때도 밀려 들어가게 */
  function wrapClose() {
    var oc = window.closeLawModal;
    if (typeof oc !== 'function' || oc.__rrSys) return;
    var w = function () {
      var m = document.getElementById('law-modal');
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!m || !m.classList.contains('show') || reduce || document.hidden) return oc.apply(this, arguments);
      var self = this, args = arguments;
      m.classList.add('rr-closing');
      setTimeout(function () { m.classList.remove('rr-closing'); oc.apply(self, args); }, 190);
    };
    w.__rrSys = true;
    window.closeLawModal = w;
  }

  /* 시작 화면 */
  function boot() {
    var b = document.getElementById('rr-boot');
    if (!b) { document.body.classList.add('rr-ready'); openFromHash(); return; }
    var t0 = Date.now();
    (function wait() {
      var ready = (window.__rrItems && window.__rrItems.length) || Date.now() - t0 > 6000;
      if (!ready) return setTimeout(wait, 80);
      document.body.classList.add('rr-ready');
      openFromHash();
      b.classList.add('done');
      setTimeout(function () { b.remove(); }, 450);
    })();
  }

  function start() {
    var hasShell = shell();
    scan(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') fixText(m.target);
        else m.addedNodes.forEach(scan);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    if (hasShell) {
      wrapTabs();
      wrapClose();
      boot();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
