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
        summary: (r.t || '') + '의 2026년 개정사항',
        effectiveDate: r.d,
        amendmentType: r.a === '일' ? '일부개정' : (r.a === '타' ? '타법개정' : r.a),
        status: r.s === 0 ? '현행' : '시행예정',
        ministry: r.m || '',
        categories: r.c ? [r.c] : [],
        source: { url: r.u ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + r.u) : '' },
        amendments: [{ date: r.d, amendmentType: r.a === '일' ? '일부개정' : '타법개정' }],
        originalTitle: r.t
      };
    });
  }

  function enrich(items) {
    const today = todayKST();
    items.forEach(function (it) {
      if (!it.effectiveDate) return;
      const d = new Date(it.effectiveDate + 'T00:00:00+09:00');
      const days = Math.round((d - today) / 86400000);
      it.daysUntil = days;
      it.inForce = days <= 0;
      it.status = days <= 0 ? '현행' : '시행예정';
    });
    const by = {};
    items.forEach(function (it) {
      (by[it.title] = by[it.title] || []).push(it);
    });
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
        if (!Array.isArray(g.amendments) || !g.amendments.length) {
          g.amendments = [{ date: g.effectiveDate, amendmentType: g.amendmentType || '' }];
        }
      });
    });
    return items;
  }

  function banner(items) {
    if (document.getElementById('event-model-banner')) return;
    const past = items.filter(function (x) { return x.inForce || x.status === '현행'; }).length;
    const titles = {};
    const multiTitles = {};
    const both = {};
    items.forEach(function (x) {
      titles[x.title] = 1;
      if ((x.eventCount || 1) > 1) multiTitles[x.title] = 1;
      if ((x.sameTitlePastCount || 0) > 0 && (x.sameTitleUpcomingCount || 0) > 0) both[x.title] = 1;
    });
    const el = document.createElement('div');
    el.id = 'event-model-banner';
    el.style.cssText = 'position:sticky;top:0;z-index:9999;background:#12324f;color:#e8eef4;padding:10px 14px;font:14px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
    el.innerHTML = '<b>이벤트 모델</b><span>개정 ' + items.length + '건 / 법령 ' + Object.keys(titles).length +
      '개 · 시행완료 ' + past + ' · 시행예정 ' + (items.length - past) +
      ' · 복수개정 ' + Object.keys(multiTitles).length +
      ' · 이미시행+추가예정 ' + Object.keys(both).length +
      '</span><a href="./watch.html" style="color:#9fd1ff">Watch D-30</a>';
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
    try { if (typeof updateMainDashboardWithCompanyLaws === 'function') updateMainDashboardWithCompanyLaws(); } catch (e) {}
    try { if (typeof updateJobFunctionDataWithCompanyLaws === 'function') updateJobFunctionDataWithCompanyLaws(); } catch (e) {}
  }

  async function loadJSON(url) {
    const r = await fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }

  async function boot() {
    try {
      var items = null;
      try {
        items = expandMini(await loadJSON('./events_mini.json'));
      } catch (e0) {
        try {
          const chunks = await Promise.all([0, 1, 2].map(function (i) { return loadJSON('./events_' + i + '.json'); }));
          items = [].concat.apply([], chunks);
        } catch (e1) {
          const data = await loadJSON('./index.json');
          items = Array.isArray(data) ? data : (data.items || []);
        }
      }
      if (items && items.length) apply(items);
    } catch (e) {
      console.warn('event-boot failed', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  } else {
    setTimeout(boot, 500);
  }
})();
