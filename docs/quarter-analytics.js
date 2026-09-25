/* 분기별 탭 '분기 개정 분석' + '분기 개정 법령 목록'
 * 위쪽 분기 카드(1~4분기)가 선택 버튼이다. 고른 분기를 따라:
 *  - 숫자: 개정 건수(법령 수) / 시행완료 / 30일 내 시행 / 이후 시행예정
 *  - 월별·직무별 시행 건수 (분기의 3개월, 직무별 누적)
 *  - 직무별 개정 (가로 막대, 누르면 직무별 탭의 그 직무)
 *  - 개정 유형 · 법령 종류 (비율 막대)
 *  - 소관부처 TOP 6
 *  - 개정 법령 목록 (월별로 묶음, 누르면 법령 상세 팝업, 검색)
 * 다른 곳의 '분기 상세 보기'(차트 클릭 등)도 window.showQuarterlyDetail 로 여기로 온다.
 */
(function () {
  'use strict';
  var charts = {}, cur = null, lastKey = '';
  var Q = { Q1: ['1분기', [1, 2, 3]], Q2: ['2분기', [4, 5, 6]], Q3: ['3분기', [7, 8, 9]], Q4: ['4분기', [10, 11, 12]] };
  var AMEND_NOTE = { '일부개정': '그 법 자체의 내용을 바꾼 개정', '타법개정': '다른 법 개정에 따라 용어·조문을 맞춘 정비', '전부개정': '법 전체를 새로 쓴 개정', '제정': '새로 만든 법령' };

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
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function currentQuarter(year) {
    var t = todayKST();
    if (String(t.getFullYear()) !== String(year)) return Number(year) < t.getFullYear() ? 'Q4' : 'Q1';
    return 'Q' + (Math.floor(t.getMonth() / 3) + 1);
  }

  function render(force) {
    var K = window.rrChartKit, items = window.__rrItems || [];
    var root = document.getElementById('rr-q-an');
    if (!K || !root || !items.length || typeof Chart === 'undefined') return false;
    var year = K.yearOf(items);
    if (!cur) cur = currentQuarter(year);
    var months = Q[cur][1];
    var sel = items.filter(function (x) {
      var d = String(x.effectiveDate || '');
      return d.slice(0, 4) === year && months.indexOf(Number(d.slice(5, 7))) >= 0;
    }).sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || a.title.localeCompare(b.title); });
    var key = cur + '|' + sel.length + '|' + (window.rrIsDark && window.rrIsDark());
    if (!force && key === lastKey) return true;
    lastKey = key;

    var k = K.ink(), R = K.ramp(), today = todayKST(), cats = window.RR_CAT_ORDER || [];
    var label = year + '년 ' + Q[cur][0] + ' (' + months[0] + '~' + months[2] + '월)';
    document.getElementById('rr-q-an-title').textContent = label + ' 개정 분석';
    document.querySelectorAll('.quarterly-tab').forEach(function (t, i) { t.classList.toggle('selected', 'Q' + (i + 1) === cur); });

    /* 숫자 */
    var done = 0, soon = 0, later = 0, titles = {};
    sel.forEach(function (x) { var d = days(x.effectiveDate, today); if (d < 0) done++; else if (d <= 30) soon++; else later++; titles[x.title] = 1; });
    document.getElementById('rr-q-tiles').innerHTML = [
      ['개정 건수', sel.length, '법령 ' + Object.keys(titles).length + '개의 개정 합계'],
      ['시행완료', done, sel.length ? Math.round(done / sel.length * 100) + '%' : ''],
      ['30일 내 시행', soon, soon ? '⏰ 준비 필요' : '없음'],
      ['이후 시행예정', later, '']
    ].map(function (t, i) {
      return '<div class="rr-job-tile' + (i === 2 && soon ? ' hot' : '') + '"><span>' + t[0] + '</span><b>' + t[1] + '</b><small>' + t[2] + '</small></div>';
    }).join('');

    /* 월별 · 직무별 (누적) */
    var mLabels = months.map(function (m) { return m + '월'; });
    make('rr-q-monthly', {
      type: 'bar',
      data: { labels: mLabels, datasets: cats.map(function (c) {
        return { label: c, data: months.map(function (m) { return sel.filter(function (x) { return Number(x.effectiveDate.slice(5, 7)) === m && (x.categories || [])[0] === c; }).length; }),
          backgroundColor: window.rrCatColor(c), borderColor: k.surface, borderWidth: { top: 2 }, borderSkipped: false, maxBarThickness: 64 };
      }) },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
        plugins: { legend: { position: 'top', align: 'start', labels: { color: k.text, boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 10 } },
          tooltip: { mode: 'index', filter: function (c) { return c.parsed.y > 0; }, callbacks: { title: function (c) { return year + '년 ' + c[0].label; },
            footer: function (c) { return '합계 ' + c.reduce(function (n, x) { return n + x.parsed.y; }, 0) + '건'; } } } },
        scales: { x: { stacked: true, grid: { display: false }, ticks: { color: k.text, font: { size: 12 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: k.grid }, border: { display: false }, ticks: { color: k.muted, font: { size: 11 }, precision: 0, maxTicksLimit: 5 } } } }
    });

    /* 직무별 개정 */
    var jobs = cats.map(function (c) { return [c, sel.filter(function (x) { return (x.categories || [])[0] === c; }).length]; })
      .filter(function (j) { return j[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    make('rr-q-jobs', {
      type: 'bar',
      data: { labels: jobs.map(function (j) { return j[0]; }), datasets: [{ data: jobs.map(function (j) { return j[1]; }), backgroundColor: jobs.map(function (j) { return window.rrCatColor(j[0]); }), borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72, maxBarThickness: 24 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 24 } },
        onClick: function (e, el) {
          if (!el.length || typeof window.switchMainTab !== 'function') return;
          var job = jobs[el[0].index][0];
          window.switchMainTab('business');
          setTimeout(function () { var t = document.querySelector('.filter-tab[data-filter="' + job + '"]'); if (t) t.click(); }, 250);
        },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text },
          tooltip: { callbacks: { label: function (c) { return ' ' + c.parsed.x + '건 · 눌러서 직무별 탭에서 보기'; } } } },
        scales: K.hbarScales(k, jobs[0] ? jobs[0][1] : 1) },
      plugins: [K.endLabels]
    });
    document.getElementById('rr-q-jobs-empty').style.display = jobs.length ? 'none' : 'block';

    /* 개정 유형 · 법령 종류 (비율 막대) */
    function split(id, rows, notes) {
      var total = rows.reduce(function (n, r) { return n + r[1]; }, 0);
      var step = rows.length <= 2 ? [0, 2] : [0, 1, 2, 3];
      var col = function (i) { return R[step[Math.min(i, step.length - 1)]]; };
      document.getElementById(id).innerHTML =
        '<div class="rr-an-split">' + rows.map(function (r, i) { return r[1] ? '<span style="flex:' + r[1] + ';background:' + col(i) + '" title="' + esc(r[0]) + ' ' + r[1] + '건"></span>' : ''; }).join('') + '</div>' +
        '<div class="rr-an-legend">' + rows.map(function (r, i) {
          var p = total ? Math.round(r[1] / total * 100) : 0;
          return '<div class="rr-an-li"><span class="rr-an-sw" style="background:' + col(i) + '"></span><span>' + esc(r[0]) +
            (notes && notes[r[0]] ? ' <small class="note">' + notes[r[0]] + '</small>' : '') + '</span><b>' + r[1] + '</b><small>' + p + '%</small></div>';
        }).join('') + '</div>';
    }
    var types = {};
    sel.forEach(function (x) { var t = x.amendmentType || '기타'; types[t] = (types[t] || 0) + 1; });
    split('rr-q-type', Object.keys(types).map(function (t) { return [t, types[t]]; }).sort(function (a, b) { return b[1] - a[1]; }), AMEND_NOTE);
    split('rr-q-kind', ['법률', '시행령', '시행규칙'].map(function (kd) { return [kd, sel.filter(function (x) { return K.lawKind(x.title) === kd; }).length]; }));

    /* 소관부처 TOP 6 */
    var byMin = {};
    sel.forEach(function (x) { String(x.ministry || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (m) { byMin[m] = (byMin[m] || 0) + 1; }); });
    var mins = Object.keys(byMin).map(function (m) { return [m, byMin[m]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, 6);
    make('rr-q-min', {
      type: 'bar',
      data: { labels: mins.map(function (m) { return m[0]; }), datasets: [{ data: mins.map(function (m) { return m[1]; }), backgroundColor: R[1], borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72, maxBarThickness: 24 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 24 } },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text }, tooltip: { callbacks: { label: function (c) { return ' 개정 ' + c.parsed.x + '건'; } } } },
        scales: K.hbarScales(k, mins[0] ? mins[0][1] : 1) },
      plugins: [K.endLabels]
    });

    renderList(sel, today);
    return true;
  }

  /* 개정 법령 목록 (월별로 묶음) */
  var lastSel = [], lastToday = null;
  function renderList(sel, today) {
    lastSel = sel; lastToday = today;
    var q = (document.getElementById('rr-q-search').value || '').trim().toLowerCase();
    var rows = sel.filter(function (x) { return !q || (x.title + ' ' + (x.ministry || '') + ' ' + (x.categories || []).join(' ') + ' ' + (x.amendmentType || '')).toLowerCase().indexOf(q) >= 0; });
    document.getElementById('rr-q-list-title').textContent = '📋 ' + Q[cur][0] + ' 개정 법령 목록';
    document.getElementById('rr-q-list-count').textContent = rows.length + '건';
    var byMonth = {};
    rows.forEach(function (x) { var m = Number(x.effectiveDate.slice(5, 7)); (byMonth[m] = byMonth[m] || []).push(x); });
    var html = Q[cur][1].map(function (m) {
      var list = byMonth[m] || [];
      if (!list.length) return '';
      return '<div class="rr-q-month"><div class="rr-q-month-h">' + m + '월 <span>' + list.length + '건</span></div>' + list.map(function (x) {
        var d = days(x.effectiveDate, today);
        var dd = d < 0 ? '<span class="rr-dd done">시행완료</span>' : d === 0 ? '<span class="rr-dd hot">D-DAY</span>' : '<span class="rr-dd ' + (d <= 30 ? 'hot' : 'later') + '">D-' + d + '</span>';
        var cat = (x.categories || [])[0] || '';
        return '<button type="button" class="rr-q-row" data-key="' + esc(x._key || x.id) + '">' +
          '<span class="rr-q-date">' + esc(x.effectiveDate.slice(5).replace('-', '.')) + '</span>' +
          '<span class="rr-q-title">' + esc(x.title) + '</span>' +
          '<span class="rr-q-meta"><i style="background:' + window.rrCatColor(cat) + '"></i>' + esc(cat) + ' · ' + esc(x.amendmentType || '') + ' · ' + esc(x.ministry || '') + '</span>' +
          dd + '</button>';
      }).join('') + '</div>';
    }).join('');
    document.getElementById('rr-q-list').innerHTML = html || '<div class="rr-job-empty" style="display:block">해당하는 개정이 없습니다.</div>';
  }

  /* 분기 선택: 카드 클릭 · 다른 곳의 '분기 상세 보기' 모두 여기로 */
  function select(q, scroll) {
    if (!Q[q]) return;
    cur = q;
    render(true);
    if (scroll) {
      var el = document.getElementById('rr-q-an');
      if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }
  }
  window.showQuarterlyDetail = function (q) {
    var onTab = document.getElementById('quarterly-content') && document.getElementById('quarterly-content').classList.contains('active');
    if (!onTab && typeof window.switchMainTab === 'function') window.switchMainTab('quarterly');
    select(q, !onTab);
  };
  window.closeQuarterlyDetail = function () {};

  document.addEventListener('click', function (e) {
    var row = e.target.closest && e.target.closest('.rr-q-row[data-key]');
    if (row && typeof window.showLawDetail === 'function') window.showLawDetail(row.getAttribute('data-key'));
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'rr-q-search') renderList(lastSel, lastToday || todayKST());
  });

  var st = document.createElement('style');
  st.textContent = [
    '#rr-q-an, #rr-q-listbox { margin: 1.25rem 0 0; }',
    '.quarterly-tab.selected { border-color: var(--primary) !important; box-shadow: 0 0 0 2px rgba(102,126,234,.35), 0 10px 24px rgba(102,126,234,.18) !important; }',
    '.rr-q-listhead { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; margin-bottom:.8rem; }',
    '.rr-q-listhead .filter-title { margin:0; }',
    '.rr-q-listhead .cnt { font-size:.8rem; font-weight:700; color:var(--primary); padding:.15rem .6rem; border-radius:999px; border:1px solid rgba(102,126,234,.45); }',
    '.rr-q-listhead input { margin-left:auto; min-width:220px; padding:.5rem .8rem; border-radius:10px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font:inherit; font-size:.88rem; }',
    '.rr-q-month { margin-bottom: 1rem; }',
    '.rr-q-month-h { font-size:.82rem; font-weight:800; color:var(--text-secondary); margin:0 0 .4rem .2rem; }',
    '.rr-q-month-h span { color:var(--text-muted); font-weight:600; margin-left:.3rem; }',
    '.rr-q-row { display:grid; grid-template-columns: 58px minmax(0,1.3fr) minmax(0,1.6fr) auto; align-items:center; gap:.8rem; width:100%; text-align:left; font:inherit;',
    '  padding:.65rem .9rem; margin:0 0 .35rem; border-radius:12px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); cursor:pointer; transition:transform .15s ease, box-shadow .15s ease; }',
    '.rr-q-row:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(31,38,135,.10); border-color: rgba(102,126,234,.45); }',
    '.rr-q-row:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }',
    '.rr-q-date { font-size:.85rem; font-weight:800; color:var(--primary); font-variant-numeric:tabular-nums; }',
    '.rr-q-title { font-weight:700; font-size:.92rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.rr-q-meta { font-size:.78rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.rr-q-meta i { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; vertical-align:0; }',
    '.rr-dd { font-size:.72rem; font-weight:800; padding:.15rem .5rem; border-radius:7px; white-space:nowrap; }',
    '.rr-dd.done { color:var(--text-muted); background:var(--bg-primary); }',
    '.rr-dd.hot { color:#c53030; background:rgba(229,62,62,.10); }',
    '.rr-dd.later { color:#805ad5; background:rgba(128,90,213,.10); }',
    '@media (max-width: 900px) { .rr-q-row { grid-template-columns: 52px minmax(0,1fr) auto; } .rr-q-meta { display:none; } .rr-q-listhead input { margin-left:0; width:100%; } }'
  ].join('\n');
  document.head.appendChild(st);

  var n = 0;
  var iv = setInterval(function () {
    var pane = document.getElementById('quarterly-content');
    if ((pane && pane.offsetParent && render()) || ++n > 240) clearInterval(iv);
  }, 250);
  var origSwitch = window.switchMainTab;
  if (typeof origSwitch === 'function') {
    window.switchMainTab = function (name) {
      var r = origSwitch.apply(this, arguments);
      if (name === 'quarterly') setTimeout(function () { render(true); }, 150);
      return r;
    };
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { render(true); });
  }
})();
