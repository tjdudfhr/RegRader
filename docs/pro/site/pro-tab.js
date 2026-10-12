/* 기업별 적용법규 탭 (RegRader Pro · 저장소의 pro/)
 *
 * 회사 이름으로 공공데이터 · DART 를 조회해 현행 법률 전부를 적용 · 미적용으로 판정하고,
 * 그 회사 적용법규로 이 RegRader 와 같은 분기별 · 직무별 모니터링을 만든다.
 *   - 이 사이트(GitHub Pages)에서 바로 된다: docs/pro/ 가 판정 엔진을 브라우저에서 돌린다 (서버 · 키 없음)
 *   - Pro 서버(pro/server.py)가 띄운 회사별 화면(/rr/<회사>/) 안에서는 그 서버의 보낸 회사 목록을 보여 준다
 */
(function () {
  'use strict';
  var LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && /^\/rr\//.test(location.pathname);
  var PRO = LOCAL ? location.origin + '/' : (location.pathname.indexOf('/pro/site/') >= 0 ? '../' : './pro/');
  var LIST = LOCAL ? location.origin + '/rr/' : PRO + 'companies.html';
  var README = 'https://github.com/tjdudfhr/RegRader/blob/main/pro/README.md';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return n == null ? '–' : Number(n).toLocaleString(); }

  var css = document.createElement('style');
  css.textContent = [
    '.rr-pro { display:flex; flex-direction:column; gap:16px; }',
    '.rr-pro-card { padding:22px; border-radius:14px; background:var(--surface); border:1px solid var(--line); box-shadow:var(--sh-xs); }',
    '.rr-pro-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }',
    '.rr-pro-head h2 { margin:0 0 4px; font-size:18px; font-weight:800; color:var(--ink); }',
    '.rr-pro-head p { margin:0; font-size:13.5px; color:var(--ink-3); }',
    '.rr-pro-acts { display:flex; gap:8px; flex-wrap:wrap; }',
    '.rr-pro-acts .rr-btn { text-decoration:none; }',
    '.rr-pro-steps { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin-top:18px; }',
    '.rr-pro-step { padding:14px; border-radius:12px; background:var(--surface-2); border:1px solid var(--line); }',
    '.rr-pro-step b { display:block; font-size:14px; color:var(--ink); margin-bottom:4px; }',
    '.rr-pro-step span { font-size:12.5px; color:var(--ink-3); line-height:1.55; }',
    '.rr-pro-step i { font-style:normal; display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--brand-solid); color:#fff; font-size:12px; font-weight:800; margin-bottom:8px; }',
    '.rr-pro-run h3, .rr-pro-list h3 { margin:0 0 10px; font-size:15px; font-weight:800; color:var(--ink); }',
    '.rr-pro-run p { margin:0 0 8px; font-size:13px; color:var(--ink-2); }',
    '.rr-pro-run pre { margin:0 0 10px; padding:12px 14px; border-radius:10px; background:#0f172a; color:#e2e8f0; font-size:12.5px; overflow-x:auto; }',
    '.rr-pro-run a { color:var(--brand); font-weight:700; }',
    '.rr-pro-co { display:grid; grid-template-columns:1fr auto; gap:4px 14px; align-items:center; padding:12px 0; border-top:1px solid var(--line); }',
    '.rr-pro-co:first-of-type { border-top:0; }',
    '.rr-pro-co b { font-size:14.5px; color:var(--ink); }',
    '.rr-pro-co small { grid-column:1; font-size:12.5px; color:var(--ink-3); }',
    '.rr-pro-co .rr-btn { grid-row:span 2; text-decoration:none; }',
    '@media (max-width:900px){ .rr-pro-steps { grid-template-columns:repeat(2, minmax(0, 1fr)); } }',
    '@media (max-width:560px){ .rr-pro-steps { grid-template-columns:1fr; } .rr-pro-co { grid-template-columns:1fr; } .rr-pro-co .rr-btn { grid-row:auto; } }'
  ].join('\n');
  document.head.appendChild(css);

  var STEPS = [
    ['회사 찾기', '국민연금 · 등록공장 · 인허가 공공데이터와 DART 사업보고서로 업종 · 사업장 · 근로자 수 · 상장 · 외부감사 · 기업집단을 자동으로 채웁니다.'],
    ['적용법규 판정', '현행 법률 전부를 적용 · 추정 · 미적용으로 판정하고 9개 직무로 나눕니다. 국세청 업종코드 전체에 업종 법규를 맞춰 둡니다.'],
    ['RegRader로 보내기', '판정한 법령 · 행정규칙으로 이 RegRader 와 같은 수집(올해 개정 · 계열 · 행정규칙 · 개정문 분석)을 돌립니다.'],
    ['분기별 · 직무별 보기', '회사마다 이 화면과 같은 종합 · 분기별 · 직무별 · 적용법규 화면이 만들어집니다.']
  ];

  function head() {
    return '<section class="rr-pro-card"><div class="rr-pro-head"><div><h2>기업별 적용법규</h2>' +
      '<p>RegRader Pro · 회사 이름만 넣으면 그 회사에 적용되는 법규를 찾아 RegRader 로 모니터링합니다.</p></div>' +
      '<div class="rr-pro-acts"><a class="rr-btn pri" href="' + PRO + '">새 회사 판정하기</a>' +
      '<a class="rr-btn" href="' + LIST + '">보낸 회사 목록</a></div></div>' +
      '<div class="rr-pro-steps">' + STEPS.map(function (s, i) {
        return '<div class="rr-pro-step"><i>' + (i + 1) + '</i><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>';
      }).join('') + '</div></section>';
  }

  function run() {
    return '<section class="rr-pro-card rr-pro-run"><h3>안내</h3>' +
      '<p>이 사이트에서 바로 됩니다. 판정 엔진이 이 브라우저 안에서 돌고, 회사 정보 · 판정 결과는 어디로도 보내지 않습니다. 처음 열 때 엔진을 받느라 10~20초 걸립니다.</p>' +
      '<p>회사 찾기에는 국민연금 가입자 30명 이상 법인과 상장사가 들어 있습니다 (공공데이터 · DART, 매월 갱신). 그 밖의 회사는 근로자 수 · 업종 · 지역을 직접 넣어 판정합니다.</p>' +
      '<p>법령 개정 자료는 매일 07:00 이 RegRader 와 같이 갱신됩니다. 보낸 회사는 이 브라우저에 저장되어 ‘보낸 회사 목록’에서 다시 엽니다.</p>' +
      '<p>DART 를 실시간으로 다시 조회하는 서버판(pro/server.py)도 있습니다 — <a href="' + README + '" target="_blank" rel="noopener">pro/README.md</a></p></section>';
  }

  function company(c) {
    var r = c.result || {};
    var open = c.state === 'done' ? '<a class="rr-btn pri" href="' + esc(c.url) + '" target="_blank" rel="noopener">RegRader 화면</a>'
      : '<span class="rr-btn" aria-disabled="true">' + (c.state === 'running' ? '수집 중 ' + (c.progress || 0) + '%' : '수집 실패') + '</span>';
    return '<div class="rr-pro-co"><b>' + esc(c.company) + '</b>' + open +
      '<small>적용법규 ' + num(c.laws) + ' + 행정규칙 ' + num(c.admin) +
      (c.state === 'done' ? ' · 올해 개정 ' + num(r.totalCount) + '건 · ' + esc(r.asOf || '') + ' 기준' : '') + '</small></div>';
  }

  function list(el) {
    var box = document.createElement('section');
    box.className = 'rr-pro-card rr-pro-list';
    box.innerHTML = '<h3>보낸 회사</h3><div>불러오는 중…</div>';
    el.appendChild(box);
    fetch('/api/regrader/list', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      var cs = d.companies || [];
      box.lastChild.innerHTML = cs.length ? cs.map(company).join('') : '아직 보낸 회사가 없습니다.';
    }).catch(function () { box.lastChild.textContent = '목록을 불러오지 못했습니다.'; });
  }

  function render() {
    var el = document.getElementById('rr-pro');
    if (!el || el.dataset.ready) return;
    el.dataset.ready = '1';
    el.className = 'rr-pro';
    el.innerHTML = head() + (LOCAL ? '' : run());
    if (LOCAL) list(el);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
