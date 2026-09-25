/* 분기별 탭 '개정 분석' 대시보드
 *  - 분기 카드마다 직무 구성 막대(가는 누적 막대)
 *  - 직무별 개정 건수 (가로 막대, 누르면 직무별 탭으로 이동)
 *  - 분기 × 직무 (누적 가로 막대, 누르면 분기 상세) + 표로 보기
 *  - 개정 유형 / 법령 종류 (도넛, 3~5조각)
 *  - 소관부처 TOP 8, 올해 여러 번 개정된 법령 TOP 8 (가로 막대, 법령은 누르면 상세 팝업)
 * 색: 직무는 window.rrCatColor (검증된 8색, 고정 순서). 그 밖의 차원은 보라 한 계열의 단계색
 * (라이트/다크 각각 검증). 숫자·글자는 글자색 토큰을 쓰고, 색은 식별용으로만 쓴다.
 * 연도는 데이터에서 읽으므로 해가 바뀌어도 그대로 동작한다.
 */
(function () {
  'use strict';
  var charts = {};
  var lastKey = '';
  var QUARTERS = [['Q1', '1분기', 1, 3], ['Q2', '2분기', 4, 6], ['Q3', '3분기', 7, 9], ['Q4', '4분기', 10, 12]];

  function dark() { return window.rrIsDark ? window.rrIsDark() : false; }
  function cssVar(n, f) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* 보라 단계색: [0] 이 가장 강조 (라이트=가장 진함, 다크=가장 밝음). 둘 다 표면 대비 2:1 이상 검증 */
  function ramp() {
    return dark() ? ['#ccd2f8', '#a9b3f1', '#8591e8', '#6470dd'] : ['#32379a', '#4a57cf', '#6a79e2', '#8f9bec'];
  }
  function ink() {
    return { text: cssVar('--text-primary', dark() ? '#f7fafc' : '#1a202c'), muted: cssVar('--text-muted', '#718096'),
             grid: dark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', surface: dark() ? '#2d3748' : '#ffffff' };
  }
  function lawKind(t) { return /시행규칙$/.test(t) ? '시행규칙' : /시행령$/.test(t) ? '시행령' : '법률'; }
  function yearOf(items) {
    var c = {};
    items.forEach(function (x) { var y = String(x.effectiveDate || '').slice(0, 4); if (y) c[y] = (c[y] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0] || String(window.RR_YEAR);
  }

  function compute(items) {
    var year = yearOf(items);
    var cats = window.RR_CAT_ORDER || [];
    var byCat = {}, byQC = {}, byType = {}, byKind = {}, byMin = {}, byLaw = {};
    cats.forEach(function (c) { byCat[c] = 0; });
    QUARTERS.forEach(function (q) { byQC[q[0]] = {}; cats.forEach(function (c) { byQC[q[0]][c] = 0; }); });
    items.forEach(function (x) {
      var d = String(x.effectiveDate || '');
      if (d.slice(0, 4) !== year) return;
      var c = (x.categories || [])[0] || '기타';
      var m = Number(d.slice(5, 7));
      var q = QUARTERS.filter(function (qq) { return m >= qq[2] && m <= qq[3]; })[0];
      if (byCat[c] != null) byCat[c]++;
      if (q && byQC[q[0]][c] != null) byQC[q[0]][c]++;
      var t = x.amendmentType || '기타';
      byType[t] = (byType[t] || 0) + 1;
      var k = lawKind(x.title || '');
      byKind[k] = (byKind[k] || 0) + 1;
      String(x.ministry || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (mn) { byMin[mn] = (byMin[mn] || 0) + 1; });
      (byLaw[x.title] = byLaw[x.title] || []).push(x);
    });
    function top(obj, n) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, n); }
    return {
      year: year, cats: cats, byCat: byCat, byQC: byQC,
      types: top(byType, 5), kinds: ['법률', '시행령', '시행규칙'].map(function (k) { return [k, byKind[k] || 0]; }),
      ministries: top(byMin, 8),
      multi: Object.keys(byLaw).map(function (t) { return [t, byLaw[t].length, byLaw[t]]; }).filter(function (r) { return r[1] > 1; })
        .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, 8),
      total: items.filter(function (x) { return String(x.effectiveDate || '').slice(0, 4) === year; }).length
    };
  }

  /* 막대 끝 값 표시 (선택적 직접 라벨) */
  var endLabels = {
    id: 'rrEndLabels',
    afterDatasetsDraw: function (chart) {
      var o = chart.options.plugins.rrEndLabels;
      if (!o) return;
      var ctx = chart.ctx, meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
      ctx.save();
      ctx.fillStyle = o.color;
      ctx.font = '600 11px Inter, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      meta.data.forEach(function (bar, i) {
        var v = o.totals ? o.totals[i] : chart.data.datasets[0].data[i];
        if (!v) return;
        ctx.fillText(v, bar.x + 6, bar.y);
      });
      ctx.restore();
    }
  };
  var centerText = {
    id: 'rrCenter2',
    afterDraw: function (chart) {
      var o = chart.options.plugins.rrCenter2;
      if (!o) return;
      var a = chart.chartArea, ctx = chart.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = o.color; ctx.font = '800 22px Inter, -apple-system, sans-serif'; ctx.fillText(o.value, x, y - 6);
      ctx.fillStyle = o.muted; ctx.font = '600 11px Inter, -apple-system, sans-serif'; ctx.fillText(o.label, x, y + 14);
      ctx.restore();
    }
  };

  function make(id, cfg) {
    if (charts[id]) charts[id].destroy();
    var el = document.getElementById(id);
    if (!el) return null;
    charts[id] = new Chart(el, cfg);
    return charts[id];
  }
  function hbarScales(k, max) {
    return {
      x: { beginAtZero: true, suggestedMax: Math.ceil(max * 1.15), grid: { color: k.grid }, border: { display: false }, ticks: { color: k.muted, font: { size: 11 }, precision: 0, maxTicksLimit: 5 } },
      y: { grid: { display: false }, border: { display: false }, ticks: { color: k.text, font: { size: 12 }, autoSkip: false } }
    };
  }
  function legendHTML(rows, total) {
    return rows.map(function (r) {
      var pct = total ? Math.round(r[1] / total * 100) : 0;
      return '<div class="rr-an-li"><span class="rr-an-sw" style="background:' + r[2] + '"></span><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b><small>' + pct + '%</small></div>';
    }).join('');
  }
  function goJob(cat) {
    if (typeof window.switchMainTab === 'function') window.switchMainTab('business');
    setTimeout(function () {
      var t = document.querySelector('.filter-tab[data-filter="' + cat + '"]');
      if (t) t.click();
      var host = document.getElementById('business-content');
      if (host) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  }

  function renderStrips(s) {
    QUARTERS.forEach(function (q, qi) {
      var card = document.querySelectorAll('.quarterly-tab')[qi];
      if (!card) return;
      var box = card.querySelector('.rr-qstrip');
      if (!box) {
        box = document.createElement('div');
        box.className = 'rr-qstrip';
        (card.querySelector('.quarter-info') || card).appendChild(box);
      }
      var row = s.byQC[q[0]], tot = s.cats.reduce(function (n, c) { return n + row[c]; }, 0);
      var top3 = s.cats.filter(function (c) { return row[c]; }).sort(function (a, b) { return row[b] - row[a]; }).slice(0, 2);
      box.innerHTML = '<div class="rr-qbar" role="img" aria-label="' + q[1] + ' 직무 구성">' + s.cats.filter(function (c) { return row[c]; }).map(function (c) {
        return '<span style="flex:' + row[c] + ';background:' + window.rrCatColor(c) + '" title="' + c + ' ' + row[c] + '건"></span>';
      }).join('') + '</div>' +
        (tot ? '<div class="rr-qtop">' + top3.map(function (c) { return '<span><i style="background:' + window.rrCatColor(c) + '"></i>' + c + ' ' + row[c] + '</span>'; }).join('') + '</div>' : '');
    });
  }

  function render(force) {
    var items = window.__rrItems || [];
    var root = document.getElementById('rr-analytics');
    if (!root || !items.length || typeof Chart === 'undefined' || !window.rrCatColor) return false;
    var s = compute(items);
    var key = JSON.stringify([s.byQC, s.types, s.ministries, s.multi.map(function (m) { return [m[0], m[1]]; })]) + dark();
    if (!force && key === lastKey) return true;
    lastKey = key;
    var k = ink(), R = ramp();

    document.getElementById('rr-an-year').textContent = s.year + '년';
    setTabBadges(s);
    renderStrips(s);

    /* 1. 직무별 개정 건수 */
    var jobs = s.cats.map(function (c) { return [c, s.byCat[c]]; }).sort(function (a, b) { return b[1] - a[1]; });
    make('rr-an-jobs', {
      type: 'bar',
      data: { labels: jobs.map(function (j) { return j[0]; }), datasets: [{ data: jobs.map(function (j) { return j[1]; }), backgroundColor: jobs.map(function (j) { return window.rrCatColor(j[0]); }), borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72, categoryPercentage: 0.9 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        layout: { padding: { right: 24 } },
        onClick: function (e, el) { if (el.length) goJob(jobs[el[0].index][0]); },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text },
          tooltip: { callbacks: { label: function (c) { return ' ' + c.parsed.x + '건 (' + Math.round(c.parsed.x / (s.total || 1) * 100) + '%) · 눌러서 직무별 보기'; } } } },
        scales: hbarScales(k, jobs[0] ? jobs[0][1] : 1)
      },
      plugins: [endLabels]
    });

    /* 2. 분기 × 직무 (누적) */
    var qTotals = QUARTERS.map(function (q) { return s.cats.reduce(function (n, c) { return n + s.byQC[q[0]][c]; }, 0); });
    make('rr-an-qjob', {
      type: 'bar',
      data: {
        labels: QUARTERS.map(function (q) { return q[1]; }),
        datasets: s.cats.map(function (c) {
          return { label: c, data: QUARTERS.map(function (q) { return s.byQC[q[0]][c]; }), backgroundColor: window.rrCatColor(c), borderColor: k.surface, borderWidth: { right: 2 }, borderSkipped: false, barPercentage: 0.72 };
        })
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        layout: { padding: { right: 28 } },
        onClick: function (e, el) { if (el.length && window.showQuarterlyDetail) window.showQuarterlyDetail(QUARTERS[el[0].index][0]); },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: {
          legend: { position: 'top', align: 'start', labels: { color: k.text, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2, font: { size: 11 }, padding: 10 } },
          rrEndLabels: { color: k.text, totals: qTotals },
          tooltip: { mode: 'index', filter: function (c) { return c.parsed.x > 0; }, callbacks: {
            title: function (c) { return s.year + '년 ' + c[0].label + ' · 합계 ' + qTotals[c[0].dataIndex] + '건'; },
            footer: function () { return '눌러서 분기 상세 보기'; } } }
        },
        scales: (function () { var sc = hbarScales(k, Math.max.apply(null, qTotals.concat([1]))); sc.x.stacked = true; sc.y.stacked = true; return sc; })()
      },
      plugins: [endLabels]
    });
    /* 표로 보기 (색만으로 구분하지 않도록) */
    document.getElementById('rr-an-qjob-table').innerHTML =
      '<table><thead><tr><th>직무</th>' + QUARTERS.map(function (q) { return '<th>' + q[1] + '</th>'; }).join('') + '<th>합계</th></tr></thead><tbody>' +
      s.cats.map(function (c) {
        return '<tr><td><span class="rr-an-sw" style="background:' + window.rrCatColor(c) + '"></span>' + c + '</td>' +
          QUARTERS.map(function (q) { return '<td>' + (s.byQC[q[0]][c] || '·') + '</td>'; }).join('') + '<td><b>' + s.byCat[c] + '</b></td></tr>';
      }).join('') +
      '<tr class="tot"><td>합계</td>' + qTotals.map(function (t) { return '<td>' + t + '</td>'; }).join('') + '<td>' + s.total + '</td></tr></tbody></table>';

    /* 3. 개정 유형: 조각이 2~3개뿐이라 도넛 대신 비율 막대 + 설명 */
    var TYPE_NOTE = { '일부개정': '그 법 자체의 내용을 바꾼 개정', '타법개정': '다른 법 개정에 따라 용어·조문을 맞춘 정비', '전부개정': '법 전체를 새로 쓴 개정', '제정': '새로 만든 법령', '폐지': '없어진 법령' };
    var tTotal = s.types.reduce(function (n, r) { return n + r[1]; }, 0);
    /* 두 조각뿐이면 한 단계 건너뛴 색으로 대비를 키운다 */
    var tStep = s.types.length <= 2 ? [0, 2] : [0, 1, 2, 3];
    var tColor = function (i) { return R[tStep[Math.min(i, tStep.length - 1)]]; };
    document.getElementById('rr-an-type-bar').innerHTML = s.types.map(function (r, i) {
      return '<span style="flex:' + r[1] + ';background:' + tColor(i) + '" title="' + esc(r[0]) + ' ' + r[1] + '건"></span>';
    }).join('');
    document.getElementById('rr-an-type-legend').innerHTML = s.types.map(function (r, i) {
      var pct = tTotal ? Math.round(r[1] / tTotal * 100) : 0;
      return '<div class="rr-an-li"><span class="rr-an-sw" style="background:' + tColor(i) + '"></span><span>' + esc(r[0]) +
        (TYPE_NOTE[r[0]] ? ' <small class="note">' + TYPE_NOTE[r[0]] + '</small>' : '') + '</span><b>' + r[1] + '</b><small>' + pct + '%</small></div>';
    }).join('');

    /* 4. 법령 종류 (도넛, 3조각) */
    [['rr-an-kind', s.kinds, '법령 종류']].forEach(function (d) {
      var rows = d[1].map(function (r, i) { return [r[0], r[1], R[Math.min(i, R.length - 1)]]; });
      var total = rows.reduce(function (n, r) { return n + r[1]; }, 0);
      make(d[0], {
        type: 'doughnut',
        data: { labels: rows.map(function (r) { return r[0]; }), datasets: [{ data: rows.map(function (r) { return r[1]; }), backgroundColor: rows.map(function (r) { return r[2]; }), borderColor: k.surface, borderWidth: 2, hoverOffset: 4 }] },
        options: { cutout: '68%', responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
          plugins: { legend: { display: false }, rrCenter2: { value: total, label: '건', color: k.text, muted: k.muted },
            tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ' ' + c.parsed + '건 (' + Math.round(c.parsed / (total || 1) * 100) + '%)'; } } } } },
        plugins: [centerText]
      });
      document.getElementById(d[0] + '-legend').innerHTML = legendHTML(rows, total);
    });

    /* 5. 소관부처 TOP 8 */
    var mins = s.ministries;
    make('rr-an-min', {
      type: 'bar',
      data: { labels: mins.map(function (m) { return m[0]; }), datasets: [{ data: mins.map(function (m) { return m[1]; }), backgroundColor: R[1], borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, layout: { padding: { right: 24 } },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text }, tooltip: { callbacks: { label: function (c) { return ' 개정 ' + c.parsed.x + '건'; } } } },
        scales: hbarScales(k, mins[0] ? mins[0][1] : 1) },
      plugins: [endLabels]
    });

    /* 6. 올해 여러 번 개정된 법령 TOP 8 */
    var multi = s.multi;
    /* 긴 이름은 줄이되 '시행령/시행규칙' 꼬리는 남겨 법률과 하위법령을 구분한다 */
    var short = function (t) {
      if (t.length <= 16) return t;
      var tail = (t.match(/ (시행령|시행규칙)$/) || [''])[0];
      return t.slice(0, 15 - tail.length) + '…' + tail;
    };
    make('rr-an-multi', {
      type: 'bar',
      data: { labels: multi.map(function (m) { return short(m[0]); }), datasets: [{ data: multi.map(function (m) { return m[1]; }), backgroundColor: multi.map(function (m) { return window.rrCatColor((m[2][0].categories || [])[0]); }), borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, layout: { padding: { right: 24 } },
        onClick: function (e, el) {
          if (!el.length || typeof window.showLawDetail !== 'function') return;
          var evs = multi[el[0].index][2].slice().sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)); });
          var today = new Date().toISOString().slice(0, 10);
          var next = evs.filter(function (x) { return x.effectiveDate >= today; })[0] || evs[evs.length - 1];
          window.showLawDetail(next._key || next.id);
        },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: { legend: { display: false }, rrEndLabels: { color: k.text },
          tooltip: { callbacks: {
            title: function (c) { return multi[c[0].dataIndex][0]; },
            label: function (c) { var m = multi[c.dataIndex]; return ' 올해 ' + m[1] + '회 · ' + ((m[2][0].categories || [])[0] || '') + ' · 눌러서 가장 가까운 개정 보기'; } } } },
        scales: hbarScales(k, multi[0] ? multi[0][1] : 1) },
      plugins: [endLabels]
    });
    return true;
  }

  /* 메인 탭 카드의 현재 수치 (개정 건수 · 직무 수 · 적용법규 수) */
  function setTabBadges(s) {
    /* 메뉴 배지는 숫자만 (좁은 메뉴에서 글자와 겹치지 않게), 뜻은 마우스를 올리면 */
    var set = function (id, v, tip) { var el = document.getElementById(id); if (el && v != null) { el.textContent = v; el.title = tip; } };
    var jobs = s.cats.filter(function (c) { return s.byCat[c] > 0; }).length;
    set('tab-badge-quarterly', s.total, s.year + '년 개정 ' + s.total + '건 (중복 포함)');
    set('tab-badge-business', jobs, '개정이 있는 직무 ' + jobs + '개');
    var baseBadge = function () { if (window.__rrBaseCount) set('tab-badge-lawregistry', window.__rrBaseCount, '적용법규 ' + window.__rrBaseCount + '개'); };
    baseBadge(); setTimeout(baseBadge, 1500);
  }
  /* 선택된 탭을 보조기기에도 알린다 */
  function syncAria() {
    document.querySelectorAll('.main-tab').forEach(function (t) { t.setAttribute('aria-selected', t.classList.contains('active') ? 'true' : 'false'); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.main-tab-container');
    if (bar) { bar.setAttribute('role', 'tablist'); new MutationObserver(syncAria).observe(bar, { subtree: true, attributes: true, attributeFilter: ['class'] }); }
  });

  /* 직무별 탭 차트(job-analytics.js)와 같은 방식으로 그리도록 도구를 공유한다 */
  window.rrChartKit = { ink: ink, ramp: ramp, esc: esc, endLabels: endLabels, hbarScales: hbarScales, lawKind: lawKind, yearOf: yearOf };

  var st = document.createElement('style');
  st.textContent = [
    '.rr-qstrip { margin-top: .5rem; }',
    '.rr-qbar { display:flex; gap:2px; height:8px; border-radius:4px; overflow:hidden; }',
    '.rr-qbar span { display:block; min-width:3px; }',
    '.rr-qtop { display:flex; flex-wrap:wrap; gap:.2rem .7rem; margin-top:.35rem; font-size:.72rem; color:var(--text-muted); font-weight:600; }',
    '.rr-qtop i { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:4px; vertical-align:0; }',
    '.rr-an { background: var(--bg-glass); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: 16px; padding: 1.2rem 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--glass-shadow); }',
    '.rr-an-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: .8rem; }',
    '.rr-an-card { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 14px; padding: 1rem 1.1rem; min-width: 0; }',
    '.rr-an-card.wide { grid-column: 1 / -1; }',
    '.rr-an-h { display:flex; justify-content:space-between; align-items:baseline; gap:.5rem; margin-bottom:.6rem; }',
    '.rr-an-h b { font-size:.95rem; color:var(--text-primary); }',
    '.rr-an-h span { font-size:.75rem; color:var(--text-muted); }',
    '.rr-an-plot { position:relative; }',
    '.rr-an-donut { display:flex; align-items:center; gap:1rem; }',
    '.rr-an-donut .rr-an-plot { width:140px; height:140px; flex:none; }',
    '.rr-an-legend { display:flex; flex-direction:column; gap:.4rem; font-size:.82rem; color:var(--text-secondary); flex:1; min-width:0; }',
    '.rr-an-li { display:flex; align-items:center; gap:.45rem; }',
    '.rr-an-li b { margin-left:auto; color:var(--text-primary); font-variant-numeric:tabular-nums; }',
    '.rr-an-li small { color:var(--text-muted); width:2.6em; text-align:right; font-variant-numeric:tabular-nums; }',
    '.rr-an-split { display:flex; gap:2px; height:14px; border-radius:4px; overflow:hidden; margin:.4rem 0 1rem; }',
    '.rr-an-split span { display:block; min-width:3px; }',
    '.rr-an-li small.note { width:auto; text-align:left; margin-left:.35rem; font-size:.72rem; }',
    '.rr-an-sw { display:inline-block; width:10px; height:10px; border-radius:2px; flex:none; margin-right:4px; }',
    '.rr-an details { margin-top:.6rem; font-size:.82rem; }',
    '.rr-an summary { cursor:pointer; color:var(--primary); font-weight:600; }',
    '.rr-an table { width:100%; border-collapse:collapse; margin-top:.5rem; font-variant-numeric:tabular-nums; }',
    '.rr-an th, .rr-an td { padding:.35rem .5rem; text-align:right; border-bottom:1px solid var(--border, #e2e8f0); color:var(--text-secondary); }',
    '.rr-an th:first-child, .rr-an td:first-child { text-align:left; }',
    '.rr-an th { color:var(--text-muted); font-weight:600; }',
    '.rr-an tr.tot td { font-weight:700; color:var(--text-primary); }',
    '@media (max-width: 900px) { .rr-an-grid { grid-template-columns: 1fr; } }'
  ].join('\n');
  document.head.appendChild(st);

  var n = 0;
  var t = setInterval(function () { if (render() || ++n > 100) clearInterval(t); }, 250);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { render(true); });
  }
})();
