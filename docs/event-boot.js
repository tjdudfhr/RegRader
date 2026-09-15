/* Event-model overlay: one row per (title + effectiveDate + amendmentType) */
(function () {
  function todayKST() {
    const k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return new Date(k.getFullYear(), k.getMonth(), k.getDate());
  }
  function expandMini(rows) {
    return (rows || []).map(function (r, i) {
      return {
        id: 'ev_' + i,
        title: r.t,
        summary: (r.t || '') + ' 2026',
        effectiveDate: r.d,
        amendmentType: r.a === '\uc77c' ? '\uc77c\ubd80\uac1c\uc815' : (r.a === '\ud0c0' ? '\ud0c0\ubc95\uac1c\uc815' : r.a),
        status: r.s === 0 ? '\ud604\ud589' : '\uc2dc\ud589\uc608\uc815',
        ministry: r.m || '',
        categories: r.c ? [r.c] : [],
        source: { url: r.u ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + r.u) : '' },
        amendments: [{ date: r.d, amendmentType: r.a === '\uc77c' ? '\uc77c\ubd80\uac1c\uc815' : '\ud0c0\ubc95\uac1c\uc815' }],
        originalTitle: r.t
      };
    });
  }
  function enrich(items) {
    const today = todayKST();
    items.forEach(function (it) {
      if (!it.effectiveDate) return;
      const days = Math.round((new Date(it.effectiveDate + 'T00:00:00+09:00') - today) / 86400000);
      it.daysUntil = days;
      it.inForce = days <= 0;
      it.status = days <= 0 ? '\ud604\ud589' : '\uc2dc\ud589\uc608\uc815';
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
        g.eventIndex = i + 1;
        g.eventCount = group.length;
        g.sameTitlePastCount = past;
        g.sameTitleUpcomingCount = group.length - past;
        g.timeline = timeline;
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
    el.innerHTML = '<b>\uc774\ubca4\ud2b8 \ubaa8\ub378</b> \uac1c\uc815 ' + items.length + '\uac74 / \ubc95\ub839 ' + Object.keys(titles).length +
      '\uac1c \u00b7 \uc2dc\ud589\uc644\ub8cc ' + past + ' \u00b7 \uc2dc\ud589\uc608\uc815 ' + (items.length - past) +
      ' \u00b7 \ubcf5\uc218\uac1c\uc815 ' + Object.keys(multi).length +
      ' \u00b7 \uc774\ubbf8\uc2dc\ud589+\ucd94\uac00\uc608\uc815 ' + Object.keys(both).length +
      ' <a href="./watch.html" style="color:#9fd1ff">Watch D-30</a>';
    document.body.insertBefore(el, document.body.firstChild);
  }
  function apply(items) {
    items = enrich(items);
    window.lawsData = items;
    try { lawsData = items; } catch (e) {}
    try { filteredLaws = items.slice(); } catch (e) {}
    banner(items);
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
        const parts = await Promise.all([
          loadJSON('./events_mini_0.json'),
          loadJSON('./events_mini_1.json')
        ]);
        rows = [].concat.apply([], parts);
      } catch (e0) {
        try { rows = await loadJSON('./events_mini.json'); } catch (e1) {
          const data = await loadJSON('./index.json');
          apply(Array.isArray(data) ? data : (data.items || []));
          return;
        }
      }
      if (rows && rows.length) apply(expandMini(rows));
    } catch (e) { console.warn('event-boot', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
})();
