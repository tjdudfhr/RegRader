/* 이 사이트가 어느 회사의 법규 개정 모니터링인지 표시 — 기업별 적용법규 검색으로 연 회사별 화면과 같은 모양(company-chip.js).
 * 앱 바 맨 앞: [포스코퓨처엠 · 법령 254 · 행정규칙 669] │ 종합 현황   (좁은 화면은 제목 위 한 줄) · 로딩 화면 부제 · 브라우저 탭 제목
 * 숫자는 meta.json (매일 갱신) 의 적용법규 수.
 * 회사별 화면(?company= · pro/site · 맥 서버판)은 그 회사 이름으로 따로 표시하므로 여기서는 건너뛴다.
 */
(function () {
  'use strict';
  var HOME = '포스코퓨처엠';
  function companyView() {
    return /[?&]company=/.test(location.search) || /\/pro\//.test(location.pathname) ||
      !!document.querySelector('script[src*="pro-company.js"], script[src*="company-mode.js"]');
  }
  function dataPath(f) { return window.rrDataPath ? window.rrDataPath(f) : './' + f; }
  function show(meta) {
    if (companyView() || !window.rrCompanyChip) return;
    window.rrCompanyChip({ company: HOME, laws: meta && meta.baseLaws, admin: meta && meta.admrulLaws });
    var chip = document.getElementById('rr-co');
    if (chip) chip.title = HOME + ' 적용법규 기준 법규 개정 모니터링';
  }
  function run() {
    if (companyView()) return;
    show(null);   // 이름부터 바로 — 숫자는 meta.json 을 읽으면 채운다
    fetch(dataPath('meta.json') + '?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { if (m) show(m); })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
