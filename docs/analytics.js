/* 종합 현황 '개정 분석' — 실무자가 사규·업무에 반영할 때 필요한 것 위주 (2026-10-01 개편)
 *  - 직무별 개정 건수 (실질 개정 / 타법개정, 아래에 두 용어 설명), 직무 × 분기 표, 법령 종류별 반영할 곳, 전체를 읽어야 할 개정(제정·전부개정)
 *  - 분기별 탭 분기 카드마다 직무 구성 막대(가는 누적 막대), 메뉴 배지, 차트 도구(rrChartKit)도 여기서
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
    return dark() ? ['#ccd2f8', '#a9b3f1', '#8591e8', '#6470dd'] : ['#1f3a9e', '#3056d3', '#6485e6', '#a3b6f2'];   /* 앱 브랜드 파랑 단계 (system.css) */
  }
  function ink() {
    return { text: cssVar('--text-primary', dark() ? '#f7fafc' : '#1a202c'), muted: cssVar('--text-muted', '#718096'),
             grid: dark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', surface: dark() ? '#2d3748' : '#ffffff' };
  }
  /* 법령 종류: 'OO 시행령/시행규칙' 외에 이름이 다른 하위법령도 있다 (예: 산업안전보건기준에 관한 규칙=부령, 근로감독관규정·특허권 등의 등록령=대통령령) */
  function lawKind(t) {
    t = String(t || '').trim();
    return /규칙$/.test(t) ? '시행규칙' : /(시행령|규정|령)$/.test(t) ? '시행령' : '법률';
  }
  /* 개정·적용법규 한 건의 종류: 행정규칙(고시·훈령·예규 등)이면 '행정규칙', 아니면 법령명으로 */
  function kindOf(x) { return x && (x.kind || x.lawType === '행정규칙') ? '행정규칙' : lawKind(x && x.title); }
  var KINDS = ['법률', '시행령', '시행규칙', '행정규칙'];
  function yearOf(items) {
    var c = {};
    items.forEach(function (x) { var y = String(x.effectiveDate || '').slice(0, 4); if (y) c[y] = (c[y] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0] || String(window.RR_YEAR);
  }

  function compute(items) {
    var year = yearOf(items);
    var cats = window.RR_CAT_ORDER || [];
    var byCat = {}, byQC = {}, byType = {};
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
    });
    function top(obj, n) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, n); }
    return {
      year: year, cats: cats, byCat: byCat, byQC: byQC,
      types: top(byType, 5),
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
      box.innerHTML = '<div class="rr-qbar" role="img" aria-label="' + q[1] + ' 직무 구성">' + s.cats.filter(function (c) { return row[c]; }).map(function (c) {
        return '<span style="flex:' + row[c] + ';background:' + window.rrCatColor(c) + '" title="' + c + ' ' + row[c] + '건"></span>';
      }).join('') + '</div>'; /* 막대 아래 '많이 개정된 직무' 표기는 빼고 막대만 둔다 (막대에 마우스를 올리면 직무별 건수) */
    });
  }

  function render(force) {
    var items = window.__rrItems || [];
    var root = document.getElementById('rr-analytics');
    if (!root || !items.length || typeof Chart === 'undefined' || !window.rrCatColor) return false;
    var s = compute(items);
    var key = JSON.stringify([s.byQC, s.types]) + dark();
    if (!force && key === lastKey) return true;
    lastKey = key;
    var k = ink(), R = ramp();

    document.getElementById('rr-an-year').textContent = s.year + '년';
    setTabBadges(s);
    renderStrips(s);

    var A = window.rrAmend, year = s.year;
    var inYear = items.filter(function (x) { return String(x.effectiveDate || '').slice(0, 4) === year; });
    var num = function (n) { return n.toLocaleString('ko-KR'); };
    var isTidy = function (x) { return x.amendmentType === '타법개정'; };

    /* 1. 직무별 개정 건수 — 실질 개정(법 내용 변경) / 타법개정(다른 법 개정에 따른 명칭·용어·인용 조문 단순 변경)으로 나눠 검토 부담을 보이게 */
    var jobs = s.cats.map(function (c) {
      var xs = inYear.filter(function (x) { return (x.categories || [])[0] === c; });
      var t = xs.filter(isTidy).length;
      return [c, xs.length - t, t];
    }).filter(function (j) { return j[1] + j[2] > 0; }).sort(function (a, b) { return (b[1] + b[2]) - (a[1] + a[2]); });
    var GRAY = dark() ? '#4a5568' : '#cfd5de';
    make('rr-an-jobs', {
      type: 'bar',
      data: { labels: jobs.map(function (j) { return j[0]; }), datasets: [
        { label: '실질 개정', data: jobs.map(function (j) { return j[1]; }), backgroundColor: R[1], borderColor: k.surface, borderWidth: { right: 2 }, borderSkipped: false, barPercentage: 0.72, categoryPercentage: 0.9 },
        { label: '타법개정', data: jobs.map(function (j) { return j[2]; }), backgroundColor: GRAY, borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: false, barPercentage: 0.72, categoryPercentage: 0.9 }
      ] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, layout: { padding: { right: 30 } },
        onClick: function (e, el) { if (el.length) goJob(jobs[el[0].index][0]); },
        onHover: function (e, el) { e.native && (e.native.target.style.cursor = el.length ? 'pointer' : 'default'); },
        plugins: { legend: { position: 'top', align: 'start', labels: { color: k.text, boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 10 } },
          rrEndLabels: { color: k.text, totals: jobs.map(function (j) { return j[1] + j[2]; }) },
          tooltip: { mode: 'index', callbacks: { footer: function (c) { var j = jobs[c[0].dataIndex]; return '합계 ' + (j[1] + j[2]) + '건 · 눌러서 직무별 탭'; } } } },
        scales: (function () { var sc = hbarScales(k, Math.max.apply(null, jobs.map(function (j) { return j[1] + j[2]; }).concat([1]))); sc.x.stacked = true; sc.y.stacked = true; return sc; })() },
      plugins: [endLabels]
    });

    var def = document.getElementById('rr-an-jobs-def');
    if (def) { def.querySelector('.real').style.background = R[1]; def.querySelector('.tidy').style.background = GRAY; }

    /* 2. 직무 × 분기 표 — 언제 어느 직무에 검토가 몰리는지. 진할수록 많다. 분기 머리를 누르면 분기별 탭 */
    var curQ = (function () { var t = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); return String(t.getFullYear()) === year ? 'Q' + (Math.floor(t.getMonth() / 3) + 1) : ''; })();
    var qjobs = s.cats.filter(function (c) { return s.byCat[c] > 0; }).sort(function (a, b) { return s.byCat[b] - s.byCat[a]; });
    var qmax = Math.max.apply(null, [1].concat(qjobs.map(function (c) { return Math.max.apply(null, QUARTERS.map(function (q) { return s.byQC[q[0]][c]; })); })));
    var heat = function (v) {
      if (!v) return '';
      var a = 0.08 + 0.72 * v / qmax;
      return ' style="background:rgba(48,86,211,' + a.toFixed(2) + ');' + (a > 0.45 ? 'color:#fff' : '') + '"';
    };
    var qtot = QUARTERS.map(function (q) { return qjobs.reduce(function (n, c) { return n + s.byQC[q[0]][c]; }, 0); });
    document.getElementById('rr-an-qtable').innerHTML = '<table class="rr-an-heat"><thead><tr><th>직무</th>' +
      QUARTERS.map(function (q) { return '<th><button type="button" data-q="' + q[0] + '" class="' + (q[0] === curQ ? 'now' : '') + '" title="' + q[1] + ' 개정 보기">' + q[1] + (q[0] === curQ ? '<i>진행 중</i>' : '') + '</button></th>'; }).join('') +
      '<th>합계</th></tr></thead><tbody>' +
      qjobs.map(function (c) {
        return '<tr><td><span class="sw" style="background:' + window.rrCatColor(c) + '"></span>' + esc(c) + '</td>' +
          QUARTERS.map(function (q) { var v = s.byQC[q[0]][c]; return '<td class="v' + (q[0] === curQ ? ' now' : '') + '"' + heat(v) + '>' + (v || '<span class="z">–</span>') + '</td>'; }).join('') +
          '<td class="t">' + num(s.byCat[c]) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>합계</td>' + qtot.map(function (v, i) { return '<td class="' + (QUARTERS[i][0] === curQ ? 'now' : '') + '">' + num(v) + '</td>'; }).join('') + '<td>' + num(s.total) + '</td></tr></tfoot></table>';

    /* 3. 법령 종류별 반영할 곳 — 사규·업무 어디를 고칠지. 제재·의무 = 종합 현황 '벌칙·과태료·의무 변경'과 같은 기준.
          별표·서식 = 개정문에서 별표·별지·서식이 바뀐 개정 (amend_details.json). 행정규칙은 조문 분석 대상이 아니라 '–' */
    var WHERE = { '법률': '사규 본문 · 원칙과 의무', '시행령': '적용 대상 · 세부 기준', '시행규칙': '업무 절차 · 신고 서식', '행정규칙': '세부 지침 · 기준값 (고시문 원문)' };
    var detReady = !!(A && A.details && inYear.length && A.details(inYear[0]) !== null);
    var isForm = function (x) { var d = A && A.details(x); var arts = d ? (d.articles || []).concat(d.changes || []) : []; return arts.some(function (a) { return /별표|별지|서식/.test((a.ref || '') + (a.title || '')); }); };
    var krows = KINDS.map(function (kd) {
      var xs = inYear.filter(function (x) { return kindOf(x) === kd; }), adm = kd === '행정규칙';
      return { k: kd, n: xs.length, real: xs.filter(function (x) { return !isTidy(x); }).length,
        risk: adm ? null : xs.filter(function (x) { return A && A.isRisk(x); }).length,
        form: adm ? null : (detReady ? xs.filter(isForm).length : undefined) };
    });
    var cell = function (v) { return v === null ? '<span class="z" title="행정규칙은 조문 단위 분석 대상이 아닙니다">–</span>' : v === undefined ? '<span class="z">…</span>' : num(v); };
    var sum = function (f) { return krows.reduce(function (n, r) { return n + (r[f] || 0); }, 0); };
    document.getElementById('rr-an-kinds').innerHTML = '<table class="rr-an-kt"><thead><tr><th>종류</th><th>개정</th><th>실질 개정</th><th>제재·의무</th><th>별표·서식</th><th>주로 반영할 곳</th></tr></thead><tbody>' +
      krows.map(function (r) { return '<tr><td>' + r.k + '</td><td>' + num(r.n) + '</td><td>' + num(r.real) + '</td><td>' + cell(r.risk) + '</td><td>' + cell(r.form) + '</td><td class="w">' + WHERE[r.k] + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>합계</td><td>' + num(sum('n')) + '</td><td>' + num(sum('real')) + '</td><td>' + num(sum('risk')) + '</td><td>' + (detReady ? num(sum('form')) : '…') + '</td><td></td></tr></tfoot></table>';
    if (!detReady && A && A.loadDetails) A.loadDetails().then(function () { render(true); });

    /* 4. 전체를 읽어야 할 개정 — 제정·전부개정·폐지제정은 바뀐 부분이 아니라 전체가 새 내용 */
    var FULL = ['제정', '전부개정', '폐지제정'];
    var today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var dd = function (x) { return Math.round((new Date(x.effectiveDate + 'T00:00:00+09:00') - today) / 86400000); };
    var full = inYear.filter(function (x) { return FULL.indexOf(x.amendmentType) >= 0; }).sort(function (a, b) {
      var da = dd(a), db = dd(b);
      if ((da >= 0) !== (db >= 0)) return da >= 0 ? -1 : 1;
      return da >= 0 ? da - db : db - da;
    });
    document.getElementById('rr-an-full-n').textContent = full.length + '건';
    document.getElementById('rr-an-full').innerHTML = full.length ? '<div class="rr-an-fl">' + full.map(function (x) {
      var d = dd(x), c = (x.categories || [])[0] || '';
      return '<button type="button" class="rr-an-fr" data-key="' + esc(x._key || x.id) + '">' +
        '<span class="ty ' + (x.amendmentType === '제정' ? 'new' : 'all') + '">' + esc(x.amendmentType) + '</span>' +
        '<span class="tt"><b>' + esc(x.title) + '</b><small><i style="background:' + window.rrCatColor(c) + '"></i>' + esc(c) + ' · ' + esc(kindOf(x)) + ' · ' + esc(String(x.effectiveDate).replace(/-/g, '.')) + '</small></span>' +
        '<span class="dd' + (d >= 0 ? ' up' : '') + '">' + (d < 0 ? '시행완료' : d === 0 ? 'D-DAY' : 'D-' + d) + '</span></button>';
    }).join('') + '</div>' : '<div class="rr-an-none">올해 제정·전부개정된 법령이 없습니다.</div>';

    return true;
  }

  document.addEventListener('click', function (e) {
    var q = e.target.closest && e.target.closest('#rr-analytics .rr-an-heat button[data-q]');
    if (q && typeof window.showQuarterlyDetail === 'function') { window.showQuarterlyDetail(q.getAttribute('data-q')); window.scrollTo(0, 0); return; }
    var r = e.target.closest && e.target.closest('#rr-analytics .rr-an-fr[data-key]');
    if (r && typeof window.showLawDetail === 'function') window.showLawDetail(r.getAttribute('data-key'));
  });

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
  window.rrChartKit = { ink: ink, ramp: ramp, esc: esc, endLabels: endLabels, hbarScales: hbarScales, lawKind: lawKind, kindOf: kindOf, KINDS: KINDS, yearOf: yearOf };

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
    /* 직무 × 분기 표 · 법령 종류 표 · 전체를 읽어야 할 개정 */
    '.rr-an-heat, .rr-an-kt { width:100%; border-collapse:separate; border-spacing:0; font-size:.84rem; font-variant-numeric:tabular-nums; margin:0; }',
    '.rr-an-heat th, .rr-an-kt th { font-size:.74rem; font-weight:700; color:var(--text-muted); padding:.35rem .4rem; text-align:center; border-bottom:1px solid var(--border); }',
    '.rr-an-heat th:first-child, .rr-an-kt th:first-child { text-align:left; }',
    '.rr-an-heat td, .rr-an-kt td { padding:.45rem .4rem; text-align:center; border-bottom:1px solid var(--border); color:var(--text-primary); }',
    '.rr-an-heat td:first-child, .rr-an-kt td:first-child { text-align:left; font-weight:700; white-space:nowrap; }',
    '.rr-an-heat td.v { font-weight:700; border-radius:6px; border-bottom-color:transparent; box-shadow: inset 0 0 0 2px var(--bg-card, #fff); }',
    '.rr-an-heat td.t, .rr-an-heat tfoot td, .rr-an-kt tfoot td { font-weight:800; }',
    '.rr-an-heat tfoot td, .rr-an-kt tfoot td { border-bottom:0; color:var(--text-secondary); }',
    '.rr-an-heat .sw { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:6px; vertical-align:1px; }',
    '.rr-an-heat .z, .rr-an-kt .z { color:var(--text-muted); font-weight:400; }',
    '.rr-an-heat th button { border:0; background:none; font:inherit; color:inherit; cursor:pointer; padding:.15rem .35rem; border-radius:6px; display:inline-flex; flex-direction:column; align-items:center; line-height:1.2; }',
    '.rr-an-heat th button:hover { background:var(--bg-secondary); color:var(--text-primary); }',
    '.rr-an-heat th button.now { color:var(--primary); }',
    '.rr-an-heat th button i { font-style:normal; font-size:.66rem; font-weight:700; }',
    '.rr-an-kt td.w { text-align:left; color:var(--text-secondary); font-size:.8rem; white-space:nowrap; }',
    '.rr-an-kt th:last-child { text-align:left; }',
    '.rr-an-fl { max-height:262px; overflow-y:auto; overflow-x:hidden; border:1px solid var(--border); border-radius:12px; }',
    '.rr-an-fr { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:.7rem; align-items:center; width:100%; padding:.55rem .75rem; border:0; border-bottom:1px solid var(--border); background:var(--bg-card); text-align:left; font:inherit; color:var(--text-primary); cursor:pointer; }',
    '.rr-an-fr:last-child { border-bottom:0; }',
    '.rr-an-fr:hover { background:var(--bg-secondary); }',
    '.rr-an-fr .ty { font-size:.72rem; font-weight:800; padding:.18rem .5rem; border-radius:6px; white-space:nowrap; color:var(--ok, #15803d); background:var(--ok-soft, #ecfdf3); }',
    '.rr-an-fr .ty.all { color:var(--brand-ink, #1f3a9e); background:var(--brand-soft, #edf1fd); }',
    '.rr-an-fr .tt { display:flex; flex-direction:column; min-width:0; gap:2px; }',
    '.rr-an-fr .tt b { font-size:.86rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.rr-an-fr .tt small { font-size:.74rem; color:var(--text-muted); }',
    '.rr-an-fr .tt small i { display:inline-block; width:7px; height:7px; border-radius:2px; margin-right:5px; vertical-align:1px; }',
    '.rr-an-fr .dd { font-size:.74rem; font-weight:800; color:var(--text-muted); white-space:nowrap; }',
    '.rr-an-fr .dd.up { color:var(--warn, #c4580c); }',
    '.rr-an-def { margin-top:.8rem; display:flex; flex-direction:column; gap:.45rem; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:.7rem .85rem; }',
    '.rr-an-def p { margin:0; display:grid; grid-template-columns:auto minmax(0,1fr); gap:.5rem; font-size:.8rem; line-height:1.55; color:var(--text-secondary); }',
    '.rr-an-def b { display:inline-flex; align-items:center; gap:.4rem; color:var(--text-primary); white-space:nowrap; font-weight:800; }',
    '.rr-an-def b i { width:10px; height:10px; border-radius:3px; display:inline-block; }',
    '.rr-an-none { padding:2rem 0; text-align:center; color:var(--text-muted); font-size:.85rem; }',
    '.rr-an-cnt { font-style:normal; font-size:.78rem; font-weight:700; color:var(--text-secondary); background:var(--bg-secondary); border-radius:999px; padding:.1rem .55rem; margin-left:.35rem; vertical-align:1px; }',
    '@media (max-width: 900px) { .rr-an-grid { grid-template-columns: 1fr; } .rr-an-kt td.w { white-space:normal; } }',
    '#rr-an-qtable, #rr-an-kinds { overflow-x:auto; }',
    '@media (max-width: 520px) { .rr-an-kt th:nth-child(5), .rr-an-kt td:nth-child(5) { display:none; }' +
      ' .rr-an-heat, .rr-an-kt { font-size:.76rem; } .rr-an-heat th, .rr-an-heat td, .rr-an-kt th, .rr-an-kt td { padding:.35rem .2rem; }' +
      ' .rr-an-heat th button { padding:.1rem .15rem; } .rr-an-heat .sw { display:none; } .rr-an-heat th button i { display:none; } }'
  ].join('\n');
  document.head.appendChild(st);

  var n = 0;
  var t = setInterval(function () { if (render() || ++n > 100) clearInterval(t); }, 250);
  if (window.rrAmend && window.rrAmend.ready) window.rrAmend.ready.then(function () { render(true); });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { render(true); });
  }
})();
