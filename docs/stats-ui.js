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
    if (document.getElementById('rr-base-count') && (tot.parentNode.textContent || '').indexOf('개정 법규') >= 0) {
      var map = {
        'rr-base-count': 207,
        'total-law-count': s.events,
        'implemented-law-count': s.past,
        'amendment-law-count': s.upcoming
      };
      Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = map[id];
      });
      var lab = tot.parentNode.querySelector('div[style*="0.75rem"]');
      if (lab) lab.textContent = '개정 법규 (복수개정 ' + s.multi + ')';
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
        sub.textContent = '당사 적용 국내법규 207개와 제목이 100% 일치하는 2026년 개정만 집계합니다.';
      }
    }
    var row = tot.parentNode && tot.parentNode.parentNode;
    if (!row) return;
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.flexWrap = 'wrap';
    row.style.gap = '1.15rem 1.4rem';
    row.innerHTML =
      cell('rr-base-count', 207, '당사 적용 국내법규', 'var(--primary)') +
      cell('total-law-count', s.events, '개정 법규 (복수개정 ' + s.multi + ')', 'var(--primary)') +
      cell('implemented-law-count', s.past, '시행완료', '#48bb78') +
      cell('amendment-law-count', s.upcoming, '시행예정', '#d946ef') +
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
  function stampDate() {
    var nodes = document.querySelectorAll('div, span, p');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue;
      var t = el.textContent || '';
      if (/2026\.\s*2\.\s*20|2026-02-20/.test(t)) {
        el.textContent = t
          .replace(/2026\.\s*2\.\s*20\.?\s*(오전\s*11:16:21)?/, '2026. 9. 15.')
          .replace(/2026-02-20/, '2026-09-15');
      }
    }
  }
  function updateUniverseCard() {
    var nodes = document.querySelectorAll('div');
    var card = null;
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i].textContent || '';
      if (t.indexOf('2026년 개정 법규 현황') >= 0 && (t.indexOf('전체 개정') >= 0 || t.indexOf('2,468') >= 0) && nodes[i].children.length < 20) {
        card = nodes[i];
        break;
      }
    }
    if (!card) return;
    card.style.display = '';
    if (document.getElementById('rr-universe-current')) return;
    var nums = card.querySelectorAll('div');
    for (var j = 0; j < nums.length; j++) {
      if ((nums[j].textContent || '').replace(/\s/g, '') === '1,864') {
        var host = nums[j].parentNode && nums[j].parentNode.parentNode ? nums[j].parentNode.parentNode : nums[j].parentNode;
        if (!host) break;
        host.style.display = 'flex';
        host.innerHTML =
          '<div style="text-align:center">' +
          '<div id="rr-universe-current" style="font-size:2rem;font-weight:800;background:var(--primary-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent">2,468</div>' +
          '<div style="font-size:0.8rem;color:var(--text-muted);font-weight:500">현행 (2026 시행)</div></div>' +
          '<div style="text-align:center;margin-left:1.5rem">' +
          '<div id="rr-universe-future" style="font-size:2rem;font-weight:800;color:#d946ef">4,955</div>' +
          '<div style="font-size:0.8rem;color:var(--text-muted);font-weight:500">시행예정</div></div>';
        break;
      }
    }
    var subs = card.querySelectorAll('div');
    for (var k = 0; k < subs.length; k++) {
      if (/시행법령\+시행예정|수집 데이터/.test(subs[k].textContent || '') && !subs[k].children.length) {
        subs[k].textContent = '국가법령정보센터 OpenAPI · 2026-09-15 조회 (시행일 2026-01-01~12-31)';
      }
    }
  }
  function run() {
    hideBar();
    stampDate();
    updateUniverseCard();
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
