/* Load 2026 amendment events and apply event-model to the main dashboard */
(function () {
  function enrich(items) {
    const by = {};
    items.forEach((it) => { (by[it.title] = by[it.title] || []).push(it); });
    Object.values(by).forEach((group) => {
      group.sort((a, b) => String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || '')));
      const past = group.filter((g) => g.status === '현행' || g.inForce).length;
      const timeline = group.map((g) => ({
        effectiveDate: g.effectiveDate,
        amendmentType: g.amendmentType || '',
        status: g.status
      }));
      group.forEach((g, i) => {
        g.eventIndex = i + 1;
        g.eventCount = group.length;
        g.sameTitlePastCount = past;
        g.sameTitleUpcomingCount = group.length - past;
        g.timeline = timeline;
        if (!Array.isArray(g.amendments) || !g.amendments.length) {
          g.amendments = [{ date: g.effectiveDate, amendmentType: g.amendmentType || '', reason: null, mainContents: null }];
        }
      });
    });
    return items;
  }
  function banner(items) {
    if (document.getElementById('event-model-banner')) return;
    const past = items.filter((x) => x.status === '현행' || x.inForce).length;
    const titles = new Set(items.map((x) => x.title));
    const multiTitles = new Set(items.filter((x) => (x.eventCount || 1) > 1).map((x) => x.title));
    const both = new Set(items.filter((x) => (x.sameTitlePastCount || 0) > 0 && (x.sameTitleUpcomingCount || 0) > 0).map((x) => x.title));
    const el = document.createElement('div');
    el.id = 'event-model-banner';
    el.style.cssText = 'position:sticky;top:0;z-index:9999;background:#12324f;color:#e8eef4;padding:10px 14px;font:14px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
    el.innerHTML = '<b>이벤트 모델</b><span>개정 ' + items.length + '건 / 법령 ' + titles.size + '개 · 시행완료 ' + past + ' · 시행예정 ' + (items.length - past) + ' · 복수개정 ' + multiTitles.size + ' · 이미시행+추가예정 ' + both.size + '</span><a href="./watch.html" style="color:#9fd1ff">Watch</a>';
    document.body.insertBefore(el, document.body.firstChild);
  }
  function apply(items) {
    items = enrich(items);
    window.lawsData = items;
    try { lawsData = items; } catch (e) {}
    try { filteredLaws = items.slice(); } catch (e) {}
    banner(items);
    try { if (typeof displayLawList === 'function') displayLawList(items); } catch (e) {}
    try { if (typeof updateQuarterlyCounts === 'function') updateQuarterlyCounts(); } catch (e) {}
    try { if (typeof updateTabCounts === 'function') updateTabCounts(); } catch (e) {}
    try { if (typeof updateMainDashboardWithCompanyLaws === 'function') updateMainDashboardWithCompanyLaws(); } catch (e) {}
    try { if (typeof updateJobFunctionDataWithCompanyLaws === 'function') updateJobFunctionDataWithCompanyLaws(); } catch (e) {}
  }
  async function loadEvents() {
    const files = ['./events_0.json', './events_1.json', './events_2.json'];
    const chunks = await Promise.all(files.map((f) => fetch(f + '?v=' + Date.now(), { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(f);
      return r.json();
    })));
    return chunks.flat();
  }
  async function boot() {
    try {
      apply(await loadEvents());
    } catch (e) {
      try {
        const r = await fetch('./index.json?v=' + Date.now(), { cache: 'no-store' });
        const data = await r.json();
        if (data && Array.isArray(data.items)) apply(data.items);
      } catch (e2) {}
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  } else {
    setTimeout(boot, 600);
  }
})();
