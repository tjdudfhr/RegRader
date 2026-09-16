/* 개정이유(__rrWhy) 를 각 항목의 brief 에 반영한다.
 *
 * 데이터 샤드(whyA/whyB/wy0/wy1/why-core)는 index.html 에서 정적으로 불러온다.
 * 예전에는 이 파일이 스크립트를 동적으로 주입했는데, 그러면 같은 파일을 두 번 실행하게 되고
 * 존재하지 않는 샤드를 요청해 404 가 났다. 주입은 제거하고 반영 로직만 남긴다.
 */
(function () {
  function rowFor(item) {
    var id = String((item.meta && item.meta.lsiSeq) || '');
    if (!id) return null;
    var base = (window.__rrWhyBase || {})[id];   // 법제처 원문 전체 세트
    var cur = (window.__rrWhy || {})[id];        // 수기로 다듬은 요지 (있으면 우선)
    if (!base && !cur) return null;
    return Object.assign({}, base, cur);         // 수기본이 이기되, 없는 항목은 원문으로 채움
  }

  function applyRow(item, row) {
    var patch = {
      why: row.w,
      articles: row.a || [],
      diff: row.d || []
    };
    /* row.c = 법제처 '주요내용' 항목들, row.k = 이유·내용이 한 덩어리인 형식 */
    if (row.c && row.c.length) patch.what = row.c.join('\n');
    patch.merged = !!row.k;
    item.brief = Object.assign({}, item.brief || {}, patch);
    item.summary = row.w;
  }

  function applyAll() {
    var data = window.__rrItems || window.lawsData || [];
    var n = 0;
    data.forEach(function (item) {
      var row = rowFor(item);
      if (!row || !row.w) return;
      applyRow(item, row);
      n++;
    });
    return n;
  }

  function attach(id) {
    applyAll();
    var data = window.__rrItems || [];
    var item = data.find(function (x) {
      return x.id === id || (x.altIds || []).indexOf(id) >= 0;
    });
    if (!item) return;
    var row = rowFor(item);
    if (!row || !row.w) return;
    applyRow(item, row);
  }

  var n = 0;
  var t = setInterval(function () {
    applyAll();
    if (window.showLawDetail && !window.showLawDetail.__whyAtt) {
      var orig = window.showLawDetail;
      window.showLawDetail = function (id) {
        attach(id);
        orig(id);
      };
      window.showLawDetail.__whyAtt = true;
    }
    if (++n > 40) clearInterval(t);
  }, 250);
})();
