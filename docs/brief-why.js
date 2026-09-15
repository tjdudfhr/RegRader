(function () {
  ['whyA.js','whyB.js','wy0.js','wy1.js','why-core.js'].forEach(function (name) {
    var s = document.createElement('script');
    s.src = './' + name + '?v=20260915x';
    document.head.appendChild(s);
  });
  function applyAll() {
    var why = window.__rrWhy || {};
    var data = window.__rrItems || window.lawsData || [];
    var n = 0;
    data.forEach(function (item) {
      var row = why[String((item.meta && item.meta.lsiSeq) || '')];
      if (!row || !row.w) return;
      item.brief = Object.assign({}, item.brief || {}, { why: row.w, articles: row.a || [], diff: row.d || [] });
      item.summary = row.w;
      n++;
    });
    return n;
  }
  function attach(id) {
    applyAll();
    var data = window.__rrItems || [];
    var item = data.find(function (x) { return x.id === id || (x.altIds || []).indexOf(id) >= 0; });
    if (!item) return;
    var row = (window.__rrWhy || {})[String((item.meta && item.meta.lsiSeq) || '')];
    if (!row || !row.w) return;
    item.brief = Object.assign({}, item.brief || {}, { why: row.w, articles: row.a || [], diff: row.d || [] });
    item.summary = row.w;
  }
  var n = 0;
  var t = setInterval(function () {
    applyAll();
    if (window.showLawDetail && !window.showLawDetail.__whyAtt) {
      var orig = window.showLawDetail;
      window.showLawDetail = function (id) { attach(id); orig(id); };
      window.showLawDetail.__whyAtt = true;
    }
    if (++n > 40) clearInterval(t);
  }, 250);
})();
