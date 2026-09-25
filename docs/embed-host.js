/* 시행 임박 · 업데이트 내역 탭 (watch.html / history.html 을 ?embed=1 로 끼워 넣음)
 *  - 끼운 페이지가 알려 주는 높이로 iframe 높이를 맞춘다 (안쪽 스크롤바 없이 한 페이지처럼)
 *  - 시행 임박에서 법령을 누르면 이 페이지의 법령 상세 팝업을 연다
 */
(function () {
  'use strict';
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || !ev.data) return;
    var frames = document.querySelectorAll('iframe.rr-embed');
    var frame = null;
    frames.forEach(function (f) { if (f.contentWindow === ev.source) frame = f; });
    if (!frame) return;
    if (ev.data.rr === 'embed-height' && ev.data.h > 0) frame.style.height = Math.ceil(ev.data.h) + 'px';
    if (ev.data.rr === 'open-law' && ev.data.key && typeof window.showLawDetail === 'function') window.showLawDetail(ev.data.key);
    if (ev.data.rr === 'go-tab' && ev.data.tab && typeof window.switchMainTab === 'function') window.switchMainTab(ev.data.tab);
  });
})();
