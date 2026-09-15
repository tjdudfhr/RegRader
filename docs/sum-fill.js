/* Pull official 개정이유 baked into m0-m7 / extra11 */
(function () {
  function applyRows(rows) {
    var byU = {};
    (rows || []).forEach(function (r) {
      if (r && r.u && r.w) byU[String(r.u)] = r;
    });
    var data = window.__rrItems || window.lawsData || [];
    var n = 0;
    data.forEach(function (item) {
      var u = item.meta && item.meta.lsiSeq;
      var r = byU[String(u || '')];
      if (!r) return;
      var diffs = (r.df || []).map(function (d) {
        if (Array.isArray(d)) return { a: d[0] || '', b: d[1] || '', n: d[2] || '', k: '변경' };
        return d;
      });
      item.brief = Object.assign({}, item.brief || {}, {
        why: r.w,
        articles: r.ar || (item.brief && item.brief.articles) || [],
        diff: diffs.length ? diffs : ((item.brief && item.brief.diff) || []),
        action: r.ac || (item.brief && item.brief.action) || []
      });
      item.summary = r.w;
      n++;
    });
    return n;
  }
  async function load() {
    var files = ['./m0.json','./m1.json','./m2.json','./m3.json','./m4.json','./m5.json','./m6.json','./m7.json','./extra11.json'];
    var rows = [];
    for (var i = 0; i < files.length; i++) {
      try {
        var res = await fetch(files[i] + '?v=20260915r', { cache: 'no-store' });
        if (res.ok) {
          var j = await res.json();
          if (Array.isArray(j)) rows = rows.concat(j);
        }
      } catch (e) {}
    }
    var tries = 0;
    var t = setInterval(function () {
      var n = applyRows(rows);
      tries++;
      if (n > 80 || tries > 25) clearInterval(t);
    }, 300);
  }
  load();
})();
