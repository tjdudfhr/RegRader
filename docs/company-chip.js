/* 회사 RegRader 화면의 회사 이름 표시 — 앱 바 제목 위 한 줄(스크롤해도 보임) · 로딩 화면 · 브라우저 탭 제목.
 *
 *   포스코퓨처엠                                  ← 회사 줄 (민트 → 하늘색 글자, 숫자 없이 이름만)
 *   종합 현황                                      ← 지금 화면 제목
 *
 * window.rrCompanyChip({ company, laws, admin, date, home, homeLabel, missing })
 *   company    회사 이름          laws · admin   적용법규(법령) · 행정규칙 수     date  판정한 날
 *   home       데이터가 없을 때 판정하러 가는 곳 (Pro 화면)   homeLabel  그 링크 이름
 *   missing    true 면 '이 브라우저에 이 회사 데이터가 없다'고 알린다
 * 브라우저판(company-mode.js) · 맥 서버판 회사 화면(pro-company.js) · RegRader 기본 사이트(home-company.js)가 같이 쓴다.
 */
(function () {
  'use strict';
  var css = [
    /* 넓은 화면: 앱 바를 조금 높여 두 줄 (회사 / 화면 제목) — 왼쪽 로고 칸도 같은 높이(--top-h) */
    '@media (min-width: 1101px) { :root { --top-h: 72px; } }',
    '.rr-co { display: flex; align-items: baseline; gap: 8px; min-width: 0; margin: 0 0 2px; line-height: 1.2; white-space: nowrap; }',
    '.rr-co .nm { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis;',
    '  background: linear-gradient(90deg, #7ee2a8 0%, #8fd3ff 55%, #a9b8ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }',
    '.rr-co .ct { display: inline-flex; align-items: baseline; gap: 8px; font-size: 12px; font-weight: 600; color: rgba(214, 224, 255, .56); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; }',
    '.rr-co .ct::before { content: ""; width: 3px; height: 3px; border-radius: 50%; background: rgba(214, 224, 255, .45); align-self: center; flex: none; }',
    '.rr-co .go { flex: none; align-self: center; display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 7px; text-decoration: none;',
    '  font-size: 11.5px; font-weight: 700; color: #e6ecff; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .16); }',
    '.rr-co .go:hover { background: rgba(255, 255, 255, .15); }',
    '.rr-co.miss .nm { background: none; color: #ffd08a; }',
    '.rr-co.miss .ct { color: #ffcf8a; }',
    /* 화면 제목은 회사 이름 아래 작게 (회사 이름이 먼저 눈에 들어오게) */
    '#rr-page-title { line-height: 1.25 !important; font-size: 14.5px !important; font-weight: 700 !important; letter-spacing: -0.01em !important; }',
    'body > .container > .header #rr-page-title { color: rgba(236, 241, 255, .82) !important; }',
    /* 좁은 화면: 회사 줄은 이름만 (숫자는 숨김). 데이터가 없을 때만 앱 바 아래 안내 줄 */
    '@media (max-width: 1100px) { .rr-co .nm { font-size: 17px; } }',
    '@media (max-width: 760px) { .rr-co { margin-bottom: 1px; } .rr-co .nm { font-size: 16px; } #rr-page-title { font-size: 13.5px !important; } .rr-co .ct, .rr-top-title .rr-co .go { display: none; } }',
    '.rr-co.m { display: none; }',
    '@media (max-width: 760px) { .rr-co.m.miss { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; white-space: normal; margin: 12px 14px 0; padding: 10px 12px;',
    '  border: 1px solid var(--line, #e5e7eb); border-radius: 14px; background: var(--surface, #fff); }',
    '  .rr-co.m .nm { color: var(--ink, #111827); font-size: 14px; } .rr-co.m .ct { display: inline-flex; color: #b45309; white-space: normal; }',
    '  .rr-co.m .go { display: inline-flex; color: var(--brand, #3056d3); background: var(--brand-soft, #eef2ff); border-color: transparent; } }'
  ].join('\n');

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
    ['rr-co', 'rr-co-m', 'rr-co-crumb'].forEach(function (id) { var x = document.getElementById(id); if (x) x.remove(); });
    var n = function (x) { return x == null ? '' : Number(x).toLocaleString(); };
    var line = el('div', 'rr-co' + (o.missing ? ' miss' : ''));
    line.id = 'rr-co';
    line.setAttribute('role', 'note');
    line.appendChild(el('span', 'nm', o.company));
    var ct = o.missing ? '이 브라우저에 이 회사 데이터가 없습니다' : '';   // 법령 · 행정규칙 수는 앱 바에 넣지 않는다 (이름만)
    if (ct) line.appendChild(el('span', 'ct', ct));
    if (o.home && o.missing) {   // 데이터가 없을 때만 'RegRader Pro 에서 판정하기' (다른 회사는 '기업별 적용법규 검색' 버튼으로)
      var a = el('a', 'go', o.homeLabel || '판정하기');
      a.href = o.home;
      line.appendChild(a);
    }
    line.title = o.company + (o.missing ? '' : ' 의 적용법규로 만든 RegRader 화면' +
      (o.laws != null ? ' (법령 ' + n(o.laws) + ' · 행정규칙 ' + n(o.admin) + (o.date ? ' · ' + o.date + ' 판정' : '') + ')' : ''));
    var title = document.querySelector('.rr-top-title');
    if (title) title.insertBefore(line, title.firstChild);   // 앱 바: 회사 줄 / 화면 제목
    else document.body.insertBefore(line, document.body.firstChild);
    var bar = document.querySelector('.container > .header');
    if (bar && o.missing) {   // 좁은 화면에서 '판정하기' 안내
      var m = line.cloneNode(true);
      m.id = 'rr-co-m';
      m.classList.add('m');
      bar.insertAdjacentElement('afterend', m);
    }

    /* 로딩 화면의 부제 → 회사 이름 (사이드바 로고 밑 '법규 개정 모니터링'은 그대로) */
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
