(function () {
  [0,1,2,3,4,5,6,7].forEach(function (i) {
    var s = document.createElement('script');
    s.src = './wy' + i + '.js?v=20260915w';
    document.head.appendChild(s);
  });
  function attach(id) {
    var data = window.__rrItems || window.lawsData || [];
    var item = data.find(function (x) {
      return x.id === id || (x.altIds || []).indexOf(id) >= 0;
    });
    if (!item) return;
    var row = (window.__rrWhy || {})[String((item.meta && item.meta.lsiSeq) || '')];
    if (!row || !row.w) return;
    item.brief = Object.assign({}, item.brief || {}, {
      why: row.w,
      articles: row.a || [],
      diff: row.d || []
    });
    item.summary = row.w;
  }
  var n = 0;
  var t = setInterval(function () {
    if (window.showLawDetail && !window.showLawDetail.__whyAtt) {
      var orig = window.showLawDetail;
      window.showLawDetail = function (id) {
        attach(id);
        orig(id);
      };
      window.showLawDetail.__whyAtt = true;
    }
    var data = window.__rrItems || [];
    var why = window.__rrWhy || {};
    data.forEach(function (item) {
      var row = why[String((item.meta && item.meta.lsiSeq) || '')];
      if (!row || !row.w) return;
      item.brief = Object.assign({}, item.brief || {}, { why: row.w, articles: row.a || [], diff: row.d || [] });
      item.summary = row.w;
    });
    if (++n > 40) clearInterval(t);
  }, 250);
})();
