/* 회사 RegRader 화면의 회사 이름 표시 — 화면 맨 위(앱 바 맨 앞, 스크롤해도 보임) · 로딩 화면 · 브라우저 탭 제목.
 *
 * window.rrCompanyChip({ company, laws, admin, date, home, homeLabel, missing })
 *   company    회사 이름          laws · admin   적용법규(법령) · 행정규칙 수     date  판정한 날
 *   home       데이터가 없을 때 판정하러 가는 곳 (Pro 화면)   homeLabel  그 링크 이름
 *   missing    true 면 '이 브라우저에 이 회사 데이터가 없다'고 알린다
 * 브라우저판(company-mode.js)과 맥 서버판 회사 화면(pro-company.js)이 같이 쓴다.
 */
(function () {
  'use strict';
  var css = [
    '.rr-top-left.rr-has-co { display: flex !important; flex-direction: row !important; align-items: center !important; min-width: 0; }',
    /* 앱 바(어두운 바탕) 안: 상자 없이 구분선 하나로 이어 붙인다 */
    /* 회사 이름이 맨 앞, 그 뒤에 구분선 · 지금 화면 제목(종합 현황 · 분기별 개정 현황 …) */
    '.rr-co { display: flex; align-items: center; gap: 12px; min-width: 0; margin-right: 22px; padding-right: 22px; border-right: 1px solid rgba(255, 255, 255, .14); }',
    '.rr-co .ic { flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: #fff;',
    '  background: linear-gradient(135deg, #3d6bff, #6a4bff); box-shadow: 0 6px 14px -6px rgba(61, 107, 255, .8), inset 0 1px 0 rgba(255, 255, 255, .2); }',
    '.rr-co .ic svg { width: 18px; height: 18px; }',
    '.rr-co .tx { min-width: 0; display: flex; flex-direction: column; gap: 2px; line-height: 1.2; }',
    '.rr-co b { font-size: 16.5px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.02em; }',
    '.rr-co small { font-size: 11.5px; font-weight: 600; color: rgba(214, 224, 255, .62); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }',
    '.rr-co .go { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 9px; text-decoration: none; white-space: nowrap;',
    '  font-size: 12.5px; font-weight: 700; color: #e6ecff; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .14); transition: background .15s, border-color .15s; }',
    '.rr-co .go:hover { background: rgba(255, 255, 255, .13); border-color: rgba(255, 255, 255, .26); }',
    '.rr-co.miss .ic { background: linear-gradient(135deg, #f08a24, #dd6b20); box-shadow: none; }',
    '.rr-co.miss small { color: #ffcf8a; }',
    '.rr-co.m, .rr-co-crumb { display: none; }',
    /* 좁은 화면: 앱 바 제목 위에 작은 글씨로 회사 이름 (회사 바꾸기는 앱 바의 검색 버튼). 데이터가 없을 때만 앱 바 아래 안내 줄 */
    '@media (max-width: 900px) { .rr-top-left .rr-co { display: none; }',
    '  .rr-co-crumb { display: block; max-width: 46vw; margin-bottom: 1px; font: 700 12px/1.25 var(--font, sans-serif); color: rgba(214, 224, 255, .72);',
    '    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }',
    '  .rr-co.m { display: flex; margin: 12px 14px 0; padding: 10px 12px; border: 1px solid var(--line, #e5e7eb); border-radius: 14px; background: var(--surface, #fff); }',
    '  .rr-co.m b { color: var(--ink, #111827); font-size: 15px; } .rr-co.m small { color: var(--ink-3, #6b7280); white-space: normal; line-height: 1.35; }',
    '  .rr-co.m .tx { flex: 1; } .rr-co.m .go { color: var(--brand, #3056d3); background: var(--brand-soft, #eef2ff); border-color: transparent; }',
    '  .rr-co.m.miss small { color: #b45309; } }'
  ].join('\n');
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/></svg>';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  window.rrCompanyChip = function (o) {
    if (!document.getElementById('rr-co-css')) {
      var s = el('style');
      s.id = 'rr-co-css';
      s.textContent = css;
      document.head.appendChild(s);
    }
    var old = document.getElementById('rr-co');
    if (old) old.remove();
    var chip = el('div', 'rr-co' + (o.missing ? ' miss' : ''));
    chip.id = 'rr-co';
    chip.setAttribute('role', 'note');
    var ic = el('span', 'ic');
    ic.innerHTML = ICON;
    var tx = el('span', 'tx');
    tx.appendChild(el('b', '', o.company));
    var n = function (x) { return x == null ? '–' : Number(x).toLocaleString(); };
    tx.appendChild(el('small', '', o.missing ? '이 브라우저에 이 회사 데이터가 없습니다'
      : '법령 ' + n(o.laws) + ' · 행정규칙 ' + n(o.admin) + (o.date ? ' · ' + o.date + ' 판정' : '')));
    chip.appendChild(ic);
    chip.appendChild(tx);
    if (o.home && o.missing) {   // 데이터가 없을 때만 'RegRader Pro 에서 판정하기' (다른 회사는 '기업별 적용법규 검색' 버튼으로)
      var a = el('a', 'go');
      a.href = o.home;
      a.appendChild(document.createTextNode(o.homeLabel || '판정하기'));
      chip.appendChild(a);
    }
    chip.title = o.company + (o.missing ? '' : ' 의 적용법규로 만든 RegRader 화면');
    var left = document.querySelector('.rr-top-left');
    if (left) {   // 앱 바: [회사] │ [화면 제목] — 좁은 화면 메뉴 버튼(☰)은 맨 앞 그대로
      left.classList.add('rr-has-co');
      left.insertBefore(chip, left.querySelector('.rr-top-title'));
    }
    else document.body.insertBefore(chip, document.body.firstChild);
    ['rr-co-m', 'rr-co-crumb'].forEach(function (id) { var x = document.getElementById(id); if (x) x.remove(); });
    var title = document.querySelector('.rr-top-title');
    if (title) {   // 좁은 화면: 앱 바 제목 위 한 줄
      var cr = el('span', 'rr-co-crumb', o.company);
      cr.id = 'rr-co-crumb';
      title.insertBefore(cr, title.firstChild);
    }
    var bar = document.querySelector('.container > .header');
    if (bar && o.missing) {
      var m = chip.cloneNode(true);
      m.id = 'rr-co-m';
      m.classList.add('m');
      bar.insertAdjacentElement('afterend', m);
    }

    /* 로딩 화면의 부제 → 회사 이름 (사이드바 로고 밑 '법규 개정 모니터링'은 그대로 — 회사 이름은 앱 바 맨 앞에만) */
    document.querySelectorAll('.rr-boot-sub').forEach(function (x) { x.textContent = o.company; });

    /* 브라우저 탭 제목: 탭을 바꿔도 회사 이름이 앞에 오게 */
    var prefix = o.company + ' · ';
    function fix() { if (document.title.indexOf(prefix) !== 0) document.title = prefix + document.title.replace(/^RegRader · /, ''); }
    fix();
    var t = document.querySelector('title');
    if (t && window.MutationObserver && !window.__rrCoTitle) {
      window.__rrCoTitle = new MutationObserver(fix);
      window.__rrCoTitle.observe(t, { childList: true, characterData: true, subtree: true });
    }
  };
})();
