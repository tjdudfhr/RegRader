/* Attach official 개정이유/개정문/신구diff onto loaded events */
(function () {
  function apply(sums) {
    var data = window.__rrItems || window.lawsData || [];
    if (!data.length || !sums) return 0;
    var n = 0;
    data.forEach(function (item) {
      var u = item.meta && item.meta.lsiSeq;
      var sum = sums[String(u || '')];
      if (!sum) return;
      item.brief = Object.assign({}, item.brief || {}, sum);
      if (sum.why) item.summary = sum.why;
      if (sum.action) item.brief.action = Array.isArray(sum.action) ? sum.action : String(sum.action).split(/\n+/);
      n++;
    });
    return n;
  }
  async function load() {
    var sums = {};
    var files = ['./sum0.json', './sum1.json', './sum2.json', './sum3.json', './sum4.json', './sum5.json', './sum_a.json', './sum_b.json'];
    for (var i = 0; i < files.length; i++) {
      try {
        var res = await fetch(files[i] + '?v=20260915q', { cache: 'no-store' });
        if (res.ok) Object.assign(sums, await res.json());
      } catch (e) {}
    }
    window.__rrSums = sums;
    var tries = 0;
    var t = setInterval(function () {
      var n = apply(sums);
      tries++;
      if (n > 50 || tries > 25) clearInterval(t);
    }, 400);
  }
  load();
})();
