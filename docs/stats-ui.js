/* Official event-model stats on the main cards. Remove this file to roll back. */
(function () {
  function hideBar() {
    var el = document.getElementById('event-model-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function stats(items) {
    var past = items.filter(function (x) { return x.inForce; }).length;
    var titles = {}, multi = {}, both = {};
    items.forEach(function (x) {
      titles[x.title] = 1;
      if ((x.eventCount || 1) > 1) multi[x.title] = 1;
      if ((x.sameTitlePastCount || 0) > 0 && (x.sameTitleUpcomingCount || 0) > 0) both[x.title] = 1;
    });
    return {
      events: items.length,
      laws: Object.keys(titles).length,
      past: past,
      upcoming: items.length - past,
      multi: Object.keys(multi).length,
      both: Object.keys(both).length
    };
  }
  function cell(id, value, label, color) {
    return '<div style="text-align:center;min-width:72px">' +
      '<div id="' + id + '" style="font-size:1.55rem;font-weight:800;color:' + color + '">' + value + '</div>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);font-weight:500">' + label + '</div></div>';
  }
  function paintCard(items) {
    var tot = document.getElementById('total-law-count');
    if (!tot) return;
    var s = stats(items);
    if (document.getElementById('rr-base-count') && (tot.parentNode.textContent || '').indexOf('일치 개정') >= 0) {
      var map = {
        'rr-base-count': 207,
        'total-law-count': s.events,
        'implemented-law-count': s.past,
        'amendment-law-count': s.upcoming,
        'rr-multi-count': s.multi,
        'rr-both-count': s.both
      };
      Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = map[id];
      });
      return;
    }
    var root = tot;
    for (var i = 0; i < 8 && root; i++) {
      if (root.textContent && root.textContent.indexOf('당사 적용') >= 0) break;
      root = root.parentNode;
    }
    if (root && root.querySelector) {
      var sub = root.querySelector('div[style*="text-muted"]');
      if (sub && /기본 법규|매칭/.test(sub.textContent || '')) {
        sub.textContent = '207개 적용법규와 제목이 100% 일치하는 2026년 개정만 집계합니다.';
      }
    }
    var row = tot.parentNode && tot.parentNode.parentNode;
    if (!row) return;
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.flexWrap = 'wrap';
    row.style.gap = '1.15rem 1.4rem';
    row.innerHTML =
      cell('rr-base-count', 207, '적용 법령', 'var(--primary)') +
      cell('total-law-count', s.events, '일치 개정 건', 'var(--primary)') +
      cell('implemented-law-count', s.past, '시행완료', '#48bb78') +
      cell('amendment-law-count', s.upcoming, '시행예정', '#d946ef') +
      cell('rr-multi-count', s.multi, '복수개정 법령', '#dd6b20') +
      cell('rr-both-count', s.both, '시행+추가예정', '#c53030') +
      '<a href="./watch.html" style="font-size:0.85rem;font-weight:700;color:#2563eb;text-decoration:none;border:1px solid #bfdbfe;border-radius:999px;padding:6px 10px">D-30 알림</a>';
  }
  function paintJobs(items) {
    var CATS = ['인사노무', '공정거래', '정보보호', '지식재산권', '재무회계', '안전', '환경', '지배구조'];
    var unique = {};
    items.forEach(function (law) { if (law.title && !unique[law.title]) unique[law.title] = law; });
    var lawC = {}, evC = {};
    CATS.forEach(function (c) { lawC[c] = 0; evC[c] = 0; });
    Object.keys(unique).forEach(function (t) {
      (unique[t].categories || []).forEach(function (c) { if (lawC[c] != null) lawC[c]++; });
    });
    items.forEach(function (law) {
      (law.categories || []).forEach(function (c) { if (evC[c] != null) evC[c]++; });
    });
    CATS.forEach(function (c) {
      var job = document.getElementById('job-count-' + c);
      if (job) job.textContent = lawC[c] + ' · ' + evC[c] + '건';
    });
    var all = document.getElementById('job-count-all');
    if (all) all.textContent = Object.keys(unique).length + ' · ' + items.length + '건';
  }
  function hideUniverseCard() {
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i].textContent || '';
      if (t.indexOf('전체 개정 법령') >= 0 && t.indexOf('1,864') >= 0 && nodes[i].children.length < 12) {
        if (nodes[i].style) nodes[i].style.display = 'none';
        break;
      }
    }
  }
  function run() {
    hideBar();
    hideUniverseCard();
    var items = window.__rrItems || window.lawsData || [];
    if (items.length < 200) return false;
    paintCard(items);
    paintJobs(items);
    return true;
  }
  var n = 0;
  var t = setInterval(function () {
    hideBar();
    if (run() && ++n > 6) clearInterval(t);
    if (++n > 40) clearInterval(t);
  }, 400);
})();
