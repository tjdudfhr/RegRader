/* 지난 연도 보기
 * 헤더 '0000년 법령 개정 현황' 의 연도를 드롭다운으로 바꿔, 보관된 연도(docs/archive/<연도>/)를 골라 볼 수 있게 한다.
 * 목록은 최신 meta.json 의 archives (refresh_laws.py 가 연도 전환 때 채운다). 보관 연도가 없으면 드롭다운을 숨긴다.
 * 지난 연도를 보는 중에는 ?year=<연도> 로 다시 열고, 위에 안내 띠를 띄운다.
 */
(function () {
  'use strict';
  var view = window.RR_VIEW_YEAR;

  var st = document.createElement('style');
  st.textContent = [
    '.rr-year-select { appearance:none; -webkit-appearance:none; font:inherit; font-weight:700; color:#fff; cursor:pointer;',
    '  background:rgba(255,255,255,.18) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 stroke=%27white%27 stroke-width=%271.6%27 fill=%27none%27/%3E%3C/svg%3E") no-repeat right 8px center;',
    '  border:1px solid rgba(255,255,255,.35); border-radius:8px; padding:1px 24px 1px 8px; margin-right:2px; }',
    '.rr-year-select:hover { background-color:rgba(255,255,255,.28); }',
    '.rr-year-select:focus-visible { outline:2px solid #fff; outline-offset:2px; }',
    '.rr-year-select option { color:#1a202c; }',
    '.rr-archive-bar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; margin:0 0 1.2rem; padding:12px 16px;',
    '  border-radius:14px; border:1px solid rgba(221,107,32,.45); background:rgba(221,107,32,.10); color:var(--text-primary); font-size:.9rem; }',
    '.rr-archive-bar b { color:#dd6b20; }',
    '.rr-archive-bar a { color:#fff; background:var(--primary-gradient); padding:6px 12px; border-radius:10px; text-decoration:none; font-weight:700; white-space:nowrap; }'
  ].join('\n');
  document.head.appendChild(st);

  function go(year, current) {
    var u = new URL(location.href);
    if (!year || Number(year) === Number(current)) u.searchParams.delete('year');
    else u.searchParams.set('year', year);
    u.searchParams.set('desktop', 'true');
    location.href = u.toString();
  }

  function mountSelect(current, archives) {
    var span = document.getElementById('year');
    if (!span) return;
    var years = [current].concat(archives.filter(function (y) { return Number(y) !== Number(current); })
      .sort(function (a, b) { return b - a; }));
    if (years.length < 2 && !view) return; /* 보관 연도가 없으면 그대로 둔다 */
    var sel = document.createElement('select');
    sel.className = 'rr-year-select';
    sel.id = 'rr-year-select';
    sel.setAttribute('aria-label', '조회 연도');
    sel.innerHTML = years.map(function (y) {
      return '<option value="' + y + '">' + y + (Number(y) === Number(current) ? ' (최신)' : '') + '</option>';
    }).join('');
    sel.value = String(view || current);
    sel.addEventListener('change', function () { go(sel.value, current); });
    /* #year 는 다른 스크립트가 숫자를 써 넣으므로 숨겨 두고 옆에 드롭다운을 둔다 */
    span.style.display = 'none';
    span.parentNode.insertBefore(sel, span);
  }

  function mountBanner(current, meta) {
    var host = document.querySelector('.container > .tab-content') || document.querySelector('.rr-summary');
    if (!host) return;
    var when = meta && meta.generatedAt ? new Date(meta.generatedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '';
    var bar = document.createElement('div');
    bar.className = 'rr-archive-bar';
    bar.innerHTML = '<div>📦 <b>' + view + '년 보관 데이터</b>를 보고 있습니다' + (when ? ' (마지막 갱신 ' + when + ')' : '') +
      '. 적용법규 목록·추가와 시행 임박 알림은 올해 기준입니다.</div>' +
      '<a href="#" id="rr-archive-back">' + current + '년 최신으로 돌아가기</a>';
    host.parentNode.insertBefore(bar, host);
    bar.querySelector('#rr-archive-back').addEventListener('click', function (e) { e.preventDefault(); go(null, current); });
  }

  function start() {
    fetch('./meta.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (cur) {
        var current = cur.year || window.RR_YEAR;
        var archives = (cur.archives || []).map(Number).filter(Boolean);
        if (view && (Number(view) === Number(current) || archives.indexOf(Number(view)) < 0)) {
          /* 올해이거나 보관되지 않은 연도 → 최신 화면으로 */
          go(null, current);
          return;
        }
        mountSelect(current, archives);
        if (view) {
          fetch(window.rrDataPath('meta.json') + '?v=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : {}; })
            .then(function (m) { mountBanner(current, m); })
            .catch(function () { mountBanner(current, null); });
        }
      })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
