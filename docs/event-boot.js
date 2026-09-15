/* Event-model overlay */
(function () {
  function todayKST() {
    const k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return new Date(k.getFullYear(), k.getMonth(), k.getDate());
  }
  function atype(a) {
    if (a === '일') return '일부개정';
    if (a === '타') return '타법개정';
    return a || '';
  }
  function expandMini(rows) {
    return (rows || []).map(function (r, i) {
      var am = atype(r.a);
      return {
        id: 'ev_' + i, title: r.t, summary: (r.t || '') + ' 2026',
        effectiveDate: r.d, amendmentType: am,
        status: r.s === 0 ? '현행' : '시행예정',
        ministry: r.m || '', categories: r.c ? [r.c] : [],
        source: { url: r.u ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + r.u) : '' },
        amendments: [{ date: r.d, amendmentType: am }], originalTitle: r.t
      };
    });
  }
  function enrich(items) {
    const today = todayKST();
    items.forEach(function (it) {
      if (!it.effectiveDate) return;
      const days = Math.round((new Date(it.effectiveDate + 'T00:00:00+09:00') - today) / 86400000);
      it.daysUntil = days; it.inForce = days <= 0;
      it.status = days <= 0 ? '현행' : '시행예정';
    });
    const by = {};
    items.forEach(function (it) { (by[it.title] = by[it.title] || []).push(it); });
    Object.keys(by).forEach(function (title) {
      const group = by[title].slice().sort(function (a, b) {
        return String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || ''));
      });
      const past = group.filter(function (g) { return g.inForce; }).length;
      const timeline = group.map(function (g) {
        return { effectiveDate: g.effectiveDate, amendmentType: g.amendmentType || '', status: g.status };
      });
      group.forEach(function (g, i) {
        g.eventIndex = i + 1; g.eventCount = group.length;
        g.sameTitlePastCount = past; g.sameTitleUpcomingCount = group.length - past; g.timeline = timeline;
      });
    });
    return items;
  }
  function banner(items) {
    if (document.getElementById('event-model-banner')) return;
    const past = items.filter(function (x) { return x.inForce; }).length;
    const titles = {}, multi = {}, both = {};
    items.forEach(function (x) {
      titles[x.title] = 1;
      if ((x.eventCount || 1) > 1) multi[x.title] = 1;
      if ((x.sameTitlePastCount || 0) > 0 && (x.sameTitleUpcomingCount || 0) > 0) both[x.title] = 1;
    });
    const el = document.createElement('div');
    el.id = 'event-model-banner';
    el.style.cssText = 'position:sticky;top:0;z-index:9999;background:#12324f;color:#e8eef4;padding:10px 14px;font:14px/1.45 -apple-system,sans-serif';
    el.innerHTML = '<b>이벤트 모델</b> 개정 ' + items.length + '건 / 법령 ' + Object.keys(titles).length +
      '개 · 시행완료 ' + past + ' · 시행예정 ' + (items.length - past) +
      ' · 복수개정 ' + Object.keys(multi).length +
      ' · 이미시행+추가예정 ' + Object.keys(both).length +
      ' <a href="./watch.html" style="color:#9fd1ff">Watch D-30</a>';
    document.body.insertBefore(el, document.body.firstChild);
  }
  function apply(items) {
    items = enrich(items);
    window.lawsData = items;
    try { lawsData = items; } catch (e) {}
    try { filteredLaws = items.slice(); } catch (e) {}
    banner(items);
    try {
      var tot = document.getElementById('total-law-count');
      if (tot) tot.textContent = items.length;
      var past = items.filter(function (x) { return x.inForce; }).length;
      var imp = document.getElementById('implemented-law-count');
      if (imp) imp.textContent = past;
      var pen = document.getElementById('amendment-law-count');
      if (pen) pen.textContent = items.length - past;
      var q = {Q1:0,Q2:0,Q3:0,Q4:0};
      items.forEach(function (it) {
        var d = it.effectiveDate || '';
        if (d >= '2026-01-01' && d <= '2026-03-31') q.Q1++;
        else if (d <= '2026-06-30') q.Q2++;
        else if (d <= '2026-09-30') q.Q3++;
        else if (d <= '2026-12-31') q.Q4++;
      });
      [['q1-count',q.Q1],['q2-count',q.Q2],['q3-count',q.Q3],['q4-count',q.Q4]].forEach(function (p) {
        var el = document.getElementById(p[0]); if (el) el.textContent = p[1];
      });
    } catch (e) {}
    try { if (typeof displayLawList === 'function') displayLawList(items); } catch (e) {}
    try { if (typeof updateTabCounts === 'function') updateTabCounts(); } catch (e) {}
    try { if (typeof updateQuarterlyCounts === 'function') updateQuarterlyCounts(); } catch (e) {}
    try { if (typeof updateJobFunctionDataWithCompanyLaws === 'function') updateJobFunctionDataWithCompanyLaws(); } catch (e) {}
  }
  async function loadJSON(url) {
    const r = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(url);
    return r.json();
  }
  async function boot() {
    try {
      var rows = [];
      try {
        var mini = await loadJSON('./events_mini.json');
        if (Array.isArray(mini) && mini.length && mini[0].t) rows = mini;
      } catch (e0) {}
      if (!rows.length) {
        const settled = await Promise.allSettled([0,1,2,3,4,5,6,7].map(function (i) { return loadJSON('./m' + i + '.json'); }));
        settled.forEach(function (s) {
          if (s.status === 'fulfilled' && Array.isArray(s.value) && s.value.length && s.value[0].t) rows = rows.concat(s.value);
        });
      }
      if (!rows.length) {
        const data = await loadJSON('./index.json');
        apply(Array.isArray(data) ? data : (data.items || []));
        return;
      }
      if (rows && rows.length) apply(expandMini(rows));
    } catch (e) { console.warn('event-boot', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
})();
