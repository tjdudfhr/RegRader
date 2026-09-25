/* 직무별 탭 '직무 분석' — 바로 위 '직무별 현황' 필터(전체/각 직무)를 따라 함께 바뀐다.
 *  - 시행 현황 숫자 (시행완료 / 30일 내 / 이후 예정)
 *  - 월별 시행 건수 (전체: 직무별 누적, 직무 선택: 그 직무 색 한 가지)
 *  - 직무별 진행 현황 (시행완료 vs 시행예정 누적 가로 막대, 선택한 직무 강조)
 *  - 많이 개정된 법령 TOP 8 (누르면 상세 팝업), 소관부처 TOP 6
 * 차트 도구는 analytics.js 의 window.rrChartKit 을 함께 쓴다 (같은 색·글자·격자 규칙).
 */
(function () {
  'use strict';
  var charts = {}, cur = 'all', lastKey = '';
  var MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  function todayKST() {
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return new Date(k.getFullYear(), k.getMonth(), k.getDate());
  }
  function days(iso, t) { return Math.round((new Date(iso + 'T00:00:00+09:00') - t) / 86400000); }
  function make(id, cfg) {
    if (charts[id]) charts[id].destroy();
    var el = document.getElementById(id);
    return el ? (charts[id] = new Chart(el, cfg)) : null;
  }
  function top(obj, n) {
    return Object.keys(obj).map(function (k) { return [k, obj[k]]; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, n);
  }

  function render(force) {
    var K = window.rrChartKit, items = window.__rrItems || [];
    var root = document.getElementById('rr-job-an');
    if (!K || !root || !items.length || typeof Chart === 'undefined') return false;
    var year = K.yearOf(items);
    var all = items.filter(function (x) { return String(x.effectiveDate || '').slice(0, 4) === year; });
    var sel = cur === 'all' ? all : all.filter(function (x) { return (x.categories || [])[0] === cur; });
    var key = cur + '|' + sel.length + '|' + (window.rrIsDark && window.rrIsDark());
    if (!force && key === lastKey) return true;
    lastKey = key;

    var k = K.ink(), R = K.ramp(), today = todayKST(), cats = window.RR_CAT_ORDER || [];
    var label = cur === 'all' ? '전체 직무' : cur;
    var color = cur === 'all' ? R[1] : window.rrCatColor(cur);
    document.getElementById('rr-job-an-title').textContent = year + '년 ' + label + ' 개정 분석';
    var lt = document.querySelector('#business-content .law-list-title');
    if (lt && lt.firstChild && lt.firstChild.nodeType === 3) lt.firstChild.textContent = '📋 ' + (cur === 'all' ? '' : cur + ' ') + '개정 법령 목록 ';

    /* 시행 현황 숫자 */
    var done = 0, soon = 0, later = 0;
    sel.forEach(function (x) { var d = days(x.effectiveDate, today); if (d < 0) done++; else if (d <= 30) soon++; else later++; });
    var titles = {};
    sel.forEach(function (x) { titles[x.title] = 1; });
    document.getElementById('rr-job-tiles').innerHTML = [
      ['개정 건수', sel.length, '법령 ' + Object.keys(titles).length + '개의 개정 합계'],
      ['시행완료', done, sel.length ? Math.round(done / sel.length * 100) + '%' : ''],
      ['30일 내 시행', soon, soon ? '⏰ 준비 필요' : '없음'],
      ['이후 시행예정', later, '']
    ].map(function (t, i) {
      return '<div class="rr-job-tile' + (i === 2 && soon ? ' hot' : '') + '"><span>' + t[0] + '</span><b>' + t[1] + '</b><small>' + t[2] + '</small></div>';
    }).join('');

    /* 월별 시행 건수 */
    var curM = String(today.getFullYear()) === year ? today.getMonth() : (Number(year) < today.getFullYear() ? 12 : -1);
    var monthly;
    if (cur === 'all') {
      monthly = cats.map(function (c) {
        var d = MONTHS.map(function () { return 0; });
        all.forEach(function (x) { if ((x.categories || [])[0] === c) d[Number(x.effectiveDate.slice(5, 7)) - 1]++; });
        return { label: c, data: d, backgroundColor: window.rrCatColor(c), borderColor: k.surface, borderWidth: { top: 2 }, borderSkipped: false, maxBarThickness: 28 };
      });
    } else {
      var d = MONTHS.map(function () { return 0; });
      sel.forEach(function (x) { d[Number(x.effectiveDate.slice(5, 7)) - 1]++; });
      monthly = [{ label: cur, data: d, backgroundColor: MONTHS.map(function (_, i) { return i < curM ? color + '99' : color; }), borderRadius: 4, maxBarThickness: 28 }];
    }
    make('rr-job-monthly', {
      type: 'bar',
      data: { labels: MONTHS, datasets: monthly },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
        plugins: {
          legend: { display: cur === 'all', position: 'top', align: 'start', labels: { color: k.text, boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 10 } },
          tooltip: { mode: 'index', filter: function (c) { return c.parsed.y > 0; }, callbacks: {
            title: function (c) { var i = c[0].dataIndex; return year + '년 ' + c[0].label + (i === curM ? ' (이번 달)' : ''); } } }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: k.muted, font: { size: 11 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: k.grid }, border: { display: false }, ticks: { color: k.muted, font: { size: 11 }, precision: 0, maxTicksLimit: 5 } }
        }
      }
    });
    document.getElementById('rr-job-monthly-note').textContent = cur === 'all' ? '직무별 누적' : '연한 막대 = 지난 달';

    /* 직무별 진행 현황 (시행완료 vs 시행예정) */
    var jobs = cats.map(function (c) {
      var xs = all.filter(function (x) { return (x.categories || [])[0] === c; });
      var p = xs.filter(function (x) { return days(x.effectiveDate, today) < 0; }).length;
      return [c, p, xs.length - p];
    }).sort(function (a, b) { return (b[1] + b[2]) - (a[1] + a[2]); });
    var dim = function (c, col) { return cur === 'all' || c === cur ? col : col + '40'; };
    make('rr-job-progress', {
      type: 'bar',
      data: {
        labels: jobs.map(function (j) { return j[0]; }),
        datasets: [
          { label: '시행완료', data: jobs.map(function (j) { return j[1]; }), backgroundColor: jobs.map(function (j) { return dim(j[0], R[3]); }), borderColor: k.surface, borderWidth: { right: 2 }, borderSkipped: false, barPercentage: 0.72 },
          { label: '시행예정', data: jobs.map(function (j) { return j[2]; }), backgroundColor: jobs.map(function (j) { return dim(j[0], R[0]); }), borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: false, barPercentage: 0.72 }
        ]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 28 } },
        onClick: function (e, el) { if (el.length) pick(jobs[el[0].index][0]); },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: {
          /* 범례 색은 흐리게 처리한 막대가 아니라 원래 색으로 */
          legend: { position: 'top', align: 'start', labels: { color: k.text, boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 10,
            generateLabels: function () { return [['시행완료', R[3]], ['시행예정', R[0]]].map(function (l, i) { return { text: l[0], fillStyle: l[1], strokeStyle: l[1], lineWidth: 0, fontColor: k.text, datasetIndex: i }; }); } } },
          rrEndLabels: { color: k.text, totals: jobs.map(function (j) { return j[1] + j[2]; }) },
          tooltip: { mode: 'index', callbacks: { footer: function () { return '눌러서 이 직무만 보기'; } } }
        },
        scales: (function () { var s = K.hbarScales(k, Math.max.apply(null, jobs.map(function (j) { return j[1] + j[2]; }).concat([1]))); s.x.stacked = true; s.y.stacked = true;
          s.y.ticks.color = function (c) { var n = jobs[c.index] && jobs[c.index][0]; return cur === 'all' || n === cur ? k.text : k.muted; }; return s; })()
      },
      plugins: [K.endLabels]
    });

    /* 많이 개정된 법령 TOP 8 */
    var byLaw = {};
    sel.forEach(function (x) { (byLaw[x.title] = byLaw[x.title] || []).push(x); });
    var laws = Object.keys(byLaw).map(function (t) { return [t, byLaw[t].length, byLaw[t]]; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, 8);
    var short = function (t) { if (t.length <= 16) return t; var tail = (t.match(/ (시행령|시행규칙)$/) || [''])[0]; return t.slice(0, 15 - tail.length) + '…' + tail; };
    make('rr-job-laws', {
      type: 'bar',
      data: { labels: laws.map(function (l) { return short(l[0]); }), datasets: [{ data: laws.map(function (l) { return l[1]; }),
        backgroundColor: laws.map(function (l) { return window.rrCatColor((l[2][0].categories || [])[0]); }), borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72, maxBarThickness: 24 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 24 } },
        onClick: function (e, el) {
          if (!el.length || typeof window.showLawDetail !== 'function') return;
          var evs = laws[el[0].index][2].slice().sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)); });
          var t = today.toISOString().slice(0, 10);
          var next = evs.filter(function (x) { return x.effectiveDate >= t; })[0] || evs[evs.length - 1];
          window.showLawDetail(next._key || next.id);
        },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text },
          tooltip: { callbacks: { title: function (c) { return laws[c[0].dataIndex][0]; }, label: function (c) { return ' 올해 ' + c.parsed.x + '회 개정 · 눌러서 가장 가까운 개정 보기'; } } } },
        scales: K.hbarScales(k, laws[0] ? laws[0][1] : 1)
      },
      plugins: [K.endLabels]
    });
    document.getElementById('rr-job-laws-empty').style.display = laws.length ? 'none' : 'block';

    /* 소관부처 TOP 6 */
    var byMin = {};
    sel.forEach(function (x) { String(x.ministry || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (m) { byMin[m] = (byMin[m] || 0) + 1; }); });
    var mins = top(byMin, 6);
    make('rr-job-min', {
      type: 'bar',
      data: { labels: mins.map(function (m) { return m[0]; }), datasets: [{ data: mins.map(function (m) { return m[1]; }), backgroundColor: color, borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72, maxBarThickness: 24 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 24 } },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text }, tooltip: { callbacks: { label: function (c) { return ' 개정 ' + c.parsed.x + '건'; } } } },
        scales: K.hbarScales(k, mins[0] ? mins[0][1] : 1) },
      plugins: [K.endLabels]
    });
    return true;
  }

  /* 필터 버튼과 연결: 버튼을 누르면 cur 가 바뀌고 차트가 다시 그려진다 */
  function pick(cat) {
    var t = document.querySelector('.filter-tab[data-filter="' + cat + '"]');
    if (t) t.click(); else { cur = cat; render(true); }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#business-content .filter-tab[data-filter]');
    if (!t) return;
    cur = t.getAttribute('data-filter') || 'all';
    setTimeout(function () { render(true); }, 60);
  });
  /* 직무별 탭이 보일 때 그린다 (숨겨진 상태에서 그리면 크기가 0) */
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.main-tab[data-tab="business"]')) setTimeout(function () { render(true); }, 180);
  });
  var origSwitch = window.switchMainTab;
  if (typeof origSwitch === 'function') {
    window.switchMainTab = function (name) {
      var r = origSwitch.apply(this, arguments);
      if (name === 'business') setTimeout(function () { render(true); }, 180);
      return r;
    };
  }

  var st = document.createElement('style');
  st.textContent = [
    '#rr-job-an { margin-bottom: 1.5rem; }',
    '.rr-job-tiles { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:.8rem; margin: .8rem 0 1rem; }',
    '.rr-job-tile { background: var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius: 12px; padding: .8rem 1rem; display:flex; flex-direction:column; gap:.1rem; }',
    '.rr-job-tile span { font-size:.78rem; color: var(--text-muted); font-weight:600; }',
    '.rr-job-tile b { font-size:1.6rem; font-weight:800; color: var(--text-primary); line-height:1.2; }',
    '.rr-job-tile small { font-size:.75rem; color: var(--text-muted); }',
    '.rr-job-tile.hot { border-color: rgba(229,62,62,.45); background: rgba(229,62,62,.07); }',
    '.rr-job-tile.hot small { color:#c53030; font-weight:700; }',
    '.rr-job-empty { display:none; padding: 2rem 0; text-align:center; color: var(--text-muted); font-size:.85rem; }',
    '@media (max-width: 900px) { .rr-job-tiles { grid-template-columns: repeat(2, minmax(0,1fr)); } }'
  ].join('\n');
  document.head.appendChild(st);

  var n = 0;
  var iv = setInterval(function () {
    var pane = document.getElementById('business-content');
    if ((pane && pane.offsetParent && render()) || ++n > 120) clearInterval(iv);
  }, 250);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { render(true); });
  }
})();
