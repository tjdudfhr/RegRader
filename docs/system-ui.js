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

  /* 검색창에서 회사 화면으로(또는 되돌아) 넘어온 경우: 시작 화면(로고)을 건너뛰고 앱 틀을 바로 보인다 */
  if (window.top === window) try {
    if (sessionStorage.getItem('rr-soft')) { sessionStorage.removeItem('rr-soft'); document.documentElement.classList.add('rr-soft'); }
  } catch (e) { /* 저장소를 못 쓰면 평소처럼 */ }

  /* ---------- 아이콘 (Lucide 계열 선 아이콘, 24x24) ---------- */
  var P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    check: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
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
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
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
    history: ['알림 · 기록', '업데이트 내역', 'history'],
    intro: ['안내', '시스템 소개', 'slides']
  };

  /* ---------- 기업별 적용법규 검색 (검색창 → 바로 그 회사 화면) ----------
   * 사이드바 맨 위 버튼 · 앱 바 검색 아이콘 · 주소 #pro 로 연다.
   * 검색창에서 회사를 고르면 그 자리에서 판정하고(뒤에 띄워 둔 RegRader Pro 판정 엔진, 손으로 할 때와 같은 함수),
   * 끝나면 그 회사의 RegRader 화면으로 넘어간다 — 앱 바 · 사이드바는 그대로, 본문만 바뀐다 (system.css 의 화면 전환).
   * 검색창을 여는 순간 판정 엔진을 미리 받아 두어 고른 뒤 기다림을 줄인다.
   * 서버판(맥, /rr/)은 예전처럼 Pro 화면을 팝업으로 띄운다. */
  var SERVER = !!window.RR_PRO_URL || /\/rr\//.test(location.pathname);
  var IN_CO = /\/pro\/site\//.test(location.pathname);       // 회사 RegRader 화면(브라우저판) 안
  function proApp() { return IN_CO ? '../' : './pro/'; }     // RegRader Pro 브라우저판
  function coSite() { return IN_CO ? './' : './pro/site/'; } // 회사 RegRader 화면
  function homeUrl() { return IN_CO ? '../../' : './'; }      // 당사 RegRader
  var SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  function escH(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* 다음 화면에서 시작 화면(로고)을 건너뛴다: 같은 사이트 안에서 넘어갈 때 깜빡임 없이 */
  function soft(url) {
    try { sessionStorage.setItem('rr-soft', '1'); } catch (e) { /* 저장소를 못 쓰면 시작 화면이 잠깐 보일 뿐 */ }
    location.href = url;
  }

  /* 최근 본 회사 (이 브라우저) */
  var RECENT = 'rr-pro-recent';
  function recent() { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch (e) { return []; } }
  window.rrProRecent = function (x) {
    if (!x || !x.slug) return;
    var list = recent().filter(function (r) { return r.slug !== x.slug; });
    list.unshift({ slug: x.slug, key: x.key || '', name: x.name || x.slug, laws: x.laws, admin: x.admin, at: x.at || new Date().toISOString().slice(0, 10) });
    try { localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 8))); } catch (e) { /* 못 남겨도 그만 */ }
  };

  /* 판정 엔진: RegRader Pro 화면을 보이지 않게 띄운다 (회사 색인 · 판정 엔진을 한 번만 받는다) */
  var eng = null;
  function engine() {
    if (eng) return eng;
    var f = document.createElement('iframe');
    f.className = 'rr-find-engine';
    f.title = '판정 엔진';
    f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true');
    f.src = proApp() + '?embed=1&warm=1';
    eng = new Promise(function (ok, bad) {
      var t0 = Date.now();
      (function wait() {
        var w = null;
        try { w = f.contentWindow; } catch (e) { w = null; }
        if (w && w.rrProApi && w.rrProAuto) return ok(w);
        if (Date.now() - t0 > 90000) return bad(new Error('판정 엔진을 열지 못했습니다. 인터넷 연결을 확인해 주세요.'));
        setTimeout(wait, 100);
      })();
    });
    eng.catch(function () { eng = null; f.remove(); });
    document.body.appendChild(f);
    return eng;
  }

  var STEPS = ['회사 정보 · 검토 기록 확인', '현행 법률 1,725개 판정', 'RegRader 화면 만들기'];
  var finding = 0;   // 진행 중인 판정 번호 (닫거나 다른 회사를 고르면 앞의 결과는 버린다)

  function finder() {
    var el = document.getElementById('rr-find');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'rr-find';
    el.className = 'rr-find';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '기업별 적용법규 검색');
    el.innerHTML = '<div class="card">' +
      '<label class="in">' + SEARCH_ICON + '<input type="search" placeholder="회사 이름을 입력하세요 (예: 에코프로비엠)" autocomplete="off" spellcheck="false" aria-label="회사 이름">' +
      '<kbd>ESC</kbd></label><div class="body" role="listbox" aria-label="검색 결과"></div>' +
      '<div class="foot"><span>상장사 · 국민연금 가입자 30명 이상 법인 · 회사 이름으로 적용법규를 판정해 그 회사의 개정 모니터링 화면을 엽니다</span>' +
      '<a href="' + proApp() + '" target="_blank" rel="noopener">목록에 없는 회사 · 직접 입력 ↗</a></div></div>';
    var input = el.querySelector('input'), body = el.querySelector('.body'), timer = null, rows = [], at = -1, q0 = '';

    function mark(i) {
      at = i;
      rows.forEach(function (r, k) { r.classList.toggle('on', k === i); if (k === i) r.scrollIntoView({ block: 'nearest' }); });
    }
    function rowHtml(attrs, title, badge, sub, right) {
      return '<button type="button" class="row" role="option" ' + attrs + '><span class="ic">' + SEARCH_ICON + '</span><span class="tx"><b>' + title + '</b>' +
        (badge ? '<em>' + badge + '</em>' : '') + '<small>' + sub + '</small></span>' + (right ? '<span class="rt">' + right + '</span>' : '') + '</button>';
    }
    function paint(html) { body.innerHTML = html; rows = [].slice.call(body.querySelectorAll('.row')); mark(rows.length ? 0 : -1); }
    function idle() {
      var me = new URLSearchParams(location.search).get('company');
      var list = recent().filter(function (r) { return r.slug !== me; }).slice(0, 6);
      var h = '';
      if (IN_CO) h += '<div class="sec">지금 보는 화면</div>' + rowHtml('data-home="1"', '당사 RegRader 화면으로', '', '우리 회사 적용법규(등록부) 기준 화면으로 돌아갑니다', '↩');
      if (list.length) {
        h += '<div class="sec">최근 본 회사 <small>바로 열립니다</small></div>' + list.map(function (r) {
          var n = (r.laws != null ? '법령 ' + Number(r.laws).toLocaleString() + ' · 행정규칙 ' + Number(r.admin || 0).toLocaleString() + ' · ' : '') + (r.at || '') + ' 판정';
          return rowHtml('data-slug="' + escH(r.slug) + '" data-key="' + escH(r.key) + '"', escH(r.name), '', escH(n), '열기');
        }).join('');
      }
      if (!h) h = '<p class="msg">회사 이름을 두 글자 이상 넣으면 바로 찾습니다. 고르면 적용법규를 판정해 그 회사의 RegRader 화면을 엽니다.</p>';
      paint(h);
    }
    function hl(name, q) {
      var e = escH(name), k = escH(q.trim());
      var i = k ? e.indexOf(k) : -1;
      return i < 0 ? e : e.slice(0, i) + '<mark>' + e.slice(i, i + k.length) + '</mark>' + e.slice(i + k.length);
    }
    function search(q) {
      q0 = q;
      if (q.trim().length < 2) return idle();
      if (!rows.length || !body.querySelector('.row[data-pick]')) paint('<p class="msg"><span class="spin"></span>회사 목록을 불러오는 중…</p>');
      engine().then(function (w) { return w.rrProApi.search(q, 8); }).then(function (res) {
        if (q !== q0) return;
        if (!res.length) return paint('<p class="msg">‘' + escH(q) + '’ 에 맞는 회사가 없습니다. 이름을 조금 다르게 넣거나, 아래 ‘직접 입력’으로 판정하세요.</p>');
        paint(res.map(function (c) {
          var badge = c.listedAs ? escH((c.listedAs.market || '상장') + ' ' + (c.listedAs.code || '')) : '';
          var sub = [c.industry && c.industry.name, c.employees ? '국민연금 ' + Number(c.employees).toLocaleString() + '명' : '',
            c.factoryCount ? '공장 ' + c.factoryCount + '곳' : '', (c.address || '').split(' ').slice(0, 2).join(' ')].filter(Boolean).map(escH).join(' · ');
          return rowHtml('data-pick="' + escH(c.key) + '" data-name="' + escH(c.name) + '"', hl(c.name, q), badge, sub, '판정');
        }).join(''));
      }, function (e) {
        if (q === q0) paint('<p class="msg err">' + escH(e.message) + '</p>');
      });
    }
    function progress(name, step, t0) {
      var sec = Math.round((Date.now() - t0) / 1000);
      body.innerHTML = '<div class="run"><div class="co"><span class="spin"></span><b>' + escH(name) + '</b><small>' + sec + '초</small></div><ol>' +
        STEPS.map(function (t, i) { return '<li class="' + (i < step ? 'done' : i === step ? 'now' : '') + '">' + t + '</li>'; }).join('') +
        '</ol><p>처음 한 번은 판정 엔진을 받느라 10~20초 걸릴 수 있습니다. 저장해 둔 검토(맞음 · 아님)는 자동으로 반영합니다.</p></div>';
      rows = [];
    }
    function pick(key, name) {
      var me = ++finding, step = 0, t0 = Date.now();
      el.classList.add('busy');
      input.disabled = true;
      progress(name, 0, t0);
      var tick = setInterval(function () { if (me === finding) progress(name, step, t0); else clearInterval(tick); }, 1000);
      engine().then(function (w) {
        return w.rrProAuto(key, function (t) {
          var i = STEPS.indexOf(t);
          if (i >= 0 && me === finding) { step = i; progress(name, step, t0); }
        });
      }).then(function (r) {
        clearInterval(tick);
        if (me !== finding) return;
        var slug = new URL(r.url).searchParams.get('company');
        window.rrProRecent({ slug: slug, key: key, name: r.company || name, laws: r.laws, admin: r.admin });
        step = 3; progress(name, step, t0);
        var u = new URL(r.url);
        u.searchParams.set('key', key);
        soft(u.href);
      }, function (e) {
        clearInterval(tick);
        if (me !== finding) return;
        el.classList.remove('busy');
        input.disabled = false;
        body.innerHTML = '<p class="msg err">' + escH(e && e.message || e) + '</p>';
        rows = [];
      });
    }
    function choose(r) {
      if (!r) return;
      if (r.dataset.home) return soft(homeUrl());
      if (r.dataset.slug) return soft(coSite() + '?company=' + encodeURIComponent(r.dataset.slug) + (r.dataset.key ? '&key=' + encodeURIComponent(r.dataset.key) : ''));
      if (r.dataset.pick) pick(r.dataset.pick, r.dataset.name);
    }
    input.addEventListener('input', function () { clearTimeout(timer); var q = input.value; timer = setTimeout(function () { search(q); }, 140); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (rows.length) mark((at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (input.value.trim().length >= 2 && input.value !== q0) { clearTimeout(timer); search(input.value); return; }
        choose(rows[at]);
      }
    });
    body.addEventListener('mousemove', function (e) { var r = e.target.closest('.row'); if (r) { var i = rows.indexOf(r); if (i >= 0 && i !== at) mark(i); } });
    body.addEventListener('click', function (e) { choose(e.target.closest('.row')); });
    el.addEventListener('mousedown', function (e) { if (e.target === el) window.rrProClose(); });
    el.rrIdle = idle;
    document.body.appendChild(el);
    return el;
  }

  /* 서버판(맥): 예전 팝업 */
  function legacyPop() {
    var pop = document.getElementById('rr-pro-pop');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'rr-pro-pop';
    pop.className = 'rr-pro-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.setAttribute('aria-label', '기업별 적용법규 검색');
    pop.innerHTML = '<div class="panel"><div class="bar"><b>🔎 기업별 적용법규 검색</b><small>회사 이름으로 찾아 적용법규를 판정하고, ‘RegRader로 보내기’로 그 회사의 모니터링 화면을 엽니다</small>' +
      '<button type="button" class="x" aria-label="닫기">×</button></div><iframe title="기업별 적용법규 검색"></iframe></div>';
    pop.addEventListener('click', function (e) { if (e.target === pop || e.target.closest('.x')) window.rrProClose(); });
    document.body.appendChild(pop);
    return pop;
  }

  window.rrProOpen = function () {
    nav(false);
    if (SERVER) {
      var pop = legacyPop(), f = pop.querySelector('iframe');
      if (!f.getAttribute('src')) f.setAttribute('src', window.RR_PRO_URL || (IN_CO ? '../?embed=1' : '/?embed=1'));
      pop.classList.add('open');
      document.documentElement.style.overflow = 'hidden';
      return;
    }
    var el = finder(), input = el.querySelector('input');
    engine();   // 고르기 전에 판정 엔진을 받기 시작한다
    if (!el.classList.contains('busy')) { input.disabled = false; if (!input.value) el.rrIdle(); }
    el.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { input.focus(); input.select(); }, 30);
  };
  window.rrProClose = function () {
    ['rr-pro-pop', 'rr-find'].forEach(function (id) { var x = document.getElementById(id); if (x) x.classList.remove('open'); });
    var f = document.getElementById('rr-find');
    if (f && f.classList.contains('busy')) { finding++; f.classList.remove('busy'); f.querySelector('input').disabled = false; f.rrIdle(); }   // 판정 중에 닫으면 그만둔다
    document.documentElement.style.overflow = '';
    if (location.hash === '#pro') try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
  };
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('#rr-pro-pop.open, #rr-find.open');
    if (open) window.rrProClose();
  });
  /* 버튼에 마우스를 올리면 판정 엔진을 미리 받기 시작한다 */
  document.addEventListener('pointerover', function (e) {
    if (!SERVER && e.target.closest && e.target.closest('.rr-pro-cta, .rr-pro-mini') && document.body) engine();
  });
  function proFromHash() { if (location.hash === '#pro') window.rrProOpen(); }
  window.addEventListener('hashchange', proFromHash);
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
    proFromHash();
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
      if (window.__rrHold) { t0 = Date.now(); return setTimeout(wait, 80); }   // 회사 화면을 그 자리에서 만드는 중 (company-mode.js)
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
