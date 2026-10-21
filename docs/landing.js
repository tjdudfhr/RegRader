/* 처음 화면 — 접속하면 대시보드 대신 먼저 보이는 앱 첫 화면 (2026-10-21 초안)
 *
 *   왼쪽: 회사 · 한 줄 소개 · [시작하기] · 바로 가기 6개      오른쪽: 레이더 (올해 개정 하나하나가 점, 돌며 켜진다)
 *
 * 보이는 때: 비밀번호를 통과하고 처음 들어올 때 (이 탭에서 한 번). 주소에 #탭 이 있으면(바로 가기 링크) · 회사 화면(?company=) ·
 *           끼워 넣은 화면(?embed=1) 에서는 보이지 않는다. ?landing 을 붙이면 언제든 보인다. 왼쪽 위 로고를 누르면 다시 연다.
 * 숫자 표는 없다 — 레이더 점은 그림으로만 쓴다 (점 = 개정 1건, 주황 = 벌칙 · 과태료 · 의무 변경, 초록 테 = 시행 예정).
 * <head> 에서 gate.js 바로 다음에 불러 대시보드가 먼저 비치지 않게 한다.
 */
(function () {
  'use strict';
  var KEY = 'rr-landing-seen';
  var root = document.documentElement;
  var q = location.search;
  var forced = /[?&]landing\b/.test(q);
  var skip = /[?&](embed|company|warm)=/.test(q) || window.RR_PRO_COMPANY || /\/pro\/site\//.test(location.pathname);
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* 저장소를 못 쓰면 매번 보인다 */ }
  var want = forced || (!skip && !seen && !(location.hash || '').slice(1));

  var css = [
    'html.rr-landing, html.rr-landing body { background: #0b1226 !important; }',
    'html.rr-landing body > *:not(#rr-landing) { visibility: hidden !important; }',   /* 대시보드는 뒤에서 그려 두되 보이지 않게 */
    'html.rr-landing body { overflow: hidden !important; }',
    '#rr-landing { position: fixed; inset: 0; z-index: 100000; overflow-y: auto; overflow-x: hidden; color: #eef2ff;',
    '  font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;',
    '  letter-spacing: -0.012em; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;',
    '  background: radial-gradient(1100px 700px at 78% 42%, rgba(48, 86, 211, .32), transparent 62%),',
    '    radial-gradient(700px 500px at 8% 100%, rgba(47, 179, 122, .13), transparent 60%), linear-gradient(160deg, #0d1733 0%, #0a1024 70%);',
    '  transition: opacity .45s ease, transform .45s cubic-bezier(.2, .8, .2, 1); }',
    '#rr-landing::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;',
    '  background-image: radial-gradient(rgba(255, 255, 255, .07) 1px, transparent 1.2px); background-size: 26px 26px;',
    '  -webkit-mask-image: linear-gradient(180deg, #000, transparent 85%); mask-image: linear-gradient(180deg, #000, transparent 85%); }',
    '#rr-landing.out { opacity: 0; transform: scale(1.03); pointer-events: none; }',
    '#rr-landing .lw { position: relative; min-height: 100%; box-sizing: border-box; max-width: 1280px; margin: 0 auto; padding: 44px 56px 28px;',
    '  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto 1fr auto; column-gap: 40px; }',
    '#rr-landing .top { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; }',
    '#rr-landing .top svg { width: 38px; height: 38px; border-radius: 11px; box-shadow: 0 10px 24px -8px rgba(48, 86, 211, .8); }',
    '#rr-landing .top b { font-size: 19px; font-weight: 800; letter-spacing: -.02em; }',
    '#rr-landing .top span { font-size: 13px; color: rgba(214, 224, 255, .62); font-weight: 600; }',
    '#rr-landing .top .sp { flex: 1; }',
    '#rr-landing .top a { color: rgba(214, 224, 255, .75); font-size: 13px; font-weight: 600; text-decoration: none; padding: 7px 12px; border-radius: 9px; }',
    '#rr-landing .top a:hover { background: rgba(255, 255, 255, .08); color: #fff; }',
    '#rr-landing .copy { align-self: center; padding: 30px 0; }',
    '#rr-landing h1 { margin: 0; font-size: clamp(34px, 4.6vw, 64px); line-height: 1.16; font-weight: 800; letter-spacing: -.035em; color: #f4f6ff; }',
    '#rr-landing h1 > span { display: inline-block; white-space: nowrap; }',
    '#rr-landing h1 em { font-style: normal; color: #7ee2a8; background: linear-gradient(transparent 88%, rgba(126, 226, 168, .55) 88%); }',
    '#rr-landing .lead { margin: 22px 0 0; max-width: 520px; font-size: 16.5px; line-height: 1.7; color: rgba(214, 224, 255, .78); }',
    '#rr-landing .cta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }',
    '#rr-landing .cta button { height: 52px; padding: 0 24px; border-radius: 14px; font-family: inherit; font-size: 16px; font-weight: 700; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; gap: 10px;',
    '  transition: transform .15s ease, background .15s ease, box-shadow .15s ease; }',
    '#rr-landing .cta .go { border: 0; color: #fff; background: #3056d3; box-shadow: 0 14px 30px -12px rgba(48, 86, 211, .9); }',
    '#rr-landing .cta .go:hover { background: #3a63e6; transform: translateY(-1px); }',
    '#rr-landing .cta .go svg { width: 18px; height: 18px; }',
    '#rr-landing .cta .ghost { color: #e6ecff; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .18); }',
    '#rr-landing .cta .ghost:hover { background: rgba(255, 255, 255, .12); }',
    '#rr-landing .cta .ghost svg { width: 16px; height: 16px; }',
    '#rr-landing .apps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 40px; max-width: 600px; }',
    '#rr-landing .app { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 14px; text-align: left; cursor: pointer; color: inherit; font: inherit;',
    '  background: rgba(255, 255, 255, .045); border: 1px solid rgba(255, 255, 255, .1); transition: background .15s ease, border-color .15s ease, transform .15s ease; }',
    '#rr-landing .app:hover { background: rgba(255, 255, 255, .09); border-color: rgba(143, 211, 255, .35); transform: translateY(-2px); }',
    '#rr-landing .app i { flex: none; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--c); color: #fff; }',
    '#rr-landing .app i svg { width: 18px; height: 18px; }',
    '#rr-landing .app b { display: block; font-size: 14px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
    '#rr-landing .app small { display: block; margin-top: 2px; font-size: 12px; color: rgba(214, 224, 255, .55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
    '#rr-landing .app span { min-width: 0; }',
    '#rr-landing .viz { position: relative; align-self: center; justify-self: center; width: 100%; max-width: 600px; aspect-ratio: 1; }',
    '#rr-landing canvas { width: 100%; height: 100%; display: block; }',
    '#rr-landing .yr { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font: 800 20px/1 ui-monospace, "SF Mono", Menlo, monospace; color: #fff; letter-spacing: .02em; }',
    '#rr-landing .foot { grid-column: 1 / -1; display: flex; align-items: center; gap: 18px; padding-top: 14px; font-size: 12.5px; color: rgba(214, 224, 255, .55); }',
    '#rr-landing .foot .st { display: inline-flex; align-items: center; gap: 8px; color: rgba(214, 224, 255, .8); font-weight: 600; }',
    '#rr-landing .foot .st i { width: 8px; height: 8px; border-radius: 50%; background: #7ee2a8; box-shadow: 0 0 0 4px rgba(126, 226, 168, .16); }',
    '#rr-landing .foot .st.bad i { background: #f5a65b; box-shadow: 0 0 0 4px rgba(245, 166, 91, .16); }',
    '#rr-landing .foot .lg { display: inline-flex; gap: 14px; margin-left: auto; }',
    '#rr-landing .foot .lg em { font-style: normal; display: inline-flex; align-items: center; gap: 6px; }',
    '#rr-landing .foot .lg em::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--d); }',
    '#rr-landing .foot .lg em.o::before { background: transparent; border: 1.5px solid #7ee2a8; width: 6px; height: 6px; }',
    /* 들어올 때 차례로 */
    '#rr-landing .rise { opacity: 0; transform: translateY(14px); animation: rrl-rise .7s cubic-bezier(.2, .8, .2, 1) forwards; }',
    '@keyframes rrl-rise { to { opacity: 1; transform: none; } }',
    '#rr-landing .viz.rise { transform: scale(.94); animation-duration: 1.1s; }',
    '@media (prefers-reduced-motion: reduce) { #rr-landing .rise { animation: none; opacity: 1; transform: none; } }',
    '@media (max-width: 1240px) { #rr-landing .apps { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 480px; } }',
    /* 좁은 화면: 위아래로 (레이더 → 글 → 바로 가기) */
    '@media (max-width: 980px) {',
    '  #rr-landing .lw { grid-template-columns: 1fr; padding: 22px 18px 20px; }',
    '  #rr-landing .viz { order: 2; max-width: 360px; margin: 6px auto 0; }',
    '  #rr-landing .copy { order: 3; padding: 10px 0 0; text-align: center; }',
    '  #rr-landing .lead { margin-left: auto; margin-right: auto; font-size: 15px; }',
    '  #rr-landing .cta { justify-content: center; }',
    '  #rr-landing .apps { grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 26px auto 0; }',
    '  #rr-landing .top a { display: none; }',
    '  #rr-landing .foot { order: 4; flex-wrap: wrap; justify-content: center; }',
    '  #rr-landing .foot .lg { margin-left: 0; }',
    '}',
    '@media (max-width: 420px) { #rr-landing .cta button { flex: 1; justify-content: center; padding: 0 14px; } #rr-landing .app small { display: none; } }'
  ].join('\n');

  var style = document.createElement('style');
  style.id = 'rr-landing-css';
  style.textContent = css;
  (document.head || root).appendChild(style);

  /* 바로 가기: [탭, 이름, 한 줄, 아이콘, 색] */
  var APPS = [
    ['overview', '종합 현황', '올해 개정 한눈에', 'dashboard', '#3056d3'],
    ['watch', '시행 임박', '곧 시행되는 개정', 'clock', '#d97706'],
    ['lawregistry', '적용법규', '법령 · 행정규칙 · 조례', 'book', '#0d9488'],
    ['tracker', '대응 현황', '검토 · 조치 기록', 'check', '#2f855a'],
    ['pro', '기업별 적용법규', '회사 이름으로 찾기', 'search', '#7c3aed'],
    ['history', '업데이트 내역', '매일 바뀐 내용', 'history', '#475569']
  ];
  var MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#3056d3"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.8"/>' +
    '<circle cx="16" cy="16" r="5" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.8"/><path d="M16 16 22.7 9.3" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' +
    '<circle cx="16" cy="16" r="2" fill="#fff"/><circle cx="21.2" cy="20.6" r="1.7" fill="#7ee2a8"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var ICONS = {   /* system-ui.js rrIcon 과 같은 선 아이콘 — 처음 화면은 그 파일을 받기 전에 그리므로 여기 둔다 */
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    check: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>'
  };
  function icon(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  }

  var el = null, stopRadar = null;

  function build() {
    var year = window.RR_YEAR || new Date().getFullYear();
    var d = 0;
    var rise = function () { d += 0.07; return ' class="rise" style="animation-delay:' + d.toFixed(2) + 's"'; };
    el = document.createElement('section');
    el.id = 'rr-landing';
    el.setAttribute('aria-label', 'RegRader 처음 화면');
    el.innerHTML =
      '<div class="lw">' +
        '<header class="top">' + MARK + '<b>RegRader</b><span>법규 개정 모니터링</span><i class="sp"></i>' +
          '<a href="#" data-go="intro">시스템 소개</a><a href="#" data-go="overview">대시보드</a></header>' +
        '<div class="copy">' +
          '<h1' + rise() + '><span>모르고 지나치는 법 개정,</span><br><em>이제 없습니다.</em></h1>' +
          '<p' + rise().replace('class="rise"', 'class="lead rise"') + '>법령 · 행정규칙 · 조례의 개정을 매일 아침 확인해, 우리 회사에 적용되는 것만 골라 할 일과 근거를 정리합니다.</p>' +
          '<div' + rise().replace('class="rise"', 'class="cta rise"') + '><button type="button" class="go" data-go="overview">시작하기' + ARROW + '</button>' +
            '<button type="button" class="ghost" data-go="intro">' + PLAY + '소개 영상</button></div>' +
          '<div class="apps">' + APPS.map(function (a) {
            return '<button type="button"' + rise().replace('class="rise"', 'class="app rise"') + ' data-go="' + a[0] + '"><i style="--c:' + a[4] + '">' + icon(a[3]) + '</i>' +
              '<span><b>' + esc(a[1]) + '</b><small>' + esc(a[2]) + '</small></span></button>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="viz rise" style="animation-delay:.15s"><canvas aria-hidden="true"></canvas><div class="yr">' + esc(year) + '</div></div>' +
        '<footer class="foot"><span class="st" id="rrl-st"><i></i>매일 07:00 자동 갱신</span>' +
          '<span class="lg"><em style="--d:#7d95ff">개정</em><em style="--d:#f5a65b">벌칙 · 과태료 · 의무 변경</em><em class="o">시행 예정</em></span></footer>' +
      '</div>';
    (document.body || root).appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      e.preventDefault();
      enter(b.getAttribute('data-go'));
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', fitTitle);
    fitTitle();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);
    stopRadar = radar(el.querySelector('canvas'));
    status();
  }

  /* 제목 첫 줄('모르고 지나치는 법 개정,')이 글 칸보다 넓으면 글자 크기를 줄여 한 줄에 맞춘다 */
  function fitTitle() {
    var h = el && el.querySelector('h1'), line = h && h.firstChild;
    if (!h || !line) return;
    h.style.fontSize = '';
    var room = h.parentNode.clientWidth, need = line.scrollWidth;
    if (room && need > room) h.style.fontSize = (parseFloat(getComputedStyle(h).fontSize) * room / need * 0.98).toFixed(1) + 'px';
  }

  function onKey(e) {
    if (!el || el.classList.contains('out')) return;
    if (e.key === 'Escape' || (e.key === 'Enter' && !(e.target && e.target.closest && e.target.closest('button')))) { e.preventDefault(); enter('overview'); }
  }

  /* 들어가기: 처음 화면을 걷고 그 탭으로 */
  function enter(tab) {
    if (!el) return;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* 다음에 또 보일 뿐 */ }
    if (tab === 'pro' && typeof window.rrProOpen === 'function') window.rrProOpen();
    else if (typeof window.switchMainTab === 'function') window.switchMainTab(tab || 'overview');
    el.classList.add('out');
    root.classList.remove('rr-landing');
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', fitTitle);
    var gone = el;
    el = null;
    setTimeout(function () { if (stopRadar) stopRadar(); gone.remove(); }, 480);
  }

  function open() {
    if (el) return;
    root.classList.add('rr-landing');
    build();
  }

  /* 오늘 갱신 상태 (docs/health.json) */
  function status() {
    fetch('./health.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (h) {
      var s = document.getElementById('rrl-st');
      if (!s || !h || !h.date) return;
      var today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      var iso = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
      var when = h.date === iso ? '오늘 ' + h.time : h.date.slice(5).replace('-', '.') + ' ' + h.time;
      s.lastChild.textContent = h.ok ? when + ' 자동 갱신 완료' : when + ' 갱신 확인 필요';
      s.classList.toggle('bad', !h.ok);
    }).catch(function () {});
  }

  /* ---------- 레이더 (소개 영상 표지와 같은 그림): 12시 = 1월 1일, 시계 방향으로 한 해 · 고리 = 직무 · 점 = 개정 1건 ----------
     첫 바퀴는 빛이 지나가며 점을 하나씩 '포착'하고, 그다음부터는 7.5초에 한 바퀴씩 계속 돌며 지나간 자리의 점이 빛난다. */
  var RINGS = ['지식재산권', '지배구조', '공정거래', '정보보호', '인사노무', '안전', '재무회계', '환경'];   // 안쪽 → 바깥
  var TAU = Math.PI * 2, PERIOD = 7500, FIRST = 4200;
  function radar(cv) {
    var ctx = cv.getContext('2d');
    var dots = [], S = 0, dpr = 1, tData = 0, alive = true, raf = 0;
    var year = window.RR_YEAR || new Date().getFullYear();
    var start = Date.UTC(year, 0, 1), days = (Date.UTC(year + 1, 0, 1) - start) / 864e5;
    var kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    var today = Date.UTC(kst.getFullYear(), kst.getMonth(), kst.getDate());
    var angOf = function (doy) { return -Math.PI / 2 + ((doy + 0.5) / days) * TAU; };
    var aToday = angOf((today - start) / 864e5);
    var hash = function (n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

    function load() {
      var items = window.__rrItems;
      if (!items || !items.length) return;
      var risk = window.rrAmend && window.rrAmend.isRisk;
      dots = items.map(function (it, i) {
        var ds = String(it.effectiveDate || '');
        var t = Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10));
        if (!isFinite(t)) return null;
        var ring = RINGS.indexOf(((it.categories || [])[0]) || '');
        if (ring < 0) ring = 7;
        return { a: angOf((t - start) / 864e5 + hash(i) * 1.8), u: (ring + 0.16 + 0.68 * hash(i + 999)) / 8, risk: !!(risk && risk(it)), future: t > today };
      }).filter(Boolean).sort(function (x, y) { return x.a - y.a; });
      tData = performance.now();
    }
    /* 레이더 전용 작은 자료 (docs/radar.json, 몇 KB) — 대시보드 자료를 기다리지 않고 바로 받는다.
       점 = 연중 날짜 * 16 + 고리 * 2 + 벌칙 · 과태료 · 의무 변경 (scripts/radar_data.py) */
    function setYear(y) {
      year = y;
      start = Date.UTC(year, 0, 1);
      days = (Date.UTC(year + 1, 0, 1) - start) / 864e5;
      aToday = angOf((today - start) / 864e5);
      var yl = cv.parentNode && cv.parentNode.querySelector('.yr');
      if (yl) yl.textContent = year;
    }
    function useRadar(d) {
      if (dots.length || !d || !d.dots || !d.dots.length) return;
      if (d.year && +d.year !== year) setYear(+d.year);
      var todayDoy = (today - start) / 864e5;
      dots = d.dots.map(function (v, i) {
        var doy = Math.floor(v / 16);
        return { a: angOf(doy + hash(i) * 1.8), u: (((v >> 1) & 7) + 0.16 + 0.68 * hash(i + 999)) / 8, risk: (v & 1) === 1, future: doy > todayDoy };
      }).sort(function (x, y) { return x.a - y.a; });
      tData = performance.now();
    }
    fetch('./radar.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(useRadar).catch(function () {});
    function fit() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      S = cv.clientWidth;
      cv.width = cv.height = Math.round(S * dpr);
    }
    function draw(phi, revealTo) {
      var cx = S / 2, cy = S / 2, R = S * 0.43, r0 = S * 0.085, k = S / 960;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      var disc = ctx.createRadialGradient(cx, cy, r0, cx, cy, R);
      disc.addColorStop(0, 'rgba(91, 128, 255, 0.10)');
      disc.addColorStop(1, 'rgba(91, 128, 255, 0.025)');
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      /* 시행 예정 구간 (오늘 ~ 연말) */
      ctx.fillStyle = 'rgba(126, 226, 168, 0.05)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, aToday, -Math.PI / 2 + TAU); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 1;
      for (var i = 0; i <= 8; i++) {
        ctx.strokeStyle = i === 8 ? 'rgba(132, 158, 238, 0.5)' : 'rgba(132, 158, 238, 0.14)';
        ctx.beginPath(); ctx.arc(cx, cy, r0 + (R - r0) * i / 8, 0, TAU); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 ' + Math.max(10, Math.round(18 * k)) + 'px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      for (var m = 0; m < 12; m++) {
        var d0 = (Date.UTC(year, m, 1) - start) / 864e5;
        var a = angOf(d0 - 0.5), am = angOf(d0 + 14);
        ctx.strokeStyle = 'rgba(132, 158, 238, 0.16)';
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (R + 10 * k), cy + Math.sin(a) * (R + 10 * k)); ctx.stroke();
        ctx.fillStyle = 'rgba(165, 184, 240, 0.62)';
        ctx.fillText((m + 1) + '월', cx + Math.cos(am) * (R + 30 * k), cy + Math.sin(am) * (R + 30 * k));
      }
      if (S >= 420) {   /* 고리 이름 (작은 화면에서는 뺀다) */
        ctx.textAlign = 'right';
        ctx.font = '500 ' + Math.round(15 * k) + 'px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.fillStyle = 'rgba(165, 184, 240, 0.5)'; ctx.strokeStyle = 'rgba(10, 20, 49, 0.9)'; ctx.lineWidth = 4 * k;
        RINGS.forEach(function (name, j) {
          var y = cy - (r0 + (R - r0) * (j + 0.5) / 8);
          ctx.strokeText(name, cx - 12 * k, y); ctx.fillText(name, cx - 12 * k, y);
        });
        ctx.lineWidth = 1;
      }
      /* 훑는 빛 + 앞선 줄 (자료를 받기 전에는 그리지 않는다) */
      var W = 0.9;
      if (phi !== null && typeof ctx.createConicGradient === 'function') {
        var cg = ctx.createConicGradient(phi - W, cx, cy);
        cg.addColorStop(0, 'rgba(91, 128, 255, 0)');
        cg.addColorStop(W / TAU * 0.995, 'rgba(120, 152, 255, 0.30)');
        cg.addColorStop(W / TAU, 'rgba(91, 128, 255, 0)');
        cg.addColorStop(1, 'rgba(91, 128, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, phi - W, phi); ctx.closePath(); ctx.fill();
      }
      if (phi !== null) {
        ctx.strokeStyle = 'rgba(178, 198, 255, 0.9)'; ctx.lineWidth = 2 * k + 0.6;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(phi) * r0, cy + Math.sin(phi) * r0); ctx.lineTo(cx + Math.cos(phi) * R, cy + Math.sin(phi) * R); ctx.stroke();
      }
      /* 점: 빛이 지나간 직후 가장 밝고 서서히 가라앉는다 */
      for (var j = 0; j < dots.length; j++) {
        var e = dots[j];
        if (revealTo !== null && e.a > revealTo) break;
        var dd = ((phi - e.a) % TAU + TAU) % TAU;
        var glow = Math.exp(-dd / 0.75);
        var r = r0 + (R - r0) * e.u, x = cx + Math.cos(e.a) * r, y = cy + Math.sin(e.a) * r;
        var color = e.risk ? '#f5a65b' : e.future ? '#7ee2a8' : '#7d95ff';
        var size = (e.risk ? 4.6 : 3.4) * k + 0.4;
        if (glow > 0.08) {
          ctx.globalAlpha = glow * 0.3; ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(x, y, size * (2.2 + 2 * glow), 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 0.42 + 0.58 * glow;
        ctx.beginPath(); ctx.arc(x, y, size, 0, TAU);
        if (e.future && !e.risk) { ctx.strokeStyle = color; ctx.lineWidth = 1.6 * k + 0.4; ctx.stroke(); }
        else { ctx.fillStyle = color; ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      /* 오늘 */
      ctx.setLineDash([6 * k, 6 * k]); ctx.strokeStyle = 'rgba(126, 226, 168, 0.85)'; ctx.lineWidth = 1.6 * k + 0.4;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(aToday) * r0, cy + Math.sin(aToday) * r0); ctx.lineTo(cx + Math.cos(aToday) * R, cy + Math.sin(aToday) * R); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7ee2a8';
      ctx.beginPath(); ctx.arc(cx + Math.cos(aToday) * R, cy + Math.sin(aToday) * R, 5 * k + 1, 0, TAU); ctx.fill();
      /* 가운데 */
      ctx.fillStyle = '#0a1431';
      ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(132, 158, 238, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
    function frame(ts) {
      if (!alive) return;
      if (!dots.length) load();
      if (cv.clientWidth !== S) fit();
      var phi, reveal = null;
      if (!dots.length) phi = null;   /* 자료를 받는 동안은 고리만 (보통 0.1~0.3초) */
      else {
        var t = ts - tData;
        /* 첫 바퀴: 빠르게 돌며 포착하다가 끝에서 보통 속도(7.5초에 한 바퀴)로 이어진다 */
        if (t < FIRST) { var p = t / FIRST, b = (FIRST / PERIOD - 1); phi = -Math.PI / 2 + ((1 - b) * p + b * p * p) * TAU; reveal = phi; }
        else phi = -Math.PI / 2 + ((t - FIRST) / PERIOD) * TAU;
      }
      draw(phi, reveal);
      raf = requestAnimationFrame(frame);
    }
    fit();
    raf = requestAnimationFrame(frame);
    var onResize = function () { S = 0; if (!raf) raf = requestAnimationFrame(frame); };
    window.addEventListener('resize', onResize);
    return function () { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }

  window.rrLanding = { open: open, enter: enter };

  if (want && !root.classList.contains('rr-locked')) {
    root.classList.add('rr-landing');
    build();
  }
  /* 왼쪽 위 로고를 누르면 처음 화면을 다시 연다 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.rr-brand');
    if (b && !skip) { e.preventDefault(); open(); }
  }, true);
})();
