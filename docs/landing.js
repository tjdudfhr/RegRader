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
    'html.rr-landing #rr-boot { opacity: 0 !important; }',
    'html.rr-landing body { overflow: hidden !important; }',
    '#rr-landing { position: fixed; inset: 0; z-index: 100000; overflow-y: auto; overflow-x: hidden; color: #eef2ff;',
    '  font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; -webkit-font-smoothing: antialiased;',
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
    '#rr-landing .co { display: inline-block; font-size: 22px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 18px;',
    '  background: linear-gradient(90deg, #7ee2a8 0%, #8fd3ff 55%, #a9b8ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }',
    '#rr-landing h1 { margin: 0; font-size: clamp(34px, 4.2vw, 58px); line-height: 1.16; font-weight: 800; letter-spacing: -.035em; color: #f4f6ff; }',
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
  function icon(n) { return window.rrIcon ? window.rrIcon(n) : ''; }

  var el = null, raf = 0, stopRadar = null;

  function build() {
    var year = window.RR_YEAR || new Date().getFullYear();
    var co = window.RR_COMPANY_NAME || '포스코퓨처엠';
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
          '<div' + rise() + '><span class="co">' + esc(co) + '</span></div>' +
          '<h1' + rise() + '>모르고 지나치는 법 개정,<br><em>이제 없습니다.</em></h1>' +
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
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      e.preventDefault();
      enter(b.getAttribute('data-go'));
    });
    document.addEventListener('keydown', onKey);
    stopRadar = radar(el.querySelector('canvas'));
    status();
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

  /* ---------- 레이더: 12시 = 1월 1일, 시계 방향으로 한 해 · 고리 = 직무 · 점 = 개정 1건 ---------- */
  var JOBS = ['환경', '재무회계', '안전', '인사노무', '정보보호', '공정거래', '지배구조', '지식재산권'];
  function radar(cv) {
    var ctx = cv.getContext('2d');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dots = [], size = 0, dpr = 1, t0 = performance.now(), alive = true;
    var year = window.RR_YEAR || new Date().getFullYear();
    var start = Date.UTC(year, 0, 1), days = (Date.UTC(year + 1, 0, 1) - start) / 864e5;
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    var todayA = ((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 864e5) / days * Math.PI * 2;
    var PERIOD = 7000;   // 한 바퀴 7초

    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
    function load() {
      var items = window.__rrItems;
      if (!items || !items.length) return false;
      var risk = window.rrAmend && window.rrAmend.isRisk;
      dots = items.map(function (it) {
        var ds = String(it.effectiveDate || '');
        var t = Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10));
        if (!isFinite(t)) return null;
        var job = JOBS.indexOf(((it.categories || [])[0]) || '');
        var k = hash(String(it.title) + ds);
        return {
          a: (t - start) / 864e5 / days * Math.PI * 2 + (k - .5) * .03,
          r: (job < 0 ? JOBS.length - .5 : job + .2 + k * .6) / JOBS.length,
          up: t > Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
          risk: !!(risk && risk(it)),
          lit: 0
        };
      }).filter(Boolean);
      return true;
    }
    function fit() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      size = cv.clientWidth;
      cv.width = cv.height = Math.round(size * dpr);
    }
    function frame(ts) {
      if (!alive) return;
      if (!dots.length) load();
      if (cv.clientWidth !== size) fit();
      var W = size, c = W / 2, R = W * 0.45, R0 = R * 0.2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, W);
      var sweep = reduce ? todayA : ((ts - t0) / PERIOD) * Math.PI * 2;
      var ang = function (a) { return a - Math.PI / 2; };
      /* 고리 · 달 눈금 */
      ctx.lineWidth = 1;
      for (var i = 0; i <= JOBS.length; i++) {
        ctx.beginPath();
        ctx.arc(c, c, R0 + (R - R0) * i / JOBS.length, 0, Math.PI * 2);
        ctx.strokeStyle = i === JOBS.length ? 'rgba(143,170,255,.30)' : 'rgba(143,170,255,.09)';
        ctx.stroke();
      }
      ctx.font = '600 ' + Math.max(10, W * 0.019) + 'px Pretendard, -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var m = 0; m < 12; m++) {
        var a = ang(m / 12 * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * R0, c + Math.sin(a) * R0);
        ctx.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        ctx.strokeStyle = 'rgba(143,170,255,.07)';
        ctx.stroke();
        var am = ang((m + .5) / 12 * Math.PI * 2);
        ctx.fillStyle = 'rgba(200,212,255,.42)';
        ctx.fillText((m + 1) + '월', c + Math.cos(am) * (R + W * 0.033), c + Math.sin(am) * (R + W * 0.033));
      }
      /* 시행 예정 구간 (오늘 ~ 연말) 은 옅게 */
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, R, ang(todayA), ang(Math.PI * 2));
      ctx.closePath();
      ctx.fillStyle = 'rgba(126,226,168,.035)';
      ctx.fill();
      /* 오늘 선 */
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(ang(todayA)) * R0, c + Math.sin(ang(todayA)) * R0);
      ctx.lineTo(c + Math.cos(ang(todayA)) * R, c + Math.sin(ang(todayA)) * R);
      ctx.strokeStyle = 'rgba(126,226,168,.7)';
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(c + Math.cos(ang(todayA)) * R, c + Math.sin(ang(todayA)) * R, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#7ee2a8';
      ctx.fill();
      /* 훑는 빛 */
      if (!reduce) {
        var g = ctx.createConicGradient ? ctx.createConicGradient(ang(sweep) - 0.9, c, c) : null;
        if (g) {
          g.addColorStop(0, 'rgba(79,124,255,0)');
          g.addColorStop(0.142, 'rgba(79,124,255,.30)');
          g.addColorStop(0.1433, 'rgba(79,124,255,0)');
          ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, ang(sweep) - 0.9, ang(sweep)); ctx.closePath();
          ctx.fillStyle = g; ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(ang(sweep)) * R0, c + Math.sin(ang(sweep)) * R0);
        ctx.lineTo(c + Math.cos(ang(sweep)) * R, c + Math.sin(ang(sweep)) * R);
        ctx.strokeStyle = 'rgba(170,195,255,.85)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.lineWidth = 1;
      }
      /* 점: 빛이 지나가면 밝아졌다가 천천히 가라앉는다 */
      var sw = ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      for (var j = 0; j < dots.length; j++) {
        var p = dots[j];
        var behind = ((sw - p.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        var glow = reduce ? .6 : Math.max(0, 1 - behind / 2.2);
        var x = c + Math.cos(ang(p.a)) * (R0 + (R - R0) * p.r), y = c + Math.sin(ang(p.a)) * (R0 + (R - R0) * p.r);
        var rad = W * (p.risk ? 0.0062 : 0.0048);
        if (glow > .55) {
          ctx.beginPath(); ctx.arc(x, y, rad * (2.6 + glow), 0, Math.PI * 2);
          ctx.fillStyle = p.risk ? 'rgba(245,166,91,' + (glow * .18) + ')' : 'rgba(125,149,255,' + (glow * .16) + ')';
          ctx.fill();
        }
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
        if (p.up) {
          ctx.strokeStyle = 'rgba(126,226,168,' + (.45 + glow * .5) + ')'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.lineWidth = 1;
        } else {
          ctx.fillStyle = p.risk ? 'rgba(245,166,91,' + (.55 + glow * .45) + ')' : 'rgba(125,149,255,' + (.38 + glow * .55) + ')';
          ctx.fill();
        }
      }
      /* 가운데 구멍 */
      ctx.beginPath(); ctx.arc(c, c, R0 * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1328'; ctx.fill();
      ctx.strokeStyle = 'rgba(143,170,255,.35)'; ctx.stroke();
      raf = reduce && dots.length ? 0 : requestAnimationFrame(frame);
    }
    fit();
    raf = requestAnimationFrame(frame);
    var onResize = function () { size = 0; if (!raf) raf = requestAnimationFrame(frame); };
    window.addEventListener('resize', onResize);
    return function () { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }

  window.rrLanding = { open: open, enter: enter };

  if (want && !root.classList.contains('rr-locked')) {
    root.classList.add('rr-landing');
    if (document.body) build();
    else document.addEventListener('DOMContentLoaded', build);
  }
  /* 왼쪽 위 로고를 누르면 처음 화면을 다시 연다 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.rr-brand');
    if (b && !skip) { e.preventDefault(); open(); }
  }, true);
})();
