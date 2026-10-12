/* 회사 RegRader 화면의 회사 이름 표시 — 화면 맨 위(앱 바, 스크롤해도 보임) · 사이드바 · 로딩 화면 · 브라우저 탭 제목.
 *
 * window.rrCompanyChip({ company, laws, admin, date, home, homeLabel, missing })
 *   company    회사 이름          laws · admin   적용법규(법령) · 행정규칙 수     date  판정한 날
 *   home       다른 회사를 고르는 곳 (Pro 화면)   homeLabel  그 링크 이름
 *   missing    true 면 '이 브라우저에 이 회사 데이터가 없다'고 알린다
 * 브라우저판(company-mode.js)과 맥 서버판 회사 화면(pro-company.js)이 같이 쓴다.
 */
(function () {
  'use strict';
  var css = [
    '.rr-top-left.rr-has-co { display: flex !important; flex-direction: row !important; align-items: center !important; min-width: 0; }',
    '.rr-co { display: flex; align-items: center; gap: 10px; min-width: 0; margin-left: 16px; padding: 5px 14px 5px 6px; border-radius: 12px;',
    '  background: var(--brand-soft, #e8edfb); border: 1px solid color-mix(in srgb, var(--brand, #3056d3) 28%, transparent); }',
    '.rr-co .ic { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--brand-solid, #3056d3); color: #fff; }',
    '.rr-co .ic svg { width: 17px; height: 17px; }',
    '.rr-co .tx { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }',
    '.rr-co b { font-size: 16px; font-weight: 800; color: var(--ink, #111827); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.02em; }',
    '.rr-co small { font-size: 11.5px; font-weight: 600; color: var(--ink-3, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
    '.rr-co small a { color: var(--brand, #3056d3); text-decoration: none; font-weight: 700; }',
    '.rr-co small a:hover { text-decoration: underline; }',
    '.rr-co.miss { background: #fff4e5; border-color: #f6c26b; }',
    '.rr-co.miss .ic { background: #dd6b20; }',
    '.rr-co.m { display: none; }',
    /* 좁은 화면: 앱 바 안에는 자리가 없어 앱 바 바로 아래 한 줄로 */
    '@media (max-width: 900px) { .rr-top-left .rr-co { display: none; }',
    '  .rr-co.m { display: flex; margin: 10px 12px 0; } .rr-co.m b { font-size: 15px; } .rr-co.m small { white-space: normal; } }'
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
    var sub = el('small');
    if (o.missing) {
      sub.appendChild(document.createTextNode('이 브라우저에 이 회사 데이터가 없습니다 · '));
    } else {
      sub.appendChild(document.createTextNode('RegRader Pro 판정 · 법령 ' + (o.laws == null ? '–' : Number(o.laws).toLocaleString()) +
        ' + 행정규칙 ' + (o.admin == null ? '–' : Number(o.admin).toLocaleString()) + (o.date ? ' · ' + o.date : '') + (o.home ? ' · ' : '')));
    }
    if (o.home) {
      var a = el('a', '', o.homeLabel || '다른 회사 검색');
      a.href = o.home;
      sub.appendChild(a);
    }
    tx.appendChild(sub);
    chip.appendChild(ic);
    chip.appendChild(tx);
    chip.title = o.company + (o.missing ? '' : ' 의 적용법규로 만든 RegRader 화면');
    var left = document.querySelector('.rr-top-left');
    if (left) { left.classList.add('rr-has-co'); left.appendChild(chip); }
    else document.body.insertBefore(chip, document.body.firstChild);
    var oldM = document.getElementById('rr-co-m');
    if (oldM) oldM.remove();
    var bar = document.querySelector('.container > .header');
    if (bar) {
      var m = chip.cloneNode(true);
      m.id = 'rr-co-m';
      m.classList.add('m');
      bar.insertAdjacentElement('afterend', m);
    }

    /* 사이드바 · 로딩 화면의 부제 → 회사 이름 */
    document.querySelectorAll('.rr-brand-sub, .rr-boot-sub').forEach(function (x) { x.textContent = o.company; });

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
