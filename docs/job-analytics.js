/* 직무별 탭 '직무 분석' — 바로 위 '직무별 현황' 필터(전체/각 직무)를 따라 함께 바뀐다.
 * 직무 담당자가 바로 알아야 할 것 위주로:
 *  - 시행 현황 숫자 (개정 건수 / 시행완료 / 30일 내 / 이후 예정)
 *  - 개정 성격 (도넛): 법 내용을 바꾼 실질 개정 vs 다른 법에 맞춘 타법 정비
 *  - 제재 · 의무 변경 (도넛): 벌칙·과태료·과징금·행정처분 > 의무 > 조문 신설·삭제 > 표시 없음 (한 건은 가장 무거운 쪽 하나로)
 *  - 시행 전 대응 (도넛): 대응 현황 기록(tracker.js)의 상태 — 로그인한 담당자·총괄에게만
 *  - 다가오는 시행 (타임라인, 누르면 법령 상세) · 월별 시행 건수
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
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

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
    var lt = document.getElementById('law-list-label');
    if (lt) lt.textContent = (cur === 'all' ? '' : cur + ' ') + '개정 법령 목록';

    /* 시행 현황 숫자 */
    var done = 0, soon = 0, later = 0;
    sel.forEach(function (x) { var d = days(x.effectiveDate, today); if (d < 0) done++; else if (d <= 30) soon++; else later++; });
    var titles = {};
    sel.forEach(function (x) { titles[x.title] = 1; });
    document.getElementById('rr-job-tiles').innerHTML = [
      ['개정 건수', sel.length, '법령 ' + Object.keys(titles).length + '개'],
      ['시행완료', done, sel.length ? Math.round(done / sel.length * 100) + '%' : ''],
      ['30일 내 시행', soon, soon ? '⏰ 준비 필요' : '없음'],
      ['이후 시행예정', later, '']
    ].map(function (t, i) {
      return '<div class="rr-job-tile' + (i === 2 && soon ? ' hot' : '') + '"><span>' + t[0] + '</span><b>' + (typeof t[1] === 'number' ? t[1].toLocaleString('ko-KR') : t[1]) + '</b><small>' + t[2] + '</small></div>';
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
          x: { stacked: true, grid: { display: false }, ticks: { color: k.muted, font: { size: 10 }, autoSkip: false, maxRotation: 0, callback: function (v, i) { return (i + 1) + '월'; } } },
          y: { stacked: true, beginAtZero: true, grid: { color: k.grid }, border: { display: false }, ticks: { color: k.muted, font: { size: 11 }, precision: 0, maxTicksLimit: 5 } }
        }
      }
    });
    document.getElementById('rr-job-monthly-note').textContent = cur === 'all' ? '직무별 누적' : '연한 막대 = 지난 달';

    var num = function (n) { return n.toLocaleString('ko-KR'); };
    var pct = function (n, t) { return t ? Math.round(n / t * 100) : 0; };
    var dark = window.rrIsDark && window.rrIsDark();
    var GRAY = dark ? '#4a5568' : '#d5dae2';

    /* 도넛 한 칸: 가운데 숫자 + 범례(이름·건수·비중) + 한 줄 요약 */
    function donut(id, rows, center, say, opt) {
      opt = opt || {};
      var box = document.getElementById(id);
      if (!box) return;
      var total = rows.reduce(function (n, r) { return n + r[1]; }, 0);
      var cid = id + '-c';
      box.innerHTML = '<div class="rr-jd-plot"><canvas id="' + cid + '" role="img" aria-label="' + esc(opt.aria || '') + '"></canvas>' +
          '<div class="rr-jd-c">' + center + '</div></div>' +
        '<div class="rr-an-legend">' + (rows.length ? rows.map(function (r) {
          return '<div class="rr-an-li' + (r[1] ? '' : ' zero') + '"><span class="rr-an-sw" style="background:' + r[2] + '"></span><span>' + esc(r[0]) + '</span><b>' + (r[1] ? num(r[1]) : '–') + '</b><small>' + (r[1] ? pct(r[1], total) + '%' : '') + '</small></div>';
        }).join('') : '') + '</div>' +
        (say ? '<p class="rr-jd-say">' + say + '</p>' : '') + (opt.foot || '');
      var has = rows.filter(function (r) { return r[1] > 0; });
      make(cid, {
        type: 'doughnut',
        data: has.length
          ? { labels: has.map(function (r) { return r[0]; }), datasets: [{ data: has.map(function (r) { return r[1]; }), backgroundColor: has.map(function (r) { return r[2]; }), borderColor: k.surface, borderWidth: 2, hoverOffset: 4 }] }
          : { labels: [''], datasets: [{ data: [1], backgroundColor: k.grid, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', animation: { duration: 500 },
          plugins: { legend: { display: false }, tooltip: { enabled: has.length > 0, callbacks: {
            label: function (c) { return ' ' + c.label + ' ' + num(c.parsed) + '건 (' + pct(c.parsed, total) + '%)'; } } } } }
      });
    }
    var big = function (n, t) { return '<b>' + num(n) + '<small>건</small></b><span>' + t + '</span>'; };

    /* 개정 성격 — 실질 개정(법 내용 변경) vs 타법 정비 */
    var TYPE_ORDER = ['일부개정', '전부개정', '제정', '폐지제정', '폐지'];
    var tc = {};
    sel.forEach(function (x) { var t = x.amendmentType || '기타'; tc[t] = (tc[t] || 0) + 1; });
    var tkeys = Object.keys(tc).filter(function (t) { return t !== '타법개정'; })
      .sort(function (a, b) { var ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || tc[b] - tc[a]; });
    var natRows = tkeys.map(function (t, i) { return [t, tc[t], R[[1, 0, 2, 3, 3][Math.min(i, 4)]]]; });
    if (tc['타법개정']) natRows.push(['타법개정 (정비)', tc['타법개정'], GRAY]);
    var real = sel.length - (tc['타법개정'] || 0);
    donut('rr-job-nature', natRows, big(real, '실질 개정'),
      sel.length ? '<b>' + num(sel.length) + '건 중 ' + num(real) + '건(' + pct(real, sel.length) + '%)</b>이 법 내용 자체를 바꾼 개정입니다. 타법개정은 다른 법 개정에 맞춘 용어·조문 정비입니다.' : '올해 개정이 없습니다.',
      { aria: label + ' 개정 성격 도넛 차트' });

    /* 제재 · 의무 변경 — 한 건은 가장 무거운 표시 하나로 센다 (합계 = 개정 건수) */
    var A = window.rrAmend;
    var LV = [['제재 변경', '#d92d20'], ['의무 변경', '#f0a33a'], ['조문 신설·삭제', R[2]], ['표시 없음', GRAY]];
    var lvOf = function (x) {
      var c = A ? A.codes(x) : [];
      if (c.some(function (v) { return v === '벌칙' || v === '과태료' || v === '과징금' || v === '처분'; })) return 0;
      if (c.indexOf('의무') >= 0) return 1;
      if (c.indexOf('신설') >= 0 || c.indexOf('삭제') >= 0) return 2;
      return 3;
    };
    var lc = [0, 0, 0, 0], riskUp = 0;
    sel.forEach(function (x) { var l = lvOf(x); lc[l]++; if (l <= 1 && days(x.effectiveDate, today) >= 0) riskUp++; });
    var risk = lc[0] + lc[1];
    donut('rr-job-risk', LV.map(function (l, i) { return [l[0], lc[i], l[1]]; }), big(risk, '제재·의무 변경'),
      !A ? '개정 표시를 불러오는 중입니다.' : risk
        ? '<b>' + num(risk) + '건</b>에서 벌칙·과태료·과징금·행정처분 또는 회사 의무가 바뀌었습니다.' + (riskUp ? ' 이 중 <b>' + num(riskUp) + '건이 아직 시행 전</b>으로 우선 검토 대상입니다.' : ' 모두 이미 시행되었습니다.')
        : '올해 제재·의무가 바뀐 개정은 확인되지 않았습니다.',
      { aria: label + ' 제재·의무 변경 도넛 차트' });

    /* 시행 전 대응 — 대응 현황 기록(로그인한 담당자·총괄에게만) */
    var T = window.rrTracker, snap = T && T.snapshot && T.snapshot();
    var pre = sel.filter(function (x) { return days(x.effectiveDate, today) >= 0; });
    var SC = [['미검토', '#a3abba'], ['검토중', '#4a6ee0'], ['조치필요', '#e8762c'], ['조치완료', '#1f9d55'], ['해당없음', dark ? '#718096' : '#cfd5de']];
    var go = '<button type="button" class="rr-jd-go" data-jgo="tracker">대응 현황에서 기록하기 →</button>';
    if (!snap) {
      var box = document.getElementById('rr-job-resp');
      if (charts['rr-job-resp-c']) { charts['rr-job-resp-c'].destroy(); delete charts['rr-job-resp-c']; }
      box.innerHTML = '<div class="rr-jd-lock"><span class="ic" aria-hidden="true">' + (window.rrIcon ? window.rrIcon('lock') : '🔒') + '</span>' +
        '<b>시행 예정 ' + num(pre.length) + '건</b><p>담당자로 로그인하면 이 직무의 검토·조치 진행 상황이 여기에 표시됩니다.</p>' +
        '<button type="button" class="rr-jd-go" data-jgo="login">담당자 로그인</button></div>';
    } else {
      var sc = {};
      SC.forEach(function (s) { sc[s[0]] = 0; });
      pre.forEach(function (x) { var st = T.status(x) || '미검토'; sc[st] = (sc[st] || 0) + 1; });
      var open = pre.length - sc['조치완료'] - sc['해당없음'];
      var soonOpen = pre.filter(function (x) { var st = T.status(x) || '미검토'; var d = days(x.effectiveDate, today); return d <= 30 && st !== '조치완료' && st !== '해당없음'; }).length;
      donut('rr-job-resp', SC.map(function (s) { return [s[0], sc[s[0]], s[1]]; }), big(open, '미완료'),
        pre.length ? '시행 예정 <b>' + num(pre.length) + '건 중 ' + num(pre.length - open) + '건 완료</b>' + (soonOpen ? ' · <b class="hot">30일 내 미완료 ' + num(soonOpen) + '건</b>' : ' · 30일 내 미완료 없음') : '올해 남은 시행 예정이 없습니다.',
        { aria: label + ' 시행 전 대응 상태 도넛 차트', foot: go });
    }

    /* 다가오는 시행 — 시행 예정 전부 (숫자 = 목록 건수), 누르면 법령 상세 */
    var nx = pre.slice().sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || a.title.localeCompare(b.title); });
    document.getElementById('rr-job-next-n').textContent = nx.length ? num(nx.length) + '건' : '';
    document.getElementById('rr-job-next').innerHTML = nx.length ? '<div class="rr-jn-list">' + nx.map(function (x) {
      var d = days(x.effectiveDate, today), cls = d <= 7 ? 'u' : d <= 30 ? 's' : 'l';
      var cat = (x.categories || [])[0] || '';
      return '<button type="button" class="rr-jn-row ' + cls + '" data-key="' + esc(x._key || x.id) + '">' +
        '<span class="dd">' + (d === 0 ? 'D-DAY' : 'D-' + d) + '</span>' +
        '<span class="dt">' + esc(String(x.effectiveDate).slice(5).replace('-', '.')) + '</span>' +
        '<span class="tt"><span class="t">' + esc(x.title) + '</span>' + (A ? A.badges(A.codes(x)) : '') + '</span>' +
        '<span class="mt">' + (cur === 'all' ? '<i style="background:' + window.rrCatColor(cat) + '"></i>' + esc(cat) + ' · ' : '') + esc(x.amendmentType || '') + '</span>' +
      '</button>';
    }).join('') + '</div>' : '<div class="rr-jn-none">올해 남은 시행 예정이 없습니다.</div>';
    return true;
  }

  /* 필터 버튼과 연결: 버튼을 누르면 cur 가 바뀌고 차트가 다시 그려진다 */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#business-content .filter-tab[data-filter]');
    if (!t) return;
    cur = t.getAttribute('data-filter') || 'all';
    setTimeout(function () { render(true); }, 60);
  });
  /* 다가오는 시행: 법령 상세 / 대응 현황으로 / 로그인 */
  document.addEventListener('click', function (e) {
    var row = e.target.closest && e.target.closest('#rr-job-an .rr-jn-row[data-key]');
    if (row && typeof window.showLawDetail === 'function') { window.showLawDetail(row.getAttribute('data-key')); return; }
    var g = e.target.closest && e.target.closest('#rr-job-an [data-jgo]');
    if (!g) return;
    if (g.getAttribute('data-jgo') === 'login') { if (window.rrTracker) window.rrTracker.openLogin(); }
    else if (typeof window.switchMainTab === 'function') { window.switchMainTab('tracker'); window.scrollTo(0, 0); }
  });
  /* 로그인·기록 변경, 개정 표시를 다 읽었을 때 다시 그린다 */
  function visible() { var p = document.getElementById('business-content'); return !!(p && p.offsetParent); }
  window.addEventListener('rr-trk-change', function () { if (visible()) render(true); });
  if (window.rrAmend && window.rrAmend.ready) window.rrAmend.ready.then(function () { if (visible()) render(true); });
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
    /* 직무 분석: 첫 줄 도넛 3개, 둘째 줄 다가오는 시행(2칸) + 월별 */
    '.rr-an-grid.rr-job-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }',
    '.rr-an-card.span2 { grid-column: span 2; }',
    '.rr-jd { display:flex; flex-direction:column; align-items:center; gap:.8rem; }',
    '.rr-jd-plot { position:relative; width:150px; height:150px; }',
    '.rr-jd-c { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; text-align:center; }',
    '.rr-jd-c b { font-size:1.5rem; font-weight:800; color:var(--text-primary); line-height:1.1; font-variant-numeric:tabular-nums; }',
    '.rr-jd-c b small { font-size:.8rem; font-weight:700; margin-left:1px; }',
    '.rr-jd-c span { font-size:.74rem; font-weight:700; color:var(--text-muted); margin-top:3px; }',
    '.rr-jd .rr-an-legend { width:100%; gap:.3rem; }',
    '.rr-jd .rr-an-li.zero { opacity:.45; }',
    '.rr-jd-say { margin:0; width:100%; font-size:.8rem; line-height:1.55; color:var(--text-secondary); background:var(--bg-secondary); border-radius:10px; padding:.6rem .75rem; }',
    '.rr-jd-say b { color:var(--text-primary); } .rr-jd-say b.hot { color:var(--danger); }',
    '.rr-jd-go { align-self:stretch; border:1px solid var(--border); background:var(--bg-card); color:var(--primary); border-radius:10px; padding:.5rem .75rem; font:inherit; font-size:.82rem; font-weight:700; cursor:pointer; }',
    '.rr-jd-go:hover { background:var(--bg-secondary); }',
    '.rr-jd-lock { display:flex; flex-direction:column; align-items:center; text-align:center; gap:.45rem; padding:1.2rem .4rem .2rem; width:100%; }',
    '.rr-jd-lock .ic { width:64px; height:64px; border-radius:50%; border:10px solid var(--bg-secondary); display:flex; align-items:center; justify-content:center; color:var(--text-muted); box-sizing:content-box; }',
    '.rr-jd-lock .ic svg { width:22px; height:22px; }',
    '.rr-jd-lock b { font-size:1rem; color:var(--text-primary); margin-top:.3rem; }',
    '.rr-jd-lock p { margin:0 0 .4rem; font-size:.82rem; line-height:1.55; color:var(--text-secondary); }',
    '.rr-an-cnt { font-style:normal; font-size:.78rem; font-weight:700; color:var(--text-secondary); background:var(--bg-secondary); border-radius:999px; padding:.1rem .55rem; margin-left:.35rem; vertical-align:1px; }',
    '.rr-jn-list { max-height:268px; overflow-y:auto; overflow-x:hidden; border:1px solid var(--border); border-radius:12px; }',
    '.rr-jn-row { display:grid; grid-template-columns:64px 44px minmax(0,1fr) auto; align-items:center; gap:.7rem; width:100%; padding:.55rem .8rem; border:0; border-bottom:1px solid var(--border); background:var(--bg-card); text-align:left; font:inherit; cursor:pointer; color:var(--text-primary); }',
    '.rr-jn-row:last-child { border-bottom:0; }',
    '.rr-jn-row:hover { background:var(--bg-secondary); }',
    '.rr-jn-row .dd { font-size:.76rem; font-weight:800; text-align:center; border-radius:7px; padding:.2rem 0; font-variant-numeric:tabular-nums; }',
    '.rr-jn-row.u .dd { color:var(--danger); background:var(--danger-soft); }',
    '.rr-jn-row.s .dd { color:var(--warn); background:var(--warn-soft); }',
    '.rr-jn-row.l .dd { color:var(--brand-ink, #1f3a9e); background:var(--brand-soft, #edf1fd); }',
    '.rr-jn-row .dt { font-size:.8rem; font-weight:700; color:var(--text-muted); font-variant-numeric:tabular-nums; }',
    /* 배지가 많으면 법령명을 줄이지 않고 배지를 다음 줄로 */
    '.rr-jn-row .tt { display:flex; align-items:center; flex-wrap:wrap; row-gap:3px; min-width:0; }',
    '.rr-jn-row .tt .t { font-size:.88rem; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }',
    '.rr-jn-row .tt .rr-rbs { flex-wrap:wrap; }',
    '.rr-jn-row .mt { font-size:.76rem; color:var(--text-muted); white-space:nowrap; }',
    '.rr-jn-row .mt i { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; }',
    '.rr-jn-none { padding:2.2rem 0; text-align:center; color:var(--text-muted); font-size:.88rem; border:1px dashed var(--border); border-radius:12px; }',
    '@media (max-width: 1100px) { .rr-an-grid.rr-job-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .rr-an-card.span2 { grid-column: 1 / -1; } }',
    '@media (max-width: 900px) { .rr-an-grid.rr-job-grid { grid-template-columns: 1fr; } .rr-jn-row { grid-template-columns:58px minmax(0,1fr); } .rr-jn-row .dt, .rr-jn-row .mt { display:none; } }',
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
