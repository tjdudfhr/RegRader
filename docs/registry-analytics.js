/* 적용법규 탭 '적용법규 분석' — 왼쪽 '직무 분야'(전체/각 직무)를 따라 함께 바뀐다.
 * 주제: 당사 적용법규(법규등록부) 중 올해 얼마나 개정됐나.
 *  - 숫자: 적용법규 수 / 올해 개정된 법규 / 올해 개정 없음 / 30일 내 시행 예정 법규
 *  - 직무별 적용법규 (올해 개정됨 vs 개정 없음, 누르면 그 직무 선택)
 *  - 법령 종류 (도넛)
 *  - 사업 단계별 적용법규: 공장 건설·설비 → 생산·환경·안전 → 판매·수출입·거래, 회사 공통 (법령 계열 단위로 나눔)
 *  - 제재·의무가 바뀐 적용법규: 올해 개정에서 벌칙·과태료·과징금·행정처분·의무가 바뀐 법규 (법규등록부 준수 의무 갱신 대상)
 * 적용법규 목록은 base_laws_207.json (법규 추가 시 자동으로 늘어난다), 개정은 window.__rrItems.
 */
(function () {
  'use strict';
  var charts = {}, cur = 'all', base = null, lastKey = '';
  /* 사업 단계: 회사가 하는 일 — 이차전지소재·내화물 공장을 짓고(건설·설비) → 만들고(생산) → 팔고 운송(판매) + 회사 공통.
     법령 계열(법률 이름) 단위로 나눈다. 계열이 없으면 직무로 (환경·안전 → 생산, 공정거래 → 판매, 나머지 → 공통) */
  var STAGES = [['build', '공장 건설·설비'], ['make', '생산 · 환경·안전'], ['sell', '판매·수출입·거래'], ['corp', '회사 공통']];
  var STAGE_OF = {};
  [['build', ['건축법', '산업집적활성화 및 공장설립에 관한 법률', '환경영향평가법', '건설산업기본법', '건설폐기물의 재활용촉진에 관한 법률', '석면안전관리법',
      '소방시설 설치 및 관리에 관한 법률', '승강기 안전관리법', '전기안전관리법', '도시가스사업법', '액화석유가스의 안전관리 및 사업법', '수도법', '하수도법']],
   ['make', ['산업안전보건법', '중대재해 처벌 등에 관한 법률', '화학물질관리법', '화학물질의 등록 및 평가 등에 관한 법률', '위험물안전관리법', '고압가스 안전관리법',
      '화재의 예방 및 안전관리에 관한 법률', '원자력안전법', '연구실 안전환경 조성에 관한 법률', '대기환경보전법', '물환경보전법', '폐기물관리법', '소음ㆍ진동관리법',
      '악취방지법', '토양환경보전법', '잔류성오염물질 관리법', '해양폐기물 및 해양오염퇴적물 관리법', '자원의 절약과 재활용촉진에 관한 법률', '순환경제사회 전환 촉진법',
      '환경개선비용 부담법', '환경기술 및 환경산업 지원법', '환경정책기본법', '에너지이용 합리화법', '기후위기 대응을 위한 탄소중립ㆍ녹색성장 기본법', '온실가스 배출권의 할당 및 거래에 관한 법률']],
   ['sell', ['대외무역법', '관세법', '자유무역협정의 이행을 위한 관세법의 특례에 관한 법률', '독점규제 및 공정거래에 관한 법률', '하도급거래 공정화에 관한 법률',
      '대리점거래의 공정화에 관한 법률', '대ㆍ중소기업 상생협력 촉진에 관한 법률', '약관의 규제에 관한 법률', '표시ㆍ광고의 공정화에 관한 법률', '제조물 책임법',
      '경제안보를 위한 공급망 안정화 지원 기본법', '소재ㆍ부품ㆍ장비산업 경쟁력 강화 및 공급망 안정화를 위한 특별조치법', '국가첨단전략산업 경쟁력 강화 및 보호에 관한 특별조치법']]
  ].forEach(function (g) { g[1].forEach(function (t) { STAGE_OF[t.replace(/\s/g, '')] = g[0]; }); });
  function stageOf(root, job) {
    var st = root && STAGE_OF[String(root).replace(/\s/g, '')];
    if (st) return st;
    return job === '환경' || job === '안전' ? 'make' : job === '공정거래' ? 'sell' : 'corp';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

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
      .then(function (d) {
        base = d.items || [];
        /* 적용법규 = 법령 + 계열에 연결된 행정규칙(참고용 제외) */
        var F = window.rrFamilies;
        return (F && F.ready ? F.ready : Promise.resolve()).then(function () {
          var adm = F && F.admrul ? F.admrul() : [];
          base = base.concat(adm.map(function (a) { return { title: a.title, categories: a.category ? [a.category] : [], lawType: '행정규칙', kind: a.kind, family: a.family }; }));
          return base;
        });
      })
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
      ['올해 개정된 법규', amended.length, pct + '% · 개정 ' + amended.reduce(function (n, b) { return n + ev[b.title].length; }, 0) + '건'],
      ['올해 개정 없음', laws.length - amended.length, (100 - pct) + '%'],
      ['30일 내 시행 예정', soonLaws.length, soonLaws.length ? '⏰ 위 ' + amended.length + '개 중' : '없음']
    ].map(function (t, i) {
      return '<div class="rr-job-tile' + (i === 3 && soonLaws.length ? ' hot' : '') + '"><span>' + t[0] + '</span><b>' + (typeof t[1] === 'number' ? t[1].toLocaleString('ko-KR') : t[1]) + '</b><small>' + t[2] + '</small></div>';
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


    /* 법령 종류 (도넛) */
    var kinds = (K.KINDS || ['법률', '시행령', '시행규칙']).map(function (kd, i) { return [kd, laws.filter(function (b) { return (K.kindOf ? K.kindOf(b) : K.lawKind(b.title)) === kd; }).length, R[i]]; });
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

    /* 사업 단계별 적용법규 — 합계 = 위 '적용법규' 숫자 */
    var F = window.rrFamilies;
    var rootOf = function (b) {
      if (b.family) return b.family;
      var f = F && F.familyOf ? F.familyOf(b.title) : null;
      return f ? f.root : '';
    };
    var upSoon = function (b) { return (ev[b.title] || []).some(function (x) { return Math.round((new Date(x.effectiveDate + 'T00:00:00+09:00') - today) / 86400000) >= 0; }); };
    var stg = {};
    STAGES.forEach(function (st) { stg[st[0]] = { laws: [], fam: {} }; });
    laws.forEach(function (b) {
      var r = rootOf(b), g = stg[stageOf(r, (b.categories || [])[0])];
      g.laws.push(b);
      var key = r || b.title;
      g.fam[key] = (g.fam[key] || 0) + 1;
    });
    document.getElementById('rr-reg-stages').innerHTML = STAGES.map(function (st, i) {
      var g = stg[st[0]], n = g.laws.length;
      var adm = g.laws.filter(function (b) { return b.lawType === '행정규칙'; }).length;
      var am = g.laws.filter(function (b) { return ev[b.title]; }).length, up = g.laws.filter(upSoon).length;
      var top = Object.keys(g.fam).map(function (k2) { return [k2, g.fam[k2]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
      var shown = top.slice(0, 6);
      return (i === 3 ? '<span class="sep" aria-hidden="true"></span>' : i ? '<span class="arr" aria-hidden="true">→</span>' : '') +
        '<div class="st ' + st[0] + (n ? '' : ' none') + '"><div class="h">' + (i < 3 ? '<span class="no">' + (i + 1) + '</span>' : '') + st[1] + '</div>' +
        '<div class="n"><b>' + n.toLocaleString('ko-KR') + '</b>개<small>법령 ' + (n - adm) + ' · 행정규칙 ' + adm + '</small></div>' +
        '<div class="m">올해 개정 <b>' + am + '</b> · 시행 예정 <b class="' + (up ? 'up' : '') + '">' + up + '</b></div>' +
        '<div class="fam">' + shown.map(function (f) { return '<span title="' + esc(f[0]) + ' 계열 적용법규 ' + f[1] + '개">' + esc(f[0].length > 14 ? f[0].slice(0, 13) + '…' : f[0]) + '<i>' + f[1] + '</i></span>'; }).join('') +
          (top.length > shown.length ? '<span class="more">외 ' + (top.length - shown.length) + '개 계열</span>' : '') + (n ? '' : '<span class="more">해당 없음</span>') + '</div></div>';
    }).join('');

    /* 제재·의무가 바뀐 적용법규 — 법규등록부의 준수 의무 칸을 고쳐야 할 법규. 법규 단위(개정 여러 건이면 표시를 합친다) */
    var A = window.rrAmend;
    var riskLaws = laws.map(function (b) {
      var xs = (ev[b.title] || []).filter(function (x) { return A && A.isRisk(x); });
      if (!xs.length) return null;
      var codes = [];
      xs.forEach(function (x) { A.codes(x).forEach(function (c) { if (codes.indexOf(c) < 0) codes.push(c); }); });
      xs.sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)); });
      var t0 = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
      var pickEv = xs.filter(function (x) { return x.effectiveDate >= t0; })[0] || xs[xs.length - 1];
      return { b: b, xs: xs, codes: codes, ev: pickEv };
    }).filter(Boolean).sort(function (a, b) {
      /* 시행 예정(가까운 순) 먼저, 그다음 이미 시행된 것(최근 순) */
      var t0 = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
      var ua = a.ev.effectiveDate >= t0, ub = b.ev.effectiveDate >= t0;
      if (ua !== ub) return ua ? -1 : 1;
      return (ua ? a.ev.effectiveDate.localeCompare(b.ev.effectiveDate) : b.ev.effectiveDate.localeCompare(a.ev.effectiveDate)) || a.b.title.localeCompare(b.b.title);
    });
    document.getElementById('rr-reg-risk-n').textContent = riskLaws.length + '개';
    document.getElementById('rr-reg-risk').innerHTML = riskLaws.length ? '<div class="rr-rk">' + riskLaws.map(function (r) {
      var d = Math.round((new Date(r.ev.effectiveDate + 'T00:00:00+09:00') - today) / 86400000), c = (r.b.categories || [])[0] || '';
      var order = ['벌칙', '과태료', '과징금', '처분', '의무', '신설', '삭제'];
      var cs = order.filter(function (x) { return r.codes.indexOf(x) >= 0; });
      return '<button type="button" class="rr-rk-row" data-key="' + esc(r.ev._key || r.ev.id) + '">' +
        '<span class="tt"><b>' + esc(r.b.title) + '</b><small><i style="background:' + window.rrCatColor(c) + '"></i>' + esc(c) + ' · ' + esc(K.kindOf(r.b)) + ' · 올해 ' + r.xs.length + '건</small></span>' +
        '<span class="bd">' + (A ? A.badges(cs) : '') + '</span>' +
        '<span class="dd' + (d >= 0 ? ' up' : '') + '">' + String(r.ev.effectiveDate).slice(5).replace('-', '.') + (d >= 0 ? (d === 0 ? ' D-DAY' : ' D-' + d) : ' 시행') + '</span></button>';
    }).join('') + '</div>' : '<div class="rr-an-none">올해 제재·의무가 바뀐 적용법규가 없습니다.</div>';
    return true;
  }

  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('#rr-reg-an .rr-rk-row[data-key]');
    if (r && typeof window.showLawDetail === 'function') window.showLawDetail(r.getAttribute('data-key'));
  });
  /* 개정 표시를 다 읽으면 다시 (제재·의무가 바뀐 적용법규) */
  if (window.rrAmend && window.rrAmend.ready) window.rrAmend.ready.then(function () { var p = document.getElementById('lawregistry-content'); if (p && p.offsetParent) render(true); });

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
  var st = document.createElement('style');
  st.textContent = [
    '.rr-stg { display:grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr); gap:.6rem; align-items:stretch; }',
    '.rr-stg .arr { align-self:center; color:var(--text-muted); font-weight:800; font-size:1.1rem; }',
    '.rr-stg .sep { width:1px; background:var(--border); margin:0 .3rem; }',
    '.rr-stg .st { border:1px solid var(--border); border-radius:12px; padding:.75rem .85rem; background:var(--bg-card); display:flex; flex-direction:column; gap:.35rem; min-width:0; }',
    '.rr-stg .st.corp { background:var(--bg-secondary); border-style:dashed; }',
    '.rr-stg .st.none { opacity:.5; }',
    '.rr-stg .h { font-weight:800; font-size:.9rem; color:var(--text-primary); display:flex; align-items:center; gap:.4rem; }',
    '.rr-stg .no { width:18px; height:18px; border-radius:50%; background:var(--primary); color:#fff; font-size:.7rem; display:inline-flex; align-items:center; justify-content:center; flex:none; }',
    '.rr-stg .n { font-size:.8rem; color:var(--text-secondary); display:flex; align-items:baseline; gap:.2rem; flex-wrap:wrap; }',
    '.rr-stg .n b { font-size:1.5rem; font-weight:800; color:var(--text-primary); font-variant-numeric:tabular-nums; }',
    '.rr-stg .n small { width:100%; font-size:.72rem; color:var(--text-muted); }',
    '.rr-stg .m { font-size:.78rem; color:var(--text-secondary); }',
    '.rr-stg .m b { color:var(--text-primary); font-variant-numeric:tabular-nums; } .rr-stg .m b.up { color:var(--warn, #c4580c); }',
    '.rr-stg .fam { display:flex; flex-wrap:wrap; gap:4px; margin-top:.15rem; }',
    '.rr-stg .fam span { font-size:.7rem; font-weight:600; color:var(--text-secondary); background:var(--bg-secondary); border-radius:6px; padding:.12rem .4rem; white-space:nowrap; }',
    '.rr-stg .st.corp .fam span { background:var(--bg-card); }',
    '.rr-stg .fam span i { font-style:normal; color:var(--text-muted); margin-left:.25rem; font-variant-numeric:tabular-nums; }',
    '.rr-stg .fam .more { background:none !important; color:var(--text-muted); }',
    '.rr-rk { max-height:300px; overflow-y:auto; overflow-x:hidden; border:1px solid var(--border); border-radius:12px; }',
    '.rr-rk-row { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto; gap:.8rem; align-items:center; width:100%; padding:.55rem .8rem; border:0; border-bottom:1px solid var(--border); background:var(--bg-card); text-align:left; font:inherit; color:var(--text-primary); cursor:pointer; }',
    '.rr-rk-row:last-child { border-bottom:0; }',
    '.rr-rk-row:hover { background:var(--bg-secondary); }',
    '.rr-rk-row .tt { display:flex; flex-direction:column; gap:2px; min-width:0; }',
    '.rr-rk-row .tt b { font-size:.87rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    '.rr-rk-row .tt small { font-size:.74rem; color:var(--text-muted); }',
    '.rr-rk-row .tt small i { display:inline-block; width:7px; height:7px; border-radius:2px; margin-right:5px; vertical-align:1px; }',
    '.rr-rk-row .bd { min-width:0; } .rr-rk-row .bd .rr-rbs { margin-left:0; flex-wrap:wrap; }',
    '.rr-rk-row .dd { font-size:.75rem; font-weight:800; color:var(--text-muted); white-space:nowrap; font-variant-numeric:tabular-nums; }',
    '.rr-rk-row .dd.up { color:var(--warn, #c4580c); }',
    '@media (max-width: 1100px) { .rr-stg { grid-template-columns: repeat(2, minmax(0,1fr)); } .rr-stg .arr, .rr-stg .sep { display:none; } }',
    '@media (max-width: 640px) { .rr-stg { grid-template-columns: 1fr; } .rr-rk-row { grid-template-columns:minmax(0,1fr) auto; } .rr-rk-row .bd { grid-column:1 / -1; grid-row:2; } }'
  ].join('\n');
  document.head.appendChild(st);

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
