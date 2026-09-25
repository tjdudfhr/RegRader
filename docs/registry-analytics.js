/* 적용법규 탭 '적용법규 분석' — 왼쪽 '직무 분야'(전체/각 직무)를 따라 함께 바뀐다.
 * 주제: 당사 적용법규(법규등록부) 중 올해 얼마나 개정됐나.
 *  - 숫자: 적용법규 수 / 올해 개정된 법규 / 올해 개정 없음 / 30일 내 시행 예정 법규
 *  - 직무별 적용법규 (올해 개정됨 vs 개정 없음, 누르면 그 직무 선택)
 *  - 올해 개정 횟수 분포 (0회 / 1회 / 2회 / 3회 / 4회 이상)
 *  - 법령 종류 (도넛), 소관부처 TOP 8
 * 적용법규 목록은 base_laws_207.json (법규 추가 시 자동으로 늘어난다), 개정은 window.__rrItems.
 */
(function () {
  'use strict';
  var charts = {}, cur = 'all', base = null, lastKey = '';

  function todayKST() {
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return new Date(k.getFullYear(), k.getMonth(), k.getDate());
  }
  function make(id, cfg) {
    if (charts[id]) charts[id].destroy();
    var el = document.getElementById(id);
    return el ? (charts[id] = new Chart(el, cfg)) : null;
  }
  function loadBase() {
    if (base) return Promise.resolve(base);
    return fetch('./base_laws_207.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { base = d.items || []; return base; })
      .catch(function () { base = []; return base; });
  }

  function render(force) {
    var K = window.rrChartKit, items = window.__rrItems || [];
    var root = document.getElementById('rr-reg-an');
    if (!K || !root || !base || !base.length || !items.length || typeof Chart === 'undefined') return false;
    var key = cur + '|' + base.length + '|' + items.length + '|' + (window.rrIsDark && window.rrIsDark());
    if (!force && key === lastKey) return true;
    lastKey = key;

    var k = K.ink(), R = K.ramp(), today = todayKST(), cats = window.RR_CAT_ORDER || [];
    var year = K.yearOf(items);
    var ev = {};
    items.forEach(function (x) { if (String(x.effectiveDate || '').slice(0, 4) === year) (ev[x.title] = ev[x.title] || []).push(x); });
    var laws = cur === 'all' ? base : base.filter(function (b) { return (b.categories || [])[0] === cur; });
    var label = cur === 'all' ? '전체' : cur;
    document.getElementById('rr-reg-an-title').textContent = label + ' 적용법규 분석 · ' + year + '년 개정 기준';

    /* 숫자 */
    var amended = laws.filter(function (b) { return ev[b.title]; });
    var soonLaws = laws.filter(function (b) {
      return (ev[b.title] || []).some(function (x) { var d = Math.round((new Date(x.effectiveDate + 'T00:00:00+09:00') - today) / 86400000); return d >= 0 && d <= 30; });
    });
    var pct = laws.length ? Math.round(amended.length / laws.length * 100) : 0;
    document.getElementById('rr-reg-tiles').innerHTML = [
      ['적용법규', laws.length, '법규등록부'],
      ['올해 개정된 법규', amended.length, pct + '%'],
      ['올해 개정 없음', laws.length - amended.length, (100 - pct) + '%'],
      ['30일 내 시행 예정', soonLaws.length, soonLaws.length ? '⏰ 준비 필요' : '없음']
    ].map(function (t, i) {
      return '<div class="rr-job-tile' + (i === 3 && soonLaws.length ? ' hot' : '') + '"><span>' + t[0] + '</span><b>' + t[1] + '</b><small>' + t[2] + '</small></div>';
    }).join('');

    /* 직무별 적용법규: 올해 개정됨 vs 개정 없음 */
    var jobs = cats.map(function (c) {
      var bs = base.filter(function (b) { return (b.categories || [])[0] === c; });
      var a = bs.filter(function (b) { return ev[b.title]; }).length;
      return [c, a, bs.length - a];
    }).filter(function (j) { return j[1] + j[2] > 0; }).sort(function (a, b) { return (b[1] + b[2]) - (a[1] + a[2]); });
    var dim = function (c, col) { return cur === 'all' || c === cur ? col : col + '40'; };
    make('rr-reg-jobs', {
      type: 'bar',
      data: {
        labels: jobs.map(function (j) { return j[0]; }),
        datasets: [
          { label: '올해 개정됨', data: jobs.map(function (j) { return j[1]; }), backgroundColor: jobs.map(function (j) { return dim(j[0], R[0]); }), borderColor: k.surface, borderWidth: { right: 2 }, borderSkipped: false, barPercentage: 0.72, maxBarThickness: 24 },
          { label: '개정 없음', data: jobs.map(function (j) { return j[2]; }), backgroundColor: jobs.map(function (j) { return dim(j[0], R[3]); }), borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: false, barPercentage: 0.72, maxBarThickness: 24 }
        ]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 56 } },
        onClick: function (e, el) { if (el.length) pick(jobs[el[0].index][0]); },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: {
          legend: { position: 'top', align: 'start', labels: { color: k.text, boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 10,
            generateLabels: function () { return [['올해 개정됨', R[0]], ['개정 없음', R[3]]].map(function (l, i) { return { text: l[0], fillStyle: l[1], strokeStyle: l[1], lineWidth: 0, fontColor: k.text, datasetIndex: i }; }); } } },
          rrEndLabels: { color: k.text, totals: jobs.map(function (j) { var t = j[1] + j[2]; return j[1] + '/' + t + ' (' + Math.round(j[1] / t * 100) + '%)'; }) },
          tooltip: { mode: 'index', callbacks: { footer: function () { return '눌러서 이 직무만 보기'; } } }
        },
        scales: (function () { var s = K.hbarScales(k, Math.max.apply(null, jobs.map(function (j) { return j[1] + j[2]; }).concat([1]))); s.x.stacked = true; s.y.stacked = true;
          s.y.ticks.color = function (c) { var n = jobs[c.index] && jobs[c.index][0]; return cur === 'all' || n === cur ? k.text : k.muted; }; return s; })()
      },
      plugins: [K.endLabels]
    });

    /* 올해 개정 횟수 분포 */
    var bins = [0, 0, 0, 0, 0];
    laws.forEach(function (b) { var n = (ev[b.title] || []).length; bins[Math.min(n, 4)]++; });
    var binLabels = ['0회', '1회', '2회', '3회', '4회 이상'];
    var barColor = cur === 'all' ? R[1] : window.rrCatColor(cur);
    make('rr-reg-freq', {
      type: 'bar',
      data: { labels: binLabels, datasets: [{ data: bins, backgroundColor: bins.map(function (_, i) { return i === 0 ? (k.muted + '66') : barColor; }), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 44 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { title: function (c) { return '올해 ' + c[0].label + ' 개정된 적용법규'; }, label: function (c) { return ' ' + c.parsed.y + '개 (' + Math.round(c.parsed.y / (laws.length || 1) * 100) + '%)'; } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: k.text, font: { size: 12 } } },
          y: { beginAtZero: true, grid: { color: k.grid }, border: { display: false }, ticks: { color: k.muted, font: { size: 11 }, precision: 0, maxTicksLimit: 5 } }
        } }
    });

    /* 법령 종류 (도넛) */
    var kinds = ['법률', '시행령', '시행규칙'].map(function (kd, i) { return [kd, laws.filter(function (b) { return K.lawKind(b.title) === kd; }).length, R[i]]; });
    var kTotal = kinds.reduce(function (n, r) { return n + r[1]; }, 0);
    make('rr-reg-kind', {
      type: 'doughnut',
      data: { labels: kinds.map(function (r) { return r[0]; }), datasets: [{ data: kinds.map(function (r) { return r[1]; }), backgroundColor: kinds.map(function (r) { return r[2]; }), borderColor: k.surface, borderWidth: 2, hoverOffset: 4 }] },
      options: { cutout: '68%', responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ' ' + c.parsed + '개'; } } } } },
      plugins: [{ id: 'rrRegCenter', afterDraw: function (ch) {
        var a = ch.chartArea, ctx = ch.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = k.text; ctx.font = '800 22px Inter, -apple-system, sans-serif'; ctx.fillText(kTotal, x, y - 6);
        ctx.fillStyle = k.muted; ctx.font = '600 11px Inter, -apple-system, sans-serif'; ctx.fillText('개', x, y + 14); ctx.restore();
      } }]
    });
    document.getElementById('rr-reg-kind-legend').innerHTML = kinds.map(function (r) {
      var p = kTotal ? Math.round(r[1] / kTotal * 100) : 0;
      return '<div class="rr-an-li"><span class="rr-an-sw" style="background:' + r[2] + '"></span><span>' + r[0] + '</span><b>' + r[1] + '</b><small>' + p + '%</small></div>';
    }).join('');

    /* 소관부처 TOP 8 */
    var byMin = {};
    laws.forEach(function (b) { String((b.meta || {}).ministry || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (m) { byMin[m] = (byMin[m] || 0) + 1; }); });
    var mins = Object.keys(byMin).map(function (m) { return [m, byMin[m]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, 8);
    make('rr-reg-min', {
      type: 'bar',
      data: { labels: mins.map(function (m) { return m[0]; }), datasets: [{ data: mins.map(function (m) { return m[1]; }), backgroundColor: barColor, borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72, maxBarThickness: 24 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 24 } },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text }, tooltip: { callbacks: { label: function (c) { return ' 적용법규 ' + c.parsed.x + '개'; } } } },
        scales: K.hbarScales(k, mins[0] ? mins[0][1] : 1) },
      plugins: [K.endLabels]
    });
    return true;
  }

  /* 왼쪽 '직무 분야' 와 연결 */
  function pick(job) {
    var el = document.querySelector('.job-function-item[data-job="' + job + '"]');
    if (el) el.click(); else { cur = job; render(true); }
  }
  document.addEventListener('click', function (e) {
    var it = e.target.closest && e.target.closest('.job-function-item[data-job]');
    if (!it) return;
    cur = it.getAttribute('data-job') || 'all';
    setTimeout(function () { render(true); }, 60);
  });
  var origSwitch = window.switchMainTab;
  if (typeof origSwitch === 'function') {
    window.switchMainTab = function (name) {
      var r = origSwitch.apply(this, arguments);
      if (name === 'lawregistry') loadBase().then(function () { setTimeout(function () { render(true); }, 180); });
      return r;
    };
  }
  var n = 0;
  var iv = setInterval(function () {
    var pane = document.getElementById('lawregistry-content');
    if (pane && pane.offsetParent) loadBase().then(function () { if (render()) clearInterval(iv); });
    if (++n > 240) clearInterval(iv);
  }, 250);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { render(true); });
  }
})();
