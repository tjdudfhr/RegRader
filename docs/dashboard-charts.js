/* 메인(분기별 탭) '당사 적용 법규 개정 현황' 카드의 차트
 *  - 도넛: 시행완료 / 30일 내 시행 / 그 이후 시행예정 (가운데 전체 건수)
 *  - 막대: 월별 시행 건수 (지난 달·남은 달 색 구분, 이번 달 강조, 누르면 해당 분기 상세)
 * 연도·건수는 데이터에서 읽는다 (해가 바뀌어도 그대로 동작). Chart.js 는 index.html 이 이미 불러온다.
 */
(function () {
  'use strict';
  var donut = null, bars = null, lastKey = '';

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function isDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function todayKST() {
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return new Date(k.getFullYear(), k.getMonth(), k.getDate());
  }
  function daysUntil(iso, today) { return Math.round((new Date(iso + 'T00:00:00+09:00') - today) / 86400000); }

  function stats(items) {
    var today = todayKST();
    var years = {};
    items.forEach(function (x) { if (x.effectiveDate) years[x.effectiveDate.slice(0, 4)] = (years[x.effectiveDate.slice(0, 4)] || 0) + 1; });
    var year = Object.keys(years).sort(function (a, b) { return years[b] - years[a]; })[0] || String(today.getFullYear());
    var done = 0, soon = 0, later = 0, month = [], past = [];
    for (var i = 0; i < 12; i++) { month.push(0); past.push(0); }
    items.forEach(function (x) {
      if (!x.effectiveDate) return;
      var d = daysUntil(x.effectiveDate, today);
      if (d < 0) done++; else if (d <= 30) soon++; else later++;
      if (x.effectiveDate.slice(0, 4) === year) {
        var m = Number(x.effectiveDate.slice(5, 7)) - 1;
        month[m]++;
        if (d < 0) past[m]++;
      }
    });
    var curMonth = String(today.getFullYear()) === year ? today.getMonth() : -1;
    return { year: year, total: items.length, done: done, soon: soon, later: later, month: month, past: past, curMonth: curMonth };
  }

  var centerText = {
    id: 'rrCenter',
    afterDraw: function (chart) {
      var o = chart.options.plugins.rrCenter;
      if (!o) return;
      var a = chart.chartArea, ctx = chart.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = o.color;
      ctx.font = '800 26px Inter, -apple-system, sans-serif';
      ctx.fillText(o.value, x, y - 6);
      ctx.fillStyle = o.muted;
      ctx.font = '600 11px Inter, -apple-system, sans-serif';
      ctx.fillText(o.label, x, y + 16);
      ctx.restore();
    }
  };

  function render(force) {
    var items = window.__rrItems || [];
    var box = document.getElementById('rr-dash-charts');
    if (!box || !items.length || typeof Chart === 'undefined') return false;
    var s = stats(items);
    var key = JSON.stringify(s) + isDark();
    if (!force && key === lastKey) return true;
    lastKey = key;

    var dark = isDark();
    var text = css('--text-primary', dark ? '#f7fafc' : '#1a202c');
    var muted = css('--text-muted', '#718096');
    var grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    var C = {
      done: dark ? '#68d391' : '#48bb78',
      soon: dark ? '#fc8181' : '#e53e3e',
      later: dark ? '#e879f9' : '#d946ef',
      past: dark ? 'rgba(104,211,145,0.45)' : 'rgba(72,187,120,0.45)',
      up: dark ? 'rgba(232,121,249,0.55)' : 'rgba(217,70,239,0.45)',
      cur: '#667eea'
    };

    document.getElementById('rr-dash-year').textContent = s.year + '년';
    var bl = document.getElementById('rr-dash-bar-legend');
    if (bl) bl.innerHTML = [['시행완료', C.past], ['이번 달', C.cur], ['시행예정', C.up]].map(function (l) {
      return '<span class="rr-dash-li" style="display:inline-flex"><span class="rr-dash-sw" style="background:' + l[1] + '"></span>' + l[0] + '</span>';
    }).join('');
    var legend = [['시행완료', s.done, C.done], ['30일 내 시행', s.soon, C.soon], ['이후 시행예정', s.later, C.later]];
    document.getElementById('rr-dash-legend').innerHTML = legend.map(function (l) {
      var pct = s.total ? Math.round(l[1] / s.total * 100) : 0;
      return '<div class="rr-dash-li"><span class="rr-dash-sw" style="background:' + l[2] + '"></span>' + l[0] +
        '<b>' + l[1] + '</b><small>' + pct + '%</small></div>';
    }).join('');

    if (donut) donut.destroy();
    donut = new Chart(document.getElementById('rr-dash-donut'), {
      type: 'doughnut',
      data: { labels: legend.map(function (l) { return l[0]; }), datasets: [{ data: legend.map(function (l) { return l[1]; }), backgroundColor: legend.map(function (l) { return l[2]; }), borderWidth: 0, hoverOffset: 6 }] },
      options: {
        cutout: '70%', responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ' ' + c.parsed + '건'; } } },
          rrCenter: { value: s.total, label: '개정 건', color: text, muted: muted }
        }
      },
      plugins: [centerText]
    });

    var labels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    var colors = s.month.map(function (_, i) { return i === s.curMonth ? C.cur : (s.curMonth >= 0 && i < s.curMonth ? C.past : C.up); });
    if (bars) bars.destroy();
    bars = new Chart(document.getElementById('rr-dash-bars'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ data: s.month, backgroundColor: colors, borderRadius: 6, maxBarThickness: 28 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
        onClick: function (e, el) {
          if (!el.length || typeof window.showQuarterlyDetail !== 'function') return;
          window.showQuarterlyDetail('Q' + (Math.floor(el[0].index / 3) + 1));
        },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: function (c) { return s.year + '년 ' + c[0].label + (c[0].dataIndex === s.curMonth ? ' (이번 달)' : ''); },
            label: function (c) { return ' 시행 ' + c.parsed.y + '건 · 눌러서 분기 상세 보기'; }
          } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: muted, font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { size: 11 }, precision: 0, maxTicksLimit: 5 } }
        }
      }
    });
    return true;
  }

  var style = document.createElement('style');
  style.textContent = [
    '.rr-dash { display:grid; grid-template-columns: minmax(320px, 1fr) 2fr; gap: 1.2rem; margin-top: 1.1rem; padding-top: 1.1rem; border-top: 1px solid var(--glass-border, rgba(0,0,0,.08)); }',
    '.rr-dash-panel { min-width: 0; }',
    '.rr-dash-title { font-size: .8rem; font-weight: 700; color: var(--text-muted); margin-bottom: .5rem; display:flex; justify-content:space-between; }',
    '.rr-dash-donut-row { display:flex; align-items:center; gap: 1rem; }',
    '.rr-dash-donut-wrap { position: relative; width: 150px; height: 150px; flex: none; }',
    '.rr-dash-legend { display:flex; flex-direction:column; gap:.45rem; font-size:.82rem; color: var(--text-secondary); }',
    '.rr-dash-li { display:flex; align-items:center; gap:.45rem; white-space:nowrap; }',
    '.rr-dash-li b { margin-left:auto; padding-left:.6rem; color: var(--text-primary); font-variant-numeric: tabular-nums; }',
    '.rr-dash-li small { color: var(--text-muted); width: 2.4em; text-align:right; font-variant-numeric: tabular-nums; }',
    '.rr-dash-sw { width:10px; height:10px; border-radius:3px; flex:none; }',
    '.rr-dash-bars-wrap { position: relative; height: 150px; }',
    '.rr-dash-bar-legend { display:flex; gap:.8rem; font-weight:500; }',
    '@media (max-width: 768px) { .rr-dash { grid-template-columns: 1fr; } .rr-dash-donut-row { justify-content:center; } }'
  ].join('\n');
  document.head.appendChild(style);

  var n = 0;
  var t = setInterval(function () { if (render() || ++n > 100) clearInterval(t); }, 200);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { render(true); });
  }
})();
