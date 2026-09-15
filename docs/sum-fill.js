(function () {
  function applyWhy() {
    var why = window.__rrWhy || {};
    var data = window.__rrItems || window.lawsData || [];
    var n = 0;
    data.forEach(function (item) {
      var u = String((item.meta && item.meta.lsiSeq) || '');
      var row = why[u];
      if (!row || !row.w) return;
      item.brief = Object.assign({}, item.brief || {}, {
        why: row.w,
        articles: row.a || [],
        diff: (row.d || []).map(function (d) { return { a: d.a || '', b: d.b || '', n: d.n || '', k: '변경' }; })
      });
      item.summary = row.w;
      n++;
    });
    return n;
  }
  var tries = 0;
  var t = setInterval(function () {
    var n = applyWhy();
    tries++;
    if (n > 20 || tries > 40) clearInterval(t);
  }, 250);
})();
