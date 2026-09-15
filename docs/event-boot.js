/* Event-model overlay + popup/job/summary fixes */
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
  function packReason(am, sum) {
    if (!sum) return '';
    var arts = (sum.articles || []).join(', ');
    return '[' + (sum.type || am || '개정') + ']\n◇ 개정이유\n' + (sum.why || '') +
      '\n\n◇ 주요내용\n' + (sum.what || '') +
      (arts ? ('\n【개정문】\n' + arts) : '') +
      (sum.action ? ('\n◇ 실무 반영\n' + sum.action) : '');
  }
  function expandMini(rows, sums) {
    sums = sums || {};
    return (rows || []).map(function (r, i) {
      var am = atype(r.a);
      var sum = sums[String(r.u)] || null;
      var reason = packReason(am, sum);
      return {
        id: 'ev_' + i,
        title: r.t,
        summary: sum && sum.why ? sum.why : ((r.t || '') + ' 2026 ' + am),
        effectiveDate: r.d,
        amendmentType: am,
        status: r.s === 0 ? '현행' : '시행예정',
        ministry: r.m || '',
        categories: r.c ? [r.c] : [],
        source: { url: r.u ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + r.u) : '' },
        amendments: [{ date: r.d, amendmentType: am, reason: reason, mainContents: sum && sum.what }],
        originalTitle: r.t,
        meta: { lsiSeq: String(r.u || ''), matchType: '100%완전일치' },
        brief: sum
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
  function stampJobCounts(items) {
    var cats = ['인사노무','공정거래','정보보호','지식재산권','재무회계','안전','환경','지배구조'];
    var unique = {};
    items.forEach(function (law) { if (law.title && !unique[law.title]) unique[law.title] = law; });
    var counts = {}; cats.forEach(function (c) { counts[c] = 0; });
    Object.keys(unique).forEach(function (t) {
      (unique[t].categories || []).forEach(function (c) { if (counts[c] != null) counts[c]++; });
    });
    cats.forEach(function (c) {
      ['count-' + c, 'job-count-' + c].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = counts[c];
      });
    });
    var all = Object.keys(unique).length;
    ['count-all','job-count-all'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = all;
    });
    var evAll = document.getElementById('count-all');
    if (evAll && items.length) evAll.textContent = items.length;
  }
  function findLaw(lawId) {
    var data = window.lawsData || [];
    if (!data.length) return null;
    var hit = data.find(function (x) { return String(x.id) === String(lawId); });
    if (hit) return hit;
    hit = data.find(function (x) { return x.title === lawId; });
    if (hit) return hit;
    if (lawId && String(lawId).indexOf('|') > 0) {
      var p = String(lawId).split('|');
      hit = data.find(function (x) { return x.title === p[0] && x.effectiveDate === p[1]; });
    }
    return hit || null;
  }
  function renderBrief(item) {
    var b = item.brief || {};
    var arts = (b.articles || []).map(function (a) { return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:999px;background:#eef2ff;font-size:12px;">' + a + '</span>'; }).join('');
    var lsi = (item.meta && item.meta.lsiSeq) || '';
    var src = (item.source && item.source.url) || (lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi) : '');
    return '<div class="summary-section" style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin:0 0 12px;background:#f8fafc">' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:6px">실무 요약</div>' +
      '<div style="font-weight:700;margin-bottom:8px">' + (item.amendmentType || '') + ' · ' + (item.effectiveDate || '') + '</div>' +
      '<div style="margin:0 0 8px"><b>왜 개정됐나</b><br>' + (b.why || item.summary || '개정이유 확인 중') + '</div>' +
      '<div style="margin:0 0 8px"><b>무엇이 바뀌었나</b><br>' + (b.what || '') + '</div>' +
      (arts ? ('<div style="margin:0 0 8px"><b>조문</b><br>' + arts + '</div>') : '') +
      '<div style="margin:0 0 8px"><b>실무 반영</b><br>' + (b.action || '개정 조문을 내부 절차에 반영할 항목이 있는지 확인하세요.') + '</div>' +
      (src ? ('<div><a href="' + src + '" target="_blank">국가법령정보센터 원문</a>' +
        (lsi ? (' · <a href="https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + '&viewCls=lsOldAndNew" target="_blank">신구비교</a>') : '') +
        '</div>') : '') +
      '</div>';
  }
  function patchPopup() {
    var prev = window.showLawDetail;
    window.showLawDetail = function (lawId) {
      var data = window.lawsData || [];
      if (!data.length) {
        alert('법령 데이터를 로드하는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      var item = findLaw(lawId);
      if (!item) {
        console.warn('law not found', lawId);
        alert('해당 법령 이벤트를 찾지 못했습니다. 목록을 새로고침한 뒤 다시 눌러주세요.');
        return;
      }
      try {
        var t = document.getElementById('modal-title');
        if (t) t.textContent = item.title || '법령 제목';
        var s = document.getElementById('modal-subtitle');
        if (s) s.textContent = (item.ministry || '') + ' • ' + (item.amendmentType || '') + ' • ' + (item.effectiveDate || '');
      } catch (e) {}
      if (typeof prev === 'function') {
        try { prev(item.id); } catch (e) {}
      }
      try {
        if (typeof generateAISummary === 'function') generateAISummary(item);
      } catch (e) {}
      var box = document.getElementById('modal-summary');
      if (box) {
        var brief = renderBrief(item);
        if (box.innerHTML.indexOf('실무 요약') < 0) box.innerHTML = brief + box.innerHTML;
      }
      var modal = document.getElementById('law-modal');
      if (modal) modal.classList.add('show');
    };
    if (!window.__rrClickBound) {
      window.__rrClickBound = true;
      document.addEventListener('click', function (ev) {
        var n = ev.target;
        while (n && n !== document) {
          if (n.getAttribute && (n.getAttribute('data-eid') || n.getAttribute('data-law-id'))) {
            ev.preventDefault();
            window.showLawDetail(n.getAttribute('data-eid') || n.getAttribute('data-law-id'));
            return;
          }
          n = n.parentNode;
        }
      }, true);
    }
  }
  function apply(items) {
    items = enrich(items);
    window.lawsData = items;
    try { lawsData = items; } catch (e) {}
    try { filteredLaws = items.slice(); } catch (e) {}
    banner(items);
    stampJobCounts(items);
    try {
      var tot = document.getElementById('total-law-count');
      if (tot) tot.textContent = items.length;
      var past = items.filter(function (x) { return x.inForce; }).length;
      var imp = document.getElementById('implemented-law-count');
      if (imp) imp.textContent = past;
      var pen = document.getElementById('amendment-law-count');
      if (pen) pen.textContent = items.length - past;
    } catch (e) {}
    patchPopup();
    try { if (typeof displayLawList === 'function') displayLawList(items); } catch (e) {}
    try { if (typeof updateTabCounts === 'function') updateTabCounts(); } catch (e) {}
    try { if (typeof updateQuarterlyCounts === 'function') updateQuarterlyCounts(); } catch (e) {}
    try { if (typeof updateJobFunctionDataWithCompanyLaws === 'function') updateJobFunctionDataWithCompanyLaws(); } catch (e) {}
    stampJobCounts(items);
  }
  async function loadJSON(url) {
    const r = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(url);
    return r.json();
  }
  async function boot() {
    try {
      var rows = [];
      var sums = {};
      try { sums = await loadJSON('./summaries.json'); } catch (eS) { sums = {}; }
      try {
        var mini = await loadJSON('./events_mini.json');
        if (Array.isArray(mini) && mini.length && mini[0].t) rows = mini;
      } catch (e0) {}
      if (!rows.length) {
        const settled = await Promise.allSettled([0,1,2,3,4,5,6,7].map(function (i) { return loadJSON('./m' + i + '.json'); }));
        settled.forEach(function (s) {
          if (s.status === 'fulfilled' && Array.isArray(s.value) && s.value.length && s.value[0].t) rows = rows.concat(s.value);
        });
        try {
          var extra = await loadJSON('./extra11.json');
          if (Array.isArray(extra) && extra.length && extra[0].t) rows = rows.concat(extra);
        } catch (e2) {}
        var seen = {};
        rows = rows.filter(function (r) {
          var k = (r.t || '') + '|' + (r.d || '') + '|' + (r.a || '');
          if (seen[k]) return false;
          seen[k] = 1;
          return true;
        });
      }
      if (!rows.length) {
        const data = await loadJSON('./index.json');
        apply(Array.isArray(data) ? data : (data.items || []));
        return;
      }
      apply(expandMini(rows, sums));
    } catch (e) { console.warn('event-boot', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
})();
