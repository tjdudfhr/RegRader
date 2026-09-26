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
    /* 카드 구조는 index.html 에 이미 있다(rr-base-count). 예전에는 '개정 법규' 글자로 판단해서,
       문구를 바꾸면 아래의 옛 경로로 빠져 줄 전체를 다시 그리고 없앤 'D-30 알림' 버튼이 되살아났다. */
    if (document.getElementById('rr-base-count')) {
      var map = {
        'total-law-count': s.events,
        'implemented-law-count': s.past,
        'amendment-law-count': s.upcoming
      };
      Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = map[id];
      });
      var lab = tot.parentNode.querySelector('div[style*="0.75rem"]');
      /* '복수개정 87'을 중복 건수로 오해하기 쉬워서 '중복 포함'을 붙인다. 법규 개수(중복 제외)는 툴팁에만 둔다 */
      if (lab) {
        var nAdm = items.filter(function (x) { return x.kind; }).length;
        lab.textContent = '개정 건수 (중복 포함)';
        lab.title = '올해 개정 ' + s.events + '건 (그중 행정규칙 ' + nAdm + '건)은 한 법규가 여러 번 개정된 것을 각각 센 수입니다 (중복 포함). 중복을 빼면 법령·행정규칙 ' + s.laws + '개, 그중 2회 이상 개정된 것 ' + s.multi + '개';
      }
      paintUrgent(items);
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
        sub.textContent = '당사 적용 국내법규 ' + (window.__rrBaseCount || '–') + '개와 제목이 100% 일치하는 ' + window.RR_YEAR + '년 개정만 집계합니다.';
      }
    }
    var row = tot.parentNode && tot.parentNode.parentNode;
    if (!row) return;
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.flexWrap = 'wrap';
    row.style.gap = '1.15rem 1.4rem';
    row.innerHTML =
      cell('rr-base-count', window.__rrBaseCount || '–', '당사 적용 국내법규', 'var(--primary)') +
      cell('total-law-count', s.events, '개정 건수 (중복 포함) · 법령 ' + s.laws + '개', 'var(--primary)') +
      cell('implemented-law-count', s.past, '시행완료', '#48bb78') +
      cell('amendment-law-count', s.upcoming, '시행예정', '#d946ef') +
      '';
  }
  /* 시행 임박 칸: 30일 이내 시행 건수, 7일 이내가 있으면 빨강+깜빡이는 점 */
  /* 연말에는 다음 해 1~2월 시행분(upcoming_next.json)도 30일 내 시행에 포함한다 */
  var nextRows = null;
  (window.RR_VIEW_YEAR ? Promise.resolve({ ok: false }) : fetch('./upcoming_next.json?v=' + Date.now(), { cache: 'no-store' }))
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) { nextRows = Array.isArray(rows) ? rows : []; if (window.__rrItems) paintUrgent(window.__rrItems); })
    .catch(function () { nextRows = []; });
  function paintUrgent(items) {
    var box = document.getElementById('rr-urgent');
    if (!box) return;
    if (window.RR_VIEW_YEAR) { box.style.display = 'none'; return; } /* 지난 연도 보기에서는 '30일 내 시행'이 의미 없다 */
    items = items.concat((nextRows || []).map(function (r) { return { effectiveDate: r.d }; }));
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    var today = new Date(k.getFullYear(), k.getMonth(), k.getDate());
    var in30 = 0, in7 = 0;
    items.forEach(function (x) {
      if (!x.effectiveDate) return;
      var d = Math.round((new Date(x.effectiveDate + 'T00:00:00+09:00') - today) / 86400000);
      if (d >= 0 && d <= 30) in30++;
      if (d >= 0 && d <= 7) in7++;
    });
    box.className = 'rr-urgent' + (in7 ? ' lvl-urgent' : in30 ? ' lvl-soon' : '');
    document.getElementById('rr-urgent-count').textContent = in30;
    var wb = document.getElementById('tab-badge-watch');
    if (wb) { wb.textContent = in30 ? in30 : ''; wb.title = '30일 내 시행 ' + in30 + '건 (7일 내 ' + in7 + '건)'; }
    document.getElementById('rr-urgent-dot').innerHTML = in7 ? '<span class="rr-urgent-dot"></span>' : '';
    document.getElementById('rr-urgent-sub').innerHTML = in7 ? '· <b>7일 내 ' + in7 + '</b> ' : '';
    box.title = '30일 이내 시행 ' + in30 + '건' + (in7 ? ' (7일 이내 ' + in7 + '건)' : '') + ' · 눌러서 보기';
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
    /* job-count-* 는 적용법규(207개) 소관이라 registry-fix.js 가 관리한다.
       여기서 개정 기준 수치로 덮어쓰면 적용법규 탭 숫자가 어긋난다. */
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
          '<div style="font-size:0.8rem;color:var(--text-muted);font-weight:500">현행 (' + window.RR_YEAR + ' 시행)</div></div>' +
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
    /* 예전에는 '200건 미만이면 옛 데이터'로 보고 그리지 않았다. 연초에는 실제 개정이 수십 건뿐이라 카드가 비므로,
       event-boot 가 불러온 최신 데이터(__rrItems)가 준비됐는지로 판단한다. */
    var items = window.__rrItems || [];
    if (!items.length) return false;
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
