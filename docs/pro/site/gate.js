/* 화면 잠금 — 비밀번호를 넣어야 RegRader 화면이 보인다 (한 번 맞히면 이 브라우저에 기억).
 *
 * 모든 화면(<head> 맨 앞)에서 불린다: index · watch · history · mobile_v2 · pro/ (브라우저판 Pro · 회사 화면).
 * 아래에 최신 화면 확인도 같이 한다 (맨 먼저 불리는 파일이라).
 * GitHub Pages 는 서버가 없어 '화면 잠금'이다: 공개 저장소의 자료(json)와 코드는 주소로 직접 받을 수 있다.
 * 비밀번호 원문은 넣지 않고 SHA-256 해시만 비교한다. 바꾸려면 HASH 를 새 비밀번호의 해시로.
 */
/* 최신 화면 확인 — GitHub Pages 는 화면 파일을 브라우저가 10분까지 저장해 두고 다시 쓴다.
 * 서버의 화면이 지금 연 것보다 새로우면 한 번 새로 연다 (다른 컴퓨터 · 휴대폰에서 예전 화면이 나오지 않게). */
(function () {
  'use strict';
  try {
    var key = 'rr-fresh:' + location.pathname;
    if (Date.now() - Number(sessionStorage.getItem(key) || 0) < 60000) return;   // 방금 새로 열었으면 또 확인하지 않는다
    var mine = Date.parse(document.lastModified);
    if (!mine) return;
    fetch(location.pathname, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      var srv = Date.parse(r.headers.get('last-modified') || '');
      if (r.ok && srv && srv - mine > 5000) {
        sessionStorage.setItem(key, String(Date.now()));
        location.reload();
      }
    }).catch(function () {});
  } catch (e) { /* 확인을 못 해도 화면은 그대로 연다 */ }
})();

(function () {
  'use strict';
  var HASH = '0c39212c181a0c0182b25a0e9099eb767a9cb3167ed70b9f0ec0bc30322e5265';
  var KEY = 'rr-gate';
  try { if (localStorage.getItem(KEY) === HASH) return; } catch (e) { /* 저장소를 못 쓰면 매번 묻는다 */ }

  var root = document.documentElement;
  root.classList.add('rr-locked');
  var css = document.createElement('style');
  css.textContent = [
    'html.rr-locked body > *:not(#rr-gate) { display: none !important; }',
    'html.rr-locked body { overflow: hidden !important; background: #0f172a !important; }',
    '#rr-gate { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 16px;',
    '  background: radial-gradient(120% 120% at 20% 0%, #1e3a8a 0%, #0f172a 60%); font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif; }',
    '#rr-gate form { width: 100%; max-width: 360px; padding: 28px 26px; border-radius: 16px; background: #fff; box-shadow: 0 20px 60px rgba(0,0,0,.35); }',
    '#rr-gate .mk { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }',
    '#rr-gate .mk b { font-size: 18px; color: #111827; } #rr-gate .mk small { display: block; font-size: 12px; color: #6b7280; }',
    '#rr-gate label { display: block; font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 6px; }',
    '#rr-gate input { width: 100%; box-sizing: border-box; height: 44px; padding: 0 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; }',
    '#rr-gate input:focus { outline: 2px solid #3056d3; outline-offset: 1px; border-color: #3056d3; }',
    '#rr-gate button { width: 100%; height: 44px; margin-top: 12px; border: 0; border-radius: 10px; background: #3056d3; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; }',
    '#rr-gate .err { min-height: 18px; margin-top: 8px; font-size: 12.5px; color: #c53030; }'
  ].join('\n');
  document.head.appendChild(css);

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function show() {
    if (document.getElementById('rr-gate')) return;
    var g = document.createElement('div');
    g.id = 'rr-gate';
    g.innerHTML = '<form autocomplete="off"><div class="mk"><svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#3056d3"/>' +
      '<circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.8"/><path d="M16 16 22.7 9.3" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="16" cy="16" r="2" fill="#fff"/><circle cx="21.2" cy="20.6" r="1.7" fill="#7ee2a8"/></svg><div><b>RegRader</b><small>법규 개정 모니터링</small></div></div>' +
      '<label for="rr-gate-pw">비밀번호</label><input id="rr-gate-pw" type="password" autocomplete="current-password" required>' +
      '<button type="submit">들어가기</button><div class="err" role="alert"></div></form>';
    document.body.appendChild(g);
    var form = g.querySelector('form'), input = g.querySelector('input'), err = g.querySelector('.err');
    input.focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      sha256(input.value).then(function (h) {
        if (h !== HASH) { err.textContent = '비밀번호가 맞지 않습니다.'; input.select(); return; }
        var saved = false;
        try { localStorage.setItem(KEY, HASH); saved = localStorage.getItem(KEY) === HASH; } catch (x) { saved = false; }
        if (saved) { location.reload(); return; }   /* 숨긴 채 그린 차트가 크기 0 이 되지 않게 다시 연다 */
        root.classList.remove('rr-locked'); g.remove();   /* 기억은 못 해도 이번에는 연다 */
      });
    });
  }
  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show);
})();
